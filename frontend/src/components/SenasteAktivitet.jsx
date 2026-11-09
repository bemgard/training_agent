import { Navigation } from "lucide-react"
import { kategoriInfo } from "../aktivitetstyper"

function formatDuration(min) {
  if (!min) return "—"
  return `${Math.floor(min / 60)}:${String(Math.round(min % 60)).padStart(2, "0")}`
}

function PulsKurva({ puls }) {
  if (!puls || puls < 10) return null
  // Simulerar en kurva baserat på snittpuls — ersätt med riktig HR-data om du får det från API
  const pts = [0.7, 0.75, 0.82, 0.88, 0.91, 0.87, 0.9, 0.93, 0.89, 0.85]
    .map(f => Math.round(puls * f))
  const min = Math.min(...pts), max = Math.max(...pts), range = max - min || 1
  const w = 100, h = 60
  const coords = pts.map((v, i) => {
    const x = (i / (pts.length - 1)) * w
    const y = h - ((v - min) / range) * (h - 8) - 4
    return [x, y]
  })
  const line = coords.map(([x, y]) => `${x},${y}`).join(" ")
  const area = `M ${coords[0][0]},${coords[0][1]} ` +
    coords.slice(1).map(([x, y]) => `L ${x},${y}`).join(" ") +
    ` L ${w},${h} L 0,${h} Z`

  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="hrgrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f97316" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#hrgrad)" />
      <polyline points={line} fill="none" stroke="#f97316" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function SenasteAktivitet({ aktiviteter }) {
  const a = aktiviteter?.[0]
  if (!a) return null

  const stats = [
    { label: "DISTANS", value: a.distans_km > 0 ? `${a.distans_km}` : null, unit: "km" },
    { label: "TID",     value: formatDuration(a.duration_min), unit: null },
    { label: "TEMPO",   value: a.snitt_tempo || "—", unit: a.snitt_tempo ? "/km" : null },
    { label: "SNITTPULS", value: a.snitt_puls || "—", unit: a.snitt_puls ? "bpm" : null },
  ]

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
        marginBottom: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12,
          color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          <Navigation size={14} color="#f97316" />
          Senaste aktivitet · {a.namn || kategoriInfo(a.kategori).namn}
        </div>
        {a.plats && (
          <div style={{ fontSize: 11, color: "#475569" }}>📍 {a.plats}</div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {stats.map(({ label, value, unit }) => (
            <div key={label} style={{ borderBottom: "1px solid #1e2736", paddingBottom: 12 }}>
              <div style={{ fontSize: 10, color: "#475569", letterSpacing: "0.1em", marginBottom: 2 }}>
                {label}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9", letterSpacing: "-0.5px" }}>
                {value}
                {unit && <span style={{ fontSize: 12, color: "#64748b", marginLeft: 4 }}>{unit}</span>}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontSize: 11, color: "#475569", marginBottom: 8 }}>
            {kategoriInfo(a.kategori).ikon} Pulsprofil
          </div>
          <PulsKurva puls={a.snitt_puls} />
          {a.snitt_puls && (
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
              <span style={{ fontSize: 10, color: "#475569" }}>Start</span>
              <span style={{ fontSize: 10, color: "#f97316" }}>Snitt {a.snitt_puls} bpm</span>
              <span style={{ fontSize: 10, color: "#475569" }}>Slut</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}