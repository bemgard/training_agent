import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { kategoriInfo, formatMinuter } from "../aktivitetstyper"

// Delas av veckovyn och planförhandsvisningen i chatten. Fältnamnen följer scripts/plan.py.
const STEGTYPER = {
  uppvarmning: "Uppvärmning", lugnt: "Lugnt", intervall: "Intervaller", tempo: "Tempo",
  backe: "Backintervaller", nedjogg: "Nedvarvning", vila: "Vila",
}
const STATUS = {
  genomford: { text: "Genomfört", färg: "#6ee7b7" },
  missad: { text: "Missat", färg: "#f87171" },
  idag: { text: "Idag", färg: "#fbbf24" },
  kommande: { text: "Kommande", färg: "#64748b" },
}
const C = { text: "#e2e8f0", sub: "#94a3b8", muted: "#64748b", border: "#2a2a3a", bg: "#0f131b" }

function målText(p) {
  return [p.distans_km && `${p.distans_km} km`, p.duration_min && formatMinuter(p.duration_min), p.pulszon, p.tempo]
    .filter(Boolean).join(" · ")
}

function stegText(s) {
  const mängd = s.distans_km ? `${s.distans_km} km` : s.min ? `${s.min} min` : ""
  const delar = [s.antal ? `${s.antal} × ${mängd}` : mängd, s.zon, s.tempo, s.vila_min ? `vila ${s.vila_min} min` : null]
  return delar.filter(Boolean).join(" · ")
}

function PassInnehåll({ pass }) {
  const steg = pass.steg || [], övningar = pass.ovningar || []
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
      {pass.syfte && <div style={{ fontSize: 12.5, color: C.sub, lineHeight: 1.5 }}>{pass.syfte}</div>}
      {steg.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: "4px 12px", fontSize: 12.5 }}>
          {steg.map((s, i) => [
            <span key={i + "t"} style={{ color: C.muted }}>{STEGTYPER[s.typ] || s.typ}</span>,
            <span key={i + "v"} style={{ color: C.text }}>{stegText(s)}{s.beskrivning ? ` — ${s.beskrivning}` : ""}</span>,
          ])}
        </div>
      )}
      {övningar.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ color: C.muted, textAlign: "left" }}>
              <th style={{ fontWeight: 500, padding: "2px 0" }}>Övning</th>
              <th style={{ fontWeight: 500 }}>Set × reps</th>
              <th style={{ fontWeight: 500 }}>Belastning</th>
              <th style={{ fontWeight: 500 }}>Vila</th>
            </tr>
          </thead>
          <tbody>
            {övningar.map((o, i) => (
              <tr key={i} style={{ borderTop: `1px solid ${C.border}`, color: C.text }}>
                <td style={{ padding: "5px 0" }}>{o.namn}{o.kommentar && <div style={{ fontSize: 11, color: C.muted }}>{o.kommentar}</div>}</td>
                <td>{o.set} × {o.reps}</td>
                <td style={{ color: C.sub }}>{o.belastning || "–"}</td>
                <td style={{ color: C.sub }}>{o.vila_s ? `${o.vila_s} s` : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default function PlanPass({ pass, åtgärder, öppen: startÖppen = false }) {
  const [öppen, setÖppen] = useState(startÖppen)
  const k = kategoriInfo(pass.kategori)
  const status = pass.status && STATUS[pass.status]
  const u = pass.utfort
  return (
    <div style={{ background: "#1a1a26", border: `1px solid ${status?.färg === "#f87171" ? "#f8717140" : C.border}`, borderLeft: `3px solid ${k.färg}`, borderRadius: 10, padding: "10px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => setÖppen(!öppen)}>
        {öppen ? <ChevronDown size={14} color={C.muted} /> : <ChevronRight size={14} color={C.muted} />}
        <span style={{ fontSize: 15 }}>{k.ikon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text, overflowWrap: "anywhere" }}>{pass.titel || pass.typ}</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 1 }}>{målText(pass) || k.namn}</div>
        </div>
        {pass.garmin_workout_id && <span title="Ligger i Garmin-kalendern" style={{ fontSize: 11, color: "#93c5fd", flexShrink: 0 }}>⌚ I Garmin</span>}
        {status && (
          <span style={{ fontSize: 11, fontWeight: 600, color: status.färg, background: status.färg + "1a", border: `1px solid ${status.färg}40`, borderRadius: 999, padding: "2px 9px", flexShrink: 0 }}>
            {status.text}
          </span>
        )}
      </div>
      {u && (
        <div style={{ fontSize: 12, color: "#6ee7b7", marginTop: 6, marginLeft: 24 }}>
          Gjort: {[u.distans_km && `${u.distans_km} km`, u.duration_min && formatMinuter(u.duration_min), u.snitt_puls && `puls ${u.snitt_puls}`].filter(Boolean).join(" · ")}
        </div>
      )}
      {öppen && <div style={{ marginLeft: 24 }}><PassInnehåll pass={pass} />{åtgärder}</div>}
    </div>
  )
}
