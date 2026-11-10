import { useState } from "react"
import { syncGarmin } from "../api"

const colors = {
  border: "#2a2a3a",
  muted: "#64748b",
  accent: "#6ee7b7",
  accentDim: "#1a3a2e",
  text: "#e2e8f0",
}

export default function Header({ activeTab, setActiveTab, profile, onLogout }) {
  const [synkar, setSynkar] = useState(false)
  const [syncStatus, setSyncStatus] = useState(null)

  // Senaste synk från sync_log (faktisk tidpunkt + om den lyckades), inte senaste datadatum
  const senaste = profile?.senaste_synk
  let syncText = null
  if (senaste?.slut) {
    const t = new Date(senaste.slut)
    const idag = new Date().toDateString() === t.toDateString()
    const dag = idag ? "idag" : t.toLocaleDateString("sv-SE", { weekday: "short", day: "numeric", month: "short" })
    const kl = t.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })
    syncText = `${senaste.ok ? "Synkad" : "Synk misslyckades"} ${dag} ${kl}${senaste.kalla === "schema" ? " (auto)" : ""}`
  }
  const syncOk = senaste?.ok !== false
  const timme = new Date().getHours()
  const hälsning = timme < 10 ? "God morgon" : timme < 17 ? "Hej" : "God kväll"

  const tabs = [
    { id: "dashboard", label: "Översikt" },
    { id: "trender", label: "Trender" },
    { id: "chat", label: "AI-Coach" },
    { id: "plan", label: "Träningsplan" },
    { id: "kost", label: "Kost", snart: true },
  ]

  async function triggerSync() {
    setSynkar(true)
    setSyncStatus(null)
    try {
      const data = await syncGarmin()
      if (data.ok) {
        setSyncStatus("ok")
        setTimeout(() => window.location.reload(), 1500)
      } else {
        setSyncStatus("fel")
        console.error(data.error)
      }
    } catch {
      setSyncStatus("fel")
    } finally {
      setSynkar(false)
    }
  }

  return (
    <div style={{
      borderBottom: `1px solid ${colors.border}`,
      padding: "16px 32px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between"
    }}>
      <div>
        <div style={{ fontSize: 11, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.1em" }}>
          Training Agent
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em" }}>
            {hälsning} 👋
          </div>
          {syncText && (
            <div style={{ fontSize: 11, color: colors.muted, display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{
                width: 6, height: 6, borderRadius: "50%", background: syncOk ? colors.accent : "#f87171",
                display: "inline-block", flexShrink: 0,
              }} />
              <span style={{ color: syncOk ? undefined : "#f87171" }}>{syncText}</span>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={triggerSync} disabled={synkar} style={{
          background: "transparent",
          border: `1px solid ${colors.border}`,
          color: synkar ? colors.muted : syncStatus === "ok" ? colors.accent : syncStatus === "fel" ? "#f87171" : colors.muted,
          padding: "8px 14px",
          borderRadius: 8,
          cursor: synkar ? "not-allowed" : "pointer",
          fontSize: 12,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}>
          <span style={{ display: "inline-block", animation: synkar ? "spin 1s linear infinite" : "none" }}>↻</span>
          {synkar ? "Synkar..." : syncStatus === "ok" ? "Klar!" : syncStatus === "fel" ? "Misslyckades" : "Synka"}
        </button>

        <button onClick={onLogout} style={{
          background: "transparent",
          border: `1px solid ${colors.border}`,
          color: colors.muted,
          padding: "8px 14px",
          borderRadius: 8,
          cursor: "pointer",
          fontSize: 12,
        }}>
          Logga ut
        </button>

        <div style={{ display: "flex", gap: 8 }}>
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              background: activeTab === tab.id ? colors.accentDim : "transparent",
              border: `1px solid ${activeTab === tab.id ? colors.accent + "60" : colors.border}`,
              color: activeTab === tab.id ? colors.accent : colors.muted,
              padding: "8px 16px",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 500,
            }}>
              {tab.label}
              {tab.snart && (
                <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
                  color: "#fbbf24", background: "#fbbf241a", border: "1px solid #fbbf2440", borderRadius: 999, padding: "1px 6px" }}>
                  Snart
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}