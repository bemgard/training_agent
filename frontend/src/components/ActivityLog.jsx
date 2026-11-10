import { useState } from "react"
import { Activity } from "lucide-react"
import { KATEGORIER, kategoriInfo, lokaltDatum, formatMinuter } from "../aktivitetstyper"
import { setAktivitetstyp } from "../api"

function formatDatum(datum) {
  const idag = new Date()
  const igår = new Date(); igår.setDate(idag.getDate() - 1)
  if (datum === lokaltDatum(idag)) return "Idag"
  if (datum === lokaltDatum(igår)) return "Igår"
  return new Date(datum + "T12:00:00").toLocaleDateString("sv-SE", { weekday: "short", day: "numeric", month: "short" })
}

function TypVäljare({ aktivitet, onUppdatera }) {
  const [öppen, setÖppen] = useState(false)
  const [sparar, setSparar] = useState(false)
  const info = kategoriInfo(aktivitet.kategori)
  const oklassad = !aktivitet.kategori

  async function välj(e) {
    const v = e.target.value
    setSparar(true)
    await setAktivitetstyp(aktivitet.activity_id, v === "__auto" ? null : v)
    await onUppdatera?.()
    setSparar(false)
    setÖppen(false)
  }

  if (öppen) {
    return (
      <select autoFocus disabled={sparar} defaultValue={aktivitet.typ_manuell || ""} onChange={välj}
        onBlur={() => !sparar && setÖppen(false)}
        style={{ background: "#12121a", color: "#e2e8f0", border: "1px solid #2a2a3a", borderRadius: 6, fontSize: 12, padding: "2px 4px" }}>
        <option value="" disabled>Välj typ…</option>
        {Object.entries(KATEGORIER).map(([k, v]) => <option key={k} value={k}>{v.ikon} {v.namn}</option>)}
        {aktivitet.typ_manuell && <option value="__auto">↺ Återställ till Garmins typ</option>}
      </select>
    )
  }

  return (
    <button onClick={() => setÖppen(true)} title="Klicka för att ändra passtyp" style={{
      background: oklassad ? "#3a2e12" : "transparent",
      color: oklassad ? "#fbbf24" : info.färg,
      border: `1px ${aktivitet.gissad || oklassad ? "dashed" : "solid"} ${oklassad ? "#fbbf2460" : info.färg + "50"}`,
      borderRadius: 999, fontSize: 11, padding: "1px 8px", cursor: "pointer",
    }}>
      {oklassad ? "Klassa pass" : `${info.namn}${aktivitet.gissad ? "?" : ""}`}
    </button>
  )
}

export default function ActivityLog({ aktiviteter, onUppdatera }) {
  const lista = aktiviteter?.slice(0, 8) || []
  return (
    <div style={{ background: "#1a1a26", border: "1px solid #2a2a3a", borderRadius: 12, padding: "20px 24px" }}>
      <div style={{
        color: "#64748b", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em",
        marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Activity size={14} color="#6ee7b7" /> Senaste aktiviteter
        </div>
        <span style={{ textTransform: "none", letterSpacing: 0, fontSize: 11, color: "#475569" }}>
          Klicka på passtypen för att ändra
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {lista.map((a, i) => {
          const info = kategoriInfo(a.kategori)
          const löpning = a.kategori === "running"
          return (
            <div key={a.activity_id ?? i} className="aktivitetsrad" style={{
              display: "grid", gridTemplateColumns: "32px 1fr auto auto auto", alignItems: "center",
              gap: 16, padding: "10px 0", borderBottom: i < lista.length - 1 ? "1px solid #2a2a3a" : "none",
            }}>
              <div style={{
                width: 32, height: 32, background: "#12121a", borderRadius: 8,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
              }}>
                {info.ikon}
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "#e2e8f0" }}>{a.namn || info.namn}</span>
                  <TypVäljare aktivitet={a} onUppdatera={onUppdatera} />
                </div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                  {formatDatum(a.datum)}{a.plats ? ` · ${a.plats}` : ""}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 13, color: "#e2e8f0" }}>{formatMinuter(a.duration_min)}</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>tid</div>
              </div>
              <div className="m-dolj" style={{ textAlign: "right" }}>
                <div style={{ fontSize: 13, color: "#e2e8f0" }}>{a.distans_km >= 0.1 ? `${a.distans_km} km` : "—"}</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>{löpning && a.snitt_tempo ? a.snitt_tempo : "distans"}</div>
              </div>
              <div className="m-dolj" style={{ textAlign: "right" }}>
                <div style={{ fontSize: 13, color: "#f87171" }}>{a.snitt_puls ? `${a.snitt_puls} ♥` : "—"}</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>puls</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
