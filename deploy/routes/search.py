"""
/api/search — Flask version
TF-IDF search with suggestions and summary generation.
"""
import re
import sqlite3
from flask import Blueprint, jsonify, request
from ..database import get_db, dict_row, dict_rows
from ..search_engine import TfIdfSearchEngine

bp = Blueprint("search", __name__, url_prefix="/api/search")

engine = TfIdfSearchEngine()
_indexed = False


def invalidate_index():
    global _indexed
    _indexed = False


def _ensure_index(conn: sqlite3.Connection):
    global _indexed
    experiments = conn.execute("""
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
    for exp in experiments:
        d = dict(exp)
        splits = conn.execute(
            "SELECT fac_id, oper_id, oper_nm, eps_lot_gbn_cd, work_cond_desc, eqp_id, recipe_id, note "
            "FROM split_tables WHERE plan_id = ?",
            (d.get("plan_id"),),
        ).fetchall()
        d["_splits"] = [dict(s) for s in splits]
        docs.append(d)

    engine.build_index(docs)
    _indexed = True


# ── Suggestion extraction ──

def _extract_suggestions(results: list[dict], original_query: str) -> list[dict]:
    if not results:
        return []

    N = len(results)
    query_tokens = set(engine.tokenize(original_query))

    GRAMMAR_STOPS = {
        "향", "및", "위한", "통해", "기반", "위해", "후", "시", "내",
        "의", "을", "를", "이", "가", "에", "는", "은", "로", "으로",
        "과", "와", "도", "에서", "까지", "부터", "대한", "된", "한", "할",
        "x", "o",
    }
    stop_words = set(GRAMMAR_STOPS)
    if engine.df_map and engine.doc_count > 0:
        threshold = engine.doc_count * 0.4
        for token, df in engine.df_map.items():
            if df >= threshold:
                stop_words.add(token)

    # Pre-compute full doc texts
    full_doc_texts = []
    for r in results:
        exp = r.get("experiment") or r.get("document")
        full_doc_texts.append(engine._doc_to_text(exp).lower())

    # Keyword map
    keyword_map: dict[str, dict] = {}
    for idx, r in enumerate(results):
        exp = r.get("experiment") or r.get("document")
        proj = r.get("project")
        splits = r.get("splits", [])

        field_texts = [
            ("평가아이템", exp.get("eval_item")),
            ("모듈", exp.get("module")),
            ("평가공정", exp.get("eval_process")),
            ("평가분류", exp.get("eval_category")),
            ("과제", exp.get("iacpj_nm")),
            ("Plan ID", exp.get("plan_id")),
            ("LOT", exp.get("lot_code")),
            ("요청자", exp.get("requester")),
            ("팀", exp.get("team")),
            ("WF방향", exp.get("wf_direction")),
            ("이전평가", exp.get("prev_eval")),
            ("참고", exp.get("reference")),
        ]
        if proj:
            field_texts += [
                ("Tech", proj.get("iacpj_tech_n")),
                ("목표", proj.get("iacpj_ta_goa")),
                ("현황", proj.get("iacpj_cur_stt")),
                ("목적", proj.get("project_purpose")),
                ("개발분류", proj.get("iacpj_tgt_n")),
                ("핵심기술", proj.get("iacpj_core_tec")),
                ("NUDD", proj.get("iacpj_nud_n")),
            ]
        for s in splits:
            if s.get("fac_id"): field_texts.append(("FAB", s["fac_id"]))
            if s.get("oper_id"): field_texts.append(("OPER_ID", s["oper_id"]))
            if s.get("oper_nm"): field_texts.append(("공정", s["oper_nm"]))
            if s.get("work_cond_desc"): field_texts.append(("조건", s["work_cond_desc"]))
            if s.get("eqp_id"): field_texts.append(("장비", s["eqp_id"]))
            if s.get("recipe_id"): field_texts.append(("Recipe", s["recipe_id"]))
            if s.get("note"): field_texts.append(("Note", s["note"]))

        for field, text in field_texts:
            if not text:
                continue
            tokens = engine.tokenize(text)
            for token in tokens:
                if token in query_tokens:
                    continue
                if token in stop_words:
                    continue
                if len(token) < 2:
                    continue
                if re.match(r"^\d+$", token):
                    continue
                if token not in keyword_map:
                    keyword_map[token] = {"fields": set()}
                keyword_map[token]["fields"].add(field)

    # Validate & score
    candidates = []
    for token, info in keyword_map.items():
        actual_hit = sum(1 for text in full_doc_texts if token in text)
        if actual_hit >= N:
            continue
        if actual_hit == 0:
            continue
        if N >= 6 and actual_hit <= 1:
            continue
        ratio = actual_hit / N
        disc_score = 1 - abs(ratio - 0.5) * 2
        small_bonus = 0.3 if N <= 5 and actual_hit == 1 else 0
        candidates.append({
            "keyword": token,
            "hitCount": actual_hit,
            "totalResults": N,
            "fields": sorted(info["fields"]),
            "discriminationScore": disc_score + small_bonus,
        })

    # Deduplicate
    candidates.sort(key=lambda c: c["discriminationScore"], reverse=True)
    seen = set()
    grouped = []
    for c in candidates:
        sig = f"{c['hitCount']}:{','.join(c['fields'])}"
        if sig in seen:
            continue
        seen.add(sig)
        grouped.append(c)

    # Top 6 diverse
    final = []
    used_combos: list[str] = []
    for c in grouped:
        if len(final) >= 6:
            break
        fk = "+".join(c["fields"])
        if used_combos.count(fk) >= 2:
            continue
        used_combos.append(fk)
        final.append({
            "keyword": c["keyword"],
            "context": f"{c['hitCount']}/{c['totalResults']}건 매칭 · {', '.join(c['fields'][:2])}",
        })
    return final


def _generate_summary(results: list[dict], query: str) -> str:
    if not results:
        return f'"{query}"에 대한 검색 결과가 없습니다. 다른 키워드로 시도해보세요.'

    project_groups: dict[str, dict] = {}
    for r in results:
        p_name = (r.get("project") or {}).get("iacpj_nm") or (r.get("experiment") or {}).get("iacpj_nm", "")
        if p_name not in project_groups:
            project_groups[p_name] = {"project": r.get("project"), "experiments": [], "topScore": r["score"]}
        project_groups[p_name]["experiments"].append(r)

    group_count = len(project_groups)
    lines = [f'"{query}" 검색 결과, {group_count}개 과제에서 총 {len(results)}건의 실험을 찾았습니다.']

    for name, group in project_groups.items():
        module = ""
        if group["project"]:
            module = group["project"].get("iacpj_mod_n") or ""
        if not module and group["experiments"]:
            module = (group["experiments"][0].get("experiment") or {}).get("module", "")
        lines.append(f"\n[{module}] {name} - {len(group['experiments'])}건")
        for exp in group["experiments"][:3]:
            e = exp["experiment"]
            lines.append(f"  - {e.get('eval_item', '')} ({e.get('plan_id', '')})")
        if len(group["experiments"]) > 3:
            lines.append(f"  ... 외 {len(group['experiments']) - 3}건")

    return "\n".join(lines)


def _parse_query(raw_query: str):
    quoted_terms = []
    for m in re.finditer(r'"([^"]+)"', raw_query):
        term = m.group(1).strip()
        if term:
            quoted_terms.append(term)
    normal_query = re.sub(r'"[^"]*"', " ", raw_query)
    normal_query = re.sub(r"\s+", " ", normal_query).strip()
    return quoted_terms, normal_query


@bp.route("/", methods=["POST"])
def search_endpoint():
    conn = get_db()
    body = request.get_json(force=True)
    query = body.get("query")
    top_k = body.get("topK", 10)
    if not query:
        return jsonify({"detail": "query is required"}), 400

    global _indexed
    if not _indexed:
        _ensure_index(conn)

    quoted_terms, normal_query = _parse_query(query)

    if quoted_terms:
        exact_matched = [
            doc for doc in engine.documents
            if all(phrase.lower() in engine._doc_to_text(doc).lower() for phrase in quoted_terms)
        ]
        if normal_query:
            tfidf_results = engine.search(normal_query, len(engine.documents))
            score_lookup = {}
            for r in tfidf_results:
                score_lookup[r["document"].get("id")] = r["score"]
            candidates = []
            for doc in exact_matched:
                s = score_lookup.get(doc.get("id"), 0)
                candidates.append({"score": s, "document": doc})
            candidates.sort(key=lambda x: x["score"], reverse=True)
            candidates = candidates[:top_k]
        else:
            candidates = [{"score": 1, "document": doc} for doc in exact_matched[:top_k]]
    else:
        tfidf_results = engine.search(query, top_k)
        query_tokens = engine.tokenize(query)
        and_filtered = [
            r for r in tfidf_results
            if all(t in engine._doc_to_text(r["document"]).lower() for t in query_tokens)
        ]
        candidates = and_filtered if and_filtered else tfidf_results

    enriched = []
    for r in candidates:
        doc = r["document"]
        splits = conn.execute(
            "SELECT * FROM split_tables WHERE plan_id = ?", (doc.get("plan_id"),)
        ).fetchall()
        project = conn.execute(
            "SELECT * FROM projects WHERE iacpj_nm = ?", (doc.get("iacpj_nm"),)
        ).fetchone()
        enriched.append({
            "score": round(r["score"] * 1000) / 1000,
            "experiment": doc,
            "project": dict_row(project),
            "splits": dict_rows(splits),
        })

    summary = _generate_summary(enriched, query)
    suggestions = _extract_suggestions(enriched, query)

    return jsonify({"summary": summary, "suggestions": suggestions, "results": enriched})


@bp.route("/reindex", methods=["POST"])
def reindex():
    conn = get_db()
    global _indexed
    _indexed = False
    _ensure_index(conn)
    return jsonify({"message": "Reindexed", "documentCount": len(engine.documents)})
