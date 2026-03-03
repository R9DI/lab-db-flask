"""
/api/llm-search — Flask version. LLM-assisted search with TF-IDF pre-filtering.
"""
import re
import json
import os
import sqlite3
import requests as http_requests
from flask import Blueprint, jsonify, request
from database import get_db, dict_row, dict_rows
from search_engine import TfIdfSearchEngine

bp = Blueprint("llm_search", __name__, url_prefix="/api/llm-search")

engine = TfIdfSearchEngine()
_indexed = False

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "..", "llm-config.json")

def _load_config():
    try:
        if os.path.exists(CONFIG_PATH):
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception:
        pass
    return None

def _save_config(config):
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2, ensure_ascii=False)

def _get_config():
    saved = _load_config()
    if saved:
        return saved
    base_url = os.environ.get("LLM_BASE_URL")
    if base_url:
        return {
            "baseUrl": base_url,
            "apiKey": os.environ.get("LLM_API_KEY", ""),
            "model": os.environ.get("LLM_MODEL", "gpt-120b"),
        }
    return None

def invalidate_index():
    global _indexed
    _indexed = False

def _ensure_index(conn):
    global _indexed
    rows = conn.execute("""
        SELECT e.*,
          p.project_purpose, p.iacpj_ta_goa, p.iacpj_cur_stt,
          p.iacpj_tech_n, p.iacpj_mod_n as project_module,
          p.iacpj_tgt_n, p.iacpj_level,
          p.ia_tgt_htr_n, p.iacpj_nud_n,
          p.iacpj_itf_uno, p.iacpj_bgn_dy, p.iacpj_ch_n, p.ia_ta_grd_n,
          p.iacpj_core_tec, p.ia_ch_or_n
        FROM experiments e
        LEFT JOIN projects p ON e.iacpj_nm = p.iacpj_nm
    """).fetchall()
    docs = []
    for exp in rows:
        d = dict(exp)
        splits = conn.execute(
            "SELECT fac_id,oper_id,oper_nm,eps_lot_gbn_cd,work_cond_desc,eqp_id,recipe_id,note FROM split_tables WHERE plan_id=?",
            (d.get("plan_id"),),
        ).fetchall()
        d["_splits"] = [dict(s) for s in splits]
        docs.append(d)
    engine.build_index(docs)
    _indexed = True

def _exp_to_context(result, idx, total):
    exp = result["experiment"]
    proj = result.get("project")
    splits = result.get("splits", [])
    text = (
        f"[후보 {idx+1}/{total}] {exp.get('eval_item','N/A')}\n"
        f"  - 과제: {exp.get('iacpj_nm','N/A')}\n"
        f"  - 모듈: {exp.get('module','N/A')}\n"
        f"  - Plan ID: {exp.get('plan_id','미배정')}\n"
        f"  - 평가공정: {exp.get('eval_process','N/A')}\n"
        f"  - 평가분류: {exp.get('eval_category','N/A')}\n"
        f"  - 요청자: {exp.get('requester','N/A')} / 팀: {exp.get('team','N/A')}\n"
        f"  - LOT: {exp.get('lot_code','N/A')}\n"
        f"  - 상태: {exp.get('status','N/A')}"
    )
    if proj:
        text += (
            f"\n  - 과제 목적: {proj.get('project_purpose','N/A')}"
            f"\n  - 과제 목표: {proj.get('iacpj_ta_goa','N/A')}"
            f"\n  - 현재 상태: {proj.get('iacpj_cur_stt','N/A')}"
            f"\n  - 대상 기술: {proj.get('iacpj_tech_n','N/A')}"
            f"\n  - 분류: {proj.get('iacpj_tgt_n','N/A')}"
        )
    if splits:
        text += f"\n  - Split 조건 ({len(splits)}건):"
        for s in splits[:5]:
            text += f"\n    * {s.get('oper_nm') or s.get('oper_id','공정')}: {s.get('eps_lot_gbn_cd','base')} | {s.get('work_cond_desc','-')} | 장비: {s.get('eqp_id','-')}"
        if len(splits) > 5:
            text += f"\n    ... 외 {len(splits)-5}건"
    return text

SYSTEM_PROMPT = """당신은 반도체 실험 데이터베이스 탐색 도우미입니다.
목표: 대화를 통해 후보 실험을 점차 1개로 좁혀나가는 것입니다.

응답 규칙:
1. 현재 후보 실험들의 핵심 차이점을 구체적으로 설명하세요.
2. 범위를 좁힐 수 있는 질문을 1~2개 제시하세요.
3. 사용자의 답변을 반영해 어떤 실험이 더 적합한지 안내하세요.
4. 후보가 1개로 좁혀지면 해당 실험의 상세 정보를 안내하고, 이 실험을 기반으로 신규 실험을 구성할지 물어보세요.
5. 후보가 많을 때는 가장 구분력 있는 기준으로 그룹핑하여 설명하세요.

금지사항:
- 데이터에 없는 내용을 추측하거나 만들어내지 마세요.
- 영어 사용 금지 (한국어 전용).
- 단순 목록 나열 금지."""

def _call_llm(config, system_prompt, user_message, history=None):
    """Synchronous LLM call using requests library."""
    messages = [{"role": "system", "content": system_prompt}]
    if history:
        messages.extend(history)
    messages.append({"role": "user", "content": user_message})
    headers = {"Content-Type": "application/json"}
    if config.get("apiKey"):
        headers["Authorization"] = f"Bearer {config['apiKey']}"

    resp = http_requests.post(
        f"{config['baseUrl']}/chat/completions",
        headers=headers,
        json={"model": config["model"], "messages": messages, "temperature": 0.3, "max_tokens": 1500},
        timeout=60,
    )
    if resp.status_code != 200:
        raise Exception(f"LLM API error ({resp.status_code}): {resp.text}")
    data = resp.json()
    return data.get("choices", [{}])[0].get("message", {}).get("content", "응답을 생성하지 못했습니다.")

def _parse_query(raw):
    qt = [m.group(1).strip() for m in re.finditer(r'"([^"]+)"', raw) if m.group(1).strip()]
    nq = re.sub(r'"[^"]*"'," ",raw)
    nq = re.sub(r"\s+"," ",nq).strip()
    return qt, nq

# ── Config endpoints ──
@bp.route("/config", methods=["GET"])
def get_config_endpoint():
    c = _get_config()
    if not c:
        return jsonify({"configured": False})
    hint = ""
    if c.get("apiKey"):
        k = c["apiKey"]
        hint = k[:4] + "****" + k[-4:] if len(k) >= 8 else "****"
    return jsonify({"configured": True, "baseUrl": c["baseUrl"], "model": c["model"], "apiKeyHint": hint})

@bp.route("/config", methods=["POST"])
def save_config_endpoint():
    body = request.get_json(force=True)
    base_url = body.get("baseUrl")
    model = body.get("model")
    if not base_url or not model:
        return jsonify({"detail": "baseUrl과 model은 필수입니다."}), 400
    c = {"baseUrl": base_url.rstrip("/"), "apiKey": body.get("apiKey", ""), "model": model}
    _save_config(c)
    hint = ""
    if c["apiKey"]:
        k = c["apiKey"]
        hint = k[:4]+"****"+k[-4:] if len(k) >= 8 else "****"
    return jsonify({"message": "LLM 설정이 저장되었습니다.", "configured": True, "baseUrl": c["baseUrl"], "model": c["model"], "apiKeyHint": hint})

@bp.route("/config", methods=["DELETE"])
def delete_config_endpoint():
    try:
        if os.path.exists(CONFIG_PATH): os.remove(CONFIG_PATH)
    except Exception:
        pass
    return jsonify({"message": "LLM 설정이 삭제되었습니다.", "configured": False})

@bp.route("/config/test", methods=["POST"])
def test_config():
    body = request.get_json(force=True)
    base_url = body.get("baseUrl")
    model = body.get("model")
    if not base_url or not model:
        return jsonify({"detail": "baseUrl과 model은 필수입니다."}), 400
    try:
        tc = {"baseUrl": base_url.rstrip("/"), "apiKey": body.get("apiKey", ""), "model": model}
        answer = _call_llm(tc, "You are a test assistant.", "Say 'OK' in Korean.", [])
        return jsonify({"success": True, "response": answer})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

# ── Main search ──
@bp.route("/", methods=["POST"])
def llm_search_endpoint():
    conn = get_db()
    body = request.get_json(force=True)
    query = body.get("query")
    history = body.get("conversationHistory", [])
    candidate_ids = body.get("candidateIds")
    if not query:
        return jsonify({"detail": "query is required"}), 400

    global _indexed
    if not _indexed:
        _ensure_index(conn)

    qt, nq = _parse_query(query)
    candidates = []

    if candidate_ids and len(candidate_ids) > 0:
        id_set = set(candidate_ids)
        all_r = engine.search(query, len(engine.documents))
        filtered = [r for r in all_r if r["document"].get("id") in id_set]
        if filtered:
            candidates = filtered[:15]
        else:
            candidates = [{"score": 0.5, "document": d} for d in engine.documents if d.get("id") in id_set]
    elif qt:
        exact = [d for d in engine.documents if all(p.lower() in engine._doc_to_text(d).lower() for p in qt)]
        if nq:
            tr = engine.search(nq, len(engine.documents))
            sm = {r["document"].get("id"): r["score"] for r in tr}
            candidates = sorted([{"score": sm.get(d.get("id"), 0), "document": d} for d in exact], key=lambda x: x["score"], reverse=True)[:15]
        else:
            candidates = [{"score": 1, "document": d} for d in exact[:15]]
    else:
        pr = engine.search(query, 15)
        tokens = engine.tokenize(query)
        af = [r for r in pr if all(t in engine._doc_to_text(r["document"]).lower() for t in tokens)]
        candidates = af if af else pr

    enriched = []
    for r in candidates:
        doc = r["document"]
        splits = conn.execute("SELECT * FROM split_tables WHERE plan_id=?", (doc.get("plan_id"),)).fetchall()
        proj = conn.execute("SELECT * FROM projects WHERE iacpj_nm=?", (doc.get("iacpj_nm"),)).fetchone()
        enriched.append({"score": round(r["score"]*1000)/1000, "experiment": doc, "project": dict_row(proj), "splits": dict_rows(splits)})

    config = _get_config()
    if not config:
        return jsonify({
            "answer": f"LLM이 설정되지 않았습니다. 상단에서 모델을 등록해주세요.\n\n키워드 검색 결과: \"{query}\"에 대해 {len(enriched)}건의 실험이 검색되었습니다.",
            "results": enriched, "resultCount": len(enriched), "llmError": True,
        })
    try:
        total = len(enriched)
        ctx = "\n\n".join(_exp_to_context(r, i, total) for i, r in enumerate(enriched)) if total else "관련 실험 데이터를 찾지 못했습니다."
        narrowing = candidate_ids and len(candidate_ids) > 0
        if narrowing:
            um = f"[현재 후보 실험 목록 ({total}건)]\n{ctx}\n\n[사용자 메시지]\n{query}\n\n후보 실험들의 차이점을 분석하고, 사용자의 답변을 반영하여 어떤 실험이 더 적합한지 안내하며 후보를 좁혀주세요."
        else:
            um = f"[검색된 후보 실험 목록 ({total}건)]\n{ctx}\n\n[사용자 질문]\n{query}\n\n위 후보 실험들의 핵심 차이점을 설명하고, 범위를 좁힐 수 있는 질문을 제시해주세요."
        llm_resp = _call_llm(config, SYSTEM_PROMPT, um, history)
        return jsonify({"answer": llm_resp, "results": enriched, "resultCount": len(enriched)})
    except Exception as e:
        return jsonify({
            "answer": f"LLM 호출에 실패하여 키워드 검색 결과만 표시합니다.\n({e})\n\n검색어 \"{query}\"에 대해 {len(enriched)}건의 실험이 검색되었습니다.",
            "results": enriched, "resultCount": len(enriched), "llmError": True,
        })
