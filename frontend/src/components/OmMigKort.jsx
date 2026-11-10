import { useEffect, useState } from "react"
import { User, Pencil, Check, Plus, Trash2, Shuffle } from "lucide-react"
import { fetchOmMig, sparaOmMig, läggTillRegel, taBortRegel } from "../api"

const C = { surface: "#161b25", border: "#232a38", bg: "#0f131b", text: "#f1f5f9", sub: "#94a3b8", muted: "#64748b", accent: "#a78bfa" }
const input = { background: C.bg, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, width: "100%", boxSizing: "border-box", fontFamily: "inherit" }
const etikett = { fontSize: 11, fontWeight: 600, color: C.sub, marginBottom: 6, display: "block" }
const ERFARENHET = [["nyborjare", "Nybörjare"], ["motionar", "Motionär"], ["van", "Van"], ["elit", "Elit"]]
const sekundär = { background: "none", border: `1px solid ${C.border}`, color: C.sub, borderRadius: 8, padding: "6px 8px", cursor: "pointer" }

function Chip({ på, onClick, children }) {
  return (
    <button type="button" onClick={onClick} style={{
      background: på ? C.accent + "22" : "transparent", color: på ? C.accent : C.sub, border: `1px solid ${på ? C.accent + "80" : C.border}`,
      borderRadius: 999, padding: "5px 12px", fontSize: 12, cursor: "pointer", fontWeight: på ? 600 : 400,
    }}>{children}</button>
  )
}

function Formulär({ start, utrustningVal, onSparat, onAvbryt }) {
  const [p, setP] = useState({ ...start })
  const [fel, setFel] = useState("")
  const sätt = (k, v) => setP(prev => ({ ...prev, [k]: v }))
  const växla = u => sätt("utrustning", p.utrustning.includes(u) ? p.utrustning.filter(x => x !== u) : [...p.utrustning, u])

  async function spara(e) {
    e.preventDefault()
    const r = await sparaOmMig(p)
    if (!r.ok) return setFel("Kunde inte spara — kontrollera fälten")
    onSparat()
  }
  const text = (k, rubrik, platshållare, rader = 2) => (
    <label><span style={etikett}>{rubrik}</span>
      <textarea style={{ ...input, minHeight: rader * 22, resize: "vertical" }} value={p[k] || ""} onChange={e => sätt(k, e.target.value)} placeholder={platshållare} />
    </label>
  )

  return (
    <form onSubmit={spara} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <span style={etikett}>Träningserfarenhet</span>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {ERFARENHET.map(([k, n]) => <Chip key={k} på={p.erfarenhet === k} onClick={() => sätt("erfarenhet", p.erfarenhet === k ? null : k)}>{n}</Chip>)}
        </div>
      </div>
      {text("sporter", "Sporter och bakgrund", "t.ex. Fotboll i division 4, springer på lågsäsong", 1)}
      <div>
        <span style={etikett}>Utrustning du har tillgång till</span>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {Object.entries(utrustningVal).map(([k, n]) => <Chip key={k} på={p.utrustning.includes(k)} onClick={() => växla(k)}>{n}</Chip>)}
        </div>
      </div>
      {text("skador", "Skador och historik", "t.ex. Opererat vänster knä 2022, känsliga hälsenor")}
      {text("preferenser", "Preferenser", "t.ex. Tränar helst morgon, ogillar intervaller på bana")}
      {text("fritext", "Övrigt coachen bör veta", "")}
      {fel && <div style={{ color: "#f87171", fontSize: 12 }}>{fel}</div>}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" onClick={onAvbryt} style={{ ...sekundär, padding: "8px 14px", fontSize: 13 }}>Avbryt</button>
        <button type="submit" style={{ background: C.accent, border: "none", color: "#0a0a0f", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
          <Check size={14} /> Spara
        </button>
      </div>
    </form>
  )
}

function Regler({ regler, kategorier, onÄndrat }) {
  const [ny, setNy] = useState(null)
  const [fel, setFel] = useState("")
  const val = Object.entries(kategorier)
  const liten = { ...input, width: "auto", padding: "5px 8px", fontSize: 12.5, display: "inline-block" }

  async function spara() {
    const maxKm = String(ny.max_km).trim() === "" ? null : Number(String(ny.max_km).replace(",", "."))
    const r = await läggTillRegel({ ...ny, plats: ny.plats.trim(), max_km: maxKm })
    if (!r.ok) return setFel(r.data?.detail && typeof r.data.detail === "string" ? r.data.detail : "Kontrollera fälten")
    setNy(null); setFel(""); onÄndrat()
  }

  return (
    <div style={{ marginTop: 18, borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Shuffle size={14} color={C.sub} />
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Egna klassningsregler</span>
      </div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>När klockan loggar fel typ av pass på en viss plats — t.ex. fotbollsträning som löpning.</div>
      {regler.map(r => (
        <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontSize: 13, color: C.sub, padding: "6px 0" }}>
          <span>Pass i <b style={{ color: C.text }}>{r.plats}</b> som Garmin kallar <b style={{ color: C.text }}>{kategorier[r.fran_kategori] || r.fran_kategori}</b>
            {r.max_km != null && <> och är kortare än <b style={{ color: C.text }}>{r.max_km} km</b></>} räknas som <b style={{ color: C.accent }}>{kategorier[r.till_kategori] || r.till_kategori}</b></span>
          <button title="Ta bort regel" style={sekundär} onClick={async () => { await taBortRegel(r.id); onÄndrat() }}><Trash2 size={13} /></button>
        </div>
      ))}
      {ny ? (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, fontSize: 13, color: C.sub, marginTop: 6 }}>
          Pass i <input style={{ ...liten, width: 110 }} value={ny.plats} onChange={e => setNy({ ...ny, plats: e.target.value })} placeholder="ort" />
          som Garmin kallar <select style={liten} value={ny.fran_kategori} onChange={e => setNy({ ...ny, fran_kategori: e.target.value })}>{val.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>
          och är kortare än <input style={{ ...liten, width: 56 }} inputMode="decimal" value={ny.max_km} onChange={e => setNy({ ...ny, max_km: e.target.value })} placeholder="valfri" /> km
          räknas som <select style={liten} value={ny.till_kategori} onChange={e => setNy({ ...ny, till_kategori: e.target.value })}>{val.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>
          <button onClick={spara} disabled={!ny.plats.trim()} style={{ background: C.accent, border: "none", color: "#0a0a0f", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12.5, fontWeight: 700, opacity: ny.plats.trim() ? 1 : 0.5 }}>Lägg till</button>
          <button onClick={() => { setNy(null); setFel("") }} style={{ ...sekundär, fontSize: 12.5, padding: "6px 10px" }}>Avbryt</button>
          {fel && <div style={{ color: "#f87171", fontSize: 12, width: "100%" }}>{fel}</div>}
        </div>
      ) : (
        <button onClick={() => setNy({ plats: "", fran_kategori: "running", max_km: "", till_kategori: "football" })}
          style={{ ...sekundär, display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, padding: "6px 10px", marginTop: 4 }}>
          <Plus size={13} /> Ny regel
        </button>
      )}
    </div>
  )
}

export default function OmMigKort() {
  const [data, setData] = useState(null)
  const [redigerar, setRedigerar] = useState(false)
  const ladda = () => fetchOmMig().then(setData)
  useEffect(() => { ladda() }, [])
  if (!data) return null

  const { profil, regler, utrustning_val: utrustningVal, kategorier } = data
  const erfNamn = Object.fromEntries(ERFARENHET)
  const rader = [
    profil.erfarenhet && ["Erfarenhet", erfNamn[profil.erfarenhet]],
    profil.sporter && ["Sporter", profil.sporter],
    profil.utrustning.length > 0 && ["Utrustning", profil.utrustning.map(u => utrustningVal[u] || u).join(", ")],
    profil.skador && ["Skador", profil.skador],
    profil.preferenser && ["Preferenser", profil.preferenser],
    profil.fritext && ["Övrigt", profil.fritext],
  ].filter(Boolean)

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "20px 22px", marginBottom: 28 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: redigerar || rader.length ? 14 : 0 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <User size={20} color={C.accent} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Om mig</div>
            {!rader.length && !redigerar && <div style={{ fontSize: 12.5, color: C.sub, marginTop: 2 }}>Skador, utrustning och preferenser — coachen anpassar passen efter det.</div>}
          </div>
        </div>
        {!redigerar && <button onClick={() => setRedigerar(true)} title="Redigera" style={sekundär}><Pencil size={14} /></button>}
      </div>
      {redigerar ? (
        <Formulär start={profil} utrustningVal={utrustningVal} onSparat={() => { setRedigerar(false); ladda() }} onAvbryt={() => setRedigerar(false)} />
      ) : rader.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: "6px 12px", fontSize: 13 }}>
          {rader.map(([k, v]) => [<span key={k + "k"} style={{ color: C.muted }}>{k}</span>, <span key={k + "v"} style={{ color: C.text, whiteSpace: "pre-wrap" }}>{v}</span>])}
        </div>
      )}
      <Regler regler={regler} kategorier={kategorier} onÄndrat={ladda} />
    </div>
  )
}
