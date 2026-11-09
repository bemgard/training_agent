import os
import psycopg2
import psycopg2.extras
from pathlib import Path

DATABASE_URL = os.environ.get("DATABASE_URL")

# Fallback till SQLite lokalt
USE_SQLITE = not DATABASE_URL

if USE_SQLITE:
    import sqlite3
    BASE_DIR = Path(__file__).parent.parent
    DB_PATH = BASE_DIR / "data" / "training.db"

def open_conn():
    if USE_SQLITE:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        return conn
    else:
        return psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)

def get_db():
    if USE_SQLITE:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()
    else:
        conn = psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)
        try:
            yield conn
        finally:
            conn.close()