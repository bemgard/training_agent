import { useEffect, useState } from "react"
import { Target, Pencil, Flag, Dumbbell, Trophy, Heart, Check, X, MessageCircle } from "lucide-react"
import { fetchMal, sparaMal, avslutaMal } from "../api"

const TYPER = {
  grundtraning: { namn: "Grundträning", ikon: Dumbbell, färg: "#6ee7b7", text: "Bygga bas och volym utan ett specifikt lopp" },
  lopp: { namn: "Lopp", ikon: Flag, färg: "#fb923c", text: "Ett lopp med datum och gärna en måltid" },
  forsasong: { namn: "Försäsong", ikon: Trophy, färg: "#60a5fa", text: "Bli redo inför en idrottssäsong" },
  halsa: { namn: "Hälsa", ikon: Heart, färg: "#f472b6", text: "Röra dig regelbundet och må bra" },
}
const FOKUS = [["kondition", "Kondition"], ["styrka", "Styrka"], ["rorlighet", "Rörlighet"], ["snabbhet", "Snabbhet"]]
const DAGAR = [["man", "Mån"], ["tis", "Tis"], ["ons", "Ons"], ["tor", "Tor"], ["fre", "Fre"], ["lor", "Lör"], ["son", "Sön"]]

const C = { surface: "#161b25", border: "#232a38", bg: "#0f131b", text: "#f1f5f9", sub: "#94a3b8", muted: "#64748b" }
const input = { background: C.bg, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, width: "100%", boxSizing: "border-box" }
const etikett = { fontSize: 11, fontWeight: 600, color: C.sub, marginBottom: 6, display: "block" }

function Chip({ på, onClick, children, färg = "#6ee7b7" }) {
  return (
    <button type="button" onClick={onClick} style={{
      background: på ? färg + "22" : "transparent", color: på ? färg : C.sub, border: `1px solid ${på ? färg + "80" : C.border}`,
      borderRadius: 999, padding: "5px 12px", fontSize: 12, cursor: "pointer", fontWeight: på ? 600 : 400,
    }}>{children}</button>
  )
}

function Räknare({ värde, setVärde, etikettText }) {
  const v = värde ?? 0
  const knapp = { width: 28, height: 28, borderRadius: 6, border: `1px solid ${C.border}`, background: C.bg, color: C.text, cursor: "pointer", fontSize: 15 }
  return (
    <div>
      <span style={etikett}>{etikettText}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button type="button" style={knapp} onClick={() => setVärde(Math.max(0, v - 1))}>−</button>
        <span style={{ fontSize: 18, fontWeight: 700, color: C.text, minWidth: 18, textAlign: "center" }}>{v}</span>
        <button type="button" style={knapp} onClick={() => setVärde(Math.min(14, v + 1))}>+</button>
        <span style={{ fontSize: 12, color: C.muted }}>per vecka</span>
      </div>
    </div>
  )
}

const TOMT = { typ: "grundtraning", titel: "", slutdatum: "", distans_km: "", maltid: "", sport: "", fokus: [],
  kondition_per_vecka: 3, styrka_per_vecka: 2, traningsdagar: [], anteckning: "" }

function Formulär({ start, onSparat, onAvbryt }) {
  const [m, setM] = useState({ ...TOMT, ...start, slutdatum: start?.slutdatum || "", distans_km: start?.distans_km ?? "" })
  const [fel, setFel] = useState("")
  const sätt = (k, v) => setM(prev => ({ ...prev, [k]: v }))
  const växla = (k, v) => sätt(k, m[k].includes(v) ? m[k].filter(x => x !== v) : [...m[k], v])
  const typ = TYPER[m.typ]

  async function spara(e) {
    e.preventDefault()
    const titel = m.titel.trim() || typ.namn
    const data = {
      ...m, titel, slutdatum: m.slutdatum || null, distans_km: m.distans_km === "" ? null : Number(String(m.distans_km).replace(",", ".")),
      maltid: m.maltid || null, sport: m.sport || null, anteckning: m.anteckning || null,
    }
    delete data.id; delete data.aktiv; delete data.skapad; delete data.user_id
    const r = await sparaMal(data, start?.id)
    if (!r.ok) return setFel("Kunde inte spara — kontrollera fälten")
    onSparat()
  }

  return (
    <form onSubmit={spara} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <span style={etikett}>Vad tränar du för?</span>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          {Object.entries(TYPER).map(([k, t]) => (
            <button key={k} type="button" onClick={() => sätt("typ", k)} style={{
              textAlign: "left", background: m.typ === k ? t.färg + "14" : C.bg, border: `1px solid ${m.typ === k ? t.färg + "90" : C.border}`,
              borderRadius: 10, padding: "10px 12px", cursor: "pointer",
            }}>
              <t.ikon size={16} color={t.färg} />
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginTop: 6 }}>{t.namn}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2, lineHeight: 1.35 }}>{t.text}</div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
        <label><span style={etikett}>Beskriv målet</span>
          <input style={input} value={m.titel} onChange={e => sätt("titel", e.target.value)}
            placeholder={{ grundtraning: "t.ex. Bygga volym efter fotbollssäsongen", lopp: "t.ex. Stockholm halvmaraton",
              forsasong: "t.ex. Redo för fotbollsträningarna", halsa: "t.ex. Träna 3 gånger i veckan" }[m.typ]} />
        </label>
        <label><span style={etikett}>{{ lopp: "Loppdatum", forsasong: "Säsongen börjar" }[m.typ] || "Fram till (valfritt)"}</span>
          <input style={input} type="date" value={m.slutdatum} onChange={e => sätt("slutdatum", e.target.value)} />
        </label>
      </div>

      {m.typ === "lopp" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label><span style={etikett}>Distans (km)</span>
            <input style={input} inputMode="decimal" value={m.distans_km} onChange={e => sätt("distans_km", e.target.value)} placeholder="21.1" /></label>
          <label><span style={etikett}>Måltid (valfritt)</span>
            <input style={input} value={m.maltid} onChange={e => sätt("maltid", e.target.value)} placeholder="1:45:00" /></label>
        </div>
      )}
      {m.typ === "forsasong" && (
        <label><span style={etikett}>Sport</span>
          <input style={input} value={m.sport} onChange={e => sätt("sport", e.target.value)} placeholder="t.ex. fotboll" /></label>
      )}

      <div>
        <span style={etikett}>Fokus</span>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {FOKUS.map(([k, n]) => <Chip key={k} på={m.fokus.includes(k)} onClick={() => växla("fokus", k)} färg={typ.färg}>{n}</Chip>)}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Räknare etikettText="Konditionspass" värde={m.kondition_per_vecka} setVärde={v => sätt("kondition_per_vecka", v)} />
        <Räknare etikettText="Styrkepass" värde={m.styrka_per_vecka} setVärde={v => sätt("styrka_per_vecka", v)} />
      </div>

      <div>
        <span style={etikett}>Vilka dagar kan du träna?</span>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {DAGAR.map(([k, n]) => <Chip key={k} på={m.traningsdagar.includes(k)} onClick={() => växla("traningsdagar", k)} färg={typ.färg}>{n}</Chip>)}
        </div>
      </div>

      <label><span style={etikett}>Något coachen bör veta? (valfritt)</span>
        <textarea style={{ ...input, minHeight: 60, resize: "vertical", fontFamily: "inherit" }} value={m.anteckning}
          onChange={e => sätt("anteckning", e.target.value)} placeholder="t.ex. Gymmet har bara hantlar, fotboll på söndagar ibland…" />
      </label>

      {fel && <div style={{ color: "#f87171", fontSize: 12 }}>{fel}</div>}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        {onAvbryt && <button type="button" onClick={onAvbryt} style={{ background: "none", border: `1px solid ${C.border}`, color: C.sub, borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 13 }}>Avbryt</button>}
        <button type="submit" style={{ background: typ.färg, border: "none", color: "#0a0a0f", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
          <Check size={14} /> Spara mål
        </button>
      </div>
    </form>
  )
}

function Visning({ mål, onÄndra, onAvsluta, onBeOmPlan }) {
  const t = TYPER[mål.typ] || TYPER.grundtraning
  const kvar = mål.slutdatum ? Math.ceil((new Date(mål.slutdatum + "T12:00:00") - new Date()) / 864e5) : null
  const dagNamn = Object.fromEntries(DAGAR)
  const fokusNamn = Object.fromEntries(FOKUS)
  const rader = [
    mål.distans_km && ["Distans", `${mål.distans_km} km${mål.maltid ? ` · måltid ${mål.maltid}` : ""}`],
    mål.sport && ["Sport", mål.sport],
    mål.fokus.length > 0 && ["Fokus", mål.fokus.map(f => fokusNamn[f]).join(", ")],
    (mål.kondition_per_vecka != null || mål.styrka_per_vecka != null) && ["Per vecka", `${mål.kondition_per_vecka ?? 0} kondition + ${mål.styrka_per_vecka ?? 0} styrka`],
    mål.traningsdagar.length > 0 && ["Dagar", mål.traningsdagar.map(d => dagNamn[d]).join(" · ")],
  ].filter(Boolean)
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: t.färg + "1a", border: `1px solid ${t.färg}40`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <t.ikon size={20} color={t.färg} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: t.färg, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>{t.namn}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginTop: 2 }}>{mål.titel}</div>
            {kvar != null && (
              <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>
                {kvar >= 0 ? `${kvar} dagar kvar (≈ ${Math.round(kvar / 7)} veckor)` : "Datumet har passerat"} · {new Date(mål.slutdatum + "T12:00:00").toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric" })}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <button onClick={onÄndra} title="Ändra mål" style={{ background: "none", border: `1px solid ${C.border}`, color: C.sub, borderRadius: 8, padding: "6px 8px", cursor: "pointer" }}><Pencil size={14} /></button>
          <button onClick={onAvsluta} title="Avsluta mål" style={{ background: "none", border: `1px solid ${C.border}`, color: C.sub, borderRadius: 8, padding: "6px 8px", cursor: "pointer" }}><X size={14} /></button>
        </div>
      </div>
      {rader.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: "6px 12px", marginTop: 16, fontSize: 13 }}>
          {rader.map(([k, v]) => [<span key={k + "k"} style={{ color: C.muted }}>{k}</span>, <span key={k + "v"} style={{ color: C.text }}>{v}</span>])}
        </div>
      )}
      {mål.anteckning && <div style={{ fontSize: 12.5, color: C.sub, marginTop: 12, fontStyle: "italic" }}>"{mål.anteckning}"</div>}
      <button onClick={onBeOmPlan} style={{
        marginTop: 18, background: t.färg + "1a", border: `1px solid ${t.färg}60`, color: t.färg, borderRadius: 8, padding: "9px 14px",
        cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8,
      }}>
        <MessageCircle size={14} /> Be coachen om en plan för de kommande två veckorna
      </button>
    </div>
  )
}

export default function MalKort({ onChatWithGoal }) {
  const [data, setData] = useState(null)
  const [redigerar, setRedigerar] = useState(false)
  const ladda = () => fetchMal().then(setData)
  useEffect(() => { ladda() }, [])

  if (!data) return null
  const mål = data.aktivt
  const färg = TYPER[mål?.typ]?.färg || "#6ee7b7"

  return (
    <div style={{ background: C.surface, border: `1px solid ${färg}40`, borderRadius: 12, padding: "20px 22px", marginBottom: 28 }}>
      {!mål && !redigerar ? (
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <Target size={22} color="#6ee7b7" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Lägg in ditt mål</div>
            <div style={{ fontSize: 12.5, color: C.sub, marginTop: 2 }}>Coachen planerar efter det — lopp, grundträning, försäsong eller hälsa.</div>
          </div>
          <button onClick={() => setRedigerar(true)} style={{ background: "#6ee7b7", border: "none", color: "#0a0a0f", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>Lägg in mål</button>
        </div>
      ) : redigerar ? (
        <Formulär start={mål} onSparat={() => { setRedigerar(false); ladda() }} onAvbryt={() => setRedigerar(false)} />
      ) : (
        <Visning mål={mål} onÄndra={() => setRedigerar(true)}
          onAvsluta={async () => { if (confirm("Avsluta målet? Det sparas i historiken.")) { await avslutaMal(mål.id); ladda() } }}
          onBeOmPlan={() => onChatWithGoal("Gör en träningsplan för de kommande två veckorna utifrån mitt mål, min nuvarande form och belastning.")} />
      )}
    </div>
  )
}
