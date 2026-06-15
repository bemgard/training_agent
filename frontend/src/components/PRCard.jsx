import { TrendingUp, Zap } from "lucide-react"
import { useState } from "react"
import { streamChat } from "../api"

const labels = {
  "Best 1km Run": "1 km",
  "Best Half Marathon": "Halvmaraton",
  "Best Full Marathon": "Maraton",
  "Farthest Run": "Längsta"
}

export default function PRCard({ records, profile }) {
  const [förslag, setFörslag] = useState("")
  const [laddar, setLaddar] = useState(false)

  async function hämtaFörslag() {
    setFörslag("")
    setLaddar(true)
    const idag = new Date().toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    const prompt = `Idag är ${idag}. Rekommendera ett träningspass för idag baserat på min nuvarande återhämtningsstatus och träningshistorik. Var konkret: ange passtyp, distans, tempo och pulszon. Max 4 meningar.`
    await streamChat(prompt, [], (full) => setFörslag(full))
    setLaddar(false)
}

  return (
    <div style={{
      background: "#1a1a26",
      border: "1px solid #2a2a3a",
      borderRadius: 12,
      padding: "20px 24px",
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 24,
    }}>
      {/* Vänster — Personliga rekord */}
      <div>
        <div style={{
          color: "#64748b",
          fontSize: 12,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          gap: 8
        }}>
          <TrendingUp size={14} color="#6ee7b7" /> Personliga rekord
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {records.map(r => (
            <div key={r.typ}>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>
                {labels[r.typ] || r.typ}
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#e2e8f0", letterSpacing: "-0.02em" }}>
                {r.formaterat}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Höger — Nästa pass */}
      <div style={{ borderLeft: "1px solid #2a2a3a", paddingLeft: 24 }}>
        <div style={{
          color: "#64748b",
          fontSize: 12,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          gap: 8
        }}>
          <Zap size={14} color="#f97316" /> Nästa pass
        </div>

        {!förslag && !laddar && (
          <button onClick={hämtaFörslag} style={{
            background: "#1a2a1a",
            border: "1px solid #f9731640",
            color: "#f97316",
            padding: "10px 16px",
            borderRadius: 8,
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 500,
            width: "100%",
            textAlign: "left",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}>
            <Zap size={14} /> Föreslå dagens pass
          </button>
        )}

        {laddar && !förslag && (
          <div style={{ color: "#475569", fontSize: 13 }}>Analyserar din status...</div>
        )}

        {förslag && (
          <div>
            <div style={{ fontSize: 13, color: "#e2e8f0", lineHeight: 1.7 }}>
              {förslag}
            </div>
            <button onClick={hämtaFörslag} style={{
              marginTop: 12,
              background: "transparent",
              border: "none",
              color: "#475569",
              fontSize: 11,
              cursor: "pointer",
              padding: 0,
            }}>
              Föreslå nytt →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}