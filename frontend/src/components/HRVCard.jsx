import { HeartPulse } from "lucide-react"

const STATUS = {
  BALANCED: { label: "Balanserad", color: "#6ee7b7" },
  UNBALANCED: { label: "Obalanserad", color: "#fbbf24" },
  LOW: { label: "Låg", color: "#fb923c" },
  POOR: { label: "Dålig", color: "#ef4444" },
}

export default function HRVCard({ hrv }) {
  const nätter = [...(hrv || [])].reverse()  // äldst först
  const senaste = hrv?.[0]

  if (!senaste) {
    return (
      <Kort färg="#334155">
        <Rubrik färg="#475569" />
        <div style={{ color: "#475569", fontSize: 13, padding: "24px 0" }}>
          Ingen HRV-data — din Garmin-enhet stödjer troligen inte HRV-status.
        </div>
      </Kort>
    )
  }

  const status = STATUS[senaste.hrv_status] || { label: senaste.hrv_status || "Okänd", color: "#94a3b8" }
  const lag = senaste.hrv_baslinje_lag, hog = senaste.hrv_baslinje_hog
  const harBaslinje = lag != null && hog != null

  // Skala
  const värden = nätter.flatMap(n => [n.hrv_natt, n.hrv_7d]).filter(v => v != null)
  if (harBaslinje) värden.push(lag, hog)
  const yMin = Math.floor(Math.min(...värden) - 8), yMax = Math.ceil(Math.max(...värden) + 8)
  const w = 600, h = 130, padX = 14, padTop = 10, padBottom = 6
  const x = i => padX + (i / Math.max(nätter.length - 1, 1)) * (w - 2 * padX)
  const y = v => padTop + (1 - (v - yMin) / (yMax - yMin)) * (h - padTop - padBottom)

  const nattLinje = nätter.map((n, i) => `${x(i)},${y(n.hrv_natt)}`).join(" ")
  const snittLinje = nätter.filter(n => n.hrv_7d != null)
    .map(n => `${x(nätter.indexOf(n))},${y(n.hrv_7d)}`).join(" ")

  const diff = senaste.hrv_7d ? Math.round((senaste.hrv_natt - senaste.hrv_7d) / senaste.hrv_7d * 100) : null

  return (
    <Kort färg={status.color}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Rubrik färg={status.color} />
        <span style={{
          fontSize: 11, fontWeight: 600, color: status.color, background: status.color + "1a",
          border: `1px solid ${status.color}40`, borderRadius: 999, padding: "2px 10px",
        }}>
          {status.label}
        </span>
      </div>

      <div style={{ display: "flex", gap: 28, alignItems: "baseline", marginTop: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{ fontSize: 30, fontWeight: 900, color: "#f1f5f9", letterSpacing: "-1.5px", lineHeight: 1 }}>
              {senaste.hrv_7d != null ? Math.round(senaste.hrv_7d) : "—"}
            </span>
            <span style={{ fontSize: 13, color: "#475569" }}>ms</span>
          </div>
          <div style={{ fontSize: 11, color: "#334155", marginTop: 5, fontFamily: "monospace" }}>
            7-dagarssnitt{harBaslinje ? ` · baslinje ${Math.round(lag)}–${Math.round(hog)}` : ""}
          </div>
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{ fontSize: 20, fontWeight: 700, color: "#cbd5e1" }}>{Math.round(senaste.hrv_natt)}</span>
            <span style={{ fontSize: 12, color: "#475569" }}>ms</span>
          </div>
          <div style={{ fontSize: 11, color: "#334155", marginTop: 5, fontFamily: "monospace" }}>
            senaste natten{diff != null ? ` · ${diff >= 0 ? "+" : ""}${diff}% mot snitt` : ""}
          </div>
        </div>
      </div>

      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none"
        style={{ display: "block", marginTop: 14 }}>
        {harBaslinje && (
          <rect x={0} width={w} y={y(hog)} height={y(lag) - y(hog)} fill="#6ee7b7" opacity="0.07" />
        )}
        {harBaslinje && [lag, hog].map(v => (
          <line key={v} x1={0} x2={w} y1={y(v)} y2={y(v)} stroke="#6ee7b7" strokeOpacity="0.25" strokeDasharray="3 4" />
        ))}
        {snittLinje && (
          <polyline points={snittLinje} fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="5 4" />
        )}
        <polyline points={nattLinje} fill="none" stroke={status.color} strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" />
        {nätter.map((n, i) => (
          <circle key={n.datum} cx={x(i)} cy={y(n.hrv_natt)} r={i === nätter.length - 1 ? 4 : 2.5}
            fill={status.color} stroke="#161b25" strokeWidth="1.5">
            <title>{`${n.datum}: ${Math.round(n.hrv_natt)} ms`}</title>
          </circle>
        ))}
      </svg>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <span style={{ fontSize: 10, color: "#475569" }}>{nätter[0]?.datum.slice(5)}</span>
        <span style={{ fontSize: 10, color: "#475569" }}>
          <span style={{ color: status.color }}>—</span> natt
          {"  "}<span style={{ color: "#94a3b8" }}>- -</span> 7-dagarssnitt
          {harBaslinje && <>{"  "}<span style={{ color: "#6ee7b7" }}>▭</span> baslinje</>}
        </span>
        <span style={{ fontSize: 10, color: "#475569" }}>{nätter[nätter.length - 1]?.datum.slice(5)}</span>
      </div>
    </Kort>
  )
}

function Kort({ färg, children }) {
  return (
    <div style={{
      background: "#161b25", border: "1px solid #1e2736", borderRadius: 10,
      padding: "16px 18px", position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: färg }} />
      {children}
    </div>
  )
}

function Rubrik({ färg }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6, fontSize: 10, fontWeight: 500,
      color: "#475569", textTransform: "uppercase", letterSpacing: "0.09em",
    }}>
      <HeartPulse size={13} color={färg} /> HRV · senaste 14 nätterna
    </div>
  )
}
