"""
/api/experiments — Flask version
"""
import sqlite3
from flask import Blueprint, jsonify, request
from ..database import get_db, dict_row, dict_rows

bp = Blueprint("experiments", __name__, url_prefix="/api/experiments")

# Will be set from main.py after search router is created
_invalidate_index = None

def set_invalidate_index(fn):
    global _invalidate_index
    _invalidate_index = fn

def _invalidate():
    if _invalidate_index:
        _invalidate_index()

SPLIT_COLS = [
    "sno", "plan_id", "fac_id", "oper_id", "oper_nm", "eps_lot_gbn_cd", "work_cond_desc",
    "eqp_id", "recipe_id",
    *[f"user_def_val_{i}" for i in range(1, 26)],
    "note",
]


@bp.route("/", methods=["GET"])
def list_experiments():
    conn = get_db()
    iacpj_nm = request.args.get("iacpj_nm")
    base = """
        SELECT e.*, COALESCE(s.split_count, 0) AS split_count
        FROM experiments e
        LEFT JOIN (
          SELECT plan_id, COUNT(*) AS split_count
          FROM split_tables
          GROUP BY plan_id
        ) s ON e.plan_id = s.plan_id
    """
    if iacpj_nm:
        rows = conn.execute(base + " WHERE e.iacpj_nm = ?", (iacpj_nm,)).fetchall()
    else:
        rows = conn.execute(base).fetchall()
    return jsonify(dict_rows(rows))


@bp.route("/", methods=["POST"])
def create_experiment():
    conn = get_db()
    body = request.get_json(force=True)
    iacpj_nm = (body.get("iacpj_nm") or "").strip()
    if not iacpj_nm:
        return jsonify({"detail": "iacpj_nm은 필수입니다."}), 400

    cols = [
        "plan_id", "iacpj_nm", "team", "requester", "lot_code", "module",
        "wf_direction", "eval_process", "prev_eval", "cross_experiment",
        "eval_category", "eval_item", "lot_request", "reference", "volume_split",
        "assign_wf", "request_date",
    ]
    params = {}
    for col in cols:
        val = body.get(col)
        if isinstance(val, str):
            val = val.strip() or None
        params[col] = val
    params["iacpj_nm"] = iacpj_nm

    col_names = ", ".join(cols)
    placeholders = ", ".join(f":{c}" for c in cols)

    try:
        cursor = conn.execute(
            f"INSERT INTO experiments ({col_names}) VALUES ({placeholders})", params
        )
        conn.commit()
        created = conn.execute(
            "SELECT * FROM experiments WHERE id = ?", (cursor.lastrowid,)
        ).fetchone()
        _invalidate()
        return jsonify(dict_row(created)), 201
    except sqlite3.IntegrityError as e:
        if "FOREIGN KEY" in str(e):
            return jsonify({
                "detail": f"과제 '{iacpj_nm}'이(가) 존재하지 않습니다. 과제를 먼저 등록해주세요."
            }), 400
        return jsonify({"detail": f"실험 생성 중 오류 발생: {e}"}), 500


@bp.route("/<plan_id>/splits", methods=["POST"])
def create_splits(plan_id):
    conn = get_db()
    body = request.get_json(force=True)
    splits = body.get("splits")
    if not splits or not isinstance(splits, list) or len(splits) == 0:
        return jsonify({"detail": "splits 배열이 필요합니다."}), 400

    col_names = ", ".join(SPLIT_COLS)
    placeholders = ", ".join(f":{c}" for c in SPLIT_COLS)

    try:
        count = 0
        for row in splits:
            params = {c: row.get(c) or None for c in SPLIT_COLS}
            params["plan_id"] = plan_id
            conn.execute(
                f"INSERT INTO split_tables ({col_names}) VALUES ({placeholders})", params
            )
            count += 1
        conn.commit()
        return jsonify({"message": f"{count}건의 스플릿이 저장되었습니다.", "count": count}), 201
    except Exception as e:
        conn.rollback()
        return jsonify({"detail": f"스플릿 저장 중 오류 발생: {e}"}), 500


@bp.route("/<int:exp_id>/assign-lot", methods=["PATCH"])
def assign_lot(exp_id):
    conn = get_db()
    body = request.get_json(force=True)
    lot_id = (body.get("lot_id") or "").strip()
    if not lot_id:
        return jsonify({"detail": "lot_id는 필수입니다."}), 400

    try:
        new_plan_id = lot_id
        temp_plan_id = f"EXP-{exp_id}"

        result = conn.execute(
            "UPDATE experiments SET plan_id = ?, status = '실험 진행 중' WHERE id = ?",
            (new_plan_id, exp_id),
        )
        if result.rowcount == 0:
            return jsonify({"detail": "실험을 찾을 수 없습니다."}), 404

        conn.execute(
            "UPDATE split_tables SET plan_id = ? WHERE plan_id = ?",
            (new_plan_id, temp_plan_id),
        )
        conn.execute(
            "UPDATE line_lots SET status = 'assigned' WHERE lot_id = ?",
            (new_plan_id,),
        )
        conn.commit()

        updated = conn.execute(
            "SELECT * FROM experiments WHERE id = ?", (exp_id,)
        ).fetchone()
        _invalidate()
        return jsonify(dict_row(updated))
    except Exception as e:
        conn.rollback()
        return jsonify({"detail": "Lot 배정 중 오류 발생"}), 500


@bp.route("/<int:exp_id>/status", methods=["PATCH"])
def update_status(exp_id):
    conn = get_db()
    body = request.get_json(force=True)
    status = body.get("status")
    valid = ["Assign 전", "실험 진행 중", "실험 종료(결과 등록 전)", "실험 종료(결과 완료)"]
    if status not in valid:
        return jsonify({"detail": "유효하지 않은 상태입니다."}), 400

    result = conn.execute(
        "UPDATE experiments SET status = ? WHERE id = ?", (status, exp_id)
    )
    conn.commit()
    if result.rowcount == 0:
        return jsonify({"detail": "실험을 찾을 수 없습니다."}), 404
    return jsonify({"message": "상태가 변경되었습니다.", "status": status})


@bp.route("/<int:exp_id>/complete", methods=["PATCH"])
def toggle_complete(exp_id):
    conn = get_db()
    body = request.get_json(force=True)
    field = body.get("field")
    value = body.get("value")
    if field not in ("split_completed", "summary_completed"):
        return jsonify({"detail": "유효하지 않은 필드입니다."}), 400

    int_val = 1 if value else 0
    result = conn.execute(
        f"UPDATE experiments SET {field} = ? WHERE id = ?", (int_val, exp_id)
    )
    if result.rowcount == 0:
        return jsonify({"detail": "실험을 찾을 수 없습니다."}), 404

    # Fab이 In Fab이 아닐 때 Status 자동 재계산
    experiment = conn.execute(
        "SELECT * FROM experiments WHERE id = ?", (exp_id,)
    ).fetchone()
    if experiment and experiment["fab_status"] and experiment["fab_status"] != "In Fab":
        split_done = int_val if field == "split_completed" else experiment["split_completed"]
        summary_done = int_val if field == "summary_completed" else experiment["summary_completed"]
        new_status = "실험 종료(결과 완료)" if split_done and summary_done else "실험 종료(결과 등록 전)"
        conn.execute("UPDATE experiments SET status = ? WHERE id = ?", (new_status, exp_id))

    conn.commit()
    return jsonify({"message": "업데이트 완료", field: int_val})


@bp.route("/<int:exp_id>/summary", methods=["PATCH"])
def save_summary(exp_id):
    conn = get_db()
    body = request.get_json(force=True)
    summary_text = body.get("summary_text")

    result = conn.execute(
        "UPDATE experiments SET summary_text = ?, summary_completed = 1 WHERE id = ?",
        (summary_text, exp_id),
    )
    if result.rowcount == 0:
        return jsonify({"detail": "실험을 찾을 수 없습니다."}), 404

    experiment = conn.execute(
        "SELECT * FROM experiments WHERE id = ?", (exp_id,)
    ).fetchone()
    if experiment and experiment["fab_status"] and experiment["fab_status"] != "In Fab":
        new_status = (
            "실험 종료(결과 완료)" if experiment["split_completed"]
            else "실험 종료(결과 등록 전)"
        )
        conn.execute("UPDATE experiments SET status = ? WHERE id = ?", (new_status, exp_id))

    conn.commit()
    return jsonify({"message": "Summary 저장 완료", "summary_completed": 1})


@bp.route("/<int:exp_id>/fab-status", methods=["PATCH"])
def update_fab_status(exp_id):
    conn = get_db()
    body = request.get_json(force=True)
    fab_status = body.get("fab_status")
    valid_fab = ["In Fab", "Fab Out", "EPM", "WT"]
    if fab_status and fab_status not in valid_fab:
        return jsonify({"detail": "유효하지 않은 Fab 상태입니다."}), 400

    experiment = conn.execute(
        "SELECT * FROM experiments WHERE id = ?", (exp_id,)
    ).fetchone()
    if not experiment:
        return jsonify({"detail": "실험을 찾을 수 없습니다."}), 404

    if fab_status == "In Fab":
        new_status = "실험 진행 중"
    else:
        if experiment["split_completed"] and experiment["summary_completed"]:
            new_status = "실험 종료(결과 완료)"
        else:
            new_status = "실험 종료(결과 등록 전)"

    conn.execute(
        "UPDATE experiments SET fab_status = ?, status = ? WHERE id = ?",
        (fab_status, new_status, exp_id),
    )
    conn.commit()
    return jsonify({"message": "Fab 상태가 변경되었습니다.", "fab_status": fab_status, "status": new_status})


@bp.route("/<int:exp_id>", methods=["GET"])
def get_experiment(exp_id):
    conn = get_db()
    experiment = conn.execute(
        "SELECT * FROM experiments WHERE id = ?", (exp_id,)
    ).fetchone()
    if not experiment:
        return jsonify({"detail": "Experiment not found"}), 404

    splits = conn.execute(
        "SELECT * FROM split_tables WHERE plan_id = ?", (experiment["plan_id"],)
    ).fetchall()
    project = conn.execute(
        "SELECT * FROM projects WHERE iacpj_nm = ?", (experiment["iacpj_nm"],)
    ).fetchone()

    result = dict_row(experiment)
    result["splits"] = dict_rows(splits)
    result["project"] = dict_row(project)
    return jsonify(result)
