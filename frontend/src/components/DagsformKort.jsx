import { useEffect, useState } from "react"
import { Smile, Meh, BatteryLow, Thermometer, Plus, Pencil, AlertTriangle, TrendingDown, TrendingUp, Check } from "lucide-react"
import { fetchDagsform, sparaDagsform, nyttBesvar, uppdateraBesvar } from "../api"
import { lokaltDatum } from "../aktivitetstyper"

const C = { surface: "#161b25", border: "#232a38", bg: "#0f131b", text: "#f1f5f9", sub: "#94a3b8", muted: "#64748b" }
const ALLMÄNT = {
  pigg: { ikon: Smile, färg: "#6ee7b7" }, okej: { ikon: Meh, färg: "#93c5fd" },
  trott: { ikon: BatteryLow, färg: "#fbbf24" }, krasslig: { ikon: Thermometer, färg: "#f87171" },
}
const TYPFÄRG = { traningsvark: "#93c5fd", stelhet: "#fbbf24", skarp: "#f87171", loppsteg: "#f87171" }
const knapp = { background: "none", border: `1px solid ${C.border}`, color: C.sub, borderRadius: 8, padding: "5px 9px", cursor: "pointer", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5 }
const etikett = { fontSize: 11, fontWeight: 600, color: C.sub, marginBottom: 6, display: "block" }

function Chip({ på, onClick, färg = "#a78bfa", children }) {
  return (
    <button type="button" onClick={onClick} style={{
      background: på ? färg + "22" : "transparent", color: på ? färg : C.sub, border: `1px solid ${på ? färg + "80" : C.border}`,
      borderRadius: 999, padding: "5px 12px", fontSize: 12, cursor: "pointer", fontWeight: på ? 600 : 400,
    }}>{children}</button>
  )
}

function NyttBesvärFormulär({ val, datum, onKlar }) {
  const [b, setB] = useState({ kroppsdel: null, typ: "traningsvark", niva: 3, anteckning: "" })
  const [fel, setFel] = useState("")
  async function spara() {
    const r = await nyttBesvar({ ...b, datum, anteckning: b.anteckning || null })
    if (!r.ok) return setFel(typeof r.data?.detail === "string" ? r.data.detail : "Kunde inte spara")
    onKlar(true)
  }
  return (
    <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
      <div><span style={etikett}>Var gör det ont?</span>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {Object.entries(val.kroppsdelar).map(([k, n]) => <Chip key={k} på={b.kroppsdel === k} onClick={() => setB({ ...b, kroppsdel: k })}>{n}</Chip>)}
        </div>
      </div>
      <div><span style={etikett}>Hur känns det?</span>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {Object.entries(val.besvarstyp).map(([k, n]) => <Chip key={k} på={b.typ === k} färg={TYPFÄRG[k]} onClick={() => setB({ ...b, typ: k })}>{n}</Chip>)}
        </div>
      </div>
      <div><span style={etikett}>Hur ont? {b.niva}/10</span>
        <input type="range" min={1} max={10} value={b.niva} onChange={e => setB({ ...b, niva: Number(e.target.value) })} style={{ width: "100%", accentColor: TYPFÄRG[b.typ] }} />
      </div>
      <input value={b.anteckning} onChange={e => setB({ ...b, anteckning: e.target.value })} maxLength={300} placeholder="Kommentar (valfritt), t.ex. kom efter fotbollen"
        style={{ background: C.surface, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: "7px 10px", fontSize: 12.5, fontFamily: "inherit" }} />
      {fel && <div style={{ color: "#f87171", fontSize: 12 }}>{fel}</div>}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button style={knapp} onClick={() => onKlar(false)}>Avbryt</button>
        <button disabled={!b.kroppsdel} onClick={spara} style={{ ...knapp, background: "#a78bfa", color: "#0a0a0f", border: "none", fontWeight: 700, opacity: b.kroppsdel ? 1 : 0.5 }}>
          <Check size={13} /> Lägg till
        </button>
      </div>
    </div>
  )
}

export default function DagsformKort({ onÄndrad }) {
  const datum = lokaltDatum(new Date())
  const [data, setData] = useState(null)
  const [redigerar, setRedigerar] = useState(false)
  const [nyttBesvär, setNyttBesvär] = useState(false)
  const [temp, setTemp] = useState("")
  const [fritext, setFritext] = useState("")
  const ladda = () => fetchDagsform(datum).then(d => {
    setData(d); setTemp(d.idag?.temp ?? ""); setFritext(d.idag?.fritext ?? "")
  })
  useEffect(() => { ladda() }, [])
  if (!data?.val) return null

  const { idag, besvar, varning, val } = data
  const rapport = idag || { allmant: null, symtom: [], temp: null, fritext: null }
  const visaFråga = !idag || redigerar

  async function spara(ändring) {
    const ny = { ...rapport, ...ändring }
    const t = String(ny.temp ?? "").replace(",", ".")
    await sparaDagsform({ datum, allmant: ny.allmant, symtom: ny.symtom, temp: t === "" ? null : Number(t), fritext: ny.fritext || null })
    onÄndrad?.()
    ladda()
  }
  const växlaSymtom = s => spara({ symtom: rapport.symtom.includes(s) ? rapport.symtom.filter(x => x !== s) : [...rapport.symtom, s] })
  const ändraBesvär = async (b, ändring) => { await uppdateraBesvar(b.id, { datum, ...ändring }); onÄndrad?.(); ladda() }

  const vald = ALLMÄNT[rapport.allmant]
  const kantfärg = varning && !idag ? "#f8717160" : vald ? vald.färg + "40" : C.border

  return (
    <div style={{ background: C.surface, border: `1px solid ${kantfärg}`, borderRadius: 12, padding: "16px 20px" }}>
      {varning && (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "#f871711a", border: "1px solid #f8717140", borderRadius: 8, padding: "9px 12px", marginBottom: 14, fontSize: 12.5, color: "#fecaca" }}>
          <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} color="#f87171" />
          <span>Klockan ser tecken på att kroppen jobbar extra i natt: {varning.signaler.join(", ")}. Känner du dig krasslig?</span>
        </div>
      )}

      {visaFråga ? (
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 10 }}>Hur mår du idag?</div>
          <div className="m-2" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {Object.entries(ALLMÄNT).map(([k, a]) => (
              <button key={k} onClick={() => spara({ allmant: k })} style={{
                background: rapport.allmant === k ? a.färg + "1a" : C.bg, border: `1px solid ${rapport.allmant === k ? a.färg + "90" : C.border}`,
                borderRadius: 10, padding: "10px 8px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
              }}>
                <a.ikon size={18} color={a.färg} />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: C.text }}>{val.allmant[k]}</span>
              </button>
            ))}
          </div>
          {rapport.allmant && (
            <div style={{ marginTop: 14 }}>
              <span style={etikett}>Symtom (klicka på det som stämmer)</span>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                {Object.entries(val.symtom).map(([k, n]) => <Chip key={k} på={rapport.symtom.includes(k)} färg="#f87171" onClick={() => växlaSymtom(k)}>{n}</Chip>)}
                {rapport.symtom.includes("feber") && (
                  <input value={temp} onChange={e => setTemp(e.target.value)} onBlur={() => spara({ temp })} inputMode="decimal" placeholder="Temp °C"
                    style={{ width: 80, background: C.bg, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: "5px 8px", fontSize: 12 }} />
                )}
              </div>
              <input value={fritext} onChange={e => setFritext(e.target.value)} onBlur={() => fritext !== (rapport.fritext ?? "") && spara({ fritext })}
                maxLength={500} placeholder="Något mer coachen bör veta idag? (valfritt)"
                style={{ marginTop: 10, width: "100%", boxSizing: "border-box", background: C.bg, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: "7px 10px", fontSize: 12.5, fontFamily: "inherit" }} />
              {redigerar && <div style={{ textAlign: "right", marginTop: 10 }}><button style={knapp} onClick={() => setRedigerar(false)}><Check size={13} /> Klar</button></div>}
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {vald && <vald.ikon size={20} color={vald.färg} />}
          <div style={{ flex: 1, fontSize: 13.5, color: C.text }}>
            <b>Idag: {val.allmant[rapport.allmant] || "–"}</b>
            <span style={{ color: C.sub }}>
              {rapport.symtom.length ? " · " + rapport.symtom.map(s => val.symtom[s]).join(", ") : " · inga symtom"}
              {rapport.temp ? ` · ${rapport.temp} °C` : ""}
            </span>
            {rapport.fritext && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>"{rapport.fritext}"</div>}
          </div>
          <button style={knapp} title="Ändra" onClick={() => setRedigerar(true)}><Pencil size={13} /></button>
        </div>
      )}

      {(besvar.length > 0 || nyttBesvär) && <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 14, paddingTop: 10 }} />}
      {besvar.map(b => (
        <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", fontSize: 13, flexWrap: "wrap" }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: TYPFÄRG[b.typ], flexShrink: 0 }} />
          <span style={{ flex: "1 1 200px", color: C.text }}>
            <b>{val.kroppsdelar[b.kroppsdel]}</b>
            <span style={{ color: C.sub }}> · {val.besvarstyp[b.typ]} · dag {b.dag} · {b.niva}/10</span>
            {b.niva !== b.niva_start && <span style={{ color: b.niva < b.niva_start ? "#6ee7b7" : "#f87171", fontSize: 12 }}> (från {b.niva_start})</span>}
            {b.dag > 7 && <span style={{ color: "#fbbf24", fontSize: 12 }}> · över en vecka — överväg fysioterapeut</span>}
          </span>
          <span style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
            <button style={knapp} title="Bättre" onClick={() => ändraBesvär(b, { niva: Math.max(1, b.niva - 1) })}><TrendingDown size={13} /> Bättre</button>
            <button style={knapp} title="Sämre" onClick={() => ändraBesvär(b, { niva: Math.min(10, b.niva + 1) })}><TrendingUp size={13} /> Sämre</button>
            <button style={knapp} onClick={() => ändraBesvär(b, { borta: true })}><Check size={13} /> Borta</button>
          </span>
        </div>
      ))}
      {nyttBesvär ? (
        <NyttBesvärFormulär val={val} datum={datum} onKlar={sparat => { setNyttBesvär(false); if (sparat) { onÄndrad?.(); ladda() } }} />
      ) : (
        <button style={{ ...knapp, marginTop: besvar.length ? 6 : 12 }} onClick={() => setNyttBesvär(true)}><Plus size={13} /> Ont någonstans</button>
      )}
    </div>
  )
}
