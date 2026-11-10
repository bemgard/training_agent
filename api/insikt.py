"""Fas 4: coachens egna insikter. Morgoninsikt efter morgonsynken, veckosammanfattning på söndagar.
Samma systemprompt och kontext som chatten, plus en uppgift som kräver kort JSON-svar."""
import json
import os
import re
from datetime import date
from pathlib import Path
import anthropic
from api.database import open_conn, USE_SQLITE
from scripts.context_builder import get_context
from scripts.plan import Plan

ph = "?" if USE_SQLITE else "%s"
MODELL = os.environ.get("COACH_MODELL", "claude-haiku-5-5")
MAX_PER_DAG = 3
PROMPT = Path(__file__).parent.parent / "coach" / "system_prompt.txt"

UPPGIFT = {
    "morgon": """== UPPGIFT: MORGONINSIKT ==
Detta är inte ett samtal. Skriv dagens morgoninsikt som atleten ser på översikten när hen öppnar appen.
Gå igenom DAGSFORM, natten (sömn, HRV, vilopuls, hudtemp), readiness, belastningen och dagens pass i VECKANS PLAN — och säg vad atleten ska göra idag.
Svara med ENBART giltig JSON, inget annat:
{"rubrik": "max 8 ord, det viktigaste idag", "text": "2–4 korta meningar: vad datan säger och vad du rekommenderar, med konkreta värden", "rekommendation": "som_planerat | justera | vila | fritt", "plan": null}
- som_planerat: dagens planerade pass passar — nämn det. justera: dagens pass bör ändras. vila: ingen träning idag. fritt: ingen plan för idag (föreslå ändå något kort i texten om det passar)
- Vid justera, eller fritt när ett pass passar: sätt "plan" till ett planobjekt i samma format som [PLAN]-blocket med ENDAST dagens pass (inte resten av veckan). Annars null
- Vid tidig sjukdomssignal utan dagsform: skriv det och be atleten fylla i dagsformen
- Följ alla regler om dagsform, sjukdom och smärta — de gäller även här""",
    "vecka": """== UPPGIFT: VECKOSAMMANFATTNING ==
Detta är inte ett samtal. Det är söndag — skriv veckans sammanfattning som atleten ser på översikten.
Gå igenom veckan: planerat mot genomfört (VECKANS PLAN), träningsvolym och fördelning (VECKOSAMMANFATTNING), belastning (ACWR), sömn- och HRV-trend och dagsform/besvär — och vad nästa vecka bör fokusera på utifrån målet.
Svara med ENBART giltig JSON, inget annat:
{"rubrik": "max 8 ord om veckan", "text": "3–5 korta meningar med konkreta värden", "hojdpunkter": ["max 3 korta punkter, det som gick bra"], "fokus": "1–2 meningar om nästa vecka"}""",
}


def _systemprompt(user_id):
    return PROMPT.read_text() + f"\n\n== ANVÄNDARENS TRÄNINGSDATA ==\n{get_context(veckor=12, user_id=user_id)}"


def _tolka(svar_text, typ):
    m = re.search(r"\{[\s\S]*\}", svar_text)
    if not m:
        raise ValueError("inget JSON i svaret")
    d = json.loads(m.group(0))
    ut = {"rubrik": str(d.get("rubrik") or "")[:120], "text": str(d.get("text") or "")[:1500]}
    if not ut["rubrik"] or not ut["text"]:
        raise ValueError("rubrik eller text saknas")
    if typ == "morgon":
        rek = d.get("rekommendation")
        ut["rekommendation"] = rek if rek in ("som_planerat", "justera", "vila", "fritt") else "fritt"
        ut["plan"] = None
        if isinstance(d.get("plan"), dict) and ut["rekommendation"] != "vila":
            try:
                plan = Plan.model_validate(d["plan"])
                if len(plan.pass_) == 1:  # morgoninsikten får bara röra dagens pass
                    ut["plan"] = plan.model_dump(by_alias=True, exclude_none=True)
            except Exception:
                pass  # ogiltig plan → visa bara texten
    else:
        ut["hojdpunkter"] = [str(h)[:200] for h in (d.get("hojdpunkter") or [])][:3]
        ut["fokus"] = str(d.get("fokus") or "")[:500]
    return ut


def generera(user_id, typ, klient=None):
    klient = klient or anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    svar = klient.messages.create(
        model=MODELL, max_tokens=4000, system=_systemprompt(user_id),
        messages=[{"role": "user", "content": UPPGIFT[typ]}])
    text = "".join(b.text for b in svar.content if getattr(b, "type", "") == "text")
    return _tolka(text, typ)


def hämta(c, user_id, datum, typ):
    c.execute(f"SELECT innehall, antal, skapad FROM insikter WHERE user_id = {ph} AND datum = {ph} AND typ = {ph}",
              (user_id, datum, typ))
    r = c.fetchone()
    if not r:
        return None
    r = dict(r)
    d = json.loads(r["innehall"])
    d.update({"datum": datum, "typ": typ, "antal": r["antal"],
              "skapad": r["skapad"].isoformat() if hasattr(r["skapad"], "isoformat") else r["skapad"]})
    return d


def skapa(user_id, typ, datum: date, källa, tvinga=False, klient=None):
    """Skapar (eller med tvinga=True uppdaterar) insikten. Returnerar den, eller None om taket är nått
    eller den redan finns och tvinga=False."""
    conn = open_conn()
    try:
        c = conn.cursor()
        c.execute(f"SELECT antal FROM insikter WHERE user_id = {ph} AND datum = {ph} AND typ = {ph}",
                  (user_id, datum.isoformat(), typ))
        r = c.fetchone()
        antal = (r["antal"] if not isinstance(r, tuple) else r[0]) if r else 0
        if r and (not tvinga or antal >= MAX_PER_DAG):
            return None
    finally:
        conn.close()

    innehåll = generera(user_id, typ, klient)  # utan öppen anslutning — kan ta några sekunder

    conn = open_conn()
    try:
        c = conn.cursor()
        c.execute(f"""
            INSERT INTO insikter (user_id, datum, typ, innehall, kalla) VALUES ({ph}, {ph}, {ph}, {ph}, {ph})
            ON CONFLICT (user_id, datum, typ) DO UPDATE SET innehall = excluded.innehall, kalla = excluded.kalla,
                antal = insikter.antal + 1, skapad = CURRENT_TIMESTAMP
        """, (user_id, datum.isoformat(), typ, json.dumps(innehåll, ensure_ascii=False), källa))
        conn.commit()
        return hämta(c, user_id, datum.isoformat(), typ)
    finally:
        conn.close()
