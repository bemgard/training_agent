import { useState, useEffect } from "react"
import { fetchPasses, deletePass } from "../api"

const colors = {
  bg: "#0a0a0f",
  card: "#1a1a26",
  cardGreen: "#1a3a2e",
  border: "#2a2a3a",
  borderGreen: "#6ee7b740",
  text: "#e2e8f0",
  muted: "#64748b",
  accent: "#6ee7b7",
}

function PassCard({ pass, onDelete }) {
  const [bekraftar, setBekraftar] = useState(false)

  async function handleDelete() {
    setBekraftar(true)
    await onDelete(pass.id)
  }

  return (
    <div style={{
      background: colors.card,
      border: `1px solid ${colors.border}`,
      borderRadius: 12,
      padding: "16px 20px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 16,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: colors.accent }}>
            {pass.datum}
          </span>
          <span style={{
            background: "#0f2a1e",
            border: `1px solid ${colors.borderGreen}`,
            color: colors.accent,
            borderRadius: 6,
            padding: "2px 8px",
            fontSize: 11,
            fontWeight: 500,
          }}>
            {pass.typ}
          </span>
          {pass.pulszon && (
            <span style={{ fontSize: 11, color: colors.muted }}>
              {pass.pulszon}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 20, fontSize: 13, color: colors.text, marginBottom: pass.syfte ? 6 : 0 }}>
          {pass.distans_km && (
            <span>{pass.distans_km} km</span>
          )}
          {pass.tempo && (
            <span>{pass.tempo}</span>
          )}
        </div>
        {pass.syfte && (
          <div style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>
            {pass.syfte}
          </div>
        )}
      </div>
      <button
        onClick={handleDelete}
        disabled={bekraftar}
        style={{
          background: "transparent",
          border: `1px solid ${colors.border}`,
          color: colors.muted,
          borderRadius: 8,
          padding: "6px 10px",
          cursor: bekraftar ? "not-allowed" : "pointer",
          fontSize: 13,
          flexShrink: 0,
        }}
      >
        ✕
      </button>
    </div>
  )
}

export default function TraningsPlan({ onChatWithGoal }) {
  const [passes, setPasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [goal, setGoal] = useState("")

  useEffect(() => {
    fetchPasses()
      .then(setPasses)
      .finally(() => setLoading(false))
  }, [])

  async function handleDelete(id) {
    await deletePass(id)
    setPasses(prev => prev.filter(p => p.id !== id))
  }

  function handleGoalSubmit(e) {
    e.preventDefault()
    if (!goal.trim()) return
    onChatWithGoal(`Hjälp mig bygga ett träningsprogram inför: ${goal.trim()}`)
    setGoal("")
  }

  const grouped = passes.reduce((acc, p) => {
    const month = p.datum?.slice(0, 7) ?? "Okänt"
    if (!acc[month]) acc[month] = []
    acc[month].push(p)
    return acc
  }, {})

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div style={{
        background: colors.cardGreen,
        border: `1px solid ${colors.borderGreen}`,
        borderRadius: 12,
        padding: "20px 24px",
        marginBottom: 32,
      }}>
        <div style={{ fontSize: 13, color: colors.accent, fontWeight: 600, marginBottom: 4 }}>
          Skapa ny träningsplan
        </div>
        <div style={{ fontSize: 12, color: colors.muted, marginBottom: 14 }}>
          Berätta vad du tränar inför så bygger coachen ett program åt dig.
        </div>
        <form onSubmit={handleGoalSubmit} style={{ display: "flex", gap: 10 }}>
          <input
            value={goal}
            onChange={e => setGoal(e.target.value)}
            placeholder="t.ex. halvmaraton om 3 månader, 5K under 25 min..."
            style={{
              flex: 1,
              background: "#0f2a1e",
              border: `1px solid ${colors.borderGreen}`,
              borderRadius: 8,
              padding: "10px 14px",
              color: colors.text,
              fontSize: 13,
              outline: "none",
            }}
          />
          <button
            type="submit"
            disabled={!goal.trim()}
            style={{
              background: goal.trim() ? colors.cardGreen : "transparent",
              border: `1px solid ${goal.trim() ? colors.accent + "80" : colors.border}`,
              color: goal.trim() ? colors.accent : colors.muted,
              borderRadius: 8,
              padding: "10px 18px",
              cursor: goal.trim() ? "pointer" : "not-allowed",
              fontSize: 13,
              fontWeight: 500,
              whiteSpace: "nowrap",
            }}
          >
            Fråga coachen →
          </button>
        </form>
      </div>

      {loading ? (
        <div style={{ color: colors.muted, textAlign: "center", marginTop: 40 }}>
          Laddar pass...
        </div>
      ) : passes.length === 0 ? (
        <div style={{ textAlign: "center", color: colors.muted, marginTop: 60 }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>📅</div>
          <div style={{ fontSize: 14 }}>Inga sparade pass ännu.</div>
          <div style={{ fontSize: 12, marginTop: 6 }}>
            Spara pass från AI-coachen eller skapa en plan ovan.
          </div>
        </div>
      ) : (
        Object.entries(grouped)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([month, monthPasses]) => (
            <div key={month} style={{ marginBottom: 28 }}>
              <div style={{
                fontSize: 11,
                fontWeight: 600,
                color: colors.muted,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 10,
              }}>
                {new Date(month + "-15").toLocaleDateString("sv-SE", { month: "long", year: "numeric" })}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {monthPasses.map(p => (
                  <PassCard key={p.id} pass={p} onDelete={handleDelete} />
                ))}
              </div>
            </div>
          ))
      )}
    </div>
  )
}
