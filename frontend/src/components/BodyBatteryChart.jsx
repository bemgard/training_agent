import { Zap } from "lucide-react"

export default function BodyBatteryChart({ data }) {
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
        gap: 8
      }}>
        <Zap size={14} color="#6ee7b7" /> Body Battery · 7 dagar
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {data.filter(d => d.body_battery_hogst).slice(0, 7).map(d => (
          <div key={d.datum} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 11, color: "#64748b", width: 50, flexShrink: 0 }}>
              {new Date(d.datum).toLocaleDateString("sv-SE", { weekday: "short" })}
            </div>
            <div style={{ flex: 1, height: 6, background: "#2a2a3a", borderRadius: 3, overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${(d.body_battery_hogst / 100) * 100}%`,
                background: d.body_battery_hogst > 60 ? "#6ee7b7" : d.body_battery_hogst > 30 ? "#fb923c" : "#f87171",
                borderRadius: 3,
              }} />
            </div>
            <div style={{ fontSize: 12, color: "#e2e8f0", width: 28, textAlign: "right" }}>
              {d.body_battery_hogst}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}