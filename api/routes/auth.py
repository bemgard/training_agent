import os
import jwt
import datetime
from fastapi import APIRouter, Depends, HTTPException, Request
import time
from collections import defaultdict, deque
from pydantic import BaseModel
from api.database import get_db
from api.auth import hasha_lösenord, verifiera_lösenord, kryptera

router = APIRouter()
JWT_SECRET = os.environ.get("JWT_SECRET")
if not JWT_SECRET or len(JWT_SECRET) < 32:
    # Fail closed: utan en riktig hemlighet kan vem som helst förfalska inloggningstoken
    raise RuntimeError("JWT_SECRET saknas eller är för kort (minst 32 tecken)")
USE_SQLITE = not os.environ.get("DATABASE_URL")
ph = "?" if USE_SQLITE else "%s"

class RegisterRequest(BaseModel):
    email: str
    lösenord: str
    garmin_email: str
    garmin_password: str

class LoginRequest(BaseModel):
    email: str
    lösenord: str
    kom_ihag: bool = False

# ── Skydd mot lösenordsgissning (en instans på Render → minnet räcker) ──────────
MAX_FEL, FÖNSTER_SEK = 5, 15 * 60
_misslyckade = defaultdict(deque)       # (ip, email) → tidpunkter för misslyckade inloggningar
_registreringar = defaultdict(deque)    # ip → tidpunkter för registreringar


def klient_ip(request: Request) -> str:
    vidare = request.headers.get("x-forwarded-for")  # Render ligger bakom en proxy
    return vidare.split(",")[0].strip() if vidare else (request.client.host if request.client else "okänd")


def _rensa(kö, fönster):
    gräns = time.time() - fönster
    while kö and kö[0] < gräns:
        kö.popleft()


def skapa_token(user_id: int, email: str, dagar: int = 30) -> str:
    """Kom ihåg mig → 30 dagar. Annars 1 dag (frontend sparar dessutom bara i sessionStorage)."""
    payload = {
        "user_id": user_id,
        "email": email,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(days=dagar)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def verifiera_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token har gått ut")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Ogiltigt token")

@router.post("/auth/register")
def register(req: RegisterRequest, request: Request, db=Depends(get_db)):
    ip = klient_ip(request)
    _rensa(_registreringar[ip], 3600)
    if len(_registreringar[ip]) >= 10:
        raise HTTPException(status_code=429, detail="För många registreringar — försök igen om en timme")
    _registreringar[ip].append(time.time())
    c = db.cursor()
    email = req.email.strip().lower()
    if "@" not in email:
        raise HTTPException(status_code=400, detail="Ange en giltig e-postadress")
    if len(req.lösenord) < 8:
        raise HTTPException(status_code=400, detail="Lösenordet måste vara minst 8 tecken")
    if not req.garmin_email.strip() or not req.garmin_password:
        raise HTTPException(status_code=400, detail="Fyll i dina Garmin Connect-uppgifter")
    c.execute(f"SELECT id FROM users WHERE LOWER(email) = {ph}", (email,))
    if c.fetchone():
        raise HTTPException(status_code=409, detail="Det finns redan ett konto med den e-postadressen — logga in i stället")
    try:
        värden = (email, hasha_lösenord(req.lösenord), kryptera(req.garmin_email.strip()), kryptera(req.garmin_password))
        if USE_SQLITE:
            c.execute(f"INSERT INTO users (email, lösenord_hash, garmin_email, garmin_password) VALUES ({ph}, {ph}, {ph}, {ph})", värden)
            user_id = c.lastrowid
        else:
            c.execute(f"INSERT INTO users (email, lösenord_hash, garmin_email, garmin_password) VALUES ({ph}, {ph}, {ph}, {ph}) RETURNING id", värden)
            user_id = c.fetchone()["id"]
        db.commit()
    except Exception as e:
        print(f"REGISTER ERROR: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail="Kunde inte skapa kontot — försök igen")
    return {"token": skapa_token(user_id, email), "email": email}


@router.post("/auth/login")
def login(req: LoginRequest, request: Request, db=Depends(get_db)):
    email = req.email.strip().lower()
    nyckel = (klient_ip(request), email)
    _rensa(_misslyckade[nyckel], FÖNSTER_SEK)
    if len(_misslyckade[nyckel]) >= MAX_FEL:
        raise HTTPException(status_code=429, detail="För många misslyckade försök — vänta 15 minuter och försök igen")
    c = db.cursor()
    c.execute(f"SELECT * FROM users WHERE LOWER(email) = {ph}", (email,))
    user = c.fetchone()
    if not user or not verifiera_lösenord(req.lösenord, user["lösenord_hash"]):
        _misslyckade[nyckel].append(time.time())
        raise HTTPException(status_code=401, detail="Fel e-post eller lösenord")
    _misslyckade.pop(nyckel, None)
    token = skapa_token(user["id"], user["email"], dagar=30 if req.kom_ihag else 1)
    return {"token": token, "email": user["email"]}
