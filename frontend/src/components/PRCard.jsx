import { TrendingUp } from "lucide-react"

const labels = {
  "Best 1km Run": "1 km",
  "Best Half Marathon": "Halvmaraton",
  "Best Full Marathon": "Maraton",
  "Farthest Run": "Längsta"
}

export default function PRCard({ records }) {
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
        <TrendingUp size={14} color="#6ee7b7" /> Personliga rekord
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {records.map(r => (
          <div key={r.typ}>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>
              {labels[r.typ] || r.typ}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#e2e8f0", letterSpacing: "-0.02em" }}>
              {r.formaterat}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}