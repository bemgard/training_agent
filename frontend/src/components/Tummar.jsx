import { useState } from "react"
import { ThumbsUp, ThumbsDown } from "lucide-react"
import { sättBetyg } from "../api"

// 👍/👎 på coachens svar och morgoninsikten. 👎 ger valfria snabbval för varför.
const ORSAKER = ["Fel fakta", "För långt", "Passar inte mig", "Otydligt"]

export default function Tummar({ kalla, refId, utdrag }) {
  const [betyg, setBetyg] = useState(0)
  const [orsak, setOrsak] = useState(null)
  if (!refId) return null

  async function sätt(v, o = null) {
    setBetyg(v); setOrsak(o)
    await sättBetyg(kalla, refId, v, o, (utdrag || "").slice(0, 280))
  }
  const knapp = (aktiv, färg) => ({
    background: aktiv ? färg + "22" : "transparent", border: `1px solid ${aktiv ? färg + "80" : "#2a2a3a"}`,
    color: aktiv ? färg : "#64748b", borderRadius: 8, padding: "3px 7px", cursor: "pointer", display: "inline-flex", alignItems: "center",
  })
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
      <button style={knapp(betyg === 1, "#6ee7b7")} title="Bra svar" onClick={() => sätt(1)}><ThumbsUp size={13} /></button>
      <button style={knapp(betyg === -1, "#f87171")} title="Dåligt svar" onClick={() => sätt(-1)}><ThumbsDown size={13} /></button>
      {betyg === 1 && <span style={{ fontSize: 11.5, color: "#64748b" }}>Tack!</span>}
      {betyg === -1 && ORSAKER.map(o => (
        <button key={o} onClick={() => sätt(-1, o)} style={{
          background: orsak === o ? "#f871711a" : "transparent", color: orsak === o ? "#f87171" : "#94a3b8",
          border: `1px solid ${orsak === o ? "#f8717160" : "#2a2a3a"}`, borderRadius: 999, padding: "2px 9px", fontSize: 11.5, cursor: "pointer",
        }}>{o}</button>
      ))}
    </div>
  )
}
