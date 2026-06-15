import os
import jwt
import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from api.database import get_db
from api.auth import hasha_lösenord, verifiera_lösenord, kryptera

router = APIRouter()
JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret")

class RegisterRequest(BaseModel):
    email: str
    lösenord: str
    garmin_email: str
    garmin_password: str

class LoginRequest(BaseModel):
    email: str
    lösenord: str

def skapa_token(user_id: int, email: str) -> str:
    payload = {
        "user_id": user_id,
        "email": email,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(days=30)
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
def register(req: RegisterRequest, db=Depends(get_db)):
    c = db.cursor()
    try:
        lösenord_hash = hasha_lösenord(req.lösenord)
        garmin_email_krypterad = kryptera(req.garmin_email)
        garmin_password_krypterad = kryptera(req.garmin_password)
        c.execute("""
            INSERT INTO users (email, lösenord_hash, garmin_email, garmin_password)
            VALUES (%s, %s, %s, %s) RETURNING id
        """, (req.email, lösenord_hash, garmin_email_krypterad, garmin_password_krypterad))
        user_id = c.fetchone()["id"]
        db.commit()
        token = skapa_token(user_id, req.email)
        return {"token": token, "email": req.email}
    except Exception as e:
        raise HTTPException(status_code=400, detail="Email redan registrerad")

@router.post("/auth/login")
def login(req: LoginRequest, db=Depends(get_db)):
    c = db.cursor()
    c.execute("SELECT * FROM users WHERE email = %s", (req.email,))
    user = c.fetchone()
    if not user or not verifiera_lösenord(req.lösenord, user["lösenord_hash"]):
        raise HTTPException(status_code=401, detail="Fel email eller lösenord")
    token = skapa_token(user["id"], user["email"])
    return {"token": token, "email": req.email}