import json
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent
DB_PATH = BASE_DIR / "data" / "training.db"

GARMIN_WELLNESS = Path.home() / "Downloads" / "da122418-4c02-4a26-b89b-f2df8f7ef08f_1" / "DI_CONNECT" / "DI-Connect-Wellness"

def load_pulszoner() -> dict:
    zon_fil = GARMIN_WELLNESS / "96397825_heartRateZones.json"
    with open(zon_fil) as f:
        data = json.load(f)
    for z in data:
        if z.get("sport") == "RUNNING":
            return {
                "zon1": (z["zone1Floor"], z["zone2Floor"]),
                "zon2": (z["zone2Floor"], z["zone3Floor"]),
                "zon3": (z["zone3Floor"], z["zone4Floor"]),
                "zon4": (z["zone4Floor"], z["zone5Floor"]),
                "zon5": (z["zone5Floor"], z["maxHeartRateUsed"]),
                "max":  z["maxHeartRateUsed"]
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
    except Exception as e:
        return ""

def get_context(veckor: int = 12) -> str:
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    sedan = (datetime.now() - timedelta(weeks=veckor)).strftime("%Y-%m-%d")

    c.execute("SELECT langd_cm, vikt_kg, vo2max FROM user_profile LIMIT 1")
    profil = c.fetchone()

    c.execute("SELECT vo2max, datum FROM vo2max_history ORDER BY datum DESC LIMIT 1")
    vo2 = c.fetchone()

    c.execute("""
        SELECT typ, formaterat, datum FROM personal_records
        WHERE current = 1
        AND typ IN ('Best 1km Run', 'Best Half Marathon', 'Best Full Marathon', 'Farthest Run')
        ORDER BY datum
    """)
    pr = c.fetchall()

    c.execute("""
        SELECT datum, typ, distans_km, duration_min, snitt_puls, snitt_tempo, plats
        FROM activities
        WHERE datum >= ?
        AND typ IN ('running', 'treadmill_running')
        AND NOT (LOWER(plats) = 'täby' AND distans_km < 10)
        ORDER BY datum DESC
    """, (sedan,))
    löppass = c.fetchall()

    c.execute("""
        SELECT datum, typ, distans_km, duration_min, snitt_puls, plats
        FROM activities
        WHERE datum >= ?
        ORDER BY datum DESC
    """, (sedan,))
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
        c.execute("""
            SELECT ROUND(AVG(snitt_puls),0), ROUND(AVG(distans_km/(duration_min/60.0)),2), COUNT(*)
            FROM activities
            WHERE typ IN ('running','treadmill_running')
            AND snitt_puls BETWEEN ? AND ?
            AND distans_km > 2
            AND NOT (LOWER(plats) = 'täby' AND distans_km < 10)
        """, (low, high))
        return c.fetchone()

    zon2 = zon_stats(*PULSZONER["zon2"])
    zon3 = zon_stats(*PULSZONER["zon3"])
    zon4 = zon_stats(*PULSZONER["zon4"])

    c.execute("""
        SELECT datum, sovtid_min, djup_sov_min, latt_sov_min, vaken_min
        FROM sleep_daily
        WHERE datum >= ?
        ORDER BY datum DESC
        LIMIT 14
    """, ((datetime.now() - timedelta(days=14)).strftime("%Y-%m-%d"),))
    sömn = c.fetchall()

    c.execute("""
        SELECT datum, vilpuls, body_battery_hogst, body_battery_lagst, stress_snitt, steg
        FROM health_daily
        WHERE datum >= ?
        ORDER BY datum DESC
        LIMIT 7
    """, ((datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d"),))
    hälsa = c.fetchall()

    c.execute("SELECT datum, vilpuls, body_battery_hogst, body_battery_lagst, stress_snitt FROM health_daily ORDER BY datum DESC LIMIT 1")
    idag = c.fetchone()

    conn.close()

    lines = []
    lines.append("=== TRÄNINGSPROFIL ===\n")

    if profil:
        lines.append(f"ANVÄNDARPROFIL: {profil[0]} cm | {profil[1]} kg | VO2max: {profil[2]}")
    if vo2:
        lines.append(f"SENASTE VO2MAX: {vo2[0]} ({vo2[1]})")

    lines.append("\nPERSONLIGA REKORD:")
    for row in pr:
        lines.append(f"  {row[0]}: {row[1]} ({row[2]})")

    lines.append(f"\nPULSZONER (löpning, maxpuls {MAX_PULS}):")
    lines.append(f"  Zon 1: {PULSZONER['zon1'][0]}-{PULSZONER['zon1'][1]} bpm")
    lines.append(f"  Zon 2: {PULSZONER['zon2'][0]}-{PULSZONER['zon2'][1]} bpm | faktiskt tempo: {kmh_till_tempo(zon2[1])} | {zon2[2]} pass")
    lines.append(f"  Zon 3: {PULSZONER['zon3'][0]}-{PULSZONER['zon3'][1]} bpm | faktiskt tempo: {kmh_till_tempo(zon3[1])} | {zon3[2]} pass")
    lines.append(f"  Zon 4: {PULSZONER['zon4'][0]}-{PULSZONER['zon4'][1]} bpm | faktiskt tempo: {kmh_till_tempo(zon4[1])} | {zon4[2]} pass")

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
    for row in hälsa:
        lines.append(f"  {row[0]} | vilopuls: {row[1]} | BB: {row[2]}/{row[3]} | stress: {row[4]} | steg: {row[5]}")

    lines.append(f"\nSÖMN SENASTE 14 DAGAR (bekräftade nätter):")
    if sömn:
        for row in sömn:
            lines.append(f"  {row[0]} | total: {row[1]} min | djup: {row[2]} min | lätt: {row[3]} min | vaken: {row[4]} min")
    else:
        lines.append("  Ingen bekräftad sömndata tillgänglig")

    return "\n".join(lines)

if __name__ == "__main__":
    print(get_context())