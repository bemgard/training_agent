from fastapi import APIRouter, Depends, Header, HTTPException
from api.database import get_db, USE_SQLITE
from api.routes.auth import verifiera_token

router = APIRouter()
ph = "?" if USE_SQLITE else "%s"

def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Inte inloggad")
    token = authorization.split(" ")[1]
    return verifiera_token(token)

@router.get("/passes")
def get_passes(db=Depends(get_db), user=Depends(get_current_user)):
    c = db.cursor()
    c.execute(f"""
        SELECT id, datum, typ, distans_km, tempo, pulszon, syfte
        FROM planerade_pass
        WHERE user_id = {ph}
        ORDER BY datum ASC
    """, (user["user_id"],))
    return [dict(r) for r in c.fetchall()]

@router.delete("/passes/{pass_id}")
def delete_pass(pass_id: int, db=Depends(get_db), user=Depends(get_current_user)):
    c = db.cursor()
    c.execute(
        f"DELETE FROM planerade_pass WHERE id = {ph} AND user_id = {ph}",
        (pass_id, user["user_id"])
    )
    db.commit()
    return {"ok": True}
