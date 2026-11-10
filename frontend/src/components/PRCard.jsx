import { TrendingUp } from "lucide-react"

function sekTillFormat(sek) {
  if (!sek) return "—"
  const h = Math.floor(sek / 3600)
  const m = Math.floor((sek % 3600) / 60)
  const s = Math.round(sek % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
  return `${m}:${String(s).padStart(2, "0")}`
}

export default function PRCard({ records, profile }) {
  const prMap = {}
records.forEach(r => { prMap[r.typ] = r.formaterat })

  const predictions = profile?.race_predictions || {}

  const rader = [
    { label: "5 km", pr: prMap["Estimated 5K"], prognos: sekTillFormat(predictions.time_5k) },
    { label: "10 km", pr: prMap["Estimated 10K"], prognos: sekTillFormat(predictions.time_10k) },
    { label: "Halvmaraton", pr: prMap["Best Half Marathon"], prognos: sekTillFormat(predictions.time_half) },
    { label: "Maraton", pr: prMap["Best Full Marathon"], prognos: sekTillFormat(predictions.time_marathon) },
  ]

  return (
    <div style={{
      background: "#1a1a26",
      border: "1px solid #2a2a3a",
      borderRadius: 12,
      padding: "20px 24px",
    }}>
      {/* Vänster — Personliga rekord + Garmins prognos */}
      <div>
        <div style={{
          color: "#64748b",
          fontSize: 12,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          gap: 8
        }}>
          <TrendingUp size={14} color="#6ee7b7" /> Personbästa vs Garmins prognos
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            <div></div>
            <div>PB</div>
            <div>Garmin prognos</div>
          </div>
          {rader.map(({ label, pr, prognos }) => (
            <div key={label} style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              alignItems: "baseline",
              borderBottom: "1px solid #1e2736",
              paddingBottom: 8,
            }}>
              <div style={{ fontSize: 12, color: "#94a3b8" }}>{label}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: pr ? "#e2e8f0" : "#334155" }}>
                {pr || "—"}
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#fb923c" }}>
                {prognos}
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}