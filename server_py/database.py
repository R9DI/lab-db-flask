"""
Database module — SQLite connection, schema init, seed data.
Flask version — uses flask.g for per-request connections.
"""
import sqlite3
import os
from datetime import datetime, timedelta
from flask import g

DB_PATH = os.path.join(os.path.dirname(__file__), "lab.db")

# ──────────────────────────────────────────────
# Connection helper
# ──────────────────────────────────────────────

def get_connection() -> sqlite3.Connection:
    """Return a new connection with WAL mode and foreign keys enabled.
    Row factory is set to sqlite3.Row for dict-like access."""
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def get_db() -> sqlite3.Connection:
    """Flask per-request DB connection stored in g."""
    if "db" not in g:
        g.db = get_connection()
    return g.db


def close_db(e=None):
    """Close the DB connection at the end of a request."""
    db = g.pop("db", None)
    if db is not None:
        db.close()


def dict_row(row: sqlite3.Row | None):
    """Convert sqlite3.Row to plain dict (JSON-serialisable)."""
    if row is None:
        return None
    return dict(row)


def dict_rows(rows):
    """Convert a list of sqlite3.Row to list[dict]."""
    return [dict(r) for r in rows]


# ──────────────────────────────────────────────
# Schema init
# ──────────────────────────────────────────────

def init_db():
    conn = get_connection()
    try:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                iacpj_nm TEXT UNIQUE NOT NULL,
                iacpj_tgt_n TEXT,
                iacpj_level TEXT,
                iacpj_tech_n TEXT,
                ia_tgt_htr_n TEXT,
                iacpj_nud_n TEXT,
                iacpj_mod_n TEXT,
                iacpj_itf_uno TEXT,
                iacpj_bgn_dy TEXT,
                iacpj_ch_n TEXT,
                ia_ta_grd_n TEXT,
                project_purpose TEXT,
                iacpj_ta_goa TEXT,
                iacpj_cur_stt TEXT,
                iacpj_ch_i TEXT,
                ia_ch_or_i TEXT,
                ia_ch_or_n TEXT,
                ia_ch_or_path TEXT,
                iacpj_core_tec TEXT,
                iacpj_end_dy TEXT,
                iacpj_reg_dy TEXT
            );

            CREATE TABLE IF NOT EXISTS experiments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                team TEXT,
                requester TEXT,
                lot_code TEXT,
                iacpj_nm TEXT NOT NULL,
                module TEXT,
                wf_direction TEXT,
                eval_process TEXT,
                prev_eval TEXT,
                cross_experiment TEXT,
                eval_category TEXT,
                eval_item TEXT,
                lot_request TEXT,
                reference TEXT,
                volume_split TEXT,
                plan_id TEXT,
                assign_wf TEXT,
                refdata TEXT,
                refdata_url TEXT,
                request_date TEXT,
                status TEXT DEFAULT 'Assign 전',
                split_completed INTEGER DEFAULT 0,
                summary_completed INTEGER DEFAULT 0,
                fab_status TEXT,
                FOREIGN KEY (iacpj_nm) REFERENCES projects(iacpj_nm)
            );

            CREATE TABLE IF NOT EXISTS line_lots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                lot_id TEXT NOT NULL,
                current_step TEXT,
                fac_id TEXT DEFAULT 'r3',
                status TEXT DEFAULT 'available',
                estimated_arrival TEXT
            );

            CREATE TABLE IF NOT EXISTS split_tables (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sno INTEGER,
                fac_id TEXT,
                plan_id TEXT NOT NULL,
                oper_id TEXT,
                oper_nm TEXT,
                eps_lot_gbn_cd TEXT,
                work_cond_desc TEXT,
                eqp_id TEXT,
                recipe_id TEXT,
                user_def_val_1 TEXT,
                user_def_val_2 TEXT,
                user_def_val_3 TEXT,
                user_def_val_4 TEXT,
                user_def_val_5 TEXT,
                user_def_val_6 TEXT,
                user_def_val_7 TEXT,
                user_def_val_8 TEXT,
                user_def_val_9 TEXT,
                user_def_val_10 TEXT,
                user_def_val_11 TEXT,
                user_def_val_12 TEXT,
                user_def_val_13 TEXT,
                user_def_val_14 TEXT,
                user_def_val_15 TEXT,
                user_def_val_16 TEXT,
                user_def_val_17 TEXT,
                user_def_val_18 TEXT,
                user_def_val_19 TEXT,
                user_def_val_20 TEXT,
                user_def_val_21 TEXT,
                user_def_val_22 TEXT,
                user_def_val_23 TEXT,
                user_def_val_24 TEXT,
                user_def_val_25 TEXT,
                note TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_experiments_project ON experiments(iacpj_nm);
            CREATE INDEX IF NOT EXISTS idx_experiments_plan ON experiments(plan_id);
            CREATE INDEX IF NOT EXISTS idx_splits_plan ON split_tables(plan_id);
        """)

        # Migration: summary_text column
        try:
            conn.execute("ALTER TABLE experiments ADD COLUMN summary_text TEXT")
            conn.commit()
        except Exception:
            pass  # already exists

    finally:
        conn.close()


# ──────────────────────────────────────────────
# Seed data (line_lots 샘플)
# ──────────────────────────────────────────────

def seed_data():
    conn = get_connection()
    try:
        row = conn.execute("SELECT COUNT(*) AS cnt FROM line_lots").fetchone()
        if row["cnt"] == 0:
            now = datetime.utcnow()
            h = timedelta(hours=1)
            sample_lots = [
                ("RAXA123", "p301200b (esl_etch)", "r3", (now + 2 * h).isoformat()),
                ("RAXA456", "p802300c (via_open)", "r3", (now + 8 * h).isoformat()),
                ("RAXA789", "r206100a (blc_mask)", "r3", (now + 14 * h).isoformat()),
                ("RSAB101", "p951100a (m0c_mask)", "r3", (now + 24 * h).isoformat()),
                ("RSAB202", "r405500d (metal_dep)", "r3", (now + 5 * h).isoformat()),
                ("RSAB303", "p610400e (cmp_polish)", "r3", (now + 36 * h).isoformat()),
                ("RDLA404", "r507600f (ion_implant)", "r3", (now + 48 * h).isoformat()),
                ("RDLA505", "p301200b (esl_etch)", "r3", (now + 1 * h).isoformat()),
                ("RDLA606", "p802300c (via_open)", "r3", (now + 18 * h).isoformat()),
                ("RAXB707", "r206100a (blc_mask)", "r3", (now + 30 * h).isoformat()),
                ("RAXB808", "p951100a (m0c_mask)", "r3", (now + 6 * h).isoformat()),
                ("RSRB909", "r405500d (metal_dep)", "r3", (now + 42 * h).isoformat()),
            ]
            conn.executemany(
                "INSERT INTO line_lots (lot_id, current_step, fac_id, estimated_arrival) VALUES (?, ?, ?, ?)",
                sample_lots,
            )
            conn.commit()
    finally:
        conn.close()
