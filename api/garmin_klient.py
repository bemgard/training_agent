"""Inloggad Garmin-klient för en användare — samma token-flöde som scripts/sync_garmin.py
(sparade tokens först, lösenord bara som reserv) så att vi inte triggar Garmins 429/Cloudflare."""
import tempfile
from contextlib import contextmanager
from pathlib import Path
from api.database import open_conn, USE_SQLITE
from api.auth import dekryptera, kryptera

ph = "?" if USE_SQLITE else "%s"


def _v(rad, nyckel, i):
    return rad[nyckel] if not isinstance(rad, tuple) else rad[i]


@contextmanager
def inloggad(user_id: int):
    from garminconnect import Garmin
    conn = open_conn()
    try:
        c = conn.cursor()
        c.execute(f"SELECT garmin_email, garmin_password, garmin_tokens FROM users WHERE id = {ph}", (user_id,))
        rad = c.fetchone()
        if not rad or not _v(rad, "garmin_email", 0):
            raise RuntimeError("Inget Garmin-konto kopplat")
        klient = Garmin(dekryptera(_v(rad, "garmin_email", 0)), dekryptera(_v(rad, "garmin_password", 1)))
        tokens = dekryptera(_v(rad, "garmin_tokens", 2)) if _v(rad, "garmin_tokens", 2) else None
        with tempfile.TemporaryDirectory() as katalog:
            if tokens:
                (Path(katalog) / "garmin_tokens.json").write_text(tokens)
            klient.login(katalog)
        try:
            c.execute(f"UPDATE users SET garmin_tokens = {ph} WHERE id = {ph}", (kryptera(klient.client.dumps()), user_id))
            conn.commit()
        except Exception:
            conn.rollback()
    finally:
        conn.close()
    yield klient
