import { TrendingUp } from "lucide-react"

const DAGAR = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"]

function getVeckansDatum() {
  const idag = new Date()
  const dagIVeckan = idag.getDay() === 0 ? 6 : idag.getDay() - 1 // 0=mån, 6=sön
  const måndag = new Date(idag)
  måndag.setDate(idag.getDate() - dagIVeckan)
  måndag.setHours(0, 0, 0, 0)

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(måndag)
    d.setDate(måndag.getDate() + i)
    return d
  })
}

export default function WeeklyLoad({ aktiviteter }) {
  const veckansDatum = getVeckansDatum()

  const dagData = DAGAR.map((dag, i) => {
    const datum = veckansDatum[i]
    const datumStr = datum.toISOString().split("T")[0]

    const pass = aktiviteter?.filter(a => a.datum === datumStr) || []
    const km = pass.reduce((sum, a) => sum + (a.distans_km || 0), 0)
    return { dag, km: Math.round(km * 10) / 10, pass: pass.length }
  })

  const maxKm = Math.max(...dagData.map(d => d.km), 1)

  return (
    <div style={{
      background: "#1a1a26",
      border: "1px solid #2a2a3a",
      borderRadius: 12,
      padding: "20px 24px",
    }}>
      <div style={{
        color: "#64748b",
        fontSize: 12,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        marginBottom: 20,
        display: "flex",
        alignItems: "center",
        gap: 8
      }}>
        <TrendingUp size={14} color="#6ee7b7" /> Veckans belastning
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 120 }}>
        {dagData.map(({ dag, km }) => (
          <div key={dag} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <div style={{ fontSize: 10, color: "#64748b", height: 14 }}>{km > 0 ? `${km}` : ""}</div>
            <div style={{
              width: "100%",
              height: `${Math.max((km / maxKm) * 80, km > 0 ? 4 : 2)}px`,
              background: km > 0 ? "#6ee7b7" : "#2a2a3a",
              borderRadius: "4px 4px 0 0",
            }} />
            <div style={{ fontSize: 11, color: "#64748b" }}>{dag}</div>
          </div>
        ))}
      </div>
    </div>
  )
}