import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes import profile, chat, sync, auth as auth_routes, passes, kropp, trender, mal
from api.database import open_conn, USE_SQLITE

@asynccontextmanager
async def lifespan(_: FastAPI):
    db = open_conn()
    c = db.cursor()
    id_col = "id INTEGER PRIMARY KEY" if USE_SQLITE else "id SERIAL PRIMARY KEY"
    c.execute(f"""
        CREATE TABLE IF NOT EXISTS planerade_pass (
            {id_col},
            user_id INTEGER,
            datum TEXT,
            typ TEXT,
            distans_km REAL,
            tempo TEXT,
            pulszon TEXT,
            syfte TEXT
        )
    """)
    db.commit()
    db.close()
    yield

app = FastAPI(title="Training Agent API", lifespan=lifespan)

# Bara appens egna frontends får anropa API:t från webbläsaren
TILLÅTNA_URSPRUNG = os.environ.get(
    "CORS_ORIGINS", "https://training-agent-ai.netlify.app,http://localhost:5173"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[u.strip() for u in TILLÅTNA_URSPRUNG],
    allow_credentials=False,   # vi använder Bearer-token i header, inte cookies
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(profile.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(sync.router, prefix="/api")
app.include_router(auth_routes.router, prefix="/api")
app.include_router(passes.router, prefix="/api")
app.include_router(kropp.router, prefix="/api")
app.include_router(trender.router, prefix="/api")
app.include_router(mal.router, prefix="/api")

@app.get("/")
def root():
    return {"status": "Training Agent API is running"}