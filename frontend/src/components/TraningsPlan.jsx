import { useState, useEffect } from "react"
import { ChevronLeft, ChevronRight, CalendarDays, Trash2, MessageCircle, Watch } from "lucide-react"
import { fetchVecka, flyttaPass, deletePass, skickaTillGarmin, taBortFrånGarmin, taBortPlan } from "../api"
import { lokaltDatum, kategoriInfo, formatMinuter } from "../aktivitetstyper"
import PlanPass from "./PlanPass"
import MalKort from "./MalKort"
import OmMigKort from "./OmMigKort"

const C = { surface: "#161b25", border: "#232a38", text: "#f1f5f9", sub: "#94a3b8", muted: "#64748b", accent: "#6ee7b7" }
const knapp = { background: "none", border: `1px solid ${C.border}`, color: C.sub, borderRadius: 8, padding: "5px 9px", cursor: "pointer", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5 }

function måndag(d) {
  const x = new Date(d)
  x.setHours(12, 0, 0, 0)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x
}

function GarminKnapp({ pass, idag, onÄndrat }) {
  const [läge, setLäge] = useState("")
  const [fel, setFel] = useState("")
  if (!pass.kan_skickas && !pass.garmin_workout_id) return null
  async function skicka() {
    setLäge("skickar"); setFel("")
    const r = await skickaTillGarmin([pass.id], idag)
    setLäge("")
    const res = r.data?.resultat?.[0]
    if (!r.ok || !res?.ok) return setFel(res?.fel || r.data?.detail || "Kunde inte skicka")
    onÄndrat()
  }
  return (
    <>
      {pass.kan_skickas && (
        <button style={{ ...knapp, color: "#93c5fd", border: "1px solid #93c5fd50" }} onClick={skicka} disabled={läge === "skickar"}>
          <Watch size={13} /> {läge === "skickar" ? "Skickar…" : pass.garmin_workout_id ? "Skicka igen" : "Skicka till Garmin"}
        </button>
      )}
      {pass.garmin_workout_id && (
        <button style={knapp} onClick={async () => { await taBortFrånGarmin(pass.id); onÄndrat() }}>Ta bort från Garmin</button>
      )}
      {fel && <span style={{ color: "#f87171", fontSize: 12 }}>{fel}</span>}
    </>
  )
}

function PassÅtgärder({ pass, idag, onÄndrat }) {
  const [datum, setDatum] = useState(pass.datum)
  const [fel, setFel] = useState("")
  if (pass.status === "genomford") return null
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
      <input type="date" value={datum} onChange={e => setDatum(e.target.value)}
        style={{ background: "#0f131b", color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: "4px 8px", fontSize: 12 }} />
      <button style={knapp} disabled={datum === pass.datum} onClick={async () => {
        const r = await flyttaPass(pass.id, datum, idag)
        if (!r.ok) return setFel("Kunde inte flytta passet")
        onÄndrat()
      }}><CalendarDays size={13} /> Flytta</button>
      <button style={knapp} onClick={async () => { await deletePass(pass.id); onÄndrat() }}><Trash2 size={13} /> Ta bort</button>
      <GarminKnapp pass={pass} idag={idag} onÄndrat={onÄndrat} />
      {fel && <span style={{ color: "#f87171", fontSize: 12 }}>{fel}</span>}
    </div>
  )
}

function Veckovy({ onChatWithGoal }) {
  const idag = lokaltDatum(new Date())
  const [start, setStart] = useState(() => måndag(new Date()))
  const [data, setData] = useState(null)
  const ladda = () => fetchVecka(lokaltDatum(start), idag).then(setData)
  useEffect(() => { ladda() }, [start])

  const flytta = veckor => { const d = new Date(start); d.setDate(d.getDate() + veckor * 7); setStart(d) }
  const slut = new Date(start); slut.setDate(slut.getDate() + 6)
  const fmt = d => d.toLocaleDateString("sv-SE", { day: "numeric", month: "short" })
  const ärDennaVecka = lokaltDatum(måndag(new Date())) === lokaltDatum(start)
  const s = data?.summering
  const harPass = s && s.planerade > 0
  const oskickade = (data?.dagar || []).flatMap(d => d.pass).filter(p => p.kan_skickas && !p.garmin_workout_id)
  const [skickar, setSkickar] = useState(false)
  const [garminInfo, setGarminInfo] = useState("")
  async function skickaVeckan() {
    setSkickar(true); setGarminInfo("")
    const r = await skickaTillGarmin(oskickade.map(p => p.id), idag)
    setSkickar(false)
    if (!r.ok) return setGarminInfo(r.data?.detail || "Kunde inte skicka till Garmin")
    const lyckade = r.data.resultat.filter(x => x.ok).length
    setGarminInfo(`${lyckade} av ${oskickade.length} pass ligger nu i Garmin-kalendern`)
    ladda()
  }

  return (
    <div className="m-kort" style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "18px 22px", marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <CalendarDays size={18} color={C.accent} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>
            {ärDennaVecka ? "Den här veckan" : `Vecka ${fmt(start)} – ${fmt(slut)}`}
          </div>
          {data?.plan && <div style={{ fontSize: 12.5, color: C.sub, marginTop: 2 }}>{data.plan.titel}{data.plan.sammanfattning ? ` — ${data.plan.sammanfattning}` : ""}</div>}
          {data?.plan && (
            <button style={{ ...knapp, marginTop: 8, color: "#f87171", border: "1px solid #f8717140" }} onClick={async () => {
              if (!confirm(`Ta bort planen "${data.plan.titel}" och alla dess pass? Pass som skickats till Garmin tas bort där också. Dina genomförda Garmin-aktiviteter påverkas inte.`)) return
              await taBortPlan(data.plan.id)
              ladda()
            }}><Trash2 size={13} /> Ta bort planen</button>
          )}
        </div>
        <button style={knapp} onClick={() => flytta(-1)} title="Föregående vecka"><ChevronLeft size={14} /></button>
        {!ärDennaVecka && <button style={knapp} onClick={() => setStart(måndag(new Date()))}>Idag</button>}
        <button style={knapp} onClick={() => flytta(1)} title="Nästa vecka"><ChevronRight size={14} /></button>
      </div>

      {harPass && (
        <div style={{ display: "flex", gap: "8px 18px", marginTop: 14, fontSize: 12.5, color: C.sub, flexWrap: "wrap", alignItems: "center" }}>
          <span><b style={{ color: C.accent, fontSize: 15 }}>{s.genomforda}</b> av {s.planerade} pass genomförda</span>
          {s.missade > 0 && <span style={{ color: "#f87171" }}>{s.missade} missade</span>}
          <span>Planerat {formatMinuter(s.planerad_min)} · tränat {formatMinuter(s.utford_min)}</span>
          <span style={{ flex: 1 }} />
          {oskickade.length > 0 && (
            <button style={{ ...knapp, color: "#93c5fd", border: "1px solid #93c5fd50" }} onClick={skickaVeckan} disabled={skickar}>
              <Watch size={13} /> {skickar ? "Skickar…" : `Skicka ${oskickade.length} pass till Garmin`}
            </button>
          )}
        </div>
      )}
      {garminInfo && <div style={{ fontSize: 12, color: "#93c5fd", marginTop: 6, textAlign: "right" }}>{garminInfo}</div>}

      {!data ? null : !harPass && data.dagar.every(d => d.ovriga.length === 0) ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16, padding: "14px 16px", background: "#0f131b", borderRadius: 10 }}>
          <div style={{ flex: 1, fontSize: 13, color: C.sub }}>Ingen plan för veckan. Be coachen om ett schema och spara det härifrån chatten.</div>
          <button onClick={() => onChatWithGoal("Gör en veckoplan för den här veckan utifrån mitt mål, min dagsform och belastning.")}
            style={{ ...knapp, color: C.accent, border: `1px solid ${C.accent}60` }}><MessageCircle size={13} /> Be om veckoplan</button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 14 }}>
          {data.dagar.map(d => {
            const dag = new Date(d.datum + "T12:00:00")
            const ärIdag = d.datum === idag
            return (
              <div key={d.datum} className="plan-dagrad" style={{ display: "grid", gridTemplateColumns: "76px minmax(0, 1fr)", gap: 12, padding: "8px 0", borderTop: `1px solid ${C.border}` }}>
                <div style={{ paddingTop: 8 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: ärIdag ? "#fbbf24" : C.text, textTransform: "capitalize" }}>{dag.toLocaleDateString("sv-SE", { weekday: "short" })}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{fmt(dag)}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {d.pass.length === 0 && d.ovriga.length === 0 && <div style={{ fontSize: 12, color: C.muted, paddingTop: 9 }}>Vila</div>}
                  {d.pass.map(p => <PlanPass key={p.id} pass={p} åtgärder={<PassÅtgärder pass={p} idag={idag} onÄndrat={ladda} />} />)}
                  {d.ovriga.map(a => {
                    const k = kategoriInfo(a.kategori)
                    return (
                      <div key={a.activity_id} style={{ fontSize: 12, color: C.sub, padding: "4px 2px" }}>
                        {k.ikon} Oplanerat: {a.namn || k.namn} · {formatMinuter(a.duration_min)}{a.distans_km >= 1 ? ` · ${a.distans_km} km` : ""}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function TraningsPlan({ onChatWithGoal }) {
  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <MalKort onChatWithGoal={onChatWithGoal} />
      <Veckovy onChatWithGoal={onChatWithGoal} />
      <OmMigKort />
    </div>
  )
}
