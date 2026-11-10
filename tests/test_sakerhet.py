"""Säkerhetstester — försöker göra det en angripare skulle göra.
Körs mot en tillfällig SQLite-databas byggd från db/migrations (rör aldrig Supabase).
Kör:  .venv/bin/python -m pytest tests/test_sakerhet.py -v
"""
import os, re, sys, time, sqlite3, tempfile, subprocess, datetime
from pathlib import Path
import pytest

REPO = Path(__file__).parent.parent
DB_FIL = Path(tempfile.mkdtemp()) / "sakerhet.db"

# Testmiljö — sätts innan appen importeras
os.environ.update({
    "DATABASE_URL": "",
    "JWT_SECRET": "test-" + "x" * 60,
    "CRON_SECRET": "cron-test-hemlighet",
    "CORS_ORIGINS": "https://training-agent-ai.netlify.app,http://localhost:5173",
})
from cryptography.fernet import Fernet
os.environ["ENCRYPTION_KEY"] = Fernet.generate_key().decode()


def bygg_schema():
    sql = "\n".join((REPO / "db/migrations" / f).read_text() for f in sorted(os.listdir(REPO / "db/migrations"))
                    if f.endswith(".sql") and not f.startswith("008"))  # 008 = pg_cron, bara Postgres
    sql = re.sub(r"ALTER TABLE \w+ ENABLE ROW LEVEL SECURITY;", "", sql)
    sql = re.sub(r"^\s*(DROP|CREATE) EXTENSION[^;]*;", "", sql, flags=re.M)  # Postgres-tillägg (pg_net, pg_cron)
    sql = re.sub(r"CHECK \([^)]*\)\)", "", sql)
    sql = sql.replace("SERIAL PRIMARY KEY", "INTEGER PRIMARY KEY AUTOINCREMENT")
    sql = sql.replace("TIMESTAMPTZ NOT NULL DEFAULT now()", "TEXT DEFAULT CURRENT_TIMESTAMP").replace("TIMESTAMPTZ DEFAULT now()", "TEXT").replace("TIMESTAMPTZ", "TEXT")
    sql = re.sub(r"REFERENCES users\(id\) ON DELETE CASCADE", "", sql)
    sql = re.sub(r"ALTER TABLE (\w+)\s+((?:\s*ADD COLUMN [^;]+));",
                 lambda m: "\n".join(f"ALTER TABLE {m.group(1)} {c.strip()};" for c in m.group(2).split(",")), sql)
    db = sqlite3.connect(DB_FIL)
    db.executescript(sql)
    db.close()


bygg_schema()
sys.path.insert(0, str(REPO))
import api.database as databas
databas.DB_PATH = DB_FIL
from fastapi.testclient import TestClient
from api.main import app
from api.routes import auth as auth_routes
import jwt

klient = TestClient(app)


def registrera(email, lösenord="Sakert-losen-1", garmin_pw="garmin-hemligt-123"):
    return klient.post("/api/auth/register", json={"email": email, "lösenord": lösenord,
                                                  "garmin_email": email, "garmin_password": garmin_pw})


def rubrik(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def anv():
    """Två användare: A (offret) och B (angriparen)."""
    a = registrera("anna@test.se").json()
    b = registrera("bertil@test.se").json()
    ta, tb = a["token"], b["token"]
    a_id = jwt.decode(ta, os.environ["JWT_SECRET"], algorithms=["HS256"])["user_id"]
    # Lägg in data för A direkt i databasen
    db = sqlite3.connect(DB_FIL)
    db.execute("INSERT INTO activities (user_id, activity_id, datum, typ, distans_km, duration_min) VALUES (?, 999001, '2026-11-01', 'running', 5, 30)", (a_id,))
    db.execute("INSERT INTO planerade_pass (user_id, datum, typ) VALUES (?, '2026-11-20', 'Intervaller')", (a_id,))
    db.commit()
    pass_id = db.execute("SELECT id FROM planerade_pass WHERE user_id = ?", (a_id,)).fetchone()[0]
    db.close()
    klient.post("/api/vikt", json={"vikt_kg": 80}, headers=rubrik(ta))
    vikt_id = klient.get("/api/kropp", headers=rubrik(ta)).json()["matningar"][0]["id"]
    return {"ta": ta, "tb": tb, "a_id": a_id, "pass_id": pass_id, "vikt_id": vikt_id}


# ── 1. Utan inloggning ────────────────────────────────────────────────────────
PUBLIKA = {"/", "/api/auth/login", "/api/auth/register", "/api/aktivitetstyper", "/api/sync/alla"}

def test_alla_skyddade_endpoints_kraver_inloggning():
    kontrollerade, fel = [], []
    for sökväg, metoder in app.openapi()["paths"].items():
        if sökväg in PUBLIKA:
            continue
        konkret = re.sub(r"\{[^}]+\}", "1", sökväg)
        for metod in metoder:
            r = klient.request(metod.upper(), konkret, json={"message": "hej", "history": [], "datum": "2026-01-01", "typ": "x"})
            kontrollerade.append(f"{metod.upper()} {sökväg}")
            if r.status_code != 401:
                fel.append(f"{metod.upper()} {sökväg} → {r.status_code}")
    print(f"\nKontrollerade {len(kontrollerade)} endpoints: {kontrollerade}")
    assert len(kontrollerade) > 10
    assert not fel, f"Endpoints som inte kräver inloggning: {fel}"


# ── 2. Förfalskade och ogiltiga token ─────────────────────────────────────────
def test_forfalskade_token_avvisas(anv):
    nu = datetime.datetime.utcnow()
    försök = {
        "fel hemlighet": jwt.encode({"user_id": anv["a_id"], "exp": nu + datetime.timedelta(hours=1)}, "dev-secret", algorithm="HS256"),
        "utgången": jwt.encode({"user_id": anv["a_id"], "exp": nu - datetime.timedelta(seconds=1)}, os.environ["JWT_SECRET"], algorithm="HS256"),
        "alg none": jwt.encode({"user_id": anv["a_id"]}, None, algorithm="none") if "none" in jwt.algorithms.get_default_algorithms() else "eyJhbGciOiJub25lIn0.eyJ1c2VyX2lkIjoxfQ.",
        "skräp": "inte.ett.token",
        "tom": "",
    }
    for namn, token in försök.items():
        r = klient.get("/api/profile", headers=rubrik(token))
        assert r.status_code == 401, f"{namn}: fick {r.status_code}"


# ── 3. Komma åt någon annans data (IDOR) ──────────────────────────────────────
def test_kan_inte_radera_annans_vikt(anv):
    r = klient.delete(f"/api/vikt/{anv['vikt_id']}", headers=rubrik(anv["tb"]))
    assert r.status_code == 404
    assert len(klient.get("/api/kropp", headers=rubrik(anv["ta"])).json()["matningar"]) == 1


def test_kan_inte_andra_annans_aktivitet(anv):
    r = klient.patch("/api/activities/999001/typ", json={"typ": "golf"}, headers=rubrik(anv["tb"]))
    assert r.status_code == 404
    db = sqlite3.connect(DB_FIL)
    assert db.execute("SELECT typ_manuell FROM activities WHERE activity_id = 999001").fetchone()[0] is None


def test_kan_inte_radera_annans_pass(anv):
    klient.delete(f"/api/passes/{anv['pass_id']}", headers=rubrik(anv["tb"]))
    db = sqlite3.connect(DB_FIL)
    assert db.execute("SELECT COUNT(*) FROM planerade_pass WHERE id = ?", (anv["pass_id"],)).fetchone()[0] == 1


def test_ser_inte_annans_data(anv):
    b_profil = klient.get("/api/profile", headers=rubrik(anv["tb"])).json()
    assert b_profil["aktiviteter"] == []
    assert klient.get("/api/kropp", headers=rubrik(anv["tb"])).json()["matningar"] == []
    assert klient.get("/api/passes", headers=rubrik(anv["tb"])).json() == []
    assert klient.get("/api/trender?dagar=0", headers=rubrik(anv["tb"])).json()["volym"] == []


def test_mal_ar_privata(anv):
    mål = {"typ": "grundtraning", "titel": "Annas hemliga mål", "fokus": ["kondition"], "traningsdagar": ["man"]}
    assert klient.post("/api/mal", json=mål, headers=rubrik(anv["ta"])).status_code == 200
    a_mål = klient.get("/api/mal", headers=rubrik(anv["ta"])).json()["aktivt"]
    assert a_mål["titel"] == "Annas hemliga mål"
    # B ser inte A:s mål och kan varken ändra eller avsluta det
    assert klient.get("/api/mal", headers=rubrik(anv["tb"])).json()["aktivt"] is None
    assert klient.put(f"/api/mal/{a_mål['id']}", json={**mål, "titel": "Kapat"}, headers=rubrik(anv["tb"])).status_code == 404
    assert klient.delete(f"/api/mal/{a_mål['id']}", headers=rubrik(anv["tb"])).status_code == 404
    assert klient.get("/api/mal", headers=rubrik(anv["ta"])).json()["aktivt"]["titel"] == "Annas hemliga mål"


def test_mal_validering(anv):
    fel = [{"typ": "hackning", "titel": "x"}, {"typ": "lopp", "titel": ""}, {"typ": "lopp", "titel": "x", "slutdatum": "inte-ett-datum"},
           {"typ": "lopp", "titel": "x", "traningsdagar": ["måndag'; DROP TABLE mal; --"]}]
    for data in fel:
        assert klient.post("/api/mal", json=data, headers=rubrik(anv["tb"])).status_code == 422, data


# ── 4. SQL-injektion ──────────────────────────────────────────────────────────
@pytest.mark.parametrize("email", ["' OR '1'='1", "anna@test.se' --", "x'; DROP TABLE users; --"])
def test_sql_injektion_i_inloggning(anv, email):
    r = klient.post("/api/auth/login", json={"email": email, "lösenord": "' OR '1'='1"})
    assert r.status_code in (401, 429)
    db = sqlite3.connect(DB_FIL)
    assert db.execute("SELECT COUNT(*) FROM users").fetchone()[0] >= 2  # tabellen finns kvar


# ── 5. Lösenordsgissning ──────────────────────────────────────────────────────
def test_sparr_efter_fem_felaktiga_forsok():
    registrera("gissning@test.se", lösenord="Ratt-losenord-1")
    for _ in range(5):
        assert klient.post("/api/auth/login", json={"email": "gissning@test.se", "lösenord": "fel"}).status_code == 401
    r = klient.post("/api/auth/login", json={"email": "gissning@test.se", "lösenord": "fel"})
    assert r.status_code == 429
    # Även rätt lösenord stoppas under spärren
    assert klient.post("/api/auth/login", json={"email": "gissning@test.se", "lösenord": "Ratt-losenord-1"}).status_code == 429
    # Andra konton påverkas inte
    assert klient.post("/api/auth/login", json={"email": "anna@test.se", "lösenord": "Sakert-losen-1"}).status_code == 200
    auth_routes._misslyckade.clear()


# ── 6. Registrering ───────────────────────────────────────────────────────────
def test_registrering_validering():
    assert registrera("kort@test.se", lösenord="1234567").status_code == 400
    assert registrera("ANNA@test.se").status_code == 409          # finns redan (skiftlägesokänsligt)
    r = klient.post("/api/auth/register", json={"email": "u@test.se", "lösenord": "Sakert-losen-1", "garmin_email": "", "garmin_password": ""})
    assert r.status_code == 400


# ── 7. Hemligheter läcker aldrig i svar ──────────────────────────────────────
def test_inga_hemligheter_i_svar(anv):
    svar = " ".join(klient.get(p, headers=rubrik(anv["ta"])).text for p in
                    ["/api/profile", "/api/kropp", "/api/sync/status", "/api/trender?dagar=0", "/api/somn?dagar=0"])
    for förbjudet in ["garmin-hemligt-123", "garmin_password", "lösenord_hash", "garmin_tokens", "$2b$"]:
        assert förbjudet not in svar, f"Läcker: {förbjudet}"
    db = sqlite3.connect(DB_FIL)
    lagrat = db.execute("SELECT lösenord_hash, garmin_password FROM users WHERE email = 'anna@test.se'").fetchone()
    assert lagrat[0].startswith("$2b$"), "Applösenord ska vara bcrypt-hashat"
    assert "garmin-hemligt-123" not in lagrat[1], "Garmin-lösenord ska vara krypterat"


# ── 8. Schemalagd synk kräver hemlighet ───────────────────────────────────────
def test_cron_endpoint_skyddad():
    assert klient.post("/api/sync/alla").status_code == 401
    assert klient.post("/api/sync/alla", headers={"X-Cron-Secret": "gissning"}).status_code == 401
    assert klient.post("/api/sync/alla?lokal_timme=3", headers={"X-Cron-Secret": "cron-test-hemlighet"}).status_code == 200


# ── 9. CORS: bara appens egna sidor ───────────────────────────────────────────
def test_cors_bara_egna_sidor():
    def preflight(ursprung):
        return klient.options("/api/profile", headers={"Origin": ursprung, "Access-Control-Request-Method": "GET",
                                                       "Access-Control-Request-Headers": "authorization"})
    assert preflight("https://training-agent-ai.netlify.app").headers.get("access-control-allow-origin") == "https://training-agent-ai.netlify.app"
    assert "access-control-allow-origin" not in preflight("https://elak-sida.example").headers


# ── 10. Appen startar inte utan riktig JWT-hemlighet ──────────────────────────
def test_vagrar_starta_utan_jwt_hemlighet():
    for värde in ["", "kort"]:
        r = subprocess.run([sys.executable, "-c", "import api.routes.auth"], cwd=REPO, capture_output=True, text=True,
                           env={**os.environ, "JWT_SECRET": värde})
        assert r.returncode != 0 and "JWT_SECRET" in r.stderr
