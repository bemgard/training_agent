import { useEffect, useState } from "react"
import { Sparkles, RefreshCw, CheckCircle2, Shuffle, Moon, CalendarCheck } from "lucide-react"
import { fetchInsikt, uppdateraInsikt, sparaPlan } from "../api"
import { lokaltDatum } from "../aktivitetstyper"
import PlanPass from "./PlanPass"
import Tummar from "./Tummar"

const C = { surface: "#161b25", border: "#232a38", text: "#f1f5f9", sub: "#94a3b8", muted: "#64748b" }
const REK = {
  som_planerat: { text: "Kör som planerat", ikon: CheckCircle2, färg: "#6ee7b7" },
  justera: { text: "Justera dagens pass", ikon: Shuffle, färg: "#fbbf24" },
  vila: { text: "Vila idag", ikon: Moon, färg: "#93c5fd" },
  fritt: { text: "Dagens förslag", ikon: Sparkles, färg: "#a78bfa" },
}
const knapp = { background: "none", border: `1px solid ${C.border}`, color: C.sub, borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }

function Veckosammanfattning({ v }) {
  return (
    <div style={{ background: C.surface, border: "1px solid #a78bfa40", borderRadius: 12, padding: "16px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, fontWeight: 700, color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.08em" }}>
        <CalendarCheck size={14} /> Veckans sammanfattning
      </div>
      <div style={{ fontSize: 16, fontWeight: 800, color: C.text, marginTop: 6 }}>{v.rubrik}</div>
      <div style={{ fontSize: 13.5, color: C.sub, marginTop: 6, lineHeight: 1.6 }}>{v.text}</div>
      {v.hojdpunkter?.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          {v.hojdpunkter.map((h, i) => <span key={i} style={{ fontSize: 12, color: "#6ee7b7", background: "#6ee7b714", border: "1px solid #6ee7b740", borderRadius: 999, padding: "3px 10px" }}>✓ {h}</span>)}
        </div>
      )}
      {v.fokus && <div style={{ fontSize: 13, color: C.text, marginTop: 10 }}><b>Nästa vecka:</b> <span style={{ color: C.sub }}>{v.fokus}</span></div>}
      <Tummar kalla="insikt" refId={`${v.datum}:vecka`} utdrag={`${v.rubrik} — ${v.text}`} />
    </div>
  )
}

export default function InsiktKort({ dagsformÄndrad }) {
  const datum = lokaltDatum(new Date())
  const [data, setData] = useState(null)
  const [laddar, setLaddar] = useState(false)
  const [fel, setFel] = useState("")
  const [planSparad, setPlanSparad] = useState(false)
  const ladda = () => fetchInsikt(datum).then(setData)
  useEffect(() => { ladda() }, [])

  async function uppdatera() {
    setLaddar(true); setFel("")
    const r = await uppdateraInsikt(datum)
    setLaddar(false)
    if (!r.ok) return setFel(typeof r.data?.detail === "string" ? r.data.detail : "Kunde inte uppdatera")
    setPlanSparad(false)
    ladda()
  }

  if (!data) return null
  const m = data.morgon
  const kvar = m ? data.max_per_dag - m.antal : data.max_per_dag

  return (
    <>
      {data.vecka && <Veckosammanfattning v={data.vecka} />}
      {!m ? (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <Sparkles size={18} color="#a78bfa" />
          <div style={{ flex: 1, fontSize: 13, color: C.sub }}>Dagens insikt skapas efter morgonsynken 09:00. Fyll gärna i dagsformen först.</div>
          <button style={knapp} onClick={uppdatera} disabled={laddar}><RefreshCw size={13} /> {laddar ? "Coachen tänker…" : "Skapa nu"}</button>
          {fel && <span style={{ color: "#f87171", fontSize: 12 }}>{fel}</span>}
        </div>
      ) : (() => {
        const r = REK[m.rekommendation] || REK.fritt
        return (
          <div style={{ background: C.surface, border: `1px solid ${r.färg}40`, borderRadius: 12, padding: "16px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <r.ikon size={15} color={r.färg} />
              <span style={{ fontSize: 11, fontWeight: 700, color: r.färg, textTransform: "uppercase", letterSpacing: "0.08em", flex: 1 }}>Dagens insikt · {r.text}</span>
              {kvar > 0 && (
                <button style={{ ...knapp, ...(dagsformÄndrad ? { color: "#fbbf24", border: "1px solid #fbbf2460" } : {}) }} onClick={uppdatera} disabled={laddar}
                  title={`Kan uppdateras ${kvar} gång${kvar === 1 ? "" : "er"} till idag`}>
                  <RefreshCw size={13} /> {laddar ? "Coachen tänker…" : dagsformÄndrad ? "Uppdatera med din dagsform" : "Uppdatera"}
                </button>
              )}
            </div>
            <div style={{ fontSize: 17, fontWeight: 800, color: C.text, marginTop: 8 }}>{m.rubrik}</div>
            <div style={{ fontSize: 13.5, color: C.sub, marginTop: 6, lineHeight: 1.6 }}>{m.text}</div>
            {m.plan?.pass?.[0] && (
              <div style={{ marginTop: 12 }}>
                <PlanPass pass={m.plan.pass[0]} />
                <button style={{ ...knapp, marginTop: 8, color: planSparad ? C.muted : "#6ee7b7", border: `1px solid ${planSparad ? C.border : "#6ee7b760"}` }}
                  disabled={planSparad} onClick={async () => { const s = await sparaPlan(m.plan, datum); if (s.ok) setPlanSparad(true); else setFel("Kunde inte spara passet") }}>
                  {planSparad ? "✓ Ersatte dagens pass" : "📅 Använd som dagens pass"}
                </button>
              </div>
            )}
            {fel && <div style={{ color: "#f87171", fontSize: 12, marginTop: 8 }}>{fel}</div>}
            <Tummar key={`${m.datum}:${m.antal}`} kalla="insikt" refId={`${m.datum}:morgon:${m.antal}`} utdrag={`${m.rubrik} — ${m.text}`} />
          </div>
        )
      })()}
    </>
  )
}
