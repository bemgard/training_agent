import { TrendingUp } from "lucide-react"
import { kategoriInfo, lokaltDatum, formatMinuter } from "../aktivitetstyper"

const DAGAR = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"]

function veckansDatum(veckansStart) {
  // Utgå från backendens måndag; annars räkna lokalt
  let måndag
  if (veckansStart) {
    måndag = new Date(veckansStart + "T12:00:00")
  } else {
    måndag = new Date()
    måndag.setDate(måndag.getDate() - ((måndag.getDay() + 6) % 7))
  }
  return DAGAR.map((_, i) => {
    const d = new Date(måndag)
    d.setDate(måndag.getDate() + i)
    return lokaltDatum(d)
  })
}

export default function WeeklyLoad({ aktiviteter, veckansStart }) {
  const datum = veckansDatum(veckansStart)
  const idag = lokaltDatum(new Date())
  const pass = aktiviteter || []

  const dagar = datum.map((ds, i) => {
    const dagensPass = pass.filter(a => a.datum === ds)
    // Summera minuter per kategori
    const perKategori = {}
    dagensPass.forEach(a => {
      const k = a.kategori || "_oklassad"
      perKategori[k] = (perKategori[k] || 0) + (a.duration_min || 0)
    })
    const minuter = dagensPass.reduce((s, a) => s + (a.duration_min || 0), 0)
    const löpKm = dagensPass.filter(a => a.kategori === "running").reduce((s, a) => s + (a.distans_km || 0), 0)
    return { dag: DAGAR[i], datum: ds, minuter, löpKm, perKategori, framtid: ds > idag, ärIdag: ds === idag }
  })

  const maxMin = Math.max(90, ...dagar.map(d => d.minuter))
  const totalMin = dagar.reduce((s, d) => s + d.minuter, 0)
  const totalKm = dagar.reduce((s, d) => s + d.löpKm, 0)
  const kategorierIVeckan = [...new Set(pass.map(a => a.kategori || "_oklassad"))]
  const stapelHöjd = 110

  return (
    <div style={{ background: "#1a1a26", border: "1px solid #2a2a3a", borderRadius: 12, padding: "20px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div style={{
          color: "#64748b", fontSize: 12, textTransform: "uppercase",
          letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 8,
        }}>
          <TrendingUp size={14} color="#6ee7b7" /> Veckans belastning
        </div>
        <div style={{ fontSize: 13, color: "#6ee7b7", fontWeight: 600 }}>
          {pass.length} pass · {formatMinuter(totalMin)}{totalKm > 0 ? ` · ${totalKm.toFixed(1)} km löpning` : ""}
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
        {dagar.map(d => (
          <div key={d.datum} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: d.minuter ? "#e2e8f0" : "#334155", height: 16 }}>
              {d.minuter ? formatMinuter(d.minuter) : ""}
            </div>
            <div style={{ fontSize: 10, color: "#64748b", height: 14, marginBottom: 4 }}>
              {d.löpKm > 0 ? `${d.löpKm.toFixed(1)} km` : ""}
            </div>
            <div style={{
              width: "100%", maxWidth: 64, height: stapelHöjd, display: "flex", flexDirection: "column-reverse",
              background: d.framtid ? "transparent" : "#14141f", borderRadius: 6, overflow: "hidden",
              border: d.framtid ? "1px dashed #2a2a3a" : "none",
            }}>
              {Object.entries(d.perKategori).map(([k, min]) => {
                const info = k === "_oklassad" ? kategoriInfo(null) : kategoriInfo(k)
                return (
                  <div key={k} title={`${info.namn}: ${formatMinuter(min)}`}
                    style={{ height: (min / maxMin) * stapelHöjd, background: info.färg, flexShrink: 0 }} />
                )
              })}
            </div>
            <div style={{ fontSize: 11, marginTop: 8, color: d.ärIdag ? "#e2e8f0" : "#64748b", fontWeight: d.ärIdag ? 700 : 400 }}>
              {d.ärIdag ? "Idag" : d.dag}
            </div>
          </div>
        ))}
      </div>

      {kategorierIVeckan.length > 0 && (
        <div style={{ display: "flex", gap: 16, marginTop: 16, flexWrap: "wrap" }}>
          {kategorierIVeckan.map(k => {
            const info = k === "_oklassad" ? kategoriInfo(null) : kategoriInfo(k)
            return (
              <span key={k} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#94a3b8" }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: info.färg }} />
                {info.namn}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}
