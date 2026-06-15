function Sparkline({ data, color }) {
  if (!data || data.length < 2) return null
  const valid = data.filter(v => v != null)
  if (valid.length < 2) return null

  const min = Math.min(...valid)
  const max = Math.max(...valid)
  const range = max - min || 1
  const w = 120, h = 32

  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - (((v ?? min) - min) / range) * (h - 4) - 2
    return [x, y]
  })

  const linePoints = pts.map(([x, y]) => `${x},${y}`).join(" ")
  const areaPath = `M ${pts[0][0]},${pts[0][1]} ` +
    pts.slice(1).map(([x, y]) => `L ${x},${y}`).join(" ") +
    ` L ${w},${h} L 0,${h} Z`

  const gradId = `sg-${color.replace("#", "")}`

  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none" style={{ display: "block", marginTop: 10 }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <polyline points={linePoints} fill="none" stroke={color}
        strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function KPICard({ icon: Icon, label, value, unit, sub, color = "#f97316", sparkline }) {
  return (
    <div style={{
      background: "#161b25",
      border: "1px solid #1e2736",
      borderRadius: 10,
      padding: "16px 18px",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Accentlinje vänster */}
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0,
        width: 3, background: color, borderRadius: "10px 0 0 10px",
      }} />

      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        fontSize: 10, fontWeight: 500, color: "#475569",
        textTransform: "uppercase", letterSpacing: "0.09em",
        marginBottom: 10,
      }}>
        <Icon size={13} color={color} />
        {label}
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span style={{ fontSize: 30, fontWeight: 900, color: "#f1f5f9", letterSpacing: "-1.5px", lineHeight: 1 }}>
          {value ?? "—"}
        </span>
        {unit && <span style={{ fontSize: 13, color: "#475569" }}>{unit}</span>}
      </div>

      {sub && (
        <div style={{ fontSize: 11, color: "#334155", marginTop: 5, fontFamily: "monospace" }}>
          {sub}
        </div>
      )}

      <Sparkline data={sparkline} color={color} />
    </div>
  )
}