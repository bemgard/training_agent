import { useEffect, useState } from "react"
import { Activity, ChevronDown, ChevronRight, MessageCircle } from "lucide-react"
import { KATEGORIER, kategoriInfo, lokaltDatum, formatMinuter } from "../aktivitetstyper"
import { setAktivitetstyp, fetchAktiviteter } from "../api"

function formatDatum(datum) {
  const idag = new Date()
  const igår = new Date(); igår.setDate(idag.getDate() - 1)
  if (datum === lokaltDatum(idag)) return "Idag"
  if (datum === lokaltDatum(igår)) return "Igår"
  const t = new Date(datum + "T12:00:00").toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "short" })
  return t.charAt(0).toUpperCase() + t.slice(1)
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

// Pulszonsfärger (zon 1 → 5), samma ordning som Garmin
const ZONFÄRG = ["#64748b", "#60a5fa", "#6ee7b7", "#fbbf24", "#f87171"]
const INTENSITET = { lätt: "#60a5fa", medel: "#fbbf24", tung: "#f87171" }

function ZonStapel({ zoner, höjd = 5 }) {
  const total = zoner.reduce((a, b) => a + b, 0)
  return (
    <div style={{ display: "flex", height: höjd, borderRadius: 999, overflow: "hidden", background: "#0f131b" }}>
      {zoner.map((m, i) => m > 0 && <div key={i} style={{ width: `${(m / total) * 100}%`, background: ZONFÄRG[i] }} />)}
    </div>
  )
}

function Detaljer({ a, onFrågaCoach }) {
  const total = (a.zoner_min || []).reduce((x, y) => x + y, 0)
  const fakta = [
    a.max_puls && ["Maxpuls", `${a.max_puls} bpm`],
    a.snitt_puls && ["Snittpuls", `${a.snitt_puls} bpm`],
    a.elevation_gain >= 5 && ["Höjdmeter", `${Math.round(a.elevation_gain)} m`],
    a.trimp && ["Belastning (TRIMP)", `${a.trimp}${a.intensitet ? ` · ${a.intensitet} för dig` : ""}`],
  ].filter(Boolean)
  return (
    <div style={{ margin: "4px 0 6px 44px", padding: "12px 14px", background: "#0f131b", border: "1px solid #1e2736", borderRadius: 10, display: "flex", flexDirection: "column", gap: 12 }}>
      {a.zoner_min && (
        <div>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>Tid i pulszon</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 6 }}>
            {a.zoner_min.map((m, i) => (
              <div key={i}>
                <div style={{ height: 34, display: "flex", alignItems: "flex-end", background: "#161b25", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: "100%", height: `${total ? Math.max(4, (m / total) * 100) : 0}%`, background: ZONFÄRG[i], opacity: m ? 1 : 0.15 }} />
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3, textAlign: "center" }}>Z{i + 1} · {Math.round(m)}m</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {fakta.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 20px", fontSize: 12.5 }}>
          {fakta.map(([k, v]) => <span key={k}><span style={{ color: "#64748b" }}>{k}</span> <span style={{ color: "#e2e8f0" }}>{v}</span></span>)}
        </div>
      )}
      <button onClick={() => onFrågaCoach?.(`Analysera mitt pass ${a.datum}: ${a.namn || kategoriInfo(a.kategori).namn}. Hur gick det och vad betyder det för resten av veckan?`)}
        style={{ alignSelf: "flex-start", background: "#1a3a2e", border: "1px solid #6ee7b760", color: "#6ee7b7", borderRadius: 8, padding: "6px 12px", fontSize: 12.5, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
        <MessageCircle size={13} /> Fråga coachen om passet
      </button>
    </div>
  )
}

function Rad({ a, öppen, onVäxla, onUppdatera, onFrågaCoach }) {
  const info = kategoriInfo(a.kategori)
  const delar = [
    formatMinuter(a.duration_min),
    a.distans_km >= 0.5 && `${a.distans_km} km`,
    a.kategori === "running" && a.snitt_tempo,
    a.snitt_puls && `♥ ${a.snitt_puls}`,
  ].filter(Boolean)
  return (
    <div>
      <div onClick={onVäxla} style={{ display: "grid", gridTemplateColumns: "34px minmax(0, 1fr) auto", gap: 10, alignItems: "center", padding: "9px 0", cursor: "pointer" }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: info.färg + "1f", border: `1px solid ${info.färg}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
          {info.ikon}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis" }}>{a.namn || info.namn}</span>
            <span onClick={e => e.stopPropagation()}><TypVäljare aktivitet={a} onUppdatera={onUppdatera} /></span>
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 3 }}>{delar.join(" · ")}</div>
          {a.planerat && <div style={{ fontSize: 11.5, color: "#6ee7b7", marginTop: 3 }}>✓ Planerat: {a.planerat}</div>}
          {a.zoner_min && <div style={{ marginTop: 6, maxWidth: 260 }}><ZonStapel zoner={a.zoner_min} /></div>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {a.intensitet && (
            <span title={`Belastning ${a.trimp} (TRIMP) jämfört med dina pass senaste 90 dagarna`} style={{
              fontSize: 11, fontWeight: 600, color: INTENSITET[a.intensitet], background: INTENSITET[a.intensitet] + "1a",
              border: `1px solid ${INTENSITET[a.intensitet]}40`, borderRadius: 999, padding: "2px 8px", textTransform: "capitalize",
            }}>{a.intensitet}</span>
          )}
          {öppen ? <ChevronDown size={15} color="#64748b" /> : <ChevronRight size={15} color="#64748b" />}
        </div>
      </div>
      {öppen && <Detaljer a={a} onFrågaCoach={onFrågaCoach} />}
    </div>
  )
}

export default function ActivityLog({ onUppdatera, onFrågaCoach }) {
  const [lista, setLista] = useState(null)
  const [fler, setFler] = useState(false)
  const [öppen, setÖppen] = useState(null)
  const [laddar, setLaddar] = useState(false)

  const ladda = (antal = 10) => fetchAktiviteter(0, antal).then(d => { setLista(d.aktiviteter); setFler(d.fler) })
  useEffect(() => { ladda() }, [])

  async function visaFler() {
    setLaddar(true)
    const d = await fetchAktiviteter(lista.length, 10)
    setLista([...lista, ...d.aktiviteter]); setFler(d.fler); setLaddar(false)
  }
  async function typÄndrad() {
    await ladda(Math.max(10, lista?.length || 10))
    await onUppdatera?.()
  }

  // Gruppera per dag
  const dagar = []
  for (const a of lista || []) {
    const sista = dagar[dagar.length - 1]
    if (sista?.datum === a.datum) sista.pass.push(a)
    else dagar.push({ datum: a.datum, pass: [a] })
  }

  return (
    <div style={{ background: "#1a1a26", border: "1px solid #2a2a3a", borderRadius: 12, padding: "18px 22px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
        <div style={{ color: "#64748b", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 8 }}>
          <Activity size={14} color="#6ee7b7" /> Senaste aktiviteter
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 10.5, color: "#64748b" }}>
          {["Z1", "Z2", "Z3", "Z4", "Z5"].map((z, i) => (
            <span key={z} style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: ZONFÄRG[i] }} />{z}
            </span>
          ))}
        </div>
      </div>
      {lista === null ? (
        <div style={{ color: "#475569", fontSize: 13, padding: "12px 0" }}>Laddar…</div>
      ) : lista.length === 0 ? (
        <div style={{ color: "#64748b", fontSize: 13, padding: "12px 0" }}>Inga aktiviteter ännu — synka med Garmin.</div>
      ) : (
        dagar.map(d => (
          <div key={d.datum} style={{ borderTop: "1px solid #232a38", paddingTop: 8, marginTop: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.04em" }}>{formatDatum(d.datum)}</div>
            {d.pass.map(a => (
              <Rad key={a.activity_id} a={a} öppen={öppen === a.activity_id} onVäxla={() => setÖppen(öppen === a.activity_id ? null : a.activity_id)}
                onUppdatera={typÄndrad} onFrågaCoach={onFrågaCoach} />
            ))}
          </div>
        ))
      )}
      {fler && (
        <button onClick={visaFler} disabled={laddar} style={{ marginTop: 12, width: "100%", background: "transparent", border: "1px solid #2a2a3a", color: "#94a3b8", borderRadius: 8, padding: "8px", fontSize: 12.5, cursor: "pointer" }}>
          {laddar ? "Laddar…" : "Visa fler"}
        </button>
      )}
      <div style={{ fontSize: 11, color: "#475569", marginTop: 10 }}>Klicka på ett pass för detaljer · på passtypen för att ändra den</div>
    </div>
  )
}
