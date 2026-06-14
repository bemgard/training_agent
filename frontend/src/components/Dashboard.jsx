import { Activity, Heart, Zap, TrendingUp } from "lucide-react"
import KPICard from "./KPICard"
import BodyBatteryChart from "./BodyBatteryChart"
import PRCard from "./PRCard"
import WeeklyLoad from "./WeeklyLoad"
import ActivityLog from "./ActivityLog"

export default function Dashboard({ profile, aiSummary, onOpenChat }) {
  const hälsa = profile?.hälsodata || []
  const vilopulsSnitt = Math.round(
    hälsa.filter(d => d.vilpuls).reduce((a, b) => a + b.vilpuls, 0) /
    (hälsa.filter(d => d.vilpuls).length || 1)
  )

  const vilopulsData = [...hälsa].reverse().map(d => d.vilpuls)
  const bbData = [...hälsa].reverse().map(d => d.body_battery_hogst)
  const stegData = [...hälsa].reverse().map(d => d.steg)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        <KPICard
          icon={TrendingUp}
          label="VO2max"
          value={profile?.vo2max?.vo2max}
          unit="ml/kg/min"
          sub="Superior för din åldersgrupp"
          color="#6ee7b7"
        />
        <KPICard
          icon={Heart}
          label="Vilopuls"
          value={hälsa[1]?.vilpuls}
          unit="bpm"
          sub={`Snitt 7 dagar: ${vilopulsSnitt} bpm`}
          color="#60a5fa"
          sparkline={vilopulsData}
        />
        <KPICard
          icon={Zap}
          label="Body Battery"
          value={hälsa[0]?.body_battery_hogst}
          unit="/ 100"
          sub="Idag"
          color={hälsa[0]?.body_battery_hogst > 60 ? "#6ee7b7" : "#fb923c"}
          sparkline={bbData}
        />
        <KPICard
          icon={Activity}
          label="Steg igår"
          value={hälsa[1]?.steg?.toLocaleString()}
          unit="steg"
          sub="Igår"
          color="#fb923c"
          sparkline={stegData}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <BodyBatteryChart data={hälsa} />
        <PRCard records={profile?.personliga_rekord || []} />
      </div>

      <WeeklyLoad aktiviteter={profile?.aktiviteter} />
      <ActivityLog aktiviteter={profile?.aktiviteter} />

      {aiSummary && (
        <div style={{
          background: "#1a1a26",
          border: "1px solid #2a2a3a",
          borderRadius: 12,
          padding: "20px 24px",
        }}>
          <div style={{
            color: "#64748b",
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: 12,
            display: "flex",
            alignItems: "center",
            gap: 8
          }}>
            <Activity size={14} color="#6ee7b7" /> AI-Coach · Träningsstatus
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.7, color: "#e2e8f0", whiteSpace: "pre-wrap" }}>
            {aiSummary}
          </div>
          <button onClick={onOpenChat} style={{
            marginTop: 16,
            background: "#1a3a2e",
            border: "1px solid #6ee7b740",
            color: "#6ee7b7",
            padding: "8px 16px",
            borderRadius: 8,
            cursor: "pointer",
            fontSize: 13,
          }}>
            Chatta med coachen →
          </button>
        </div>
      )}
    </div>
  )
}