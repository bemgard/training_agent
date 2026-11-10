import { useEffect, useState, useCallback } from "react"
import { Scale, Plus, X, Trash2 } from "lucide-react"
import { fetchKropp, sparaKroppsprofil, sparaVikt, taBortVikt } from "../api"
import { lokaltDatum } from "../aktivitetstyper"

const MÅTT = {
  vikt: { namn: "Vikt", fält: "vikt_kg", färg: "#a78bfa", enhet: "kg" },
  fett: { namn: "Fettmassa", fält: "fett_kg", färg: "#f97316", enhet: "kg" },
  fettfri: { namn: "Fettfri massa", fält: "fettfri_kg", färg: "#60a5fa", enhet: "kg" },
  muskel: { namn: "Muskelmassa", fält: "muskel_kg", färg: "#60a5fa", enhet: "kg" },
}
const INTERVALL = [{ namn: "30 d", dagar: 30 }, { namn: "90 d", dagar: 90 }, { namn: "1 år", dagar: 365 }, { namn: "Allt", dagar: null }]

const inputStil = {
  background: "#12121a", color: "#e2e8f0", border: "1px solid #2a2a3a",
  borderRadius: 6, padding: "6px 8px", fontSize: 13, width: "100%",
}
const knappStil = (färg = "#6ee7b7") => ({
  background: färg + "1a", color: färg, border: `1px solid ${färg}50`,
  borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer",
  display: "inline-flex", alignItems: "center", gap: 6,
})

function senasteMed(mätningar, fält) {
  for (let i = mätningar.length - 1; i >= 0; i--) if (mätningar[i][fält] != null) return mätningar[i]
  return null
}

function förändring(mätningar, fält, dagar) {
  const senaste = senasteMed(mätningar, fält)
  if (!senaste) return null
  const gräns = new Date(senaste.datum + "T12:00:00"); gräns.setDate(gräns.getDate() - dagar)
  const gränsStr = lokaltDatum(gräns)
  const tidigare = mätningar.filter(m => m[fält] != null && m.datum <= gränsStr).pop()
    || mätningar.find(m => m[fält] != null && m !== senaste)
  if (!tidigare || tidigare === senaste) return null
  return Math.round((senaste[fält] - tidigare[fält]) * 10) / 10
}

function Kort({ mått, värde, sub, vald, onClick }) {
  return (
    <button onClick={onClick} style={{
      textAlign: "left", cursor: "pointer", background: vald ? "#1c2230" : "#161b25",
      border: `1px solid ${vald ? mått.färg + "80" : "#1e2736"}`, borderRadius: 10, padding: "16px 18px",
    }}>
      <div style={{ fontSize: 10, fontWeight: 500, color: "#475569", textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 10 }}>
        {mått.namn}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span style={{ fontSize: 30, fontWeight: 900, color: mått.färg, letterSpacing: "-1px", lineHeight: 1 }}>
          {värde ?? "—"}
        </span>
        {värde != null && <span style={{ fontSize: 13, color: "#475569" }}>{mått.enhet}</span>}
      </div>
      <div style={{ fontSize: 11, color: "#64748b", marginTop: 6, fontFamily: "monospace", minHeight: 14 }}>{sub}</div>
    </button>
  )
}

function Graf({ mätningar, mått }) {
  const [intervall, setIntervall] = useState(INTERVALL[1])
  const idag = new Date()
  const från = intervall.dagar ? lokaltDatum(new Date(idag.getTime() - intervall.dagar * 864e5)) : null
  const punkter = mätningar.filter(m => m[mått.fält] != null && (!från || m.datum >= från))

  const w = 600, h = 160, pad = 8
  let innehåll
  if (punkter.length < 2) {
    innehåll = (
      <div style={{ color: "#475569", fontSize: 13, textAlign: "center", padding: "50px 0" }}>
        {punkter.length === 1 ? "Väg in dig minst två gånger för att se en trend" : "Inga mätningar i perioden"}
      </div>
    )
  } else {
    const t = m => new Date(m.datum + "T12:00:00").getTime()
    const t0 = t(punkter[0]), t1 = t(punkter[punkter.length - 1])
    const värden = punkter.map(m => m[mått.fält])
    const min = Math.min(...värden), max = Math.max(...värden)
    const marg = Math.max((max - min) * 0.15, 0.5)
    const yMin = min - marg, yMax = max + marg
    const x = m => pad + ((t(m) - t0) / (t1 - t0 || 1)) * (w - 2 * pad)
    const y = v => pad + (1 - (v - yMin) / (yMax - yMin)) * (h - 2 * pad)
    const linje = punkter.map(m => `${x(m)},${y(m[mått.fält])}`).join(" ")
    innehåll = (
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", fontSize: 10, color: "#475569", fontFamily: "monospace", padding: "4px 0" }}>
          <span>{yMax.toFixed(1)}</span><span>{yMin.toFixed(1)}</span>
        </div>
        <div style={{ flex: 1, position: "relative" }}>
          <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: "block" }}>
            <polyline points={`${x(punkter[0])},${h} ${linje} ${x(punkter[punkter.length - 1])},${h}`}
              fill={mått.färg} fillOpacity="0.08" stroke="none" />
            <polyline points={linje} fill="none" stroke={mått.färg} strokeWidth="2" vectorEffect="non-scaling-stroke"
              strokeLinejoin="round" strokeLinecap="round" />
          </svg>
          {punkter.map(m => (
            <div key={m.datum} title={`${m.datum}: ${m[mått.fält]} ${mått.enhet}`} style={{
              position: "absolute", width: 7, height: 7, borderRadius: "50%", background: mått.färg,
              border: "2px solid #161b25", transform: "translate(-50%, -50%)",
              left: `${(x(m) / w) * 100}%`, top: `${(y(m[mått.fält]) / h) * 100}%`,
            }} />
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#475569", marginTop: 4 }}>
            <span>{punkter[0].datum}</span><span>{punkter[punkter.length - 1].datum}</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {INTERVALL.map(iv => (
          <button key={iv.namn} onClick={() => setIntervall(iv)} style={{
            ...knappStil(iv === intervall ? mått.färg : "#64748b"), padding: "3px 10px", fontSize: 11,
          }}>{iv.namn}</button>
        ))}
      </div>
      {innehåll}
    </div>
  )
}

function ProfilFormulär({ profil, onSparat }) {
  const [langd, setLangd] = useState(profil?.langd_cm ?? "")
  const [år, setÅr] = useState(profil?.fodelsear ?? "")
  const [kon, setKon] = useState(profil?.kon ?? "")
  const [fel, setFel] = useState("")
  async function spara() {
    const r = await sparaKroppsprofil({ langd_cm: Number(langd), fodelsear: Number(år), kon })
    if (!r.ok) return setFel("Kontrollera värdena (längd 100–250 cm, födelseår, kön)")
    onSparat()
  }
  return (
    <div className="m-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
      <label style={{ fontSize: 11, color: "#64748b" }}>Längd (cm)<input style={inputStil} type="number" value={langd} onChange={e => setLangd(e.target.value)} /></label>
      <label style={{ fontSize: 11, color: "#64748b" }}>Födelseår<input style={inputStil} type="number" value={år} onChange={e => setÅr(e.target.value)} /></label>
      <label style={{ fontSize: 11, color: "#64748b" }}>Kön
        <select style={inputStil} value={kon} onChange={e => setKon(e.target.value)}>
          <option value="" disabled>Välj…</option><option value="man">Man</option><option value="kvinna">Kvinna</option>
        </select>
      </label>
      <button style={knappStil()} onClick={spara}>Spara</button>
      {fel && <div style={{ gridColumn: "1 / -1", color: "#f87171", fontSize: 12 }}>{fel}</div>}
    </div>
  )
}

function InvägningFormulär({ onSparat, onAvbryt }) {
  const [datum, setDatum] = useState(lokaltDatum(new Date()))
  const [vikt, setVikt] = useState("")
  const [fett, setFett] = useState("")
  const [muskel, setMuskel] = useState("")
  const [fel, setFel] = useState("")
  async function spara() {
    const tal = v => (v === "" ? null : Number(String(v).replace(",", ".")))
    const r = await sparaVikt({ datum, vikt_kg: tal(vikt), fett_procent: tal(fett), muskel_kg: tal(muskel) })
    if (!r.ok) return setFel("Kontrollera värdena")
    onSparat()
  }
  return (
    <div className="m-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto auto", gap: 10, alignItems: "end" }}>
      <label style={{ fontSize: 11, color: "#64748b" }}>Datum<input style={inputStil} type="date" value={datum} onChange={e => setDatum(e.target.value)} /></label>
      <label style={{ fontSize: 11, color: "#64748b" }}>Vikt (kg)*<input style={inputStil} inputMode="decimal" autoFocus value={vikt} onChange={e => setVikt(e.target.value)} /></label>
      <label style={{ fontSize: 11, color: "#64748b" }}>Fett % (smartvåg)<input style={inputStil} inputMode="decimal" placeholder="valfritt" value={fett} onChange={e => setFett(e.target.value)} /></label>
      <label style={{ fontSize: 11, color: "#64748b" }}>Muskler kg (smartvåg)<input style={inputStil} inputMode="decimal" placeholder="valfritt" value={muskel} onChange={e => setMuskel(e.target.value)} /></label>
      <button style={knappStil()} onClick={spara} disabled={!vikt}>Spara</button>
      <button style={knappStil("#64748b")} onClick={onAvbryt}><X size={12} /></button>
      {fel && <div style={{ gridColumn: "1 / -1", color: "#f87171", fontSize: 12 }}>{fel}</div>}
    </div>
  )
}

export default function KroppSektion() {
  const [data, setData] = useState(null)
  const [vald, setVald] = useState(null)
  const [visaInvägning, setVisaInvägning] = useState(false)
  const [visaProfil, setVisaProfil] = useState(false)

  const ladda = useCallback(() => fetchKropp().then(setData), [])
  useEffect(() => { ladda() }, [ladda])

  if (!data) return null
  const { profil, matningar: m } = data
  const profilKlar = profil?.langd_cm && profil?.fodelsear && profil?.kon
  const senaste = m[m.length - 1]
  const harUppmättMuskel = m.some(x => x.muskel_kg != null)
  const tredjeMått = harUppmättMuskel ? MÅTT.muskel : MÅTT.fettfri

  const senFett = senasteMed(m, "fett_kg")
  const senTredje = senasteMed(m, tredjeMått.fält)
  const fmt = v => (v > 0 ? `↑ ${v}` : v < 0 ? `↓ ${Math.abs(v)}` : "±0")
  const dV = förändring(m, "vikt_kg", 30), dF = förändring(m, "fett_kg", 30), dT = förändring(m, tredjeMått.fält, 30)

  const kort = [
    { nyckel: "vikt", mått: MÅTT.vikt, värde: senaste?.vikt_kg,
      sub: senaste ? `${senaste.bmi ? `BMI ${senaste.bmi}` : "BMI kräver längd"}${dV != null ? ` · ${fmt(dV)} kg 30 d` : ""}` : "" },
    { nyckel: "fett", mått: MÅTT.fett, värde: senFett?.fett_kg,
      sub: senFett ? `${senFett.fett_procent} %${senFett.fett_procent_uppskattad ? " · uppskattad ±5" : ""}${dF != null ? ` · ${fmt(dF)}` : ""}`
        : profilKlar ? "" : "Fyll i längd, födelseår och kön" },
    { nyckel: harUppmättMuskel ? "muskel" : "fettfri", mått: tredjeMått, värde: senTredje?.[tredjeMått.fält],
      sub: senTredje ? `${harUppmättMuskel ? "uppmätt" : "vikt − fett, ej muskler"}${dT != null ? ` · ${fmt(dT)}` : ""}` : "" },
  ]
  const valtKort = kort.find(k => k.nyckel === vald)

  return (
    <div style={{ background: "#1a1a26", border: "1px solid #2a2a3a", borderRadius: 12, padding: "20px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ color: "#64748b", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 8 }}>
          <Scale size={14} color="#a78bfa" /> Vikt och kroppssammansättning
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={knappStil("#64748b")} onClick={() => setVisaProfil(v => !v)}>
            {profilKlar ? `${profil.langd_cm} cm · ${profil.kon === "man" ? "man" : "kvinna"} · f. ${profil.fodelsear}` : "Ange längd m.m."}
          </button>
          <button style={knappStil("#a78bfa")} onClick={() => setVisaInvägning(v => !v)}><Plus size={12} /> Väg in</button>
        </div>
      </div>

      {(visaProfil || (!profilKlar && m.length > 0)) && (
        <div style={{ marginBottom: 16 }}>
          <ProfilFormulär profil={profil} onSparat={() => { setVisaProfil(false); ladda() }} />
        </div>
      )}
      {visaInvägning && (
        <div style={{ marginBottom: 16 }}>
          <InvägningFormulär onSparat={() => { setVisaInvägning(false); ladda() }} onAvbryt={() => setVisaInvägning(false)} />
        </div>
      )}

      {m.length === 0 ? (
        <div style={{ color: "#475569", fontSize: 13, padding: "16px 0" }}>
          Inga invägningar än. Klicka <b style={{ color: "#a78bfa" }}>Väg in</b> för att börja — väg dig gärna samma tid på dagen, t.ex. på morgonen.
        </div>
      ) : (
        <>
          <div className="m-stack" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {kort.map(k => (
              <Kort key={k.nyckel} mått={k.mått} värde={k.värde} sub={k.sub}
                vald={vald === k.nyckel} onClick={() => setVald(vald === k.nyckel ? null : k.nyckel)} />
            ))}
          </div>

          {valtKort && (
            <div style={{ marginTop: 16, background: "#161b25", border: "1px solid #1e2736", borderRadius: 10, padding: "16px 18px" }}>
              <Graf mätningar={m} mått={valtKort.mått} />
              <div style={{ marginTop: 16, maxHeight: 160, overflowY: "auto" }}>
                {[...m].reverse().map(x => (
                  <div key={x.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, padding: "5px 0", borderBottom: "1px solid #1e2736", color: "#94a3b8" }}>
                    <span style={{ fontFamily: "monospace" }}>{x.datum}</span>
                    <span>{x.vikt_kg} kg{x.fett_procent != null ? ` · ${x.fett_procent} %${x.fett_procent_uppskattad ? " (uppsk.)" : ""}` : ""}{x.muskel_kg != null ? ` · ${x.muskel_kg} kg muskler` : ""}</span>
                    <button title="Ta bort" onClick={async () => { await taBortVikt(x.id); ladda() }}
                      style={{ background: "none", border: "none", color: "#475569", cursor: "pointer" }}><Trash2 size={13} /></button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {m.some(x => x.fett_procent_uppskattad) && (
            <div style={{ fontSize: 11, color: "#475569", marginTop: 12 }}>
              Fett uppskattas från BMI, ålder och kön (Deurenberg) och har ±5 procentenheters felmarginal — överskattar ofta muskulösa personer. Fyll i värden från en smartvåg för exakta siffror.
            </div>
          )}
        </>
      )}
    </div>
  )
}
