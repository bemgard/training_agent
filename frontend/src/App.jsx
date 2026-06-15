import { useState, useEffect } from "react"
import { fetchProfile, streamChat } from "./api"
import Header from "./components/Header"
import Dashboard from "./components/Dashboard"
import Chat from "./components/Chat"

export default function App() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [aiSummary, setAiSummary] = useState("")
  const [activeTab, setActiveTab] = useState("dashboard")

  useEffect(() => {
  fetchProfile()
    .then(data => {
      setProfile(data)
      setLoading(false)
    })
    .catch(() => setLoading(false))
}, [])

  if (loading) return (
    <div style={{
      background: "#0a0a0f",
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#64748b",
      fontFamily: "system-ui"
    }}>
      Laddar träningsdata...
    </div>
  )

  return (
    <div style={{
      background: "#0a0a0f",
      minHeight: "100vh",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
      color: "#e2e8f0"
    }}>
      <Header activeTab={activeTab} setActiveTab={setActiveTab} profile={profile} />
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px" }}>
        {activeTab === "dashboard" && (
          <Dashboard
            profile={profile}
            aiSummary={aiSummary}
            onOpenChat={() => setActiveTab("chat")}
          />
        )}
        {activeTab === "chat" && <Chat />}
        {activeTab === "log" && (
          <div style={{ color: "#64748b", textAlign: "center", marginTop: 80 }}>
            Träningslogg kommer snart
          </div>
        )}
      </div>
    </div>
  )
}