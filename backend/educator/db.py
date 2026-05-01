"""
db.py — SQLite storage layer for the problem bank.

One SQLite file holds every professor's bank, partitioned by `bank_id`.
A `bank_id` is just a string the professor picks (e.g. "prof-jenkins",
"orie-310-fall25"). They enter it once on the /admin page and it's
remembered in their browser localStorage; the server never enforces
authentication for it. This is the right level of identity for a
classroom tool — it's not a secret, just a partitioning key.

Schema is intentionally minimal:

    problems(
      bank_id     TEXT,
      problem_id  TEXT,
      data        TEXT  -- the full problem dict, JSON-serialized
      created_at  TIMESTAMP,
      updated_at  TIMESTAMP,
      PRIMARY KEY (bank_id, problem_id)
    )

The whole problem dict goes into `data` as JSON. This is deliberate —
problems vary in shape (different numbers of variables, different
constraint counts), and a structured-column schema would force us to
chase that. JSON-in-a-column gives us flexibility now and we can
normalize later if a query pattern actually demands it.

The file lives next to this module. In production you'd move it to a
mounted volume or a managed location; for now `backend/educator/bank.db`
is fine and gitignored.

Default bank `'demo'` is seeded from the legacy `problems.json` on
first run, so the team-project demo page keeps working without
changes.
"""

from __future__ import annotations

import json
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

_DB_PATH = Path(os.environ.get(
    'BANK_DB_PATH',
    Path(__file__).parent / 'bank.db',
))


def _now() -> str:
    """ISO8601 in UTC for created_at/updated_at."""
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()


@contextmanager
def _conn() -> Iterator[sqlite3.Connection]:
    """A connection with row-as-dict factory and FK enabled."""
    c = sqlite3.connect(_DB_PATH)
    c.row_factory = sqlite3.Row
    try:
        yield c
        c.commit()
    finally:
        c.close()


def _init_schema() -> None:
    with _conn() as c:
        c.execute("""
            CREATE TABLE IF NOT EXISTS problems (
                bank_id     TEXT NOT NULL,
                problem_id  TEXT NOT NULL,
                data        TEXT NOT NULL,
                created_at  TEXT NOT NULL,
                updated_at  TEXT NOT NULL,
                PRIMARY KEY (bank_id, problem_id)
            )
        """)


def _seed_demo_if_empty() -> None:
    """Copy `problems.json` into bank_id='demo' on first run."""
    legacy = Path(__file__).parent / 'problems.json'
    if not legacy.exists():
        return
    with _conn() as c:
        cur = c.execute("SELECT COUNT(*) AS n FROM problems WHERE bank_id = 'demo'")
        row = cur.fetchone()
        if row['n'] > 0:
            return
        with legacy.open('r', encoding='utf-8') as f:
            payload = json.load(f)
        problems = payload.get('problems', [])
        now = _now()
        for p in problems:
            pid = p.get('id') or ''
            if not pid:
                continue
            c.execute(
                """INSERT OR REPLACE INTO problems
                   (bank_id, problem_id, data, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?)""",
                ('demo', pid, json.dumps(p), now, now),
            )


def init() -> None:
    """One-call setup: create schema if missing, seed demo bank if empty."""
    _init_schema()
    _seed_demo_if_empty()


# ── CRUD ────────────────────────────────────────────────────────────────────

def list_banks() -> list[str]:
    """Distinct bank_ids currently in the database."""
    with _conn() as c:
        cur = c.execute("SELECT DISTINCT bank_id FROM problems ORDER BY bank_id")
        return [row['bank_id'] for row in cur.fetchall()]


def list_problems(bank_id: str) -> list[dict[str, Any]]:
    """All problems in one bank, in id order."""
    with _conn() as c:
        cur = c.execute(
            "SELECT data FROM problems WHERE bank_id = ? ORDER BY problem_id",
            (bank_id,),
        )
        return [json.loads(row['data']) for row in cur.fetchall()]


def get_problem(bank_id: str, problem_id: str) -> dict[str, Any] | None:
    with _conn() as c:
        cur = c.execute(
            "SELECT data FROM problems WHERE bank_id = ? AND problem_id = ?",
            (bank_id, problem_id),
        )
        row = cur.fetchone()
        return json.loads(row['data']) if row else None


def upsert_problem(bank_id: str, problem: dict[str, Any]) -> None:
    """Insert or replace a problem. The dict must contain an 'id' key."""
    pid = problem.get('id') or ''
    if not pid:
        raise ValueError("problem dict has no 'id'")
    now = _now()
    with _conn() as c:
        # Preserve created_at if the row already exists
        cur = c.execute(
            "SELECT created_at FROM problems WHERE bank_id = ? AND problem_id = ?",
            (bank_id, pid),
        )
        existing = cur.fetchone()
        created_at = existing['created_at'] if existing else now
        c.execute(
            """INSERT OR REPLACE INTO problems
               (bank_id, problem_id, data, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?)""",
            (bank_id, pid, json.dumps(problem), created_at, now),
        )


def delete_problem(bank_id: str, problem_id: str) -> bool:
    """Returns True if a row was deleted."""
    with _conn() as c:
        cur = c.execute(
            "DELETE FROM problems WHERE bank_id = ? AND problem_id = ?",
            (bank_id, problem_id),
        )
        return cur.rowcount > 0


def fork_bank(source_bank: str, target_bank: str) -> int:
    """Copy every problem from source_bank into target_bank.
    Returns the count copied. Conflicts in target_bank are overwritten.
    """
    if source_bank == target_bank:
        return 0
    now = _now()
    with _conn() as c:
        cur = c.execute(
            "SELECT problem_id, data FROM problems WHERE bank_id = ?",
            (source_bank,),
        )
        rows = cur.fetchall()
        for r in rows:
            c.execute(
                """INSERT OR REPLACE INTO problems
                   (bank_id, problem_id, data, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?)""",
                (target_bank, r['problem_id'], r['data'], now, now),
            )
        return len(rows)
