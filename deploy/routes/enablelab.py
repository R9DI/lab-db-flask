"""
Enable Lab API 프록시 — CORS 우회용
Base URL: http://rnd-ai-agent-ground-backend-basic-dev.api.aipp01.skhynix.com
"""
from flask import Blueprint, request, jsonify
import requests as http_requests

bp = Blueprint("enablelab", __name__)

ENABLE_LAB_BASE = "http://rnd-ai-agent-ground-backend-basic-dev.api.aipp01.skhynix.com"
TIMEOUT = 30  # seconds
HEADERS = {
    "Content-Type": "application/json",
    "Accept": "application/json",
}


def _proxy_post(path, body):
    """Enable Lab API POST 프록시 (디버깅 로그 포함)"""
    url = f"{ENABLE_LAB_BASE}{path}"
    print(f"[EnableLab] POST {url}")
    print(f"[EnableLab] Body: {body}")
    try:
        resp = http_requests.post(url, json=body, headers=HEADERS, timeout=TIMEOUT)
        print(f"[EnableLab] Status: {resp.status_code}")
        print(f"[EnableLab] Response: {resp.text[:500]}")
        try:
            return jsonify(resp.json()), resp.status_code
        except Exception:
            return jsonify({"success": False, "error": "Invalid JSON response", "raw": resp.text[:500]}), resp.status_code
    except http_requests.exceptions.RequestException as e:
        print(f"[EnableLab] Error: {e}")
        return jsonify({"success": False, "error": str(e)}), 502


@bp.route("/api/enablelab/tools/names", methods=["GET"])
def tool_names():
    """GET /api/tools/names → 전체 툴 이름 목록"""
    personal_id = request.args.get("personal_id", "")
    url = f"{ENABLE_LAB_BASE}/api/tools/names"
    print(f"[EnableLab] GET {url} personal_id={personal_id}")
    try:
        resp = http_requests.get(url, json={"personal_id": personal_id}, headers=HEADERS, timeout=TIMEOUT)
        print(f"[EnableLab] Status: {resp.status_code}, Response: {resp.text[:500]}")
        try:
            return jsonify(resp.json()), resp.status_code
        except Exception:
            return jsonify({"success": False, "error": "Invalid JSON response", "raw": resp.text[:500]}), resp.status_code
    except http_requests.exceptions.RequestException as e:
        print(f"[EnableLab] Error: {e}")
        return jsonify({"success": False, "error": str(e)}), 502


@bp.route("/api/enablelab/tools/list", methods=["POST"])
def tool_list():
    """POST /api/tools/list → 툴 목록 조회"""
    body = request.get_json(force=True, silent=True) or {}
    return _proxy_post("/api/tools/list", body)


@bp.route("/api/enablelab/tools/plan", methods=["POST"])
def tool_plan():
    """POST /api/tools/plan → 툴 실행"""
    body = request.get_json(force=True, silent=True) or {}
    return _proxy_post("/api/tools/plan", body)
