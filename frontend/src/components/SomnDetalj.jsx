import { useEffect, useState } from "react"
import { Moon, X } from "lucide-react"
import { fetchSomn } from "../api"

const FASER = [
  { nyckel: "djup_sov_min", namn: "Djup", färg: "#5b21b6", riktvärde: [16, 33] },
  { nyckel: "latt_sov_min", namn: "Lätt", färg: "#8b5cf6", riktvärde: [30, 64] },
  { nyckel: "rem_sov_min", namn: "REM", färg: "#c4b5fd", riktvärde: [21, 31] },
  { nyckel: "vaken_min", namn: "Vaken", färg: "#f472b6" },
]
const INTERVALL = [{ namn: "7 nätter", dagar: 7 }, { namn: "30 nätter", dagar: 30 }, { namn: "90 nätter", dagar: 90 }, { namn: "1 år", dagar: 365 }]
const VECKODAGAR = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"]

const medel = arr => {
  const v = arr.filter(x => x != null)
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}
const tidText = min => {
  if (min == null) return "—"
  const h = Math.floor(min / 60), m = Math.round(min % 60)
  return `${h}h${String(m).padStart(2, "0")}`
}
const datumText = d => new Date(d + "T12:00:00").toLocaleDateString("sv-SE", { weekday: "short", day: "numeric", month: "short" })
const poängFärg = p => (p == null ? "#475569" : p >= 80 ? "#6ee7b7" : p >= 60 ? "#fbbf24" : "#fb923c")
const sovdSumma = n => (n.djup_sov_min || 0) + (n.latt_sov_min || 0) + (n.rem_sov_min || 0)

function Ruta({ namn, värde, sub, färg }) {
  return (
    <div style={{ background: "#12161f", border: "1px solid #1e2736", borderRadius: 8, padding: "10px 12px" }}>
      <div style={{ fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em" }}>{namn}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: färg || "#f1f5f9", marginTop: 4 }}>{värde}</div>
      <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>{sub}</div>
    </div>
  )
}

function Rubrik({ children }) {
  return <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", margin: "22px 0 10px" }}>{children}</div>
}

function Staplar({ nätter }) {
  const [hover, setHover] = useState(null)
  const max = Math.max(600, ...nätter.map(n => (n.sovtid_min || 0) + (n.vaken_min || 0)))
  const h = 260, få = nätter.length <= 14
  const snitt = medel(nätter.map(n => n.sovtid_min))
  return (
    <div style={{ position: "relative" }}>
      <div style={{ position: "relative", height: h + (få ? 40 : 0), display: "flex", alignItems: "flex-end", gap: få ? 12 : nätter.length > 60 ? 1 : 3 }}>
        {[4, 6, 8, 10].map(t => (
          <div key={t} style={{ position: "absolute", left: 0, right: 0, bottom: (t * 60 / max) * h, borderTop: "1px solid #1e2736", pointerEvents: "none" }}>
            <span style={{ position: "absolute", left: -34, top: -7, fontSize: 10, color: "#475569", fontFamily: "monospace" }}>{t}h</span>
          </div>
        ))}
        {snitt && <div style={{ position: "absolute", left: 0, right: 0, bottom: (snitt / max) * h, borderTop: "1px dashed #64748b", pointerEvents: "none" }} />}
        {nätter.map((n, i) => (
          <div key={n.datum} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", cursor: "default", position: "relative", zIndex: 1 }}>
            {få && <div style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0" }}>{tidText(n.sovtid_min)}</div>}
            {få && <div style={{ fontSize: 11, fontWeight: 600, color: poängFärg(n.somnpoang), marginBottom: 4 }}>{n.somnpoang ?? ""}</div>}
            <div style={{
              width: "100%", maxWidth: 56, display: "flex", flexDirection: "column-reverse", borderRadius: få ? 5 : 2, overflow: "hidden",
              outline: hover === i ? "2px solid #e2e8f0" : "none",
            }}>
              {FASER.map(f => n[f.nyckel] ? <div key={f.nyckel} style={{ height: (n[f.nyckel] / max) * h, background: f.färg }} /> : null)}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#475569", marginTop: 6 }}>
        {få ? nätter.map(n => <span key={n.datum} style={{ flex: 1, textAlign: "center" }}>{new Date(n.datum + "T12:00:00").toLocaleDateString("sv-SE", { weekday: "short" })}</span>)
          : <><span>{datumText(nätter[0].datum)}</span><span>{datumText(nätter[nätter.length - 1].datum)}</span></>}
      </div>
      {hover != null && (() => {
        const n = nätter[hover], sovd = sovdSumma(n) || n.sovtid_min || 1
        const vänster = hover / nätter.length > 0.6
        return (
          <div style={{
            position: "absolute", top: 0, zIndex: 3, pointerEvents: "none", minWidth: 210,
            ...(vänster ? { right: `${(1 - hover / nätter.length) * 100}%` } : { left: `${((hover + 1) / nätter.length) * 100}%` }),
            background: "#0f131bf2", border: "1px solid #2a3446", borderRadius: 8, padding: "10px 12px", fontSize: 12,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ color: "#94a3b8" }}>Natten till {datumText(n.datum)}</span>
              <span style={{ color: poängFärg(n.somnpoang), fontWeight: 700 }}>{n.somnpoang ?? "—"}</span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#f1f5f9", marginBottom: 6 }}>{tidText(n.sovtid_min)}</div>
            {FASER.map(f => (
              <div key={f.nyckel} style={{ display: "flex", justifyContent: "space-between", gap: 12, color: "#94a3b8" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: f.färg }} />{f.namn}</span>
                <span style={{ fontFamily: "monospace", color: "#e2e8f0" }}>
                  {tidText(n[f.nyckel])}{f.nyckel !== "vaken_min" && n[f.nyckel] != null ? ` · ${Math.round(n[f.nyckel] / sovd * 100)}%` : ""}
                </span>
              </div>
            ))}
            <div style={{ borderTop: "1px solid #1e2736", margin: "6px 0", paddingTop: 6, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 12px", color: "#94a3b8" }}>
              {n.hrv_natt != null && <span>HRV <b style={{ color: "#e2e8f0" }}>{Math.round(n.hrv_natt)} ms</b></span>}
              {n.vilopuls_natt != null && <span>Vilopuls <b style={{ color: "#e2e8f0" }}>{n.vilopuls_natt}</b></span>}
              {n.bb_laddning != null && <span>Body Battery <b style={{ color: "#e2e8f0" }}>+{n.bb_laddning}</b></span>}
              {n.andning_snitt != null && <span>Andning <b style={{ color: "#e2e8f0" }}>{n.andning_snitt}/min</b></span>}
              {n.somnstress != null && <span>Sömnstress <b style={{ color: "#e2e8f0" }}>{Math.round(n.somnstress)}</b></span>}
              {n.hudtemp_avvikelse != null && <span>Hudtemp <b style={{ color: "#e2e8f0" }}>{n.hudtemp_avvikelse > 0 ? "+" : ""}{n.hudtemp_avvikelse}°</b></span>}
            </div>
          </div>
        )
      })()}
    </div>
  )
}

function Fördelning({ nätter }) {
  const snitt = FASER.map(f => ({ ...f, min: medel(nätter.map(n => n[f.nyckel])) }))
  const sovd = snitt.filter(f => f.nyckel !== "vaken_min").reduce((a, f) => a + (f.min || 0), 0) || 1
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {snitt.filter(f => f.riktvärde).map(f => {
        const pct = Math.round((f.min || 0) / sovd * 100)
        const inom = pct >= f.riktvärde[0] && pct <= f.riktvärde[1]
        return (
          <div key={f.nyckel}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: "#e2e8f0" }}>{f.namn} <span style={{ color: "#64748b" }}>· {tidText(f.min)}/natt</span></span>
              <span style={{ color: inom ? "#6ee7b7" : "#fbbf24", fontFamily: "monospace" }}>
                {pct}% <span style={{ color: "#475569" }}>(riktvärde {f.riktvärde[0]}–{f.riktvärde[1]}%)</span>
              </span>
            </div>
            <div style={{ position: "relative", height: 8, background: "#1e2736", borderRadius: 4 }}>
              <div style={{ position: "absolute", left: `${f.riktvärde[0]}%`, width: `${f.riktvärde[1] - f.riktvärde[0]}%`, top: -2, bottom: -2, border: "1px dashed #6ee7b760", borderRadius: 4 }} />
              <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", background: f.färg, borderRadius: 4 }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function PerVeckodag({ nätter }) {
  const dagar = VECKODAGAR.map((namn, i) => {
    // Datum = morgonen natten slutade → "natten till måndag" etc.
    const urval = nätter.filter(n => (new Date(n.datum + "T12:00:00").getDay() + 6) % 7 === i)
    return { namn, min: medel(urval.map(n => n.sovtid_min)), poäng: medel(urval.map(n => n.somnpoang)), antal: urval.length }
  })
  const max = Math.max(...dagar.map(d => d.min || 0), 1)
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-end", height: 130 }}>
      {dagar.map(d => (
        <div key={d.namn} style={{ flex: 1, textAlign: "center" }} title={`${d.antal} nätter`}>
          <div style={{ fontSize: 11, color: "#e2e8f0", fontWeight: 600 }}>{tidText(d.min)}</div>
          <div style={{ fontSize: 10, color: poängFärg(d.poäng), marginBottom: 4 }}>{d.poäng != null ? Math.round(d.poäng) : ""}</div>
          <div style={{ height: d.min ? (d.min / max) * 80 : 2, background: "#8b5cf6", opacity: 0.8, borderRadius: 4 }} />
          <div style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}>natt → {d.namn.toLowerCase()}</div>
        </div>
      ))}
    </div>
  )
}

function Kopplingar({ nätter }) {
  const långa = nätter.filter(n => n.sovtid_min >= 420), korta = nätter.filter(n => n.sovtid_min < 420)
  if (långa.length < 3 || korta.length < 3) {
    return <div style={{ fontSize: 12, color: "#475569" }}>Behöver minst 3 nätter både över och under 7 h — välj ett längre intervall.</div>
  }
  const rader = [
    { namn: "HRV", fält: "hrv_natt", enhet: "ms", högreBättre: true },
    { namn: "Vilopuls", fält: "vilopuls_natt", enhet: "bpm", högreBättre: false },
    { namn: "Body Battery-laddning", fält: "bb_laddning", enhet: "", högreBättre: true },
    { namn: "Sömnpoäng", fält: "somnpoang", enhet: "", högreBättre: true },
  ].map(r => ({ ...r, lång: medel(långa.map(n => n[r.fält])), kort: medel(korta.map(n => n[r.fält])) }))
    .filter(r => r.lång != null && r.kort != null)
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr", gap: "6px 12px", fontSize: 12 }}>
      <span style={{ color: "#475569" }} />
      <span style={{ color: "#475569" }}>≥ 7 h ({långa.length} n)</span>
      <span style={{ color: "#475569" }}>&lt; 7 h ({korta.length} n)</span>
      <span style={{ color: "#475569" }}>Skillnad</span>
      {rader.map(r => {
        const diff = r.lång - r.kort, bra = r.högreBättre ? diff > 0 : diff < 0
        return [
          <span key={r.namn + "n"} style={{ color: "#94a3b8" }}>{r.namn}</span>,
          <span key={r.namn + "l"} style={{ color: "#e2e8f0", fontFamily: "monospace" }}>{Math.round(r.lång)} {r.enhet}</span>,
          <span key={r.namn + "k"} style={{ color: "#e2e8f0", fontFamily: "monospace" }}>{Math.round(r.kort)} {r.enhet}</span>,
          <span key={r.namn + "d"} style={{ color: Math.abs(diff) < 0.5 ? "#94a3b8" : bra ? "#6ee7b7" : "#fb923c", fontFamily: "monospace" }}>
            {diff > 0 ? "+" : ""}{Math.round(diff)} {r.enhet}
          </span>,
        ]
      })}
    </div>
  )
}

export default function SomnDetalj({ onStäng }) {
  const [intervall, setIntervall] = useState(INTERVALL[1])
  const [nätter, setNätter] = useState(null)

  useEffect(() => {
    let aktiv = true
    fetchSomn(intervall.dagar).then(d => { if (aktiv) setNätter(d) })
    return () => { aktiv = false }
  }, [intervall])

  useEffect(() => {
    const esc = e => e.key === "Escape" && onStäng()
    window.addEventListener("keydown", esc)
    return () => window.removeEventListener("keydown", esc)
  }, [onStäng])

  let innehåll = <div style={{ color: "#64748b", fontSize: 13, padding: 40, textAlign: "center" }}>Laddar…</div>
  if (nätter && nätter.length === 0) innehåll = <div style={{ color: "#64748b", fontSize: 13, padding: 40, textAlign: "center" }}>Ingen sömndata i perioden</div>
  else if (nätter) {
    const medPoäng = nätter.filter(n => n.somnpoang != null)
    const bäst = medPoäng.reduce((a, b) => (b.somnpoang > (a?.somnpoang ?? -1) ? b : a), null)
    const sämst = medPoäng.reduce((a, b) => (b.somnpoang < (a?.somnpoang ?? 999) ? b : a), null)
    const andel = fält => {
      const sovd = medel(nätter.map(sovdSumma)) || 1
      return Math.round((medel(nätter.map(n => n[fält])) || 0) / sovd * 100)
    }
    const snittPoäng = medel(nätter.map(n => n.somnpoang))
    innehåll = (
      <>
        <div className="m-3" style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10, marginBottom: 18 }}>
          <Ruta namn="Snitt sömn" värde={tidText(medel(nätter.map(n => n.sovtid_min)))} sub={`${nätter.length} nätter`} />
          <Ruta namn="Snitt poäng" värde={snittPoäng != null ? Math.round(snittPoäng) : "—"} färg={poängFärg(snittPoäng)} sub="sömnpoäng" />
          <Ruta namn="Djupsömn" värde={tidText(medel(nätter.map(n => n.djup_sov_min)))} sub={`${andel("djup_sov_min")}% av sömnen`} />
          <Ruta namn="REM" värde={tidText(medel(nätter.map(n => n.rem_sov_min)))} sub={`${andel("rem_sov_min")}% av sömnen`} />
          <Ruta namn="Bästa natt" värde={bäst?.somnpoang ?? "—"} färg="#6ee7b7" sub={bäst ? `${datumText(bäst.datum)} · ${tidText(bäst.sovtid_min)}` : ""} />
          <Ruta namn="Sämsta natt" värde={sämst?.somnpoang ?? "—"} färg="#fb923c" sub={sämst ? `${datumText(sämst.datum)} · ${tidText(sämst.sovtid_min)}` : ""} />
        </div>

        <div style={{ paddingLeft: 36 }}><Staplar nätter={nätter} /></div>
        <div style={{ display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap" }}>
          {FASER.map(f => (
            <span key={f.nyckel} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#94a3b8" }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: f.färg }} />{f.namn}
            </span>
          ))}
          <span style={{ fontSize: 11, color: "#475569", marginLeft: "auto" }}>Peka eller tryck på en natt för detaljer · streckad linje = snitt</span>
        </div>

        <div className="m-stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }}>
          <div>
            <Rubrik>Sömnfaser i snitt</Rubrik>
            <Fördelning nätter={nätter} />
            <div style={{ fontSize: 10, color: "#475569", marginTop: 8 }}>Riktvärden från Garmins sömnpoäng (andel av sovd tid). Streckad ram = rekommenderat intervall.</div>
          </div>
          <div>
            <Rubrik>Per veckodag</Rubrik>
            <PerVeckodag nätter={nätter} />
          </div>
        </div>

        <Rubrik>Hur sömnlängden påverkar återhämtningen</Rubrik>
        <Kopplingar nätter={nätter} />
      </>
    )
  }

  return (
    <div onClick={onStäng} className="m-modal-bakgrund" style={{ position: "fixed", inset: 0, background: "#000000b0", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
      <div onClick={e => e.stopPropagation()} className="m-modal" style={{ background: "#161b25", border: "1px solid #2a3446", borderRadius: 12, padding: "22px 26px", width: "min(1100px, 100%)", maxHeight: "100%", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 700, color: "#f1f5f9" }}>
            <Moon size={18} color="#a78bfa" /> Sömn
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ display: "flex", gap: 4, background: "#12161f", border: "1px solid #1e2736", borderRadius: 8, padding: 3 }}>
              {INTERVALL.map(iv => (
                <button key={iv.namn} onClick={() => setIntervall(iv)} style={{
                  background: iv === intervall ? "#1e2736" : "transparent", color: iv === intervall ? "#f1f5f9" : "#64748b",
                  border: "none", borderRadius: 6, padding: "5px 12px", fontSize: 12, cursor: "pointer",
                }}>{iv.namn}</button>
              ))}
            </div>
            <button onClick={onStäng} title="Stäng (Esc)" style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer" }}><X size={20} /></button>
          </div>
        </div>
        {innehåll}
      </div>
    </div>
  )
}
