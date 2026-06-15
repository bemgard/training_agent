import { useState } from "react"
import { syncGarmin } from "../api"

const colors = {
  border: "#2a2a3a",
  muted: "#64748b",
  accent: "#6ee7b7",
  accentDim: "#1a3a2e",
  text: "#e2e8f0",
}

export default function Header({ activeTab, setActiveTab, profile }) {
  const [synkar, setSynkar] = useState(false)
  const [syncStatus, setSyncStatus] = useState(null)

  const senastSync = profile?.hälsodata?.[0]?.datum
  const syncText = senastSync
    ? new Date(senastSync + "T12:00:00").toLocaleDateString("sv-SE", { weekday: "short", day: "numeric", month: "short" })
    : null

  const tabs = [
    { id: "dashboard", label: "Översikt" },
    { id: "chat", label: "AI-Coach" },
    { id: "log", label: "Träningslogg" },
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
            God morgon 👋
          </div>
          {syncText && (
            <div style={{ fontSize: 11, color: colors.muted, display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{
                width: 6, height: 6, borderRadius: "50%", background: colors.accent,
                display: "inline-block", flexShrink: 0,
              }} />
              Synkad {syncText}
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
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}