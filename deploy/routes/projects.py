"""
/api/projects — Flask version
"""
import sqlite3
from flask import Blueprint, jsonify, request, abort
from ..database import get_db, dict_row, dict_rows

bp = Blueprint("projects", __name__, url_prefix="/api/projects")

PROJECT_COLS = [
    "iacpj_nm", "iacpj_tgt_n", "iacpj_level", "iacpj_tech_n",
    "ia_tgt_htr_n", "iacpj_nud_n", "iacpj_mod_n", "iacpj_itf_uno", "iacpj_bgn_dy",
    "iacpj_ch_n", "ia_ta_grd_n", "project_purpose", "iacpj_ta_goa", "iacpj_cur_stt",
    "iacpj_ch_i", "ia_ch_or_i", "ia_ch_or_n", "ia_ch_or_path", "iacpj_core_tec",
    "iacpj_end_dy", "iacpj_reg_dy",
]


@bp.route("/", methods=["GET"])
def list_projects():
    conn = get_db()
    rows = conn.execute("""
        SELECT p.*,
          COALESCE(e.experiment_count, 0) AS experiment_count,
          COALESCE(s.split_count, 0) AS split_count
        FROM projects p
        LEFT JOIN (
          SELECT iacpj_nm, COUNT(*) AS experiment_count
          FROM experiments
          GROUP BY iacpj_nm
        ) e ON p.iacpj_nm = e.iacpj_nm
        LEFT JOIN (
          SELECT ex.iacpj_nm, COUNT(*) AS split_count
          FROM (
            SELECT st.plan_id
            FROM split_tables st
            GROUP BY st.plan_id
            HAVING COUNT(*) >= 2
          ) valid_splits
          JOIN experiments ex ON valid_splits.plan_id = ex.plan_id
          GROUP BY ex.iacpj_nm
        ) s ON p.iacpj_nm = s.iacpj_nm
    """).fetchall()
    return jsonify(dict_rows(rows))


@bp.route("/<int:project_id>", methods=["GET"])
def get_project(project_id):
    conn = get_db()
    project = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    if not project:
        return jsonify({"detail": "Project not found"}), 404
    experiments = conn.execute(
        "SELECT * FROM experiments WHERE iacpj_nm = ?", (project["iacpj_nm"],)
    ).fetchall()
    result = dict_row(project)
    result["experiments"] = dict_rows(experiments)
    return jsonify(result)


@bp.route("/", methods=["POST"])
def create_project():
    conn = get_db()
    body = request.get_json(force=True)
    iacpj_nm = (body.get("iacpj_nm") or "").strip()
    if not iacpj_nm:
        return jsonify({"detail": "iacpj_nm은 필수입니다."}), 400

    params = {col: (body.get(col) or "").strip() or None for col in PROJECT_COLS}
    params["iacpj_nm"] = iacpj_nm

    placeholders = ", ".join(f":{col}" for col in PROJECT_COLS)
    col_names = ", ".join(PROJECT_COLS)

    try:
        cursor = conn.execute(
            f"INSERT INTO projects ({col_names}) VALUES ({placeholders})", params
        )
        conn.commit()
        created = conn.execute(
            "SELECT * FROM projects WHERE id = ?", (cursor.lastrowid,)
        ).fetchone()
        return jsonify(dict_row(created)), 201
    except sqlite3.IntegrityError as e:
        if "UNIQUE" in str(e):
            return jsonify({"detail": "이미 동일한 과제명이 존재합니다."}), 409
        return jsonify({"detail": "과제 생성 중 오류 발생"}), 500


@bp.route("/<int:project_id>", methods=["DELETE"])
def delete_project(project_id):
    conn = get_db()
    project = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    if not project:
        return jsonify({"detail": "Project not found"}), 404

    try:
        experiments = conn.execute(
            "SELECT plan_id FROM experiments WHERE iacpj_nm = ?", (project["iacpj_nm"],)
        ).fetchall()
        for exp in experiments:
            conn.execute("DELETE FROM split_tables WHERE plan_id = ?", (exp["plan_id"],))
        exp_result = conn.execute(
            "DELETE FROM experiments WHERE iacpj_nm = ?", (project["iacpj_nm"],)
        )
        conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
        conn.commit()
        return jsonify({
            "message": "과제 삭제 완료",
            "deleted": {
                "project": project["iacpj_nm"],
                "experiments": exp_result.rowcount,
                "splits": len(experiments),
            },
        })
    except Exception as e:
        conn.rollback()
        return jsonify({"detail": "과제 삭제 중 오류 발생"}), 500
