import os
import sys
import hmac
import subprocess
import threading
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Depends, Header, HTTPException
from api.database import get_db, open_conn, USE_SQLITE
from api.routes.auth import verifiera_token
from api.auth import dekryptera

router = APIRouter()
ph = "?" if USE_SQLITE else "%s"
SKRIPT = Path(__file__).parent.parent.parent / "scripts" / "sync_garmin.py"
SYNK_TIMEOUT_SEK = 900
_pågående = threading.Lock()  # en schemalagd körning åt gången


def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Inte inloggad")
    return verifiera_token(authorization.split(" ")[1])


def kör_synk(user_id: int, källa: str) -> dict:
    """Kör sync_garmin.py för en användare och loggar resultatet i sync_log."""
    db = open_conn()
    c = db.cursor()
    try:
        c.execute(f"SELECT garmin_email, garmin_password FROM users WHERE id = {ph}", (user_id,))
        rad = c.fetchone()
        if not rad:
            return {"ok": False, "error": "Användare hittades inte"}
        c.execute(f"SELECT COUNT(*) AS cnt FROM activities WHERE user_id = {ph}", (user_id,))
        första = c.fetchone()["cnt"] == 0
        c.execute(f"INSERT INTO sync_log (user_id, kalla) VALUES ({ph}, {ph}) RETURNING id", (user_id, källa))
        logg_id = c.fetchone()["id"]
        db.commit()

        try:
            resultat = subprocess.run(
                [sys.executable, str(SKRIPT)], capture_output=True, text=True, timeout=SYNK_TIMEOUT_SEK,
                env={**os.environ,
                     "GARMIN_EMAIL": dekryptera(rad["garmin_email"]),
                     "GARMIN_PASSWORD": dekryptera(rad["garmin_password"]),
                     "SYNC_USER_ID": str(user_id),
                     "FULL_SYNC": "true" if första else "false"})
            ok = resultat.returncode == 0
            utdata = resultat.stdout if ok else (resultat.stderr or resultat.stdout)
        except subprocess.TimeoutExpired:
            ok, utdata = False, f"Avbruten efter {SYNK_TIMEOUT_SEK} s"
        except Exception as e:  # t.ex. dekryptering misslyckades (fel ENCRYPTION_KEY)
            ok, utdata = False, f"{type(e).__name__}: {e}"

        meddelande = "\n".join((utdata or "").strip().splitlines()[-12:])
        c.execute(f"UPDATE sync_log SET slut = CURRENT_TIMESTAMP, ok = {ph}, meddelande = {ph} WHERE id = {ph}",
                  (ok, meddelande, logg_id))
        db.commit()
        if not ok:
            print(f"SYNC ERROR (user {user_id}, {källa}):\n{meddelande}")
        return {"ok": ok, "output": meddelande, "full_sync": första} if ok else {"ok": False, "error": meddelande}
    finally:
        db.close()


@router.post("/sync")
def sync(user=Depends(get_current_user)):
    return kör_synk(user["user_id"], "manuell")


@router.get("/sync/status")
def sync_status(db=Depends(get_db), user=Depends(get_current_user)):
    c = db.cursor()
    c.execute(f"""SELECT start, slut, ok, kalla, meddelande FROM sync_log
                  WHERE user_id = {ph} ORDER BY start DESC LIMIT 5""", (user["user_id"],))
    return [dict(r) for r in c.fetchall()]


def _synka_alla():
    if not _pågående.acquire(blocking=False):
        print("Schemalagd synk körs redan — hoppar över")
        return
    try:
        db = open_conn()
        c = db.cursor()
        c.execute("SELECT id FROM users WHERE garmin_email IS NOT NULL ORDER BY id")
        användare = [r["id"] for r in c.fetchall()]
        db.close()
        for uid in användare:  # i tur och ordning — skonsamt mot Garmin
            r = kör_synk(uid, "schema")
            print(f"Schemalagd synk user {uid}: {'OK' if r['ok'] else 'FEL'}")
    finally:
        _pågående.release()


@router.post("/sync/alla")
def sync_alla(x_cron_secret: str = Header(None), lokal_timme: int = None):
    """Anropas av Supabase pg_cron. Skyddad med CRON_SECRET.
    lokal_timme: kör bara om klockan i Stockholm är denna timme (hanterar sommar-/vintertid
    när jobbet schemaläggs på två UTC-tider)."""
    hemlighet = os.environ.get("CRON_SECRET")
    if not hemlighet or not x_cron_secret or not hmac.compare_digest(x_cron_secret, hemlighet):
        raise HTTPException(status_code=401, detail="Fel eller saknad cron-hemlighet")
    nu = datetime.now(ZoneInfo("Europe/Stockholm"))
    if lokal_timme is not None and nu.hour != lokal_timme:
        return {"startad": False, "anledning": f"Klockan är {nu:%H:%M} i Stockholm, inte {lokal_timme}"}
    threading.Thread(target=_synka_alla, daemon=True).start()
    return {"startad": True, "tid": nu.isoformat(timespec="minutes")}
