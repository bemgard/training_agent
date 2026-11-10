import os
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
try:
    from scripts.aktivitetstyp import effektiv_typ, hämta_regler, KATEGORIER
    from scripts.atletprofil import beskriv as beskriv_atlet
    from scripts.dagsform import beskriv as beskriv_dagsform, sjukvarning
    from scripts.kropp import beräkna as beräkna_kropp
    from scripts.belastning import daglig_serie, maxpuls as maxpuls_belastning
    from scripts.mal import beskriv as beskriv_mål
except ImportError:
    from aktivitetstyp import effektiv_typ, hämta_regler, KATEGORIER
    from atletprofil import beskriv as beskriv_atlet
    from dagsform import beskriv as beskriv_dagsform, sjukvarning
    from kropp import beräkna as beräkna_kropp
    from belastning import daglig_serie, maxpuls as maxpuls_belastning
    from mal import beskriv as beskriv_mål

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

    if user_id:
        c.execute(f"SELECT langd_cm, vikt_kg, vo2max FROM user_profile WHERE id = {ph} LIMIT 1", (user_id,))
    else:
        c.execute("SELECT langd_cm, vikt_kg, vo2max FROM user_profile LIMIT 1")
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

    regler = hämta_regler(c, user_id, ph)

    # Alla löpregistrerade pass (hela historiken) — filtreras via effektiv_typ så att
    # användarens egna regler (t.ex. fotbollsplan loggad som löpning) och manuella val gäller
    c.execute(f"""
        SELECT datum, typ, distans_km, duration_min, snitt_puls, snitt_tempo, plats, typ_manuell
        FROM activities
        WHERE typ IN ('running', 'treadmill_running', 'trail_running') {uid_filter}
        ORDER BY datum DESC
    """, uid_val)
    alla_löp = [r for r in c.fetchall()
                if effektiv_typ(r[1], r[6], r[2], r[3], r[4], r[7], regler)[0] == "running"]
    löppass = [r for r in alla_löp if r[0] >= sedan]

    c.execute(f"""
        SELECT datum, typ, distans_km, duration_min, snitt_puls, plats, typ_manuell, namn
        FROM activities
        WHERE datum >= {ph} {uid_filter}
        ORDER BY datum DESC
    """, (sedan,) + uid_val)
    alla = c.fetchall()

    from collections import defaultdict
    veckor_data = defaultdict(lambda: {"pass": [], "km": 0, "löp_km": 0, "min": 0, "typer": defaultdict(float)})
    övriga_pass = []
    for rad in alla:
        datum, typ, distans_km, duration_min, snitt_puls, plats, typ_manuell, namn = rad
        kategori, gissad = effektiv_typ(typ, plats, distans_km, duration_min, snitt_puls, typ_manuell, regler)
        label = KATEGORIER.get(kategori, "Oklassat pass") if kategori else "Oklassat pass"
        vecka = datetime.strptime(datum, "%Y-%m-%d").strftime("%Y-W%W")
        v = veckor_data[vecka]
        v["pass"].append(label)
        v["km"] += distans_km or 0
        if kategori == "running":
            v["löp_km"] += distans_km or 0
        v["min"] += duration_min or 0
        v["typer"][label] += duration_min or 0
        if kategori != "running" and len(övriga_pass) < 15:
            övriga_pass.append((datum, label + (" (gissning)" if gissad else ""), duration_min, snitt_puls, distans_km))

    def zon_stats(low, high):
        urval = [r for r in alla_löp
                 if r[4] is not None and low <= r[4] <= high and (r[2] or 0) > 2 and (r[3] or 0) > 0]
        if not urval:
            return (None, None, 0)
        snittpuls = round(sum(r[4] for r in urval) / len(urval))
        kmh = round(sum(r[2] / (r[3] / 60.0) for r in urval) / len(urval), 2)
        return (snittpuls, kmh, len(urval))

    zon2 = zon_stats(*pulszoner["zon2"])
    zon3 = zon_stats(*pulszoner["zon3"])
    zon4 = zon_stats(*pulszoner["zon4"])

    c.execute(f"""
        SELECT datum, sovtid_min, djup_sov_min, latt_sov_min, vaken_min, rem_sov_min,
               somnpoang, somn_kvalitet, hrv_natt, hrv_status, hrv_7d,
               hrv_baslinje_lag, hrv_baslinje_hog, vilopuls_natt, bb_laddning, hudtemp_avvikelse
        FROM sleep_daily
        WHERE datum >= {ph} {uid_filter}
        ORDER BY datum DESC LIMIT 14
    """, ((datetime.now() - timedelta(days=14)).strftime("%Y-%m-%d"),) + uid_val)
    sömn = c.fetchall()

    c.execute(f"""
        SELECT datum, poang, niva, feedback, somn_faktor, somnhistorik_faktor,
               aterhamtning_faktor, aterhamtning_min, belastning_faktor, akut_belastning,
               stress_faktor, hrv_faktor, uppdaterad
        FROM readiness_daily
        WHERE datum >= {ph} {uid_filter}
        ORDER BY datum DESC LIMIT 7
    """, ((datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d"),) + uid_val)
    readiness = c.fetchall()

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

    c.execute(f"""
        SELECT datum, snitt_puls, max_puls, duration_min, zon1_sek, zon2_sek, zon3_sek, zon4_sek, zon5_sek
        FROM activities {('WHERE user_id = ' + ph) if user_id else ''} ORDER BY datum
    """, uid_val)
    kolumner = ["datum", "snitt_puls", "max_puls", "duration_min", "zon1_sek", "zon2_sek", "zon3_sek", "zon4_sek", "zon5_sek"]
    alla_pass = [dict(zip(kolumner, r)) for r in c.fetchall()]
    belastning = daglig_serie(alla_pass, maxpuls_belastning(alla_pass))

    aktivt_mål = None
    if user_id:
        mål_kolumner = ["typ", "titel", "slutdatum", "distans_km", "maltid", "sport", "fokus",
                        "kondition_per_vecka", "styrka_per_vecka", "traningsdagar", "anteckning"]
        c.execute(f"SELECT {', '.join(mål_kolumner)} FROM mal WHERE user_id = {ph} AND aktiv = {ph} ORDER BY skapad DESC LIMIT 1",
                  (user_id, True))
        rad = c.fetchone()
        aktivt_mål = dict(zip(mål_kolumner, rad)) if rad else None

    atlet = None
    if user_id:
        atlet_kolumner = ["erfarenhet", "sporter", "utrustning", "skador", "preferenser", "fritext"]
        c.execute(f"SELECT {', '.join(atlet_kolumner)} FROM atletprofil WHERE user_id = {ph}", (user_id,))
        rad = c.fetchone()
        atlet = dict(zip(atlet_kolumner, rad)) if rad else None

    idag_datum = datetime.now().date()
    rapporter, besvär, varning = [], [], None
    if user_id:
        k = ["datum", "allmant", "symtom", "temp", "fritext"]
        c.execute(f"SELECT {', '.join(k)} FROM dagsform WHERE user_id = {ph} AND datum >= {ph} ORDER BY datum DESC",
                  (user_id, (idag_datum - timedelta(days=2)).isoformat()))
        rapporter = [dict(zip(k, r)) for r in c.fetchall()]
        k = ["kroppsdel", "typ", "niva", "niva_start", "start_datum", "senast_datum", "anteckning"]
        c.execute(f"SELECT {', '.join(k)} FROM besvar WHERE user_id = {ph} AND aktiv = {ph} ORDER BY start_datum",
                  (user_id, True))
        besvär = [dict(zip(k, r)) for r in c.fetchall()]
        k = ["datum", "hudtemp_avvikelse", "hrv_natt", "vilopuls_natt"]
        c.execute(f"SELECT {', '.join(k)} FROM sleep_daily WHERE user_id = {ph} ORDER BY datum DESC LIMIT 15", (user_id,))
        varning = sjukvarning([dict(zip(k, r)) for r in c.fetchall()])
        if varning and (idag_datum - datetime.strptime(varning["datum"], "%Y-%m-%d").date()).days > 1:
            varning = None

    kropp = []
    kroppsprofil = (None, None, None)
    if user_id:
        c.execute(f"SELECT langd_cm, fodelsear, kon FROM users WHERE id = {ph}", (user_id,))
        kroppsprofil = c.fetchone() or kroppsprofil
        c.execute(f"""
            SELECT datum, vikt_kg, fett_procent, muskel_kg FROM weight_log
            WHERE user_id = {ph} AND datum >= {ph} ORDER BY datum ASC
        """, (user_id, (datetime.now() - timedelta(days=120)).strftime("%Y-%m-%d")))
        kropp = [beräkna_kropp({"datum": r[0], "vikt_kg": r[1], "fett_procent": r[2], "muskel_kg": r[3]}, *kroppsprofil)
                 for r in c.fetchall()]

    conn.close()

    lines = []
    lines.append("=== TRÄNINGSPROFIL ===\n")
    lines.append(f"DAGENS DATUM: {datetime.now().strftime('%Y-%m-%d (%A)')}")

    lines.append("\nDAGSFORM (självrapporterat av atleten — väger TYNGRE än klockans data, se reglerna för dagsform):")
    lines.extend(beskriv_dagsform(rapporter, besvär, varning, idag_datum))

    lines.append("\nOM ATLETEN (atletens egna uppgifter — respektera skador, utrustning och preferenser):")
    lines.extend(beskriv_atlet(atlet, regler, KATEGORIER))

    lines.append("\nATLETENS MÅL:")
    if aktivt_mål:
        lines.extend(beskriv_mål(aktivt_mål, datetime.now().date()))
    else:
        lines.append("  Inget mål angivet — utgå från aerob basbyggnad och föreslå att atleten lägger in ett mål under Träningsplan.")

    if profil:
        lines.append(f"ANVÄNDARPROFIL: {profil[0]} cm | {profil[1]} kg | VO2max: {profil[2]}")
    if vo2:
        lines.append(f"SENASTE VO2MAX: {vo2[0]} ({vo2[1]})")

    if kropp:
        k = kropp[-1]
        rad = f"KROPP (senaste invägning {k['datum']}): {k['vikt_kg']} kg"
        if k.get("bmi"):
            rad += f" | BMI {k['bmi']}"
        if k.get("fett_procent") is not None:
            rad += f" | fett {k['fett_procent']} %" + (" (grov uppskattning ±5, ej mätt)" if k.get("fett_procent_uppskattad") else " (uppmätt)")
        if k.get("muskel_kg") is not None:
            rad += f" | muskelmassa {k['muskel_kg']} kg (uppmätt)"
        lines.append(rad)
        gräns = (datetime.strptime(k["datum"], "%Y-%m-%d") - timedelta(days=30)).strftime("%Y-%m-%d")
        tidigare = [x for x in kropp if x["datum"] <= gräns] or kropp[:1]
        if tidigare and tidigare[-1] is not k:
            t = tidigare[-1]
            diff = round(k["vikt_kg"] - t["vikt_kg"], 1)
            lines.append(f"  Viktförändring sedan {t['datum']}: {'+' if diff >= 0 else ''}{diff} kg ({len(kropp)} invägningar senaste 120 dagarna)")

    lines.append("\nPERSONLIGA REKORD:")
    for row in pr:
        lines.append(f"  {row[0]}: {row[1]} ({row[2]})")

    lines.append(f"\nPULSZONER (löpning, maxpuls {pulszoner['max']}):")
    lines.append(f"  Zon 1: {pulszoner['zon1'][0]}-{pulszoner['zon1'][1]} bpm")
    lines.append(f"  Zon 2: {pulszoner['zon2'][0]}-{pulszoner['zon2'][1]} bpm | faktiskt tempo: {kmh_till_tempo(zon2[1])} | {zon2[2]} pass")
    lines.append(f"  Zon 3: {pulszoner['zon3'][0]}-{pulszoner['zon3'][1]} bpm | faktiskt tempo: {kmh_till_tempo(zon3[1])} | {zon3[2]} pass")
    lines.append(f"  Zon 4: {pulszoner['zon4'][0]}-{pulszoner['zon4'][1]} bpm | faktiskt tempo: {kmh_till_tempo(zon4[1])} | {zon4[2]} pass")

    if belastning and belastning[-1]["kronisk"] is not None:
        b = belastning[-1]
        lines.append("\nTRÄNINGSBELASTNING (Edwards TRIMP från pulszoner — mäter kondition, inte muskulär belastning från styrka):")
        lines.append(f"  Akut (7 d): {b['akut']} | Kronisk (snitt/vecka, 28 d): {b['kronisk']} | ACWR: {b['acwr']} → {b['zon']}")
        veckovis = [belastning[i] for i in range(len(belastning) - 1, max(-1, len(belastning) - 29), -7)]
        lines.append("  Akut belastning vecka för vecka (nyast först): " + ", ".join(f"{x['datum']}: {x['akut']}" for x in veckovis))

    lines.append(f"\nVECKOSAMMANFATTNING (senaste {veckor} veckor):")
    for vecka in sorted(veckor_data.keys(), reverse=True):
        v = veckor_data[vecka]
        typer = ", ".join(f"{t} {round(m)} min" for t, m in sorted(v["typer"].items(), key=lambda x: -x[1]))
        lines.append(f"  {vecka}: {len(v['pass'])} pass | {round(v['min'])} min totalt | löpning {round(v['löp_km'],1)} km | {typer}")

    lines.append("\nÖVRIGA PASS (ej löpning, senaste):")
    for datum, label, minuter, puls, km in övriga_pass:
        km_txt = f" | {km} km" if km and km >= 1 else ""
        lines.append(f"  {datum} | {label} | {round(minuter or 0)} min | puls {puls or '-'}{km_txt}")

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

    idag_str = datetime.now().strftime("%Y-%m-%d")

    def tim(minuter):
        if minuter is None:
            return "-"
        return f"{int(minuter // 60)}h{int(minuter % 60):02d}m"

    lines.append("\nÅTERHÄMTNING (training readiness och HRV):")
    if readiness:
        r = readiness[0]
        tidpunkt = (r[12] or "")[11:16]
        if r[0] == idag_str:
            lines.append(f"  Training Readiness IDAG ({r[0]}, uppdaterad {tidpunkt}): {r[1]}/100 {r[2]} ({r[3]})")
        else:
            lines.append(f"  Ingen readiness för idag ännu. Senaste: {r[0]} — {r[1]}/100 {r[2]} ({r[3]})")
        återh_h = f" (kvar {round(r[7] / 60, 1)} h)" if r[7] is not None else ""
        lines.append(f"    Faktorer: sömn {r[4]}% | sömnhistorik {r[5]}% | återhämtningstid {r[6]}%{återh_h} | "
                     f"belastning/ACWR {r[8]}% (akut belastning {r[9]}) | stresshistorik {r[10]}% | HRV {r[11]}%")
        if len(readiness) > 1:
            lines.append("    Trend: " + ", ".join(f"{x[0][5:]}: {x[1]}" for x in reversed(readiness)))
    else:
        lines.append("  Ingen training readiness tillgänglig (enheten stödjer det troligen inte)")

    hrv_nätter = [row for row in sömn if row[8] is not None]
    if hrv_nätter:
        h = hrv_nätter[0]
        # Garmin jämför 7-dagarssnittet (inte enskild natt) mot baslinjen — gör likadant
        if h[10] is not None and h[11] is not None and h[12] is not None:
            if h[10] < h[11]:
                läge = "UNDER"
            elif h[10] > h[12]:
                läge = "ÖVER"
            else:
                läge = "inom"
            lines.append(f"  HRV 7-dagarssnitt: {int(h[10])} ms → {läge} personlig baslinje {int(h[11])}–{int(h[12])} | status {h[9]}")
        else:
            lines.append(f"  HRV-status: {h[9]} (baslinje saknas — Garmin behöver ~3 veckors data)")
        jämfört = ""
        if h[10]:
            diff = round((h[8] - h[10]) / h[10] * 100)
            jämfört = f" ({'+' if diff >= 0 else ''}{diff}% mot 7-dagarssnittet)"
        lines.append(f"  HRV senaste natten ({h[0]}): {int(h[8])} ms{jämfört} — enskilda nätter varierar, väg in trenden")
        lines.append("    HRV per natt: " + ", ".join(f"{x[0][5:]}: {int(x[8])}" for x in reversed(hrv_nätter[:7])))
    else:
        lines.append("  Ingen HRV-data — enheten stödjer troligen inte HRV-status. Bedöm återhämtning via sömn, vilopuls och Body Battery.")

    lines.append(f"\nSÖMN SENASTE 14 NÄTTER (datum = morgonen natten slutade):")
    if sömn:
        for row in sömn:
            delar = [f"  {row[0]} | {tim(row[1])}"]
            if row[6] is not None:
                delar.append(f"poäng {row[6]} ({row[7]})")
            delar.append(f"djup {tim(row[2])} | REM {tim(row[5])} | lätt {tim(row[3])} | vaken {tim(row[4])}")
            if row[13] is not None:
                delar.append(f"vilopuls {row[13]}")
            if row[14] is not None:
                delar.append(f"BB-laddning +{row[14]}")
            if row[15] is not None:
                delar.append(f"hudtemp {row[15]:+.1f} °C")
            lines.append(" | ".join(delar))
    else:
        lines.append("  Ingen bekräftad sömndata tillgänglig")

    return "\n".join(lines)

if __name__ == "__main__":
    print(get_context())