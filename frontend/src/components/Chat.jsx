import { useState, useRef, useEffect } from "react"
import { hämtaToken } from "../token"
import { Send } from "lucide-react"
import ReactMarkdown from "react-markdown"
import { streamChat } from "../api"

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

export default function Chat({ initialMessages = [], initialInput = "", onInitialInputConsumed }) {
  const [messages, setMessages] = useState(initialMessages)
  const [input, setInput] = useState(initialInput)
  const [streaming, setStreaming] = useState(false)
  const chatEndRef = useRef(null)

  useEffect(() => {
    if (initialInput) {
      setInput(initialInput)
      onInitialInputConsumed?.()
    }
  }, [initialInput])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  async function send() {
    if (!input.trim() || streaming) return

    const userMsg = { role: "user", content: input }
    setMessages(prev => [...prev, userMsg, { role: "assistant", content: "" }])
    setInput("")
    setStreaming(true)

    const history = messages.map(m => ({ role: m.role, content: m.content }))

    await streamChat(input, history, (full) => {
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: "assistant", content: full }
        return updated
      })
    })

    setStreaming(false)
  }

  return (
    <>
    <style>{RUNNER_CSS}</style>
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 180px)" }}>
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
    </>
  )
}