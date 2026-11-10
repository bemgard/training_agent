import { Activity, Heart, Zap } from "lucide-react"
import KPICard from "./KPICard"
import SleepChart from "./SleepChart"
import VeckanKort from "./VeckanKort"
import ActivityLog from "./ActivityLog"
import ReadinessCard from "./ReadinessCard"
import HRVCard from "./HRVCard"
import KroppSektion from "./KroppSektion"
import SomnDetalj from "./SomnDetalj"
import DagsformKort from "./DagsformKort"
import InsiktKort from "./InsiktKort"
import { useState } from "react"

const BELASTNINGSZON = {
  låg: { label: "låg", color: "#60a5fa" },
  optimal: { label: "optimal", color: "#6ee7b7" },
  förhöjd: { label: "förhöjd", color: "#fbbf24" },
  hög: { label: "hög", color: "#ef4444" },
}

export default function Dashboard({ profile, onÖppnaPlan, onUppdatera }) {
  const [visaSömn, setVisaSömn] = useState(false)
  const [dagsformÄndrad, setDagsformÄndrad] = useState(false)
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

  const vilopulsIdag = hälsa.find(d => d.vilpuls)?.vilpuls

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Sektion titel="Idag" första>
        <InsiktKort dagsformÄndrad={dagsformÄndrad} />
        <DagsformKort onÄndrad={() => setDagsformÄndrad(true)} />
      </Sektion>

      <Sektion titel="Återhämtning">
        <div className="m-stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <ReadinessCard readiness={profile?.readiness} />
          <HRVCard hrv={profile?.hrv} />
        </div>
        <div className="m-stack" style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)", gap: 14 }}>
          <SleepChart sömnVecka={profile?.sömn_vecka || []} onClick={() => setVisaSömn(true)} />
          <div className="m-2" style={{ display: "grid", gridTemplateRows: "1fr 1fr", gap: 14 }}>
            <KPICard
              icon={Heart}
              label="Vilopuls"
              value={vilopulsIdag}
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
          </div>
        </div>
        {visaSömn && <SomnDetalj onStäng={() => setVisaSömn(false)} />}
      </Sektion>

      <Sektion titel="Träningen">
        <div className="m-stack" style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)", gap: 14 }}>
          <VeckanKort onÖppnaPlan={onÖppnaPlan} />
          <KPICard
            icon={Activity}
            label="Belastning (ACWR)"
            value={belastningNu?.acwr != null ? belastningNu.acwr.toFixed(2) : "—"}
            unit={BELASTNINGSZON[belastningNu?.zon]?.label}
            sub={belastningNu?.kronisk != null ? `Senaste 7 d: ${belastningNu.akut} · normalt ${belastningNu.kronisk}/vecka` : "Kräver 4 veckors historik"}
            color={BELASTNINGSZON[belastningNu?.zon]?.color || "#64748b"}
            sparkline={(profile?.belastning || []).map(d => d.akut)}
          />
        </div>
        <ActivityLog aktiviteter={profile?.aktiviteter} onUppdatera={onUppdatera} />
      </Sektion>

      <Sektion titel="Kropp">
        <KroppSektion />
      </Sektion>
    </div>
  )
}

function Sektion({ titel, första, children }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: första ? 0 : 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.12em", margin: 0 }}>{titel}</h2>
        <div style={{ flex: 1, height: 1, background: "#1e2736" }} />
      </div>
      {children}
    </section>
  )
}
