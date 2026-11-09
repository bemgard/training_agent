import { Moon } from "lucide-react"

const FASER = [
  { nyckel: "djup_sov_min", namn: "Djup", färg: "#5b21b6" },
  { nyckel: "latt_sov_min", namn: "Lätt", färg: "#8b5cf6" },
  { nyckel: "rem_sov_min", namn: "REM", färg: "#c4b5fd" },
  { nyckel: "vaken_min", namn: "Vaken", färg: "#f472b6" },
]

function poängFärg(p) {
  if (p == null) return "#475569"
  if (p >= 80) return "#6ee7b7"
  if (p >= 60) return "#fbbf24"
  return "#fb923c"
}

function formatTid(min) {
  if (!min) return "—"
  const h = Math.floor(min / 60), m = Math.round(min % 60)
  return `${h}h${m > 0 ? String(m).padStart(2, "0") : ""}`
}

export default function SleepChart({ sömnVecka, onClick }) {
  const nätter = [...(sömnVecka || [])].reverse()  // äldst först
  const giltiga = nätter.filter(d => d.sovtid_min)
  const snitt = giltiga.length ? giltiga.reduce((a, d) => a + d.sovtid_min, 0) / giltiga.length : 0

  // Skala: minst 10 h så att 6 h vs 8 h syns tydligt som 60 % vs 80 % av höjden
  const totalMed = d => (d.sovtid_min || 0) + (d.vaken_min || 0)
  const skalaMax = Math.max(600, ...nätter.map(totalMed))
  const stapelHöjd = 170

  return (
    <div onClick={onClick} title="Klicka för mer sömnstatistik" style={{ background: "#1a1a26", border: "1px solid #2a2a3a", borderRadius: 12, padding: "20px 24px", cursor: onClick ? "pointer" : "default" }}
      onMouseEnter={e => onClick && (e.currentTarget.style.borderColor = "#a78bfa80")}
      onMouseLeave={e => (e.currentTarget.style.borderColor = "#2a2a3a")}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div style={{
          color: "#64748b", fontSize: 12, textTransform: "uppercase",
          letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 8,
        }}>
          <Moon size={14} color="#a78bfa" /> Sömn · Senaste 7 nätterna
        </div>
        <div style={{ fontSize: 13, color: "#a78bfa", fontWeight: 600 }}>
          {giltiga.length ? `Snitt ${formatTid(snitt)}` : "Ingen data"}
        </div>
      </div>

      {giltiga.length === 0 ? (
        <div style={{ color: "#475569", fontSize: 13, textAlign: "center", padding: "30px 0" }}>
          Ingen sömndata registrerad denna vecka
        </div>
      ) : (
        <>
          <div style={{ position: "relative", display: "flex", gap: 14, alignItems: "flex-end" }}>
            {/* Snittlinje */}
            <div style={{
              position: "absolute", left: 0, right: 0,
              bottom: 22 + (snitt / skalaMax) * stapelHöjd,
              borderTop: "1px dashed #475569", pointerEvents: "none",
            }}>
              <span style={{ position: "absolute", right: 0, top: -16, fontSize: 10, color: "#64748b" }}>
                snitt
              </span>
            </div>

            {nätter.map(d => {
              const harData = !!d.sovtid_min
              return (
                <div key={d.datum} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: harData ? "#e2e8f0" : "#334155", marginBottom: 2 }}>
                    {formatTid(d.sovtid_min)}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: poängFärg(d.somnpoang), marginBottom: 6, minHeight: 14 }}>
                    {d.somnpoang != null ? d.somnpoang : ""}
                  </div>

                  <div style={{
                    width: "100%", maxWidth: 56, height: stapelHöjd,
                    display: "flex", flexDirection: "column-reverse",
                    background: "#14141f", borderRadius: 6, overflow: "hidden",
                  }}>
                    {harData && FASER.map(f => {
                      const min = d[f.nyckel]
                      if (!min) return null
                      return (
                        <div key={f.nyckel}
                          title={`${f.namn}: ${formatTid(min)}`}
                          style={{ height: (min / skalaMax) * stapelHöjd, background: f.färg, flexShrink: 0 }} />
                      )
                    })}
                  </div>

                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 8, height: 14 }}>
                    {new Date(d.datum + "T12:00:00").toLocaleDateString("sv-SE", { weekday: "short" })}
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ display: "flex", gap: 16, marginTop: 16, flexWrap: "wrap" }}>
            {FASER.map(f => (
              <span key={f.nyckel} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#94a3b8" }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: f.färg }} />
                {f.namn}
              </span>
            ))}
            <span style={{ fontSize: 11, color: "#64748b", marginLeft: "auto" }}>
              siffran under tiden = sömnpoäng · klicka för mer statistik
            </span>
          </div>
        </>
      )}
    </div>
  )
}
