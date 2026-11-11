import { useState, useRef, useEffect } from "react"
import { Send, Plus, Trash2, Menu, X } from "lucide-react"
import ReactMarkdown from "react-markdown"
import { streamChat, skapaSamtal, fetchSamtalLista, fetchSamtal, taBortSamtal, sparaPlan } from "../api"
import { lokaltDatum } from "../aktivitetstyper"
import PlanPass from "./PlanPass"
import Tummar from "./Tummar"


const RUNNER_CSS = `
@keyframes runner-bounce {
  0%   { transform: translateX(0px); }
  50%  { transform: translateX(10px); }
  100% { transform: translateX(0px); }
}
`

function RunnerLoading() {
  return (
    <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 16 }}>
      <div style={{
        background: "#1a1a26",
        border: "1px solid #2a2a3a",
        borderRadius: "16px 16px 16px 4px",
        padding: "12px 20px",
        fontSize: 22,
      }}>
        <span style={{ display: "inline-block", animation: "runner-bounce 0.7s ease-in-out infinite" }}>
          🏃
        </span>
      </div>
    </div>
  )
}

function extractPlan(content) {
  const match = content.match(/\[PLAN\]([\s\S]*?)\[\/PLAN\]/)
  if (!match) return null
  try {
    const plan = JSON.parse(match[1])
    return Array.isArray(plan.pass) && plan.pass.length ? plan : null
  } catch {
    return null
  }
}

function PlanFörhandsvisning({ plan, samtalId }) {
  const [läge, setLäge] = useState("ny")  // ny | sparar | sparad | fel
  const [info, setInfo] = useState("")
  const pass = [...plan.pass].sort((a, b) => a.datum.localeCompare(b.datum))

  async function spara() {
    setLäge("sparar")
    const r = await sparaPlan(plan, lokaltDatum(new Date()), samtalId)
    if (!r.ok) {
      setLäge("fel")
      setInfo(typeof r.data?.detail === "string" ? r.data.detail : "Planen följde inte formatet — be coachen göra om den.")
      return
    }
    setLäge("sparad")
    setInfo(r.data.ersatta ? `${r.data.ersatta} tidigare planerade pass ersattes.` : "")
  }

  return (
    <div style={{ marginTop: 12, borderTop: "1px solid #2a2a3a", paddingTop: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {plan.titel} · {pass.length} pass
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {pass.map((p, i) => (
          <div key={i}>
            <div style={{ fontSize: 11, color: "#64748b", margin: "2px 0 3px", textTransform: "capitalize" }}>
              {new Date(p.datum + "T12:00:00").toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "short" })}
            </div>
            <PlanPass pass={p} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
        <button onClick={spara} disabled={läge === "sparar" || läge === "sparad"} style={{
          background: läge === "sparad" ? "#12121a" : "#1a3a2e", border: `1px solid ${läge === "sparad" ? "#2a2a3a" : "#6ee7b760"}`,
          color: läge === "sparad" ? "#64748b" : "#6ee7b7", padding: "7px 14px", borderRadius: 8,
          cursor: läge === "sparad" ? "default" : "pointer", fontSize: 12.5, fontWeight: 600,
        }}>
          {läge === "sparad" ? "✓ Sparad i Träningsplan" : läge === "sparar" ? "Sparar…" : pass.length > 1 ? "📅 Spara veckoplan" : `📅 Spara pass — ${pass[0].datum}`}
        </button>
        {info && <span style={{ fontSize: 12, color: läge === "fel" ? "#f87171" : "#64748b" }}>{info}</span>}
      </div>
    </div>
  )
}

function ChatMessage({ role, content, samtalId, strömmar, index }) {
  const plan = role === "assistant" && !strömmar ? extractPlan(content) : null
  // Dölj blocket (även ett halvfärdigt under strömning) och det gamla [PASS]-formatet i äldre samtal
  const visningsText = content.replace(/\[PLAN\][\s\S]*?(\[\/PLAN\]|$)/, "").replace(/\[PASS\][\s\S]*?\[\/PASS\]/, "").trim()

  return (
    <div style={{
      display: "flex",
      justifyContent: role === "user" ? "flex-end" : "flex-start",
      marginBottom: 16,
    }}>
      <div className="message-bubble" style={{
        maxWidth: plan ? "90%" : "75%",
        width: plan ? "90%" : undefined,
        background: role === "user" ? "#1a3a2e" : "#1a1a26",
        border: `1px solid ${role === "user" ? "#6ee7b740" : "#2a2a3a"}`,
        borderRadius: role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
        padding: "12px 16px",
        fontSize: 14,
        color: "#e2e8f0",
        lineHeight: 1.6,
      }}>
        <ReactMarkdown>{visningsText}</ReactMarkdown>
        {plan && <PlanFörhandsvisning plan={plan} samtalId={samtalId} />}
        {role === "assistant" && !strömmar && samtalId && visningsText && <Tummar kalla="chatt" refId={`${samtalId}:${index}`} utdrag={visningsText} />}
      </div>
    </div>
  )
}

function relativtDatum(iso) {
  const d = new Date(iso.replace(" ", "T") + (/[Z+]/.test(iso.slice(10)) ? "" : "Z"))
  const dagar = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 864e5)
  if (dagar === 0) return d.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })
  if (dagar === 1) return "Igår"
  if (dagar < 7) return d.toLocaleDateString("sv-SE", { weekday: "long" })
  return d.toLocaleDateString("sv-SE", { day: "numeric", month: "short" })
}

function SamtalsLista({ lista, aktivt, onVälj, onNytt, onTaBort, öppen, onStäng }) {
  return (
    <div className={`chat-lista${öppen ? " oppen" : ""}`} style={{ width: 230, flexShrink: 0, display: "flex", flexDirection: "column", gap: 8, borderRight: "1px solid #2a2a3a", paddingRight: 16, overflowY: "auto" }}>
      <button className="d-dolj flex" onClick={onStäng} style={{ alignSelf: "flex-end", background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: 4 }}><X size={20} /></button>
      <button onClick={onNytt} style={{
        background: "#1a3a2e", border: "1px solid #6ee7b760", color: "#6ee7b7", borderRadius: 10, padding: "9px 12px",
        cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8,
      }}><Plus size={15} /> Nytt samtal</button>
      {lista.length === 0 && <div style={{ fontSize: 12, color: "#64748b", padding: "8px 4px" }}>Dina samtal sparas här.</div>}
      {lista.map(s => (
        <div key={s.id} onClick={() => onVälj(s.id)} style={{
          background: s.id === aktivt ? "#1a1a26" : "transparent", border: `1px solid ${s.id === aktivt ? "#2a2a3a" : "transparent"}`,
          borderRadius: 10, padding: "8px 10px", cursor: "pointer", display: "flex", gap: 6, alignItems: "flex-start",
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.titel}</div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{relativtDatum(s.uppdaterad)} · {s.antal} meddelanden</div>
          </div>
          <button title="Ta bort samtal" onClick={e => { e.stopPropagation(); onTaBort(s.id) }}
            style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: 2 }}><Trash2 size={13} /></button>
        </div>
      ))}
    </div>
  )
}

export default function Chat({ initialInput = "", onInitialInputConsumed }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState(initialInput)
  const [streaming, setStreaming] = useState(false)
  const [samtalId, setSamtalId] = useState(null)
  const [lista, setLista] = useState([])
  const [menyÖppen, setMenyÖppen] = useState(false)
  const chatEndRef = useRef(null)

  const laddaLista = () => fetchSamtalLista().then(setLista)
  useEffect(() => {
    laddaLista()
    // Öppna samtalet du hade uppe senast i den här fliken (överlever flikbyte i appen)
    let senaste = null
    try { senaste = Number(sessionStorage.getItem("aktivtSamtal")) || null } catch { /* privat läge */ }
    if (senaste && !initialInput) väljSamtal(senaste)
  }, [])

  useEffect(() => {
    try {
      if (samtalId) sessionStorage.setItem("aktivtSamtal", String(samtalId))
      else sessionStorage.removeItem("aktivtSamtal")
    } catch { /* privat läge */ }
  }, [samtalId])

  useEffect(() => {
    if (initialInput) {
      setInput(initialInput)
      setSamtalId(null)
      setMessages([])
      onInitialInputConsumed?.()
    }
  }, [initialInput])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  async function väljSamtal(id) {
    if (streaming) return
    const s = await fetchSamtal(id)
    if (!s) return laddaLista()
    setSamtalId(id)
    setMessages(s.meddelanden)
  }

  function nyttSamtal() {
    if (streaming) return
    setSamtalId(null)
    setMessages([])
  }

  async function taBort(id) {
    if (!confirm("Ta bort samtalet?")) return
    await taBortSamtal(id)
    if (id === samtalId) nyttSamtal()
    laddaLista()
  }

  async function send() {
    const text = input.trim()
    if (!text || streaming) return

    setMessages(prev => [...prev, { role: "user", content: text }, { role: "assistant", content: "" }])
    setInput("")
    setStreaming(true)

    let id = samtalId
    if (!id) {
      id = await skapaSamtal()
      setSamtalId(id)
    }

    await streamChat(text, id, (full) => {
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: "assistant", content: full }
        return updated
      })
    })

    setStreaming(false)
    laddaLista()
  }

  return (
    <>
    <style>{RUNNER_CSS}</style>
    <div className="chat-ram" style={{ display: "flex", gap: 20, height: "calc(100vh - 180px)" }}>
    <SamtalsLista lista={lista} aktivt={samtalId} öppen={menyÖppen} onStäng={() => setMenyÖppen(false)}
      onVälj={id => { setMenyÖppen(false); väljSamtal(id) }} onNytt={() => { setMenyÖppen(false); nyttSamtal() }} onTaBort={taBort} />
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
      <div className="d-dolj flex" style={{ alignItems: "center", gap: 10, paddingBottom: 10, borderBottom: "1px solid #2a2a3a", marginBottom: 10 }}>
        <button onClick={() => setMenyÖppen(true)} style={{ background: "none", border: "1px solid #2a2a3a", color: "#94a3b8", borderRadius: 8, padding: "6px 10px", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <Menu size={16} /> Samtal
        </button>
        <span style={{ flex: 1, fontSize: 13, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {lista.find(x => x.id === samtalId)?.titel || "Nytt samtal"}
        </span>
        {samtalId && <button onClick={nyttSamtal} style={{ background: "none", border: "none", color: "#6ee7b7", display: "flex", alignItems: "center" }} title="Nytt samtal"><Plus size={20} /></button>}
      </div>
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 16 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", color: "#64748b", marginTop: 80 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🏃</div>
            <div style={{ fontSize: 16 }}>Ställ en fråga till din träningscoach</div>
          </div>
        )}
        {messages.map((m, i) => {
          if (streaming && i === messages.length - 1 && m.role === "assistant" && m.content === "")
            return <RunnerLoading key={i} />
          return <ChatMessage key={i} {...m} index={i} samtalId={samtalId} strömmar={streaming && i === messages.length - 1} />
        })}
        <div ref={chatEndRef} />
      </div>
      <div style={{ display: "flex", gap: 12, paddingTop: 16, borderTop: "1px solid #2a2a3a" }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
          placeholder="Fråga din coach..."
          style={{
            flex: 1,
            background: "#1a1a26",
            border: "1px solid #2a2a3a",
            borderRadius: 12,
            padding: "12px 16px",
            color: "#e2e8f0",
            fontSize: 14,
            outline: "none",
          }}
        />
        <button onClick={send} disabled={streaming || !input.trim()} style={{
          background: streaming ? "#334155" : "#1a3a2e",
          border: `1px solid ${streaming ? "#2a2a3a" : "#6ee7b760"}`,
          color: streaming ? "#64748b" : "#6ee7b7",
          padding: "12px 20px",
          borderRadius: 12,
          cursor: streaming ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 14,
        }}>
          <Send size={16} />
        </button>
      </div>
    </div>
    </div>
    </>
  )
}