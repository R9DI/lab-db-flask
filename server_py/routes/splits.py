"""
/api/splits — Flask version
"""
import sqlite3
from flask import Blueprint, jsonify, request
from ..database import get_db, dict_rows

bp = Blueprint("splits", __name__, url_prefix="/api/splits")

# Will be set from main.py
_invalidate_index = None

def set_invalidate_index(fn):
    global _invalidate_index
    _invalidate_index = fn

SPLIT_COLS = [
    "sno", "plan_id", "fac_id", "oper_id", "oper_nm", "eps_lot_gbn_cd", "work_cond_desc",
    "eqp_id", "recipe_id",
    *[f"user_def_val_{i}" for i in range(1, 26)],
    "note",
]


@bp.route("/", methods=["GET"])
def list_splits():
    conn = get_db()
    plan_id = request.args.get("plan_id")
    if plan_id:
        rows = conn.execute(
            "SELECT * FROM split_tables WHERE plan_id = ?", (plan_id,)
        ).fetchall()
    else:
        rows = conn.execute("SELECT * FROM split_tables").fetchall()
    return jsonify(dict_rows(rows))


@bp.route("/<plan_id>", methods=["PUT"])
def replace_splits(plan_id):
    conn = get_db()
    body = request.get_json(force=True)
    splits = body.get("splits")
    if not splits or not isinstance(splits, list):
        return jsonify({"detail": "splits array required"}), 400

    col_names = ", ".join(SPLIT_COLS)
    placeholders = ", ".join(f":{c}" for c in SPLIT_COLS)

    try:
        conn.execute("DELETE FROM split_tables WHERE plan_id = ?", (plan_id,))
        for row in splits:
            params = {c: row.get(c) or None for c in SPLIT_COLS}
            params["plan_id"] = plan_id
            conn.execute(
                f"INSERT INTO split_tables ({col_names}) VALUES ({placeholders})", params
            )
        conn.commit()

        if _invalidate_index:
            _invalidate_index()

        return jsonify({"count": len(splits)})
    except Exception as e:
        conn.rollback()
        return jsonify({"detail": f"Split 저장 중 오류 발생: {e}"}), 500
