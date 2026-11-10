"""Jämför coachens svar mellan två modeller på DIN riktiga data (läser, skriver inget).
Kör:  .venv/bin/python scripts/jamfor_modeller.py din@email.se"""
import os, sys, time
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).parent.parent
load_dotenv(BASE_DIR / ".env")
sys.path.insert(0, str(BASE_DIR))
import anthropic, psycopg2
from scripts.context_builder import get_context

MODELLER = {"claude-haiku-4-5-20251001": (1.00, 5.00), "claude-haiku-5-5": (0.10, 0.50)}  # $/MTok in, ut
FRÅGOR = [
    "Hur återhämtad är jag idag, och vad ska jag köra?",
    "Hur har min HRV och vilopuls utvecklats senaste veckan — något att oroa sig för?",
    "Föreslå ett löppass för imorgon med tanke på min belastning.",
]

email = sys.argv[1] if len(sys.argv) > 1 else sys.exit("Användning: jamfor_modeller.py <app-email>")
c = psycopg2.connect(os.environ["DATABASE_URL"]).cursor()
c.execute("SELECT id FROM users WHERE LOWER(email) = %s", (email.lower(),))
user_id = c.fetchone()[0]
system = (BASE_DIR / "coach" / "system_prompt.txt").read_text() + "\n\n== ANVÄNDARENS TRÄNINGSDATA ==\n" + get_context(veckor=12, user_id=user_id)
klient = anthropic.Anthropic()

totalt = {m: 0.0 for m in MODELLER}
for fråga in FRÅGOR:
    print("\n" + "=" * 100 + f"\nFRÅGA: {fråga}\n" + "=" * 100)
    for modell, (pin, pout) in MODELLER.items():
        t0 = time.time()
        svar = klient.messages.create(model=modell, max_tokens=8000, system=system,
                                      messages=[{"role": "user", "content": fråga}])
        kostnad = (svar.usage.input_tokens * pin + svar.usage.output_tokens * pout) / 1e6
        totalt[modell] += kostnad
        text = "".join(b.text for b in svar.content if b.type == "text")
        tänkt = sum(len(getattr(b, "thinking", "") or "") for b in svar.content if b.type == "thinking")
        info = f"{time.time() - t0:.1f} s | {svar.usage.input_tokens} in / {svar.usage.output_tokens} ut | ${kostnad:.4f}"
        if tänkt:
            info += f" | tänkte ~{tänkt // 4} tokens"
        if svar.stop_reason == "max_tokens":
            info += " | ⚠️ AVKLIPPT (max_tokens)"
        print(f"\n--- {modell}  ({info}) ---\n")
        print(text or "(inget svar — bara tänkande)")

print("\n" + "=" * 100)
for modell, kr in totalt.items():
    print(f"{modell}: ${kr:.4f} för {len(FRÅGOR)} frågor  (≈ ${kr / len(FRÅGOR) * 900:.2f}/mån vid 900 frågor)")
