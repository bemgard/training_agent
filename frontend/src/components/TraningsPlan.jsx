import { useState, useEffect } from "react"
import { fetchPasses, deletePass } from "../api"
import MalKort from "./MalKort"

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

  useEffect(() => {
    fetchPasses()
      .then(setPasses)
      .finally(() => setLoading(false))
  }, [])

  async function handleDelete(id) {
    await deletePass(id)
    setPasses(prev => prev.filter(p => p.id !== id))
  }

  const grouped = passes.reduce((acc, p) => {
    const month = p.datum?.slice(0, 7) ?? "Okänt"
    if (!acc[month]) acc[month] = []
    acc[month].push(p)
    return acc
  }, {})

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <MalKort onChatWithGoal={onChatWithGoal} />

      {loading ? (
        <div style={{ color: colors.muted, textAlign: "center", marginTop: 40 }}>
          Laddar pass...
        </div>
      ) : passes.length === 0 ? (
        <div style={{ textAlign: "center", color: colors.muted, marginTop: 60 }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>📅</div>
          <div style={{ fontSize: 14 }}>Inga sparade pass ännu.</div>
          <div style={{ fontSize: 12, marginTop: 6 }}>
            Spara pass från AI-coachen eller be den om en plan utifrån ditt mål ovan.
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
