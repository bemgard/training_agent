function Sparkline({ data, color }) {
  if (!data || data.length < 2) return null
  
  const valid = data.filter(v => v != null)
  if (valid.length < 2) return null
  
  const min = Math.min(...valid)
  const max = Math.max(...valid)
  const range = max - min || 1
  const w = 120
  const h = 32
  
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w
      const y = h - ((( v ?? min) - min) / range) * h
      return `${x},${y}`
    })
    .join(" ")

  return (
    <svg width={w} height={h} style={{ display: "block", marginTop: 8 }}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.7}
      />
    </svg>
  )
}

export default function KPICard({ icon: Icon, label, value, unit, sub, color = "#6ee7b7", sparkline }) {
  return (
    <div style={{
      background: "#1a1a26",
      border: "1px solid #2a2a3a",
      borderRadius: 12,
      padding: "20px 24px",
      display: "flex",
      flexDirection: "column",
      gap: 8,
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        color: "#64748b",
        fontSize: 12,
        textTransform: "uppercase",
        letterSpacing: "0.08em"
      }}>
        <Icon size={14} color={color} />
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ fontSize: 32, fontWeight: 700, color: "#e2e8f0", letterSpacing: "-0.02em" }}>
          {value ?? "—"}
        </span>
        {unit && <span style={{ fontSize: 14, color: "#64748b" }}>{unit}</span>}
      </div>
      {sub && <div style={{ fontSize: 12, color: "#64748b" }}>{sub}</div>}
      <Sparkline data={sparkline} color={color} />
    </div>
  )
}