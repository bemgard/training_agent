import { useEffect, useState } from "react"
import { CalendarDays, ChevronRight } from "lucide-react"
import { fetchVecka } from "../api"
import { lokaltDatum, kategoriInfo, formatMinuter } from "../aktivitetstyper"

// Kompakt veckoremsa för översikten: planerat mot genomfört (samma avstämning som veckovyn i Plan)
const STATUSFÄRG = { genomford: "#6ee7b7", missad: "#f87171", idag: "#fbbf24", kommande: "#475569" }

function måndag(d) {
  const x = new Date(d)
  x.setHours(12, 0, 0, 0)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x
}

export default function VeckanKort({ onÖppnaPlan }) {
  const idag = lokaltDatum(new Date())
  const [data, setData] = useState(null)
  useEffect(() => { fetchVecka(lokaltDatum(måndag(new Date())), idag).then(setData) }, [])
  if (!data) return <div style={{ background: "#161b25", border: "1px solid #232a38", borderRadius: 12, minHeight: 170 }} />

  const s = data.summering
  const harPlan = s.planerade > 0
  return (
    <div onClick={onÖppnaPlan} style={{ background: "#161b25", border: "1px solid #232a38", borderRadius: 12, padding: "16px 18px", cursor: "pointer" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <CalendarDays size={14} color="#6ee7b7" />
        <span style={{ fontSize: 12, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          Veckan{data.plan ? ` · ${data.plan.titel}` : ""}
        </span>
        <span style={{ fontSize: 12, color: "#6ee7b7", display: "flex", alignItems: "center", whiteSpace: "nowrap" }}>Planen <ChevronRight size={14} /></span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 6 }}>
        {data.dagar.map(d => {
          const ärIdag = d.datum === idag
          const dag = new Date(d.datum + "T12:00:00")
          const poster = [
            ...d.pass.map(p => ({ ikon: kategoriInfo(p.kategori).ikon, färg: STATUSFÄRG[p.status], titel: `${p.titel} · ${p.status === "genomford" ? "genomfört" : p.status === "missad" ? "missat" : p.status}` })),
            ...d.ovriga.map(a => ({ ikon: kategoriInfo(a.kategori).ikon, färg: "#93c5fd", titel: `${a.namn || kategoriInfo(a.kategori).namn} · oplanerat`, streckad: true })),
          ]
          return (
            <div key={d.datum} style={{
              background: ärIdag ? "#fbbf2412" : "#0f131b", border: `1px solid ${ärIdag ? "#fbbf2450" : "#1e2736"}`,
              borderRadius: 10, padding: "8px 4px", minHeight: 92, display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: ärIdag ? "#fbbf24" : "#94a3b8", textTransform: "capitalize" }}>
                {dag.toLocaleDateString("sv-SE", { weekday: "short" }).replace(".", "")}
              </div>
              {poster.length === 0 && <div style={{ fontSize: 10, color: "#334155", marginTop: 8 }}>vila</div>}
              {poster.map((p, i) => (
                <div key={i} title={p.titel} style={{
                  width: 30, height: 30, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15,
                  background: p.färg + "1f", border: `1.5px ${p.streckad ? "dashed" : "solid"} ${p.färg}`,
                }}>{p.ikon}</div>
              ))}
            </div>
          )
        })}
      </div>

      <div style={{ display: "flex", gap: "4px 16px", flexWrap: "wrap", marginTop: 12, fontSize: 12.5, color: "#94a3b8" }}>
        {harPlan ? (
          <>
            <span><b style={{ color: "#6ee7b7" }}>{s.genomforda}</b> av {s.planerade} planerade pass</span>
            {s.missade > 0 && <span style={{ color: "#f87171" }}>{s.missade} missade</span>}
            <span>Tränat {formatMinuter(s.utford_min)}{s.planerad_min ? ` av ${formatMinuter(s.planerad_min)}` : ""}</span>
          </>
        ) : (
          <span>Tränat {formatMinuter(s.utford_min)} · ingen plan för veckan — be coachen om en</span>
        )}
      </div>
    </div>
  )
}
