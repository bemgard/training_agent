import { useEffect, useState, useRef } from "react"
import { Heart, HeartPulse, TrendingUp, Moon, Gauge, BarChart3, Flame, Scale3d, X } from "lucide-react"
import { fetchTrender } from "../api"
import { kategoriInfo, lokaltDatum, formatMinuter } from "../aktivitetstyper"

const INTERVALL = [
  { namn: "30 d", dagar: 30 }, { namn: "90 d", dagar: 90 }, { namn: "6 mån", dagar: 182 },
  { namn: "1 år", dagar: 365 }, { namn: "Allt", dagar: 0 },
]
const DAG = 864e5
const tid = d => new Date(d + "T12:00:00").getTime()
const datumText = (d, medÅr) => new Date(d + "T12:00:00").toLocaleDateString("sv-SE",
  medÅr ? { day: "numeric", month: "short", year: "numeric" } : { day: "numeric", month: "short" })

// Jämna steg för y-axeln: 1, 2, 2.5, 5 × 10^n
function snyggaTicks(min, max, mål = 6) {
  const råSteg = (max - min) / mål
  const mag = 10 ** Math.floor(Math.log10(råSteg || 1))
  const steg = [1, 2, 2.5, 5, 10].map(f => f * mag).find(s => s >= råSteg) || 10 * mag
  const start = Math.floor(min / steg) * steg, slut = Math.ceil(max / steg) * steg
  const ticks = []
  for (let v = start; v <= slut + steg / 2; v += steg) ticks.push(Math.round(v * 1000) / 1000)
  return ticks
}

// Delar en serie i segment där det är mer än `maxLucka` dagar mellan punkterna
function segment(punkter, maxLucka) {
  const ut = []
  let nu = []
  punkter.filter(p => p.v != null).forEach((p, i, arr) => {
    if (i > 0 && (tid(p.datum) - tid(arr[i - 1].datum)) / DAG > maxLucka) { ut.push(nu); nu = [] }
    nu.push(p)
  })
  if (nu.length) ut.push(nu)
  return ut
}

// ── Tidsgraf: kompakt i rutnätet, detaljerad (ticks + hover) i detaljvyn ──
function TidsGraf({ serier, band, från, till, färg, yFormat = v => Math.round(v), höjd = 170, detalj = false, enhet = "" }) {
  const behållare = useRef(null)
  const [hover, setHover] = useState(null)

  const synliga = serier.filter(s => !s.dold)
  const allaV = synliga.flatMap(s => s.punkter.map(p => p.v)).concat((band || []).flatMap(b => [b.låg, b.hög]))
    .filter(v => v != null)
  if (allaV.length < 2) {
    return <div style={{ color: "#475569", fontSize: 13, textAlign: "center", padding: "60px 0" }}>För lite data i perioden</div>
  }
  const w = 600, h = höjd, pad = 6
  const t0 = tid(från), t1 = tid(till)
  const min = Math.min(...allaV), max = Math.max(...allaV)
  const ticks = detalj ? snyggaTicks(min, max, 7) : null
  const marg = Math.max((max - min) * 0.1, 1)
  const yMin = detalj ? ticks[0] : min - marg, yMax = detalj ? ticks[ticks.length - 1] : max + marg
  const x = d => pad + ((tid(d) - t0) / (t1 - t0 || 1)) * (w - 2 * pad)
  const y = v => pad + (1 - (v - yMin) / (yMax - yMin)) * (h - 2 * pad)
  const långPeriod = (t1 - t0) / DAG > 300

  const bandPoly = band?.length > 1
    ? band.map(b => `${x(b.datum)},${y(b.hög)}`).join(" ") + " " + [...band].reverse().map(b => `${x(b.datum)},${y(b.låg)}`).join(" ")
    : null
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map(f => lokaltDatum(new Date(t0 + f * (t1 - t0))))
  const yEtiketter = detalj ? ticks : [yMax, (yMax + yMin) / 2, yMin]

  function hitta(e) {
    const r = behållare.current.getBoundingClientRect()
    const andel = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))
    const t = t0 + ((andel * w - pad) / (w - 2 * pad)) * (t1 - t0)
    const värden = serier.map(s => {
      let bäst = null
      s.punkter.forEach(p => {
        if (p.v == null) return
        const avst = Math.abs(tid(p.datum) - t)
        if (avst <= (s.hoverRadie ?? 3) * DAG && (!bäst || avst < bäst.avst)) bäst = { ...p, avst }
      })
      return bäst ? { namn: s.namn, färg: s.färg, opacitet: s.opacitet, format: s.format, enhet: s.enhet, dold: s.dold, ...bäst } : null
    }).filter(Boolean)
    if (!värden.length) return setHover(null)
    const närmast = (värden.filter(v => !v.dold).length ? värden.filter(v => !v.dold) : värden).reduce((a, b) => (a.avst < b.avst ? a : b))
    setHover({ datum: närmast.datum, värden, xPos: x(närmast.datum) / w })
  }

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <div style={{ position: "relative", minWidth: detalj ? 40 : 30, fontSize: 10, color: "#475569", fontFamily: "monospace" }}>
        {yEtiketter.map(v => (
          <span key={v} style={{ position: "absolute", right: 0, top: `${(y(v) / h) * h - 6}px` }}>{yFormat(v)}</span>
        ))}
      </div>
      <div style={{ flex: 1, position: "relative" }}>
        <div ref={behållare} style={{ position: "relative", cursor: detalj ? "crosshair" : "inherit" }}
          onMouseMove={detalj ? hitta : undefined} onMouseLeave={detalj ? () => setHover(null) : undefined}>
          <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: "block" }}>
            {yEtiketter.map(v => (
              <line key={v} x1={0} x2={w} y1={y(v)} y2={y(v)} stroke="#1e2736" vectorEffect="non-scaling-stroke" />
            ))}
            {bandPoly && <polygon points={bandPoly} fill={färg} opacity="0.08" />}
            {synliga.filter(s => !s.prickar || s.bredd).flatMap((s, i) =>
              segment(s.punkter, s.maxLucka ?? 4).map((seg, j) => (
                <polyline key={`${i}-${j}`} points={seg.map(p => `${x(p.datum)},${y(p.v)}`).join(" ")} fill="none"
                  stroke={s.färg} strokeWidth={s.bredd ?? 2} strokeOpacity={s.opacitet ?? 1}
                  strokeDasharray={s.streckad ? "5 4" : undefined}
                  vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
              )))}
            {hover && <line x1={hover.xPos * w} x2={hover.xPos * w} y1={0} y2={h} stroke="#64748b" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
          </svg>
          {synliga.filter(s => s.prickar).flatMap((s, i) => s.punkter.filter(p => p.v != null).map(p => (
            <div key={`${i}-${p.datum}`} title={`${p.datum}: ${yFormat(p.v)}`} style={{
              position: "absolute", width: s.prickStorlek ?? 6, height: s.prickStorlek ?? 6, borderRadius: "50%",
              background: s.färg, opacity: s.opacitet ?? 1, transform: "translate(-50%, -50%)", pointerEvents: "none",
              left: `${(x(p.datum) / w) * 100}%`, top: `${(y(p.v) / h) * 100}%`,
            }} />
          )))}
          {hover && (
            <div style={{
              position: "absolute", top: 4, pointerEvents: "none", zIndex: 2,
              ...(hover.xPos > 0.6 ? { right: `${(1 - hover.xPos) * 100 + 1}%` } : { left: `${hover.xPos * 100 + 1}%` }),
              background: "#0f131bf2", border: "1px solid #2a3446", borderRadius: 8, padding: "8px 10px", minWidth: 140,
            }}>
              <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>{datumText(hover.datum, true)}</div>
              {hover.värden.map(v => (
                <div key={v.namn} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12 }}>
                  <span style={{ color: "#94a3b8", display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: v.färg, opacity: Math.max(v.opacitet ?? 1, 0.5) }} />
                    {v.namn}{v.datum !== hover.datum ? ` (${datumText(v.datum)})` : ""}
                  </span>
                  <span style={{ color: "#f1f5f9", fontWeight: 600, fontFamily: "monospace" }}>
                    {(v.format || yFormat)(v.v)}{(v.enhet ?? enhet) ? ` ${v.enhet ?? enhet}` : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#475569", marginTop: 4 }}>
          {xTicks.map(t => <span key={t}>{långPeriod
            ? new Date(t + "T12:00:00").toLocaleDateString("sv-SE", { month: "short", year: "2-digit" })
            : datumText(t)}</span>)}
        </div>
      </div>
    </div>
  )
}

function VolymGraf({ volym, detalj }) {
  if (!volym.length) return <div style={{ color: "#475569", fontSize: 13, textAlign: "center", padding: "60px 0" }}>Inga pass i perioden</div>
  const h = detalj ? 340 : 170
  const ticks = snyggaTicks(0, Math.max(60, ...volym.map(v => v.totalt)), detalj ? 6 : 2)
  const max = ticks[ticks.length - 1]
  return (
    <>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ position: "relative", minWidth: detalj ? 40 : 30, fontSize: 10, color: "#475569", fontFamily: "monospace" }}>
          {ticks.map(t => <span key={t} style={{ position: "absolute", right: 0, top: (1 - t / max) * h - 6 }}>{formatMinuter(t) === "—" ? "0" : formatMinuter(t)}</span>)}
        </div>
        <div style={{ flex: 1, position: "relative", height: h }}>
          {ticks.map(t => <div key={t} style={{ position: "absolute", left: 0, right: 0, top: (1 - t / max) * h, borderTop: "1px solid #1e2736" }} />)}
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-end", gap: volym.length > 60 ? 1 : 3 }}>
            {volym.map(v => (
              <div key={v.vecka}
                title={`Vecka från ${v.vecka}: ${formatMinuter(v.totalt)}\n` + Object.entries(v.per_kategori)
                  .map(([k, m]) => `${kategoriInfo(k === "oklassad" ? null : k).namn}: ${formatMinuter(m)}`).join("\n")}
                style={{ flex: 1, display: "flex", flexDirection: "column-reverse", height: `${(v.totalt / max) * 100}%`, minHeight: 2, borderRadius: 2, overflow: "hidden" }}>
                {Object.entries(v.per_kategori).map(([k, min]) => (
                  <div key={k} style={{ height: `${(min / v.totalt) * 100}%`, background: kategoriInfo(k === "oklassad" ? null : k).färg }} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#475569", marginTop: 4, marginLeft: detalj ? 48 : 38 }}>
        <span>{datumText(volym[0].vecka, true)}</span><span>{datumText(volym[volym.length - 1].vecka, true)}</span>
      </div>
    </>
  )
}

function Legend({ poster }) {
  return (
    <div style={{ display: "flex", gap: 14, marginTop: 8, flexWrap: "wrap" }}>
      {poster.map(p => (
        <span key={p.namn} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "#94a3b8" }}>
          <span style={{ width: p.prick ? 6 : 12, height: p.prick ? 6 : 2, borderRadius: p.prick ? "50%" : 1, background: p.färg, opacity: p.opacitet ?? 1 }} />
          {p.namn}
        </span>
      ))}
    </div>
  )
}

const medel = arr => {
  const v = arr.filter(x => x != null)
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}

function delta(punkter, fält, lägreÄrBättre = false, decimaler = 0) {
  const v = punkter.map(p => p[fält]).filter(x => x != null)
  if (v.length < 2) return null
  const d = Math.round((v[v.length - 1] - v[0]) * 10 ** decimaler) / 10 ** decimaler
  const bra = lägreÄrBättre ? d < 0 : d > 0
  return <span style={{ color: d === 0 ? "#94a3b8" : bra ? "#6ee7b7" : "#fb923c" }}>{d > 0 ? "↑" : d < 0 ? "↓" : "±"} {Math.abs(d)} i perioden</span>
}

// Nyckeltal för detaljvyn
function Nyckeltal({ punkter, format, lägreÄrBättre, enhet }) {
  const p = punkter.filter(x => x.v != null)
  if (!p.length) return null
  const minP = p.reduce((a, b) => (b.v < a.v ? b : a)), maxP = p.reduce((a, b) => (b.v > a.v ? b : a))
  const förändring = p.length > 1 ? p[p.length - 1].v - p[0].v : null
  const bra = förändring == null ? null : lägreÄrBättre ? förändring < 0 : förändring > 0
  const rutor = [
    { namn: "Senaste", värde: format(p[p.length - 1].v), sub: datumText(p[p.length - 1].datum, true) },
    { namn: "Snitt", värde: format(medel(p.map(x => x.v))), sub: `${p.length} mätningar` },
    { namn: "Lägsta", värde: format(minP.v), sub: datumText(minP.datum, true) },
    { namn: "Högsta", värde: format(maxP.v), sub: datumText(maxP.datum, true) },
    { namn: "Förändring", värde: förändring == null ? "—" : `${förändring > 0 ? "+" : förändring < 0 ? "−" : "±"}${format(Math.abs(förändring))}`,
      sub: "första → senaste", färg: förändring ? (bra ? "#6ee7b7" : "#fb923c") : undefined },
  ]
  return (
    <div className="m-3" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 18 }}>
      {rutor.map(r => (
        <div key={r.namn} style={{ background: "#12161f", border: "1px solid #1e2736", borderRadius: 8, padding: "10px 12px" }}>
          <div style={{ fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em" }}>{r.namn}</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: r.färg || "#f1f5f9", marginTop: 4 }}>
            {r.värde}<span style={{ fontSize: 11, color: "#475569", fontWeight: 400 }}> {enhet}</span>
          </div>
          <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>{r.sub}</div>
        </div>
      ))}
    </div>
  )
}

function Kort({ ikon: Ikon, titel, färg, värde, enhet, sub, förklaring, onClick, children }) {
  return (
    <div onClick={onClick} style={{
      background: "#161b25", border: "1px solid #1e2736", borderRadius: 10, padding: "16px 18px", cursor: "pointer",
      transition: "border-color 0.15s",
    }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = färg + "80")}
      onMouseLeave={e => (e.currentTarget.style.borderColor = "#1e2736")}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, fontWeight: 500, color: "#475569", textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 8 }}>
            <Ikon size={13} color={färg} /> {titel}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{ fontSize: 26, fontWeight: 900, color: "#f1f5f9", letterSpacing: "-1px", lineHeight: 1 }}>{värde ?? "—"}</span>
            {värde != null && enhet && <span style={{ fontSize: 12, color: "#475569" }}>{enhet}</span>}
          </div>
        </div>
        {sub && <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "right", fontFamily: "monospace", maxWidth: "55%" }}>{sub}</div>}
      </div>
      {children}
      {förklaring && <div style={{ fontSize: 10, color: "#475569", marginTop: 8 }}>{förklaring}</div>}
    </div>
  )
}

function Detaljvy({ graf, från, till, onStäng }) {
  useEffect(() => {
    const esc = e => e.key === "Escape" && onStäng()
    window.addEventListener("keydown", esc)
    return () => window.removeEventListener("keydown", esc)
  }, [onStäng])
  const Ikon = graf.ikon
  return (
    <div onClick={onStäng} className="m-modal-bakgrund" style={{ position: "fixed", inset: 0, background: "#000000b0", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
      <div onClick={e => e.stopPropagation()} className="m-modal" style={{ background: "#161b25", border: "1px solid #2a3446", borderRadius: 12, padding: "22px 26px", width: "min(1100px, 100%)", maxHeight: "100%", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 700, color: "#f1f5f9" }}>
            <Ikon size={18} color={graf.färg} /> {graf.titel}
            <span style={{ fontSize: 12, fontWeight: 400, color: "#64748b", marginLeft: 8 }}>{datumText(från, true)} – {datumText(till, true)}</span>
          </div>
          <button onClick={onStäng} title="Stäng (Esc)" style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer" }}><X size={20} /></button>
        </div>
        {graf.nyckeltal && <Nyckeltal {...graf.nyckeltal} />}
        {graf.volym
          ? <VolymGraf volym={graf.volym} detalj />
          : <TidsGraf {...graf.graf} från={från} till={till} färg={graf.färg} höjd={340} detalj enhet={graf.enhetKort} />}
        <Legend poster={graf.legend} />
        {graf.förklaring && <div style={{ fontSize: 11, color: "#64748b", marginTop: 12 }}>{graf.förklaring}</div>}
        {!graf.volym && <div style={{ fontSize: 11, color: "#475569", marginTop: 6 }}>Peka eller tryck på grafen för exakta värden.</div>}
      </div>
    </div>
  )
}

function byggGrafer(data) {
  const vp = data.vilopuls, hrv = data.hrv, sömn = data.somn, rd = data.readiness
  const vo2g = data.vo2max.garmin, vo2e = data.vo2max.egen
  const bel = data.belastning || [], senBel = bel[bel.length - 1]
  const ZON = { låg: "#60a5fa", optimal: "#6ee7b7", förhöjd: "#fbbf24", hög: "#ef4444" }
  const senVp = vp[vp.length - 1], senHrv = hrv[hrv.length - 1], senVo2 = vo2g[vo2g.length - 1], senEgen = vo2e[vo2e.length - 1]
  const heltal = v => (v == null ? "—" : Math.round(v))
  const enDec = v => (v == null ? "—" : v.toFixed(1))
  const timmar = v => (v == null ? "—" : formatMinuter(v))

  return [
    {
      nyckel: "vilopuls", ikon: Heart, titel: "Vilopuls", färg: "#f87171", enhetKort: "bpm",
      värde: senVp?.vilpuls_snitt != null ? Math.round(senVp.vilpuls_snitt) : null, enhet: "bpm (7 d snitt)",
      sub: delta(vp, "vilpuls_snitt", true),
      graf: { serier: [
        { namn: "Per dag", punkter: vp.map(p => ({ datum: p.datum, v: p.vilpuls })), färg: "#f87171", bredd: 1, opacitet: 0.3, hoverRadie: 0.5 },
        { namn: "7 dagars snitt", punkter: vp.map(p => ({ datum: p.datum, v: p.vilpuls_snitt })), färg: "#f87171", bredd: 2.5, hoverRadie: 0.5 },
      ], yFormat: heltal },
      nyckeltal: { punkter: vp.map(p => ({ datum: p.datum, v: p.vilpuls })), format: heltal, lägreÄrBättre: true, enhet: "bpm" },
      legend: [{ namn: "per dag", färg: "#f87171", opacitet: 0.3 }, { namn: "7 dagars snitt", färg: "#f87171" }],
      förklaring: "Lägre vilopuls över tid tyder oftast på bättre kondition. En plötslig höjning på 5+ slag kan betyda trötthet, stress eller begynnande sjukdom.",
    },
    {
      nyckel: "hrv", ikon: HeartPulse, titel: "HRV", färg: "#a78bfa", enhetKort: "ms",
      värde: senHrv?.hrv_7d != null ? Math.round(senHrv.hrv_7d) : null, enhet: "ms (7 d snitt)",
      sub: senHrv ? <>baslinje {Math.round(senHrv.hrv_baslinje_lag)}–{Math.round(senHrv.hrv_baslinje_hog)}<br />{delta(hrv, "hrv_7d")}</> : null,
      graf: {
        band: hrv.filter(p => p.hrv_baslinje_lag != null).map(p => ({ datum: p.datum, låg: p.hrv_baslinje_lag, hög: p.hrv_baslinje_hog })),
        serier: [
          { namn: "Natt", punkter: hrv.map(p => ({ datum: p.datum, v: p.hrv_natt })), färg: "#a78bfa", bredd: 1, opacitet: 0.35, hoverRadie: 0.5 },
          { namn: "7 dagars snitt", punkter: hrv.map(p => ({ datum: p.datum, v: p.hrv_7d })), färg: "#a78bfa", bredd: 2.5, hoverRadie: 0.5 },
          { namn: "Baslinje låg", punkter: hrv.map(p => ({ datum: p.datum, v: p.hrv_baslinje_lag })), färg: "#a78bfa", bredd: 0, opacitet: 0.25, hoverRadie: 0.5 },
          { namn: "Baslinje hög", punkter: hrv.map(p => ({ datum: p.datum, v: p.hrv_baslinje_hog })), färg: "#a78bfa", bredd: 0, opacitet: 0.25, hoverRadie: 0.5 },
        ], yFormat: heltal },
      nyckeltal: { punkter: hrv.map(p => ({ datum: p.datum, v: p.hrv_natt })), format: heltal, enhet: "ms" },
      legend: [{ namn: "per natt", färg: "#a78bfa", opacitet: 0.35 }, { namn: "7 dagars snitt", färg: "#a78bfa" }, { namn: "personlig baslinje", färg: "#a78bfa", opacitet: 0.25 }],
      förklaring: hrv.length ? "Titta på 7-dagarssnittet mot baslinjen, inte enskilda nätter. Snitt under baslinjen flera dagar i rad = kroppen är belastad." : "Kräver en Garmin-enhet med HRV-status.",
    },
    {
      nyckel: "vo2", ikon: TrendingUp, titel: "VO2max", färg: "#60a5fa", enhetKort: "",
      värde: senVo2?.vo2max ?? senEgen?.trend, enhet: "ml/kg/min",
      sub: <>{senEgen ? <>egen uppskattning {senEgen.trend}<br /></> : null}{delta(vo2g, "vo2max", false, 1)}</>,
      graf: { serier: [
        { namn: "Egen, pass", punkter: vo2e.map(p => ({ datum: p.datum, v: p.uppskattning })), färg: "#93c5fd", opacitet: 0.45, prickar: true, prickStorlek: 5, bredd: 0, hoverRadie: 1 },
        { namn: "Egen trend", punkter: vo2e.map(p => ({ datum: p.datum, v: p.trend })), färg: "#93c5fd", bredd: 1.5, streckad: true, maxLucka: 60, hoverRadie: 30 },
        { namn: "Garmin", punkter: vo2g.map(p => ({ datum: p.datum, v: p.vo2max })), färg: "#60a5fa", bredd: 2.5, prickar: vo2g.length < 40, prickStorlek: 6, maxLucka: 90, hoverRadie: 30 },
      ], yFormat: enDec },
      nyckeltal: { punkter: (vo2g.length ? vo2g.map(p => ({ datum: p.datum, v: p.vo2max })) : vo2e.map(p => ({ datum: p.datum, v: p.trend }))), format: enDec, enhet: "" },
      legend: [{ namn: "Garmin", färg: "#60a5fa" }, { namn: "egen trend", färg: "#93c5fd" }, { namn: "egen, per pass", färg: "#93c5fd", opacitet: 0.45, prick: true }],
      förklaring: "Egen uppskattning: puls mot tempo i platta löppass (ACSM + pulsreserv), ±3–5 per pass. Trendlinjen är medianen av de 5 senaste passen.",
    },
    {
      nyckel: "somn", ikon: Moon, titel: "Sömn", färg: "#c4b5fd", enhetKort: "",
      värde: medel(sömn.map(s => s.sovtid_min)) != null ? formatMinuter(medel(sömn.map(s => s.sovtid_min))) : null, enhet: "snitt/natt",
      sub: medel(sömn.map(s => s.somnpoang)) != null ? `sömnpoäng snitt ${Math.round(medel(sömn.map(s => s.somnpoang)))}` : null,
      graf: { serier: [
        { namn: "Natt", punkter: sömn.map(p => ({ datum: p.datum, v: p.sovtid_min })), färg: "#c4b5fd", bredd: 1, opacitet: 0.3, hoverRadie: 0.5 },
        { namn: "7 dagars snitt", punkter: sömn.map(p => ({ datum: p.datum, v: p.sovtid_min_snitt })), färg: "#c4b5fd", bredd: 2.5, hoverRadie: 0.5 },
        { namn: "Sömnpoäng", punkter: sömn.map(p => ({ datum: p.datum, v: p.somnpoang })), dold: true, färg: "#64748b", format: v => Math.round(v), enhet: "", hoverRadie: 0.5 },
      ], yFormat: v => `${(v / 60).toFixed(1)}h` },
      nyckeltal: { punkter: sömn.map(p => ({ datum: p.datum, v: p.sovtid_min })), format: timmar, enhet: "" },
      legend: [{ namn: "per natt", färg: "#c4b5fd", opacitet: 0.3 }, { namn: "7 dagars snitt", färg: "#c4b5fd" }],
    },
    {
      nyckel: "readiness", ikon: Gauge, titel: "Training Readiness", färg: "#6ee7b7", enhetKort: "",
      värde: rd.length ? Math.round(medel(rd.map(r => r.poang))) : null, enhet: "snitt i perioden",
      sub: delta(rd, "poang_snitt"),
      graf: { serier: [
        { namn: "Per dag", punkter: rd.map(p => ({ datum: p.datum, v: p.poang })), färg: "#6ee7b7", bredd: 1, opacitet: 0.3, hoverRadie: 0.5 },
        { namn: "7 dagars snitt", punkter: rd.map(p => ({ datum: p.datum, v: p.poang_snitt })), färg: "#6ee7b7", bredd: 2.5, hoverRadie: 0.5 },
      ], yFormat: heltal },
      nyckeltal: { punkter: rd.map(p => ({ datum: p.datum, v: p.poang })), format: heltal, enhet: "" },
      legend: [{ namn: "per dag", färg: "#6ee7b7", opacitet: 0.3 }, { namn: "7 dagars snitt", färg: "#6ee7b7" }],
      förklaring: rd.length ? "0–24 dålig · 25–49 låg · 50–74 måttlig · 75–94 hög · 95–100 topp" : "Kräver en Garmin-enhet med Training Readiness.",
    },
    {
      nyckel: "belastning", ikon: Flame, titel: "Träningsbelastning (TRIMP)", färg: "#fb923c", enhetKort: "",
      värde: senBel?.akut ?? null, enhet: "senaste 7 d",
      sub: senBel?.kronisk != null ? <>normalt {senBel.kronisk}/vecka<br />{delta(bel, "akut")}</> : null,
      graf: { serier: [
        { namn: "Per dag", punkter: bel.map(p => ({ datum: p.datum, v: p.trimp || null })), färg: "#fb923c", opacitet: 0.4, prickar: true, prickStorlek: 4, bredd: 0, hoverRadie: 0.5 },
        { namn: "Akut (7 d)", punkter: bel.map(p => ({ datum: p.datum, v: p.akut })), färg: "#fb923c", bredd: 2.5, maxLucka: 2, hoverRadie: 0.5 },
        { namn: "Kronisk (snitt/v)", punkter: bel.map(p => ({ datum: p.datum, v: p.kronisk })), färg: "#94a3b8", bredd: 2, streckad: true, maxLucka: 2, hoverRadie: 0.5 },
      ], yFormat: heltal },
      nyckeltal: { punkter: bel.map(p => ({ datum: p.datum, v: p.akut })), format: heltal, enhet: "" },
      legend: [{ namn: "akut (7 d)", färg: "#fb923c" }, { namn: "kronisk (snitt/vecka, 28 d)", färg: "#94a3b8" }, { namn: "pass", färg: "#fb923c", opacitet: 0.4, prick: true }],
      förklaring: "Edwards TRIMP: minuter i pulszon × zonnummer, så zon 5 väger 5 gånger zon 1. Mäter konditionsbelastning — styrkepass ger låga värden trots att de belastar musklerna.",
    },
    {
      nyckel: "acwr", ikon: Scale3d, titel: "Belastningskvot (ACWR)", färg: ZON[senBel?.zon] || "#64748b", enhetKort: "",
      värde: senBel?.acwr != null ? senBel.acwr.toFixed(2) : null, enhet: senBel?.zon || "",
      sub: <>optimalt 0,8–1,3<br />{delta(bel, "acwr", false, 2)}</>,
      graf: {
        band: bel.filter(p => p.acwr != null).map(p => ({ datum: p.datum, låg: 0.8, hög: 1.3 })),
        serier: [{ namn: "ACWR", punkter: bel.map(p => ({ datum: p.datum, v: p.acwr })), färg: ZON[senBel?.zon] || "#94a3b8", bredd: 2.5, maxLucka: 2, hoverRadie: 0.5 }],
        yFormat: v => v.toFixed(1) },
      nyckeltal: { punkter: bel.map(p => ({ datum: p.datum, v: p.acwr })), format: v => (v == null ? "—" : v.toFixed(2)), enhet: "" },
      legend: [{ namn: "ACWR = akut / kronisk", färg: ZON[senBel?.zon] || "#94a3b8" }, { namn: "optimal zon 0,8–1,3", färg: ZON[senBel?.zon] || "#94a3b8", opacitet: 0.25 }],
      förklaring: "Över 1,3 ökar skaderisken, över 1,5 tydligt (Gabbett 2016). Under 0,8 tränar du mindre än kroppen är van vid.",
    },
    {
      nyckel: "volym", ikon: BarChart3, titel: "Träningsvolym", färg: "#f97316", enhetKort: "",
      värde: medel(data.volym.map(v => v.totalt)) != null ? formatMinuter(medel(data.volym.map(v => v.totalt))) : null, enhet: "snitt/vecka",
      sub: `${data.volym.length} veckor`,
      volym: data.volym,
      nyckeltal: { punkter: data.volym.map(v => ({ datum: v.vecka, v: v.totalt })), format: timmar, enhet: "/vecka" },
      legend: [...new Set(data.volym.flatMap(v => Object.keys(v.per_kategori)))]
        .map(k => ({ namn: kategoriInfo(k === "oklassad" ? null : k).namn, färg: kategoriInfo(k === "oklassad" ? null : k).färg })),
      förklaring: "Peka eller tryck på en stapel för att se veckans fördelning per passtyp.",
    },
  ]
}

export default function Trender() {
  const [intervall, setIntervall] = useState(INTERVALL[3])
  const [data, setData] = useState(null)
  const [laddar, setLaddar] = useState(true)
  const [öppen, setÖppen] = useState(null)

  useEffect(() => {
    let aktiv = true
    fetchTrender(intervall.dagar).then(d => { if (aktiv) { setData(d); setLaddar(false) } })
    return () => { aktiv = false }
  }, [intervall])

  const till = lokaltDatum(new Date())
  const från = data?.från || till
  const långPeriod = (tid(till) - tid(från)) / DAG > 300
  const grafer = data ? byggGrafer(data) : []
  const öppenGraf = grafer.find(g => g.nyckel === öppen)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#f1f5f9" }}>Trender</div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
            {data ? `${datumText(från, långPeriod)} – ${datumText(till, långPeriod)}` : ""}{laddar ? " · laddar…" : " · klicka på en graf för detaljer"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, background: "#161b25", border: "1px solid #1e2736", borderRadius: 8, padding: 3 }}>
          {INTERVALL.map(iv => (
            <button key={iv.namn} onClick={() => { setLaddar(true); setIntervall(iv) }} style={{
              background: iv === intervall ? "#1e2736" : "transparent", color: iv === intervall ? "#f1f5f9" : "#64748b",
              border: "none", borderRadius: 6, padding: "5px 12px", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap",
            }}>{iv.namn}</button>
          ))}
        </div>
      </div>

      <div className="m-stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {grafer.map(g => (
          <Kort key={g.nyckel} ikon={g.ikon} titel={g.titel} färg={g.färg} värde={g.värde} enhet={g.enhet} sub={g.sub}
            onClick={() => setÖppen(g.nyckel)}>
            {g.volym
              ? <VolymGraf volym={g.volym} />
              : <TidsGraf {...g.graf} från={från} till={till} färg={g.färg} />}
            <Legend poster={g.legend} />
          </Kort>
        ))}
      </div>

      {öppenGraf && <Detaljvy graf={öppenGraf} från={från} till={till} onStäng={() => setÖppen(null)} />}
    </div>
  )
}
