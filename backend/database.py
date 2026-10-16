"""Shared SQL interface: SQLite locally, PostgreSQL for durable cloud hosting."""
from contextlib import contextmanager
import os
import sqlite3

class Record(dict):
    def __getitem__(self, key):
        return list(self.values())[key] if isinstance(key, int) else super().__getitem__(key)

def record_factory(cursor):
    names = [column.name for column in cursor.description] if cursor.description else []
    return lambda values: Record(zip(names, values))

class Postgres:
    def __init__(self, raw):
        self.raw = raw

    def execute(self, sql, params=()):
        if sql == 'BEGIN IMMEDIATE':
            # Serialize state transitions across processes as well as threads.
            # Transaction-scoped locks work with Neon's transaction pooler.
            return self.raw.execute('SELECT pg_advisory_xact_lock(724791338)', prepare=False)
        # All SQL is fixed application SQL; values remain bound parameters.
        # Existing statements contain no literal question-mark operators.
        return self.raw.execute(sql.replace('?', '%s'), params, prepare=False)

    def executescript(self, script):
        for sql in script.split(';'):
            if sql.strip():
                self.execute(sql)

@contextmanager
def connect(sqlite_path, url=None):
    url = os.environ.get('DATABASE_URL', '') if url is None else url
    if url:
        import psycopg
        raw = psycopg.connect(url, sslmode='require', connect_timeout=15, row_factory=record_factory, prepare_threshold=None)
        connection = Postgres(raw)
    else:
        if os.environ.get('PATCHGUARD_REQUIRE_POSTGRES') == '1':
            raise RuntimeError('DATABASE_URL is required; ephemeral SQLite fallback is disabled')
        raw = sqlite3.connect(sqlite_path, timeout=15)
        raw.row_factory = sqlite3.Row
        raw.execute('PRAGMA foreign_keys=ON')
        raw.execute('PRAGMA journal_mode=WAL')
        connection = raw
    try:
        yield connection
        raw.commit()
    except BaseException:
        raw.rollback()
        raise
    finally:
        raw.close()
