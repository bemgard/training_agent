# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

A personal AI training coach that pulls data from Garmin Connect, stores it in a database, and lets users chat with a Claude-powered coach that has access to their full training history, health metrics, and sleep data. Deployed on Render.

## Running things locally

**Backend** (FastAPI, port 8000):
```bash
uvicorn api.main:app --reload
```

**Frontend** (React/Vite, port 5173):
```bash
cd frontend && npm run dev
```

**Frontend lint:**
```bash
cd frontend && npm run lint
```

**Garmin sync** (requires env vars):
```bash
GARMIN_EMAIL=... GARMIN_PASSWORD=... SYNC_USER_ID=1 FULL_SYNC=false python scripts/sync_garmin.py
# Set FULL_SYNC=true for first-time sync (fetches ~5 years back)
```

**CLI coach** (terminal interface):
```bash
python main.py --coach
```

**One-time DB import from Garmin data export JSON** (raw files in `data/raw/`):
```bash
python scripts/build_db.py
```

## Required environment variables

```
ANTHROPIC_API_KEY       # Claude API key
ENCRYPTION_KEY          # Fernet key for encrypting stored Garmin credentials
JWT_SECRET              # JWT signing secret
DATABASE_URL            # PostgreSQL URL; omit to use SQLite at data/training.db
```

Frontend: `VITE_API_URL` defaults to `http://localhost:8000/api`.

## Architecture

### Database dual-mode

Every file that touches the DB checks `DATABASE_URL` at module load time:

```python
USE_SQLITE = not os.environ.get("DATABASE_URL")
ph = "?" if USE_SQLITE else "%s"
insert_ignore = "INSERT OR IGNORE" if USE_SQLITE else "INSERT"
on_conflict = "" if USE_SQLITE else " ON CONFLICT DO NOTHING"
```

SQLite is the local default (`data/training.db`); PostgreSQL is used in production. This pattern appears in `api/database.py`, `scripts/context_builder.py`, `scripts/sync_garmin.py`, and every route file. Always carry it forward when writing new queries.

### Backend (`api/`)

- `main.py` — FastAPI app with CORS, mounts four routers under `/api`
- `auth.py` — bcrypt (passwords) + Fernet (Garmin credentials) crypto utilities
- `database.py` — `get_db()` FastAPI dependency yielding a SQLite or psycopg2 connection
- `routes/auth.py` — `POST /auth/register`, `POST /auth/login`, JWT creation/validation
- `routes/chat.py` — `POST /chat` streams Claude responses via `StreamingResponse`; also `POST /save-pass` for saving coach-suggested workouts
- `routes/sync.py` — `POST /sync` spawns `scripts/sync_garmin.py` as a subprocess, injecting Garmin credentials (decrypted on the fly) and `SYNC_USER_ID` via env vars
- `routes/profile.py` — `GET /profile` returns all dashboard data in one payload

### Claude integration

`scripts/context_builder.py` → `get_context(veckor, user_id)` builds a multi-section training context string (profile, PRs, heart rate zones, weekly summaries, recent runs, health data, sleep) that is prepended to every Claude request as part of the system prompt.

The system prompt lives in `coach/system_prompt.txt`. It instructs the coach to end workout suggestions with a machine-readable `[PASS]{...}[/PASS]` JSON block, which the frontend parses to offer a save button.

Model used: `claude-haiku-4-5-20251001` (both CLI and API routes).

### Garmin sync

`scripts/sync_garmin.py` → `sync(full_sync)`:
- First sync (`FULL_SYNC=true`): fetches ~5 years of activities, 1 year of daily health/sleep, 2 years of VO2max
- Incremental sync: fetches last 30 days
- Writes to: `activities`, `health_daily`, `sleep_daily`, `vo2max_history`, `user_profile`, `race_predictions`, `personal_records`

### Frontend (`frontend/src/`)

React 19 + Vite. No router — tabs are managed with a `activeTab` state in `App.jsx`. Auth token stored in `localStorage`. All API calls go through `api.js`; the Vite dev proxy forwards `/api/*` to `localhost:8000`.

Chat uses streaming: `fetch` + `ReadableStream` reader, calling `onChunk(fullText)` on each chunk so the UI updates incrementally.

## Language conventions

The codebase mixes Swedish and English. Swedish is used for: variable names (`lösenord`, `datum`, `snitt_puls`, `sovtid_min`), UI strings, database column names, and function names (`hasha_lösenord`, `verifiera_token`, `get_context`). English is used for: Python/JS infrastructure, FastAPI model field names in some routes, and git commits. Follow the existing convention in whatever file you're editing.

## Key data model notes

- Activity classification lives in `scripts/aktivitetstyp.py` (`effektiv_typ`): manual type (`typ_manuell`) > the user's own rules in `aktivitetsregler` (e.g. "runs in Täby under 10 km are football") > Garmin's type > guess. Load rules with `hämta_regler(cursor, user_id, ph)` and pass them in — never hardcode places. Edited by the user under Träningsplan → Om mig (`/api/om-mig`, `/api/aktivitetsregler`).
- Self-reported day form lives in `dagsform` (one row per user and local date: general feeling, symptoms, temp) and `besvar` (pain in a body part, carried day to day until marked gone). Logic and the early illness warning (skin temp + HRV + resting HR, 2 of 3 signals vs the previous 14 nights) are in `scripts/dagsform.py`, shared by `/api/dagsform` and the coach context. The client sends its local date; the API only accepts today ±1 day.
- Coach conversations are stored in `samtal` + `meddelanden`. The client creates a conversation (`POST /api/samtal`) and sends only the new message with `samtal_id`; `/api/chat` checks ownership, builds the history from the DB (last 30 messages) and saves the reply when the stream finishes. Never accept history from the client.
- Training plans (fas 2): the coach ends replies that propose dated sessions with a hidden `[PLAN]{json}[/PLAN]` block (format and validation in `scripts/plan.py`: `steg` for cardio, `ovningar` for strength). `POST /api/planer` saves it into `traningsplaner` + `planerade_pass`, replacing not-yet-done sessions in the days/weeks it covers. Status (genomförd/missad/idag/kommande) is never stored — `stäm_av` matches sessions to Garmin activities on the same date and category every time, used by both `/api/planer/vecka` and the coach context (VECKANS PLAN).
- Heart rate zones are calculated dynamically from `MAX(max_puls)` in the activities table — not stored as fixed values.
- `personal_records` has a `current = 1` flag; estimated PRs (5K, 10K, half, full) are recalculated on every sync.
