import { Activity, Heart, Zap, TrendingUp } from "lucide-react"
import KPICard from "./KPICard"
import SenasteAktivitet from "./SenasteAktivitet"
import PRCard from "./PRCard"
import SleepChart from "./SleepChart"
import WeeklyLoad from "./WeeklyLoad"
import ActivityLog from "./ActivityLog"
import ReadinessCard from "./ReadinessCard"
import HRVCard from "./HRVCard"
import KroppSektion from "./KroppSektion"
import SomnDetalj from "./SomnDetalj"
import { useState } from "react"

const BELASTNINGSZON = {
  låg: { label: "låg", color: "#60a5fa" },
  optimal: { label: "optimal", color: "#6ee7b7" },
  förhöjd: { label: "förhöjd", color: "#fbbf24" },
  hög: { label: "hög", color: "#ef4444" },
}

export default function Dashboard({ profile, aiSummary, onOpenChat, onUppdatera }) {
  const [visaSömn, setVisaSömn] = useState(false)
  const hälsa = profile?.hälsodata || []
  const belastningNu = profile?.belastning?.[profile.belastning.length - 1]
  const hälsaMedData = hälsa.filter(d => d.body_battery_hogst)

  const bbSnitt = Math.round(
    hälsaMedData.reduce((a, b) => a + (b.body_battery_hogst || 0), 0) /
    (hälsaMedData.length || 1)
  )

  const vilopulsSnitt = Math.round(
    hälsa.filter(d => d.vilpuls).reduce((a, b) => a + b.vilpuls, 0) /
    (hälsa.filter(d => d.vilpuls).length || 1)
  )

  const vilopulsData = [...hälsa].reverse().map(d => d.vilpuls)
  const bbData = [...hälsa].reverse().map(d => d.body_battery_hogst)
  const stegData = [...hälsa].reverse().map(d => d.steg)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <ReadinessCard readiness={profile?.readiness} />
        <HRVCard hrv={profile?.hrv} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16 }}>
        <KPICard
          icon={Activity}
          label="Belastning (ACWR)"
          value={belastningNu?.acwr != null ? belastningNu.acwr.toFixed(2) : "—"}
          unit={BELASTNINGSZON[belastningNu?.zon]?.label}
          sub={belastningNu?.kronisk != null ? `7 d: ${belastningNu.akut} · normalt: ${belastningNu.kronisk}/v` : "Kräver 4 veckors historik"}
          color={BELASTNINGSZON[belastningNu?.zon]?.color || "#64748b"}
          sparkline={(profile?.belastning || []).map(d => d.akut)}
        />
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
          value={hälsaMedData[0]?.body_battery_hogst}
          unit="/ 100"
          sub={`Snitt 7 dagar: ${bbSnitt}`}
          color={hälsaMedData[0]?.body_battery_hogst > 60 ? "#6ee7b7" : "#fb923c"}
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

      <KroppSektion />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <SenasteAktivitet aktiviteter={profile?.aktiviteter} />
        <PRCard records={profile?.personliga_rekord || []} profile={profile} />
      </div>

      <SleepChart sömnVecka={profile?.sömn_vecka || []} onClick={() => setVisaSömn(true)} />
      {visaSömn && <SomnDetalj onStäng={() => setVisaSömn(false)} />}
      <WeeklyLoad aktiviteter={profile?.veckans_aktiviteter} veckansStart={profile?.veckans_start} />
      <ActivityLog aktiviteter={profile?.aktiviteter} onUppdatera={onUppdatera} />

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