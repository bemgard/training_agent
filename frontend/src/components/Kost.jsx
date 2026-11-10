import { Salad, Camera, Flame, Sparkles } from "lucide-react"

// Kost är planerad men inte aktiverad än (se claude/fardplan-ai-coach.md → "Senare").
export const KOST_AKTIVERAD = false

const KOMMANDE = [
  { ikon: Camera, färg: "#6ee7b7", titel: "Logga med text eller foto", text: "Skriv \"havregrynsgröt med banan\" eller ta en bild — AI:n uppskattar kalorier och makron." },
  { ikon: Flame, färg: "#fb923c", titel: "Intag mot förbrukning", text: "Det du äter jämfört med vad Garmin mäter att du förbränner, dag för dag." },
  { ikon: Sparkles, färg: "#a78bfa", titel: "Coachen kopplar ihop", text: "Hur kosten påverkar sömn, återhämtning och dina pass — i samma samtal som träningen." },
]

export default function Kost() {
  return (
    <div style={{ maxWidth: 720, margin: "40px auto", textAlign: "center" }}>
      <div style={{
        width: 56, height: 56, borderRadius: 14, margin: "0 auto", background: "#6ee7b71a", border: "1px solid #6ee7b740",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Salad size={26} color="#6ee7b7" />
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color: "#f1f5f9", marginTop: 18 }}>Kost kommer snart</div>
      <div style={{ fontSize: 14, color: "#94a3b8", marginTop: 8, lineHeight: 1.6 }}>
        Vi bygger klart träning och återhämtning först. Sedan kopplar vi ihop det med vad du äter.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginTop: 36, textAlign: "left" }}>
        {KOMMANDE.map(k => (
          <div key={k.titel} style={{ background: "#161b25", border: "1px solid #1e2736", borderRadius: 10, padding: "16px 18px" }}>
            <k.ikon size={18} color={k.färg} />
            <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9", marginTop: 10 }}>{k.titel}</div>
            <div style={{ fontSize: 12.5, color: "#94a3b8", marginTop: 6, lineHeight: 1.5 }}>{k.text}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
