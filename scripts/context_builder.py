import os
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent
DB_PATH = BASE_DIR / "data" / "training.db"

DATABASE_URL = os.environ.get("DATABASE_URL")
USE_SQLITE = not DATABASE_URL
ph = "?" if USE_SQLITE else "%s"

def _get_conn():
    if USE_SQLITE:
        return sqlite3.connect(DB_PATH)
    import psycopg2
    return psycopg2.connect(DATABASE_URL)

def load_pulszoner(user_id: int = None) -> dict:
    conn = _get_conn()
    c = conn.cursor()
    if user_id:
        c.execute(f"SELECT MAX(max_puls) FROM activities WHERE typ IN ('running', 'treadmill_running') AND user_id = {ph}", (user_id,))
    else:
        c.execute("SELECT MAX(max_puls) FROM activities WHERE typ IN ('running', 'treadmill_running')")
    max_puls = c.fetchone()[0] or 190
    conn.close()

    return {
        "zon1": (int(max_puls * 0.50), int(max_puls * 0.60)),
        "zon2": (int(max_puls * 0.60), int(max_puls * 0.70)),
        "zon3": (int(max_puls * 0.70), int(max_puls * 0.80)),
        "zon4": (int(max_puls * 0.80), int(max_puls * 0.90)),
        "zon5": (int(max_puls * 0.90), max_puls),
        "max":  max_puls
    }

PULSZONER = load_pulszoner()
MAX_PULS = PULSZONER["max"]

def classify_activity(typ: str, plats: str, distans_km: float) -> str:
    plats = (plats or "").lower()
    if "täby" in plats and typ in ("running", "treadmill_running") and distans_km < 10:
        return "football"
    if typ in ("running", "treadmill_running"):
        return "running"
    if typ == "hiit":
        return "hiit"
    if typ == "indoor_cardio":
        return "cardio"
    if typ == "cross_country_skiing_ws":
        return "skiing"
    return typ

def kmh_till_tempo(kmh):
    if not kmh or kmh == 0:
        return "okänt"
    sek_per_km = 3600 / kmh
    return f"{int(sek_per_km // 60)}:{int(sek_per_km % 60):02d}/km"

def get_rag_context(fråga: str, antal: int = 3) -> str:
    try:
        import chromadb
        from chromadb.utils import embedding_functions

        CHROMA_DIR = BASE_DIR / "data" / "chroma"
        client = chromadb.PersistentClient(path=str(CHROMA_DIR))
        ef = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name="all-MiniLM-L6-v2"
        )
        collection = client.get_collection("training_knowledge", embedding_function=ef)
        results = collection.query(query_texts=[fråga], n_results=antal)

        if not results["documents"][0]:
            return ""

        lines = ["\n=== VETENSKAPLIG KUNSKAP ===\n"]
        for doc, meta in zip(results["documents"][0], results["metadatas"][0]):
            lines.append(f"[{meta['rubrik']}]")
            lines.append(doc)
            lines.append("")

        return "\n".join(lines)
    except Exception:
        return ""

def get_context(veckor: int = 12, user_id: int = None) -> str:
    conn = _get_conn()
    c = conn.cursor()
    sedan = (datetime.now() - timedelta(weeks=veckor)).strftime("%Y-%m-%d")

    uid_filter = f"AND user_id = {ph}" if user_id else ""
    uid_val = (user_id,) if user_id else ()

    pulszoner = load_pulszoner(user_id)

    c.execute(f"SELECT langd_cm, vikt_kg, vo2max FROM user_profile LIMIT 1")
    profil = c.fetchone()

    c.execute(f"SELECT vo2max, datum FROM vo2max_history {('WHERE user_id = ' + ph) if user_id else ''} ORDER BY datum DESC LIMIT 1", uid_val)
    vo2 = c.fetchone()

    c.execute(f"""
        SELECT typ, formaterat, datum FROM personal_records
        WHERE current = 1 {uid_filter}
        AND typ IN ('Best 1km Run', 'Best Half Marathon', 'Best Full Marathon', 'Farthest Run')
        ORDER BY datum
    """, uid_val)
    pr = c.fetchall()

    c.execute(f"""
        SELECT datum, typ, distans_km, duration_min, snitt_puls, snitt_tempo, plats
        FROM activities
        WHERE datum >= {ph} {uid_filter}
        AND typ IN ('running', 'treadmill_running')
        AND NOT (LOWER(plats) = 'täby' AND distans_km < 10)
        ORDER BY datum DESC
    """, (sedan,) + uid_val)
    löppass = c.fetchall()

    c.execute(f"""
        SELECT datum, typ, distans_km, duration_min, snitt_puls, plats
        FROM activities
        WHERE datum >= {ph} {uid_filter}
        ORDER BY datum DESC
    """, (sedan,) + uid_val)
    alla = c.fetchall()

    from collections import defaultdict
    veckor_data = defaultdict(lambda: {"pass": [], "km": 0, "typer": set()})
    for rad in alla:
        datum, typ, distans_km, duration_min, snitt_puls, plats = rad
        vecka = datetime.strptime(datum, "%Y-%m-%d").strftime("%Y-W%W")
        label = classify_activity(typ, plats, distans_km or 0)
        veckor_data[vecka]["pass"].append(label)
        veckor_data[vecka]["km"] += distans_km or 0
        veckor_data[vecka]["typer"].add(label)

    def zon_stats(low, high):
        c.execute(f"""
            SELECT ROUND(AVG(snitt_puls)::numeric, 0), ROUND(AVG(distans_km/(duration_min/60.0))::numeric, 2), COUNT(*)
            FROM activities
            WHERE typ IN ('running','treadmill_running')
            AND snitt_puls BETWEEN {ph} AND {ph}
            AND distans_km > 2
            AND NOT (LOWER(plats) = 'täby' AND distans_km < 10)
            {uid_filter}
        """, (low, high) + uid_val)
        return c.fetchone()
    
    zon2 = zon_stats(*pulszoner["zon2"])
    zon3 = zon_stats(*pulszoner["zon3"])
    zon4 = zon_stats(*pulszoner["zon4"])

    c.execute(f"""
        SELECT datum, sovtid_min, djup_sov_min, latt_sov_min, vaken_min
        FROM sleep_daily
        WHERE datum >= {ph} {uid_filter}
        ORDER BY datum DESC LIMIT 14
    """, ((datetime.now() - timedelta(days=14)).strftime("%Y-%m-%d"),) + uid_val)
    sömn = c.fetchall()

    c.execute(f"""
        SELECT datum, vilpuls, body_battery_hogst, body_battery_lagst, stress_snitt, steg
        FROM health_daily
        WHERE datum >= {ph} {uid_filter}
        ORDER BY datum DESC LIMIT 7
    """, ((datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d"),) + uid_val)
    hälsa = c.fetchall()

    c.execute(f"""
        SELECT datum, vilpuls, body_battery_hogst, body_battery_lagst, stress_snitt
        FROM health_daily {('WHERE user_id = ' + ph) if user_id else ''}
        ORDER BY datum DESC LIMIT 1
    """, uid_val)
    idag = c.fetchone()

    c.execute(f"""
        SELECT datum, steg, aktiva_sek FROM health_daily
        {('WHERE user_id = ' + ph) if user_id else ''}
        ORDER BY datum DESC LIMIT 2
    """, uid_val)
    senaste_dagar = c.fetchall()

    conn.close()

    lines = []
    lines.append("=== TRÄNINGSPROFIL ===\n")
    lines.append(f"DAGENS DATUM: {datetime.now().strftime('%Y-%m-%d (%A)')}")

    if profil:
        lines.append(f"ANVÄNDARPROFIL: {profil[0]} cm | {profil[1]} kg | VO2max: {profil[2]}")
    if vo2:
        lines.append(f"SENASTE VO2MAX: {vo2[0]} ({vo2[1]})")

    lines.append("\nPERSONLIGA REKORD:")
    for row in pr:
        lines.append(f"  {row[0]}: {row[1]} ({row[2]})")

    lines.append(f"\nPULSZONER (löpning, maxpuls {pulszoner['max']}):")
    lines.append(f"  Zon 1: {pulszoner['zon1'][0]}-{pulszoner['zon1'][1]} bpm")
    lines.append(f"  Zon 2: {pulszoner['zon2'][0]}-{pulszoner['zon2'][1]} bpm | faktiskt tempo: {kmh_till_tempo(zon2[1])} | {zon2[2]} pass")
    lines.append(f"  Zon 3: {pulszoner['zon3'][0]}-{pulszoner['zon3'][1]} bpm | faktiskt tempo: {kmh_till_tempo(zon3[1])} | {zon3[2]} pass")
    lines.append(f"  Zon 4: {pulszoner['zon4'][0]}-{pulszoner['zon4'][1]} bpm | faktiskt tempo: {kmh_till_tempo(zon4[1])} | {zon4[2]} pass")

    lines.append(f"\nVECKOSAMMANFATTNING (senaste {veckor} veckor):")
    for vecka in sorted(veckor_data.keys(), reverse=True):
        v = veckor_data[vecka]
        typer = ", ".join(sorted(v["typer"]))
        lines.append(f"  {vecka}: {len(v['pass'])} pass | {round(v['km'],1)} km | {typer}")

    lines.append(f"\nSENASTE LÖPPASS:")
    for row in löppass[:20]:
        tempo = row[5] or "-"
        lines.append(f"  {row[0]} | {row[2]:>5} km | {row[3]:>5} min | puls: {row[4]} | tempo: {tempo} | {row[6]}")

    lines.append(f"\nHÄLSODATA SENASTE 7 DAGAR:")
    if idag:
        lines.append(f"  Senaste ({idag[0]}): vilopuls {idag[1]} | BB {idag[2]}/{idag[3]} | stress {idag[4]}")
        if idag[3] and idag[3] < 30:
            lines.append("  ⚠️  Låg Body Battery — prioritera återhämtning")
        elif idag[3] and idag[3] > 60:
            lines.append("  ✅ Bra Body Battery — redo för hårdare träning")
    if len(senaste_dagar) > 1:
        igår = senaste_dagar[1]
        if igår[1] and igår[1] > 5000:
            lines.append(f"  📊 Gårdagens aktivitet ({igår[0]}): {igår[1]} steg | {round((igår[2] or 0)/60, 0)} aktiva min")
    for row in hälsa:
        lines.append(f"  {row[0]} | vilopuls: {row[1]} | BB: {row[2]}/{row[3]} | stress: {row[4]} | steg: {row[5]}")

    lines.append(f"\nSÖMN SENASTE 14 DAGAR:")
    if sömn:
        for row in sömn:
            lines.append(f"  {row[0]} | total: {row[1]} min | djup: {row[2]} min | lätt: {row[3]} min | vaken: {row[4]} min")
    else:
        lines.append("  Ingen bekräftad sömndata tillgänglig")

    return "\n".join(lines)

if __name__ == "__main__":
    print(get_context())