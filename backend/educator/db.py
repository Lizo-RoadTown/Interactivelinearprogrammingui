"""
db.py — bank storage layer.

Backed by either Postgres (production / Supabase) or SQLite (local dev),
chosen automatically by the DATABASE_URL environment variable:

    DATABASE_URL=postgresql://user:pass@host:5432/db   -> Postgres
    DATABASE_URL=  (unset)                              -> SQLite at
                                                           BANK_DB_PATH
                                                           or default

Schema is a single table, `problems`, partitioned by `bank_id` so each
professor has their own bank inside the same database. The problem dict
itself is stored as JSON text in one column — flexible enough that
problems with varying shapes don't force schema migrations.

Why both backends in one file:
  • Local dev: zero setup. Just run uvicorn and a SQLite file appears
    next to this module.
  • Production: set DATABASE_URL on Render to a Supabase connection
    string and the same code reads/writes Postgres without changes.

The seed step copies problems.json into bank_id='demo' on first run so
the team-project /educator demo page works out of the box.
"""

from __future__ import annotations

import json
import os
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Connection, Engine

# Heroku and older Render docs use postgres://, but psycopg / SQLAlchemy
# 2.x require postgresql://. Normalize early so the user can paste either
# format from a hosting dashboard without thinking about it.
DATABASE_URL = os.environ.get('DATABASE_URL', '').strip()
if DATABASE_URL.startswith('postgres://'):
    DATABASE_URL = 'postgresql://' + DATABASE_URL[len('postgres://'):]

_BANK_DB_PATH = Path(os.environ.get(
    'BANK_DB_PATH',
    Path(__file__).parent / 'bank.db',
))


def _make_engine() -> Engine:
    """Pick a backend based on DATABASE_URL. Postgres if set, SQLite otherwise."""
    if DATABASE_URL.startswith('postgresql'):
        # Small pool — Render free dyno keeps a few connections; Supabase's
        # pooler (or direct connection) handles real concurrency.
        return create_engine(
            DATABASE_URL,
            pool_size=2,
            max_overflow=3,
            pool_pre_ping=True,   # transparently reconnect if the conn drops
        )
    # SQLite fallback for local development. check_same_thread=False so the
    # FastAPI worker thread pool can reuse pooled connections safely.
    return create_engine(
        f'sqlite:///{_BANK_DB_PATH}',
        connect_args={'check_same_thread': False},
    )


_engine: Engine = _make_engine()


def is_postgres() -> bool:
    """For diagnostics / health endpoints."""
    return DATABASE_URL.startswith('postgresql')


def _now() -> str:
    """ISO8601 in UTC, stored as TEXT so both backends handle it the same."""
    return datetime.now(timezone.utc).isoformat()


@contextmanager
def _conn() -> Iterator[Connection]:
    """Yield a connection inside a transaction. Auto-commits on success."""
    with _engine.begin() as c:
        yield c


# ── Schema + seed ───────────────────────────────────────────────────────────

def _init_schema() -> None:
    with _conn() as c:
        c.execute(text("""
            CREATE TABLE IF NOT EXISTS problems (
                bank_id     TEXT NOT NULL,
                problem_id  TEXT NOT NULL,
                data        TEXT NOT NULL,
                created_at  TEXT NOT NULL,
                updated_at  TEXT NOT NULL,
                PRIMARY KEY (bank_id, problem_id)
            )
        """))


_UPSERT_SQL = text("""
    INSERT INTO problems (bank_id, problem_id, data, created_at, updated_at)
    VALUES (:bank_id, :problem_id, :data, :created_at, :updated_at)
    ON CONFLICT (bank_id, problem_id) DO UPDATE SET
        data = excluded.data,
        updated_at = excluded.updated_at
""")
# ON CONFLICT … DO UPDATE is supported by SQLite 3.24+ and by every
# Postgres version we'd reasonably target. Same SQL for both backends.


def _seed_demo_if_empty() -> None:
    """Copy problems.json into bank_id='demo' on first run."""
    legacy = Path(__file__).parent / 'problems.json'
    if not legacy.exists():
        return
    with _conn() as c:
        result = c.execute(
            text("SELECT COUNT(*) FROM problems WHERE bank_id = :bid"),
            {"bid": "demo"},
        )
        row = result.first()
        if row and row[0] > 0:
            return
        with legacy.open('r', encoding='utf-8') as f:
            payload = json.load(f)
        problems = payload.get('problems', [])
        now = _now()
        for p in problems:
            pid = p.get('id') or ''
            if not pid:
                continue
            c.execute(_UPSERT_SQL, {
                "bank_id": "demo",
                "problem_id": pid,
                "data": json.dumps(p),
                "created_at": now,
                "updated_at": now,
            })


def init() -> None:
    """One-call setup: create schema if missing, seed demo bank if empty."""
    _init_schema()
    _seed_demo_if_empty()


# ── CRUD ────────────────────────────────────────────────────────────────────

def list_banks() -> list[str]:
    """Distinct bank_ids currently in the database."""
    with _conn() as c:
        result = c.execute(text("SELECT DISTINCT bank_id FROM problems ORDER BY bank_id"))
        return [row[0] for row in result.fetchall()]


def list_problems(bank_id: str) -> list[dict[str, Any]]:
    """All problems in one bank, in id order."""
    with _conn() as c:
        result = c.execute(
            text("SELECT data FROM problems WHERE bank_id = :bid ORDER BY problem_id"),
            {"bid": bank_id},
        )
        return [json.loads(row[0]) for row in result.fetchall()]


def get_problem(bank_id: str, problem_id: str) -> dict[str, Any] | None:
    with _conn() as c:
        result = c.execute(
            text("SELECT data FROM problems WHERE bank_id = :bid AND problem_id = :pid"),
            {"bid": bank_id, "pid": problem_id},
        )
        row = result.first()
        return json.loads(row[0]) if row else None


def upsert_problem(bank_id: str, problem: dict[str, Any]) -> None:
    """Insert or replace a problem. The dict must contain an 'id' key."""
    pid = problem.get('id') or ''
    if not pid:
        raise ValueError("problem dict has no 'id'")
    now = _now()
    with _conn() as c:
        # Preserve created_at on update
        result = c.execute(
            text("SELECT created_at FROM problems WHERE bank_id = :bid AND problem_id = :pid"),
            {"bid": bank_id, "pid": pid},
        )
        existing = result.first()
        created_at = existing[0] if existing else now
        c.execute(_UPSERT_SQL, {
            "bank_id": bank_id,
            "problem_id": pid,
            "data": json.dumps(problem),
            "created_at": created_at,
            "updated_at": now,
        })


def delete_problem(bank_id: str, problem_id: str) -> bool:
    """Returns True if a row was actually deleted (False = wasn't there)."""
    with _conn() as c:
        result = c.execute(
            text("DELETE FROM problems WHERE bank_id = :bid AND problem_id = :pid"),
            {"bid": bank_id, "pid": problem_id},
        )
        return (result.rowcount or 0) > 0


def fork_bank(source_bank: str, target_bank: str) -> int:
    """Copy every problem from source_bank into target_bank.

    Conflicts in target_bank are overwritten. Returns the count copied.
    """
    if source_bank == target_bank:
        return 0
    now = _now()
    count = 0
    with _conn() as c:
        result = c.execute(
            text("SELECT problem_id, data FROM problems WHERE bank_id = :bid"),
            {"bid": source_bank},
        )
        rows = result.fetchall()
        for row in rows:
            c.execute(_UPSERT_SQL, {
                "bank_id": target_bank,
                "problem_id": row[0],
                "data": row[1],
                "created_at": now,
                "updated_at": now,
            })
            count += 1
    return count
