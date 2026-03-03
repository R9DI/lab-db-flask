"""
/api/analysis — Flask version. Data quality analysis endpoint.
"""
import re
import sqlite3
from flask import Blueprint, jsonify
from ..database import get_db, dict_rows

bp = Blueprint("analysis", __name__, url_prefix="/api/analysis")

PARTICLES = [
    "에서","으로","이나","이랑","에게","한테","까지","부터",
    "에","로","와","과","를","을","는","은","의","가","이","도","만","나","랑",
]

def _normalize_item(text):
    if not text:
        return ""
    s = text.lower().strip()
    s = re.sub(r"[\s\-_.,()[\]/:;·•*@#!?~`'\"]+", "", s)
    for p in PARTICLES:
        if s.endswith(p) and len(s) > len(p):
            s = s[: len(s) - len(p)]
            break
    return s


@bp.route("/", methods=["GET"])
def analysis():
    conn = get_db()

    # 1. Split Table 작성 불량 (0~1 row)
    split_poor = dict_rows(conn.execute("""
        SELECT e.iacpj_nm, e.plan_id, e.eval_item, e.eval_process, e.lot_code,
               COALESCE(s.cnt, 0) AS split_row_count
        FROM experiments e
        LEFT JOIN (
          SELECT plan_id, COUNT(*) AS cnt FROM split_tables GROUP BY plan_id
        ) s ON e.plan_id = s.plan_id
        WHERE COALESCE(s.cnt, 0) <= 1
        ORDER BY e.iacpj_nm, e.plan_id
    """).fetchall())

    # 2. 평가아이템 중복
    all_exp = dict_rows(conn.execute("""
        SELECT plan_id, iacpj_nm, eval_item, eval_process, lot_code
        FROM experiments
        WHERE eval_item IS NOT NULL AND TRIM(eval_item) != ''
    """).fetchall())

    eval_groups: dict[str, list] = {}
    for exp in all_exp:
        key = f"{exp['iacpj_nm']}|||{_normalize_item(exp['eval_item'])}"
        eval_groups.setdefault(key, []).append(exp)

    dup_eval_item = []
    for g_list in eval_groups.values():
        if len(g_list) > 1:
            unique_items = list(dict.fromkeys(i["eval_item"] for i in g_list))
            dup_eval_item.append({
                "iacpj_nm": g_list[0]["iacpj_nm"],
                "eval_item": " / ".join(unique_items),
                "eval_process": g_list[0]["eval_process"],
                "dup_count": len(g_list),
                "plan_ids": ", ".join(i["plan_id"] or "" for i in g_list),
                "lot_codes": ", ".join(i.get("lot_code") or "-" for i in g_list),
            })
    dup_eval_item.sort(key=lambda x: x["iacpj_nm"])

    # 3. Note 누락
    note_missing = dict_rows(conn.execute("""
        SELECT st.plan_id, st.oper_id,
               MAX(st.oper_nm) AS oper_nm,
               MAX(st.note) AS note,
               e.iacpj_nm, e.eval_item, e.lot_code
        FROM split_tables st
        JOIN experiments e ON st.plan_id = e.plan_id
        WHERE st.oper_id IS NOT NULL AND TRIM(st.oper_id) != ''
        GROUP BY st.plan_id, st.oper_id, e.iacpj_nm, e.eval_item, e.lot_code
        HAVING MAX(CASE WHEN st.note IS NOT NULL AND TRIM(st.note) != '' THEN 1 ELSE 0 END) = 0
        ORDER BY e.iacpj_nm, st.plan_id
    """).fetchall())

    # 4. 조건 누락
    cond_missing = dict_rows(conn.execute("""
        SELECT st.plan_id, st.oper_id,
               MAX(st.oper_nm) AS oper_nm,
               MAX(st.work_cond_desc) AS work_cond_desc,
               e.iacpj_nm, e.eval_item, e.lot_code
        FROM split_tables st
        JOIN experiments e ON st.plan_id = e.plan_id
        WHERE st.oper_id IS NOT NULL AND TRIM(st.oper_id) != ''
        GROUP BY st.plan_id, st.oper_id, e.iacpj_nm, e.eval_item, e.lot_code
        HAVING MAX(CASE WHEN st.work_cond_desc IS NOT NULL AND TRIM(st.work_cond_desc) != '' THEN 1 ELSE 0 END) = 0
        ORDER BY e.iacpj_nm, st.plan_id
    """).fetchall())

    # 5. 핵심 필드 누락
    field_missing = dict_rows(conn.execute("""
        SELECT plan_id, iacpj_nm, lot_code, eval_item, eval_process,
               CASE
                 WHEN (eval_item IS NULL OR TRIM(eval_item)='') AND (eval_process IS NULL OR TRIM(eval_process)='') THEN '평가아이템+평가공정'
                 WHEN eval_item IS NULL OR TRIM(eval_item)='' THEN '평가아이템'
                 ELSE '평가공정'
               END AS missing_fields
        FROM experiments
        WHERE (eval_item IS NULL OR TRIM(eval_item)='')
           OR (eval_process IS NULL OR TRIM(eval_process)='')
        ORDER BY iacpj_nm
    """).fetchall())

    # 6. lot_code 누락
    lot_missing = dict_rows(conn.execute("""
        SELECT plan_id, iacpj_nm, eval_item, eval_process
        FROM experiments
        WHERE lot_code IS NULL OR TRIM(lot_code) = ''
        ORDER BY iacpj_nm
    """).fetchall())

    # Summary
    summary = dict(conn.execute("""
        SELECT
          (SELECT COUNT(*) FROM projects) AS total_projects,
          (SELECT COUNT(*) FROM experiments) AS total_experiments,
          (SELECT COUNT(DISTINCT plan_id) FROM (
            SELECT plan_id FROM split_tables GROUP BY plan_id HAVING COUNT(*) >= 2
          )) AS experiments_with_split,
          (SELECT COUNT(*) FROM split_tables) AS total_split_rows
    """).fetchone())

    # Project summary
    all_projects = dict_rows(conn.execute("""
        SELECT p.iacpj_nm, COALESCE(e.cnt, 0) AS experiment_count
        FROM projects p
        LEFT JOIN (SELECT iacpj_nm, COUNT(*) AS cnt FROM experiments GROUP BY iacpj_nm) e
          ON p.iacpj_nm = e.iacpj_nm
        ORDER BY p.iacpj_nm
    """).fetchall())

    oper_rows = dict_rows(conn.execute("""
        SELECT ex.iacpj_nm, COUNT(DISTINCT st.plan_id || '|' || st.oper_id) AS oper_row_count
        FROM split_tables st
        JOIN experiments ex ON st.plan_id = ex.plan_id
        WHERE st.oper_id IS NOT NULL AND TRIM(st.oper_id) != ''
        GROUP BY ex.iacpj_nm
    """).fetchall())
    oper_map = {r["iacpj_nm"]: r["oper_row_count"] for r in oper_rows}

    def count_by(arr, key, name):
        return sum(1 for r in arr if r.get(key) == name)

    project_summary = []
    for p in all_projects:
        nm = p["iacpj_nm"]
        project_summary.append({
            "iacpj_nm": nm,
            "experiment_count": p["experiment_count"],
            "oper_row_count": oper_map.get(nm, 0),
            "split_poor": count_by(split_poor, "iacpj_nm", nm),
            "dup_eval": count_by(dup_eval_item, "iacpj_nm", nm),
            "note_missing": count_by(note_missing, "iacpj_nm", nm),
            "cond_missing": count_by(cond_missing, "iacpj_nm", nm),
            "field_missing": count_by(field_missing, "iacpj_nm", nm),
            "lot_missing": count_by(lot_missing, "iacpj_nm", nm),
        })

    return jsonify({
        "summary": summary,
        "projectSummary": project_summary,
        "issues": {
            "splitPoor": split_poor,
            "dupEvalItem": dup_eval_item,
            "noteMissing": note_missing,
            "condMissing": cond_missing,
            "fieldMissing": field_missing,
            "lotMissing": lot_missing,
        },
    })
