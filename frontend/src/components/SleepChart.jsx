import { Moon } from "lucide-react"

export default function SleepChart({ sömnVecka }) {
  const dagar = [...(sömnVecka || [])].reverse()

  const giltiga = dagar.filter(d => d.sovtid_min)
  const snitt = giltiga.length
    ? giltiga.reduce((a, b) => a + b.sovtid_min, 0) / giltiga.length
    : 0
  const snittH = Math.floor(snitt / 60)
  const snittM = Math.round(snitt % 60)

  const maxMin = Math.max(...dagar.map(d => d.sovtid_min || 0), 480)
  const w = 700, h = 100
  const padTop = 24, padBottom = 20

  const punkter = dagar.map((d, i) => {
    const x = (i / Math.max(dagar.length - 1, 1)) * w
    const y = h - padBottom - ((d.sovtid_min || 0) / maxMin) * (h - padTop - padBottom)
    return { x, y, sovtid: d.sovtid_min, har_data: !!d.sovtid_min, datum: d.datum }
  })

  const giltigaPunkter = punkter.filter(p => p.har_data)
  const linje = giltigaPunkter.map(p => `${p.x},${p.y}`).join(" ")
  const area = giltigaPunkter.length
    ? `M ${giltigaPunkter[0].x},${h - padBottom} ` +
      giltigaPunkter.map(p => `L ${p.x},${p.y}`).join(" ") +
      ` L ${giltigaPunkter[giltigaPunkter.length - 1].x},${h - padBottom} Z`
    : ""

  const snittY = h - padBottom - (snitt / maxMin) * (h - padTop - padBottom)

  function formatTid(min) {
    if (!min) return null
    const hh = Math.floor(min / 60)
    const mm = Math.round(min % 60)
    return `${hh}h${mm > 0 ? mm + "m" : ""}`
  }

  return (
    <div style={{
      background: "#1a1a26",
      border: "1px solid #2a2a3a",
      borderRadius: 12,
      padding: "20px 24px",
    }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
      }}>
        <div style={{
          color: "#64748b", fontSize: 12, textTransform: "uppercase",
          letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 8
        }}>
          <Moon size={14} color="#a78bfa" /> Sömn · Senaste 7 dagarna
        </div>
        <div style={{ fontSize: 13, color: "#a78bfa", fontWeight: 600 }}>
          {giltiga.length ? `Snitt ${snittH}h ${snittM}m` : "Ingen data"}
        </div>
      </div>

      {giltiga.length > 0 ? (
        <div style={{ position: "relative" }}>
          <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
            <defs>
              <linearGradient id="sleepGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Snittlinje */}
            <line x1="0" y1={snittY} x2={w} y2={snittY}
              stroke="#475569" strokeWidth="1" strokeDasharray="4 4" />

            {/* Fylld yta */}
            {area && <path d={area} fill="url(#sleepGrad)" />}

            {/* Linje */}
            <polyline points={linje} fill="none" stroke="#a78bfa" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round" />

            {/* Punkter + värden */}
            {giltigaPunkter.map((p, i) => (
            <g key={i}>
                <circle cx={p.x} cy={p.y} r="4" fill="#a78bfa" stroke="#1a1a26" strokeWidth="2" />
                <text x={p.x} y={p.y - 10} textAnchor="middle"
                fill="#e2e8f0" fontSize="11" fontWeight="600"
                fontFamily="-apple-system, BlinkMacSystemFont, 'Inter', sans-serif">
                {formatTid(p.sovtid)}
                </text>
            </g>
            ))}

            {/* Saknad data-markörer */}
            {punkter.filter(p => !p.har_data).map((p, i) => (
              <text key={i} x={p.x} y={h - padBottom + 4} textAnchor="middle"
                fill="#334155" fontSize="11">
                —
              </text>
            ))}
          </svg>
        </div>
      ) : (
        <div style={{ color: "#475569", fontSize: 13, textAlign: "center", padding: "30px 0" }}>
          Ingen sömndata registrerad denna vecka
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
        {dagar.map((d, i) => (
          <span key={i} style={{ fontSize: 11, color: "#475569" }}>
            {new Date(d.datum + "T12:00:00").toLocaleDateString("sv-SE", { weekday: "short" })}
          </span>
        ))}
      </div>
    </div>
  )
}