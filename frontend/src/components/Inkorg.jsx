import { useEffect, useState } from "react"
import { Inbox, ThumbsUp, ThumbsDown, Check } from "lucide-react"
import { fetchInkorg, ändraFeedback } from "../api"

// Calles inkorg (bara admin): feedback från gubben och tummar ner på coachen
const TYP = { fel: { ikon: "🐞", namn: "Fel", färg: "#f87171" }, ide: { ikon: "💡", namn: "Idé", färg: "#fbbf24" },
  gillar: { ikon: "😍", namn: "Gillar", färg: "#6ee7b7" }, annat: { ikon: "💬", namn: "Annat", färg: "#94a3b8" } }
const STATUS = { ny: "Ny", planerad: "Planerad", klar: "Klar", avvisad: "Avvisad" }
const C = { surface: "#161b25", border: "#232a38", text: "#f1f5f9", sub: "#94a3b8", muted: "#64748b" }
const knapp = { background: "none", border: `1px solid ${C.border}`, color: C.sub, borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 12.5 }

function tid(iso) {
  const d = new Date(String(iso).replace(" ", "T") + (/[Z+]/.test(String(iso).slice(10)) ? "" : "Z"))
  return d.toLocaleString("sv-SE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
}

function Post({ f, onÄndrad }) {
  const [status, setStatus] = useState(f.status)
  const [svar, setSvar] = useState(f.svar || "")
  const [sparat, setSparat] = useState(false)
  const t = TYP[f.typ] || TYP.annat
  const ändrad = status !== f.status || (svar || "") !== (f.svar || "")
  async function spara() {
    const r = await ändraFeedback(f.id, status, svar)
    if (r.ok) { setSparat(true); setTimeout(() => setSparat(false), 1500); onÄndrad() }
  }
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderLeft: `3px solid ${t.färg}`, borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 12, color: C.muted }}>
        <span style={{ color: t.färg, fontWeight: 700 }}>{t.ikon} {t.namn}</span>
        <span>· {f.anvandare}</span>
        <span>· {tid(f.skapad)}</span>
        {Object.entries(f.kontext || {}).filter(([k]) => k !== "version").map(([k, v]) => (
          <span key={k} style={{ border: `1px solid ${C.border}`, borderRadius: 999, padding: "0 7px" }}>{k}: {v}</span>
        ))}
      </div>
      <div style={{ fontSize: 14, color: C.text, marginTop: 8, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{f.text}</div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
        <select value={status} onChange={e => setStatus(e.target.value)}
          style={{ background: "#0f131b", color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: "5px 8px", fontSize: 12.5 }}>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input value={svar} onChange={e => setSvar(e.target.value)} maxLength={500}
          placeholder={status === "klar" ? "Meddelande till användaren, t.ex. 'Nu kan du …'" : "Anteckning / svar (visas när status är Klar)"}
          style={{ flex: "1 1 220px", background: "#0f131b", color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 10px", fontSize: 12.5 }} />
        <button style={{ ...knapp, color: ändrad ? "#6ee7b7" : C.muted, borderColor: ändrad ? "#6ee7b760" : C.border }} disabled={!ändrad} onClick={spara}>
          {sparat ? <><Check size={12} /> Sparat</> : "Spara"}
        </button>
        {f.status === "klar" && f.svar && <span style={{ fontSize: 11.5, color: C.muted }}>{f.svar_sett ? "✓ Användaren har sett svaret" : "Visas för användaren nästa gång"}</span>}
      </div>
    </div>
  )
}

export default function Inkorg({ onUppdaterad }) {
  const [filter, setFilter] = useState("ny")
  const [data, setData] = useState(null)
  const ladda = () => fetchInkorg(filter === "alla" ? null : filter).then(setData)
  useEffect(() => { ladda() }, [filter])
  const efterÄndring = () => { ladda(); onUppdaterad?.() }

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Inbox size={20} color="#6ee7b7" />
        <div style={{ fontSize: 20, fontWeight: 800, color: C.text, flex: 1 }}>Inkorg</div>
        {["ny", "planerad", "klar", "avvisad", "alla"].map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{ ...knapp, ...(filter === s ? { background: "#1a3a2e", color: "#6ee7b7", borderColor: "#6ee7b760" } : {}) }}>
            {s === "alla" ? "Alla" : STATUS[s]}
          </button>
        ))}
      </div>

      {data?.betyg && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px" }}>
          <div style={{ fontSize: 12, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Betyg på coachen</div>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", fontSize: 13.5, color: C.text }}>
            {[["insikt", "Morgoninsikten"], ["chatt", "Chatten"]].map(([k, n]) => (
              <span key={k}>{n}: <ThumbsUp size={12} color="#6ee7b7" /> {data.betyg[k]?.upp || 0} · <ThumbsDown size={12} color="#f87171" /> {data.betyg[k]?.ner || 0}</span>
            ))}
          </div>
          {data.tummar_ner.length > 0 && (
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
              {data.tummar_ner.slice(0, 8).map((t, i) => (
                <div key={i} style={{ fontSize: 12.5, color: C.sub, borderTop: `1px solid ${C.border}`, paddingTop: 6 }}>
                  <span style={{ color: "#f87171" }}>👎 {t.orsak || "ingen orsak"}</span> · {t.kalla} · {t.anvandare} · {tid(t.skapad)}
                  {t.utdrag && <div style={{ color: C.muted, fontStyle: "italic", marginTop: 2 }}>"{t.utdrag.slice(0, 160)}{t.utdrag.length > 160 ? "…" : ""}"</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!data ? <div style={{ color: C.muted }}>Laddar…</div>
        : data.feedback.length === 0 ? <div style={{ color: C.muted, fontSize: 13.5 }}>Inget här just nu.</div>
        : data.feedback.map(f => <Post key={f.id} f={f} onÄndrad={efterÄndring} />)}
    </div>
  )
}
