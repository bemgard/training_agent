import { useState, useEffect } from "react"
import { fetchProfile, streamChat } from "./api"
import Header from "./components/Header"
import Dashboard from "./components/Dashboard"
import Chat from "./components/Chat"
import Login from "./components/Login"

export default function App() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("dashboard")
  const [token, setToken] = useState(localStorage.getItem("token"))

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }
    fetchProfile()
      .then(data => {
        setProfile(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [token])

  function onLogin(token) {
    setToken(token)
  }

  function onLogout() {
    localStorage.removeItem("token")
    localStorage.removeItem("email")
    setToken(null)
    setProfile(null)
  }

  if (!token) return <Login onLogin={onLogin} />

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
      <Header activeTab={activeTab} setActiveTab={setActiveTab} profile={profile} onLogout={onLogout} />
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px" }}>
        {activeTab === "dashboard" && (
          <Dashboard profile={profile} onOpenChat={() => setActiveTab("chat")} />
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