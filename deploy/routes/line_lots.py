"""
/api/line-lots — Flask version
"""
from flask import Blueprint, jsonify
from ..database import get_db, dict_rows

bp = Blueprint("line_lots", __name__, url_prefix="/api/line-lots")


@bp.route("/", methods=["GET"])
def available_lots():
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM line_lots WHERE status = 'available' ORDER BY estimated_arrival ASC"
    ).fetchall()
    return jsonify(dict_rows(rows))


@bp.route("/all", methods=["GET"])
def all_lots():
    conn = get_db()
    rows = conn.execute("SELECT * FROM line_lots ORDER BY lot_id").fetchall()
    return jsonify(dict_rows(rows))
