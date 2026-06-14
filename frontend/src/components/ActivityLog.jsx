import { Activity } from "lucide-react"

function aktivitetIkon(typ) {
  if (typ === "running" || typ === "treadmill_running") return "🏃"
  if (typ === "football") return "⚽"
  if (typ === "hiit") return "💪"
  if (typ === "skiing" || typ === "cross_country_skiing_ws") return "⛷️"
  if (typ === "cardio" || typ === "indoor_cardio") return "🚴"
  return "🏋️"
}

function aktivitetNamn(typ) {
  if (typ === "running" || typ === "treadmill_running") return "Löpning"
  if (typ === "football") return "Fotboll"
  if (typ === "hiit") return "HIIT"
  if (typ === "skiing" || typ === "cross_country_skiing_ws") return "Skidor"
  if (typ === "cardio" || typ === "indoor_cardio") return "Cardio"
  return typ
}

function formatDatum(datum) {
  const d = new Date(datum)
  const idag = new Date()
  const igår = new Date()
  igår.setDate(idag.getDate() - 1)

  if (d.toDateString() === idag.toDateString()) return "Idag"
  if (d.toDateString() === igår.toDateString()) return "Igår"
  return d.toLocaleDateString("sv-SE", { weekday: "short", day: "numeric", month: "short" })
}

export default function ActivityLog({ aktiviteter }) {
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
        marginBottom: 16,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Activity size={14} color="#6ee7b7" /> Senaste aktiviteter
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {aktiviteter?.slice(0, 8).map((a, i) => (
          <div key={i} style={{
            display: "grid",
            gridTemplateColumns: "32px 1fr auto auto auto",
            alignItems: "center",
            gap: 12,
            padding: "10px 0",
            borderBottom: i < aktiviteter.length - 1 ? "1px solid #2a2a3a" : "none",
          }}>
            <div style={{
              width: 32,
              height: 32,
              background: "#12121a",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
            }}>
              {aktivitetIkon(a.typ)}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#e2e8f0" }}>
                {a.namn || aktivitetNamn(a.typ)}
              </div>
              <div style={{ fontSize: 11, color: "#64748b" }}>
                {formatDatum(a.datum)} · {a.plats || ""}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, color: "#e2e8f0" }}>{a.distans_km > 0 ? `${a.distans_km} km` : "—"}</div>
              <div style={{ fontSize: 11, color: "#64748b" }}>distans</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, color: "#e2e8f0" }}>{a.snitt_tempo || "—"}</div>
              <div style={{ fontSize: 11, color: "#64748b" }}>tempo</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, color: "#f87171" }}>{a.snitt_puls ? `${a.snitt_puls} ♥` : "—"}</div>
              <div style={{ fontSize: 11, color: "#64748b" }}>puls</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}