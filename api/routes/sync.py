from fastapi import APIRouter, Depends, Header, HTTPException
import subprocess
import sys
import os
from pathlib import Path
from api.database import get_db
from api.routes.auth import verifiera_token
from api.auth import dekryptera

router = APIRouter()

def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Inte inloggad")
    token = authorization.split(" ")[1]
    return verifiera_token(token)

@router.post("/sync")
def sync(db=Depends(get_db), user=Depends(get_current_user)):
    c = db.cursor()
    ph = "%s"
    c.execute(f"SELECT id, garmin_email, garmin_password FROM users WHERE id = {ph}", (user["user_id"],))
    row = c.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Användare hittades inte")

    user_id = row["id"]
    garmin_email = dekryptera(row["garmin_email"])
    garmin_password = dekryptera(row["garmin_password"])

    # Kolla om användaren redan har data — om inte, kör fullsynk
    c.execute(f"SELECT COUNT(*) as cnt FROM activities WHERE user_id = {ph}", (user_id,))
    antal = c.fetchone()["cnt"]
    är_första_synk = antal == 0

    result = subprocess.run(
        [sys.executable, str(Path(__file__).parent.parent.parent / "scripts" / "sync_garmin.py")],
        capture_output=True,
        text=True,
        env={
            **os.environ,
            "GARMIN_EMAIL": garmin_email,
            "GARMIN_PASSWORD": garmin_password,
            "SYNC_USER_ID": str(user_id),
            "FULL_SYNC": "true" if är_första_synk else "false",
        }
    )
    if result.returncode != 0:
        print("SYNC ERROR:", result.stderr)
        print("SYNC STDOUT:", result.stdout)
        return {"ok": False, "error": result.stderr}
    return {"ok": True, "output": result.stdout, "full_sync": är_första_synk}