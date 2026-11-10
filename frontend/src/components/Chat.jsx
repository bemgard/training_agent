import { useState, useRef, useEffect } from "react"
import { hämtaToken } from "../token"
import { Send, Plus, Trash2 } from "lucide-react"
import ReactMarkdown from "react-markdown"
import { streamChat, skapaSamtal, fetchSamtalLista, fetchSamtal, taBortSamtal } from "../api"

const API = import.meta.env.VITE_API_URL || "http://localhost:8000/api"

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

function extractPass(content) {
  const match = content.match(/\[PASS\](.*?)\[\/PASS\]/s)
  if (!match) return null
  try {
    return JSON.parse(match[1])
  } catch {
    return null
  }
}

function ChatMessage({ role, content }) {
  const [sparat, setSparat] = useState(false)
  const pass = role === "assistant" ? extractPass(content) : null
  const visningsText = content.replace(/\[PASS\].*?\[\/PASS\]/s, "").trim()

  async function sparaPass() {
    const token = hämtaToken()
    try {
      await fetch(`${API}/save-pass`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(pass)
      })
      setSparat(true)
    } catch {
      // tyst fel, knappen förblir klickbar
    }
  }

  return (
    <div style={{
      display: "flex",
      justifyContent: role === "user" ? "flex-end" : "flex-start",
      marginBottom: 16,
    }}>
      <div className="message-bubble" style={{
        maxWidth: "75%",
        background: role === "user" ? "#1a3a2e" : "#1a1a26",
        border: `1px solid ${role === "user" ? "#6ee7b740" : "#2a2a3a"}`,
        borderRadius: role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
        padding: "12px 16px",
        fontSize: 14,
        color: "#e2e8f0",
        lineHeight: 1.6,
      }}>
        <ReactMarkdown>{visningsText}</ReactMarkdown>
        {pass && (
          <button onClick={sparaPass} disabled={sparat} style={{
            marginTop: 10,
            background: sparat ? "#12121a" : "#1a3a2e",
            border: `1px solid ${sparat ? "#2a2a3a" : "#6ee7b760"}`,
            color: sparat ? "#64748b" : "#6ee7b7",
            padding: "6px 12px",
            borderRadius: 8,
            cursor: sparat ? "default" : "pointer",
            fontSize: 12,
          }}>
            {sparat ? "✓ Sparat" : `📅 Spara pass — ${pass.datum}`}
          </button>
        )}
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

function SamtalsLista({ lista, aktivt, onVälj, onNytt, onTaBort }) {
  return (
    <div style={{ width: 230, flexShrink: 0, display: "flex", flexDirection: "column", gap: 8, borderRight: "1px solid #2a2a3a", paddingRight: 16, overflowY: "auto" }}>
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
    <div style={{ display: "flex", gap: 20, height: "calc(100vh - 180px)" }}>
    <SamtalsLista lista={lista} aktivt={samtalId} onVälj={väljSamtal} onNytt={nyttSamtal} onTaBort={taBort} />
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
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
          return <ChatMessage key={i} {...m} />
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