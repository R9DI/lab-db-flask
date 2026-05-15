"""
Enable Lab API 프록시 — CORS 우회용
Base URL: http://rnd-ai-agent-ground-backend-basic-dev.api.aipp01.skhynix.com
"""
from flask import Blueprint, request, jsonify
import requests

bp = Blueprint("enablelab", __name__)

ENABLE_LAB_BASE = "http://rnd-ai-agent-ground-backend-basic-dev.api.aipp01.skhynix.com"
TIMEOUT = 30  # seconds


@bp.route("/api/enablelab/tools/names", methods=["GET"])
def tool_names():
    """GET /api/tools/names → 전체 툴 이름 목록"""
    personal_id = request.args.get("personal_id", "")
    try:
        resp = requests.get(
            f"{ENABLE_LAB_BASE}/api/tools/names",
            json={"personal_id": personal_id},
            timeout=TIMEOUT,
        )
        return jsonify(resp.json()), resp.status_code
    except requests.exceptions.RequestException as e:
        return jsonify({"success": False, "error": str(e)}), 502


@bp.route("/api/enablelab/tools/list", methods=["POST"])
def tool_list():
    """POST /api/tools/list → 툴 목록 조회"""
    body = request.get_json(force=True, silent=True) or {}
    try:
        resp = requests.post(
            f"{ENABLE_LAB_BASE}/api/tools/list",
            json=body,
            timeout=TIMEOUT,
        )
        return jsonify(resp.json()), resp.status_code
    except requests.exceptions.RequestException as e:
        return jsonify({"success": False, "error": str(e)}), 502


@bp.route("/api/enablelab/tools/plan", methods=["POST"])
def tool_plan():
    """POST /api/tools/plan → 툴 실행"""
    body = request.get_json(force=True, silent=True) or {}
    try:
        resp = requests.post(
            f"{ENABLE_LAB_BASE}/api/tools/plan",
            json=body,
            timeout=TIMEOUT,
        )
        return jsonify(resp.json()), resp.status_code
    except requests.exceptions.RequestException as e:
        return jsonify({"success": False, "error": str(e)}), 502
