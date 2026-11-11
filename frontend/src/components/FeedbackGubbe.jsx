import { useEffect, useRef, useState } from "react"
import { X, Send } from "lucide-react"
import { skickaFeedback, markeraFeedbackSett } from "../api"

// Streckgubben i vänstra hörnet: ett tryck förstorar pratbubblan till en feedbackruta.
// Det som skrivs hamnar i Calles inkorg (tabellen feedback), inte hos AI-coachen.
const TYPER = [
  { id: "fel", text: "🐞 Något är fel" },
  { id: "ide", text: "💡 Idé" },
  { id: "gillar", text: "😍 Gillar" },
]
const FLIKNAMN = { dashboard: "översikten", trender: "trender", chat: "coachen", plan: "träningsplanen", kost: "kost", inkorg: "inkorgen" }
const PÅMINNELSE_DAGAR = 7

function läsTid(nyckel) {
  try { return Number(localStorage.getItem(nyckel)) || 0 } catch { return 0 }
}
function sparaTid(nyckel) {
  try { localStorage.setItem(nyckel, String(Date.now())) } catch { /* privat läge */ }
}

export default function FeedbackGubbe({ flik, nyheter = [], onNyheterSedda }) {
  const [öppen, setÖppen] = useState(false)
  const [typ, setTyp] = useState("ide")
  const [text, setText] = useState("")
  const [läge, setLäge] = useState("skriv")   // skriv | skickar | tack | fel
  const [visaHej, setVisaHej] = useState(false)
  const textRef = useRef(null)

  // En liten "Tyck till?"-bubbla första gången och sedan högst en gång i veckan, i några sekunder
  useEffect(() => {
    if (Date.now() - läsTid("gubbeHej") < PÅMINNELSE_DAGAR * 864e5) return
    const på = setTimeout(() => { setVisaHej(true); sparaTid("gubbeHej") }, 4000)
    const av = setTimeout(() => setVisaHej(false), 12000)
    return () => { clearTimeout(på); clearTimeout(av) }
  }, [])

  useEffect(() => { if (öppen && läge === "skriv") setTimeout(() => textRef.current?.focus(), 220) }, [öppen, läge])

  function stäng() {
    setÖppen(false)
    if (läge !== "skriv") setTimeout(() => { setLäge("skriv"); setText("") }, 250)
  }

  async function skicka() {
    if (!text.trim()) return
    setLäge("skickar")
    const r = await skickaFeedback(typ, text.trim(), {
      flik: FLIKNAMN[flik] || flik, enhet: window.innerWidth <= 700 ? "mobil" : "dator",
      bredd: window.innerWidth, version: "2026-11-11",
    })
    if (!r.ok) return setLäge("fel")
    setLäge("tack")
    setText("")
    setTimeout(() => { setÖppen(false); setTimeout(() => setLäge("skriv"), 250) }, 2200)
  }

  async function nyheterLästa() {
    await Promise.all(nyheter.map(n => markeraFeedbackSett(n.id)))
    onNyheterSedda?.()
    setÖppen(false)
  }

  const harNyheter = nyheter.length > 0
  return (
    <div className="feedback-gubbe">
      {/* Pratbubblan — växer ut från gubben */}
      <div className={`gubbe-bubbla${öppen ? " oppen" : ""}`} role="dialog" aria-label="Tyck till om appen" aria-hidden={!öppen}>
        <button className="gubbe-stang" onClick={stäng} title="Stäng"><X size={16} /></button>
        {harNyheter ? (
          <div>
            <div className="gubbe-rubrik">Tack vare dig! 🙌</div>
            {nyheter.map(n => (
              <div key={n.id} className="gubbe-nyhet">
                <div className="gubbe-citat">"{n.text.length > 90 ? n.text.slice(0, 90) + "…" : n.text}"</div>
                <div>✓ {n.svar}</div>
              </div>
            ))}
            <button className="gubbe-skicka" onClick={nyheterLästa}>Toppen!</button>
          </div>
        ) : läge === "tack" ? (
          <div className="gubbe-tack">
            <div style={{ fontSize: 28 }}>🙌</div>
            <div className="gubbe-rubrik">Tack!</div>
            <div className="gubbe-under">Calle läser allt.</div>
          </div>
        ) : (
          <div>
            <div className="gubbe-rubrik">God dag! Vad tycker du om appen?</div>
            <div className="gubbe-under">Det du skriver går direkt till Calle som bygger appen.</div>
            <div className="gubbe-typer">
              {TYPER.map(t => (
                <button key={t.id} className={typ === t.id ? "vald" : ""} onClick={() => setTyp(t.id)}>{t.text}</button>
              ))}
            </div>
            <textarea ref={textRef} value={text} onChange={e => setText(e.target.value)} maxLength={2000} rows={4}
              onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) skicka() }}
              placeholder={{ fel: "Vad hände? Vad hade du väntat dig?", ide: "Vad skulle göra appen bättre för dig?", gillar: "Vad gillar du?" }[typ]} />
            {läge === "fel" && <div style={{ color: "#f87171", fontSize: 12, marginTop: 6 }}>Kunde inte skicka — försök igen.</div>}
            <button className="gubbe-skicka" onClick={skicka} disabled={!text.trim() || läge === "skickar"}>
              <Send size={14} /> {läge === "skickar" ? "Skickar…" : "Skicka"}
            </button>
          </div>
        )}
      </div>

      {/* Liten hälsning ibland */}
      {!öppen && (visaHej || harNyheter) && (
        <button className="gubbe-hej" onClick={() => { setVisaHej(false); setÖppen(true) }}>
          {harNyheter ? "Jag har nyheter!" : "Tyck till?"}
        </button>
      )}

      <button className={`gubbe-knapp${harNyheter ? " nyhet" : ""}`} onClick={() => { setVisaHej(false); öppen ? stäng() : setÖppen(true) }}
        title="Tyck till om appen" aria-label="Tyck till om appen">
        <img src="/gubbe.png" alt="" draggable="false" />
      </button>
    </div>
  )
}
