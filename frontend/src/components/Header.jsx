const colors = {
  border: "#2a2a3a",
  muted: "#64748b",
  accent: "#6ee7b7",
  accentDim: "#1a3a2e",
  text: "#e2e8f0",
}

export default function Header({ activeTab, setActiveTab }) {
  const tabs = [
    { id: "dashboard", label: "Översikt" },
    { id: "chat", label: "AI-Coach" },
    { id: "log", label: "Träningslogg" },
  ]

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
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em" }}>
          God morgon 👋
        </div>
      </div>
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
  )
}