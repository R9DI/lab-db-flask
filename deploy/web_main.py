"""
회사 서버용 web_main.py 예시
─────────────────────────────
이 파일을 회사 서버의 web_main.py에 복붙해서 사용하세요.

필요한 파일 배치:
  회사 웹앱 폴더/
  ├── static/          ← client/dist/static/ 안의 빌드 결과물 (JS, CSS, index.html 등)
  ├── templates/       ← (사용 안 해도 됨, static에서 직접 서빙)
  ├── web_main.py      ← 이 파일 내용 복붙
  ├── database.py      ← server_py/database.py 복사 (import 경로 수정됨)
  ├── search_engine.py ← server_py/search_engine.py 복사
  ├── routes/          ← server_py/routes/ 폴더 통째로 복사 (import 경로 수정 필요)
  ├── requirements.txt
  └── uploads/         ← 업로드 폴더 (없으면 생성)
"""

import os
from flask import Flask, send_from_directory
from flask_cors import CORS

# ── 회사 기본 설정 (기존 유지) ──
os.environ['NLS_LANG'] = 'AMERICAN_AMERICA.KO16MSWIN949'

# ── 우리 프로젝트 import (절대 import) ──
from database import init_db, seed_data, close_db
from routes import projects, experiments, splits, search, upload, llm_search, line_lots, analysis

# ── Flask App ──
app = Flask(__name__, static_folder='static')
app.config['SECRET_KEY'] = os.urandom(12)
app.config['TEMPLATES_AUTO_RELOAD'] = True
CORS(app, supports_credentials=True)

# ── DB 설정 ──
app.teardown_appcontext(close_db)
init_db()
seed_data()

# ── Wire up index invalidation callbacks ──
experiments.set_invalidate_index(search.invalidate_index)
splits.set_invalidate_index(search.invalidate_index)
upload.set_invalidate_fns(search.invalidate_index, llm_search.invalidate_index)

# ── API 블루프린트 등록 ──
app.register_blueprint(projects.bp)
app.register_blueprint(experiments.bp)
app.register_blueprint(splits.bp)
app.register_blueprint(search.bp)
app.register_blueprint(upload.bp)
app.register_blueprint(llm_search.bp)
app.register_blueprint(line_lots.bp)
app.register_blueprint(analysis.bp)


# ── 프론트엔드 (React 빌드 결과물 서빙) ──
@app.route('/')
def index():
    return send_from_directory('static', 'index.html')


# React Router 사용 시: 모든 비-API 경로를 index.html로 보냄
@app.route('/<path:path>')
def catch_all(path):
    # static 파일이면 그대로 서빙
    static_file = os.path.join(app.static_folder, path)
    if os.path.isfile(static_file):
        return send_from_directory('static', path)
    # 아니면 React Router가 처리하도록 index.html 반환
    return send_from_directory('static', 'index.html')


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3001, debug=True)
