"""
Flask main application — mirrors server/index.js
Run:  python -m server_py.main
"""
from flask import Flask
from flask_cors import CORS

from .database import init_db, seed_data, close_db
from .routes import projects, experiments, splits, search, upload, llm_search, line_lots, analysis, enablelab

# ── App ──
app = Flask(__name__)
CORS(app, supports_credentials=True)

# ── Close DB after each request ──
app.teardown_appcontext(close_db)

# ── Init DB ──
init_db()
seed_data()

# ── Wire up index invalidation callbacks ──
experiments.set_invalidate_index(search.invalidate_index)
splits.set_invalidate_index(search.invalidate_index)
upload.set_invalidate_fns(search.invalidate_index, llm_search.invalidate_index)

# ── Register blueprints ──
app.register_blueprint(projects.bp)
app.register_blueprint(experiments.bp)
app.register_blueprint(splits.bp)
app.register_blueprint(search.bp)
app.register_blueprint(upload.bp)
app.register_blueprint(llm_search.bp)
app.register_blueprint(line_lots.bp)
app.register_blueprint(analysis.bp)
app.register_blueprint(enablelab.bp)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=3001, debug=True)
