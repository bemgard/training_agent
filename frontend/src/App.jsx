import { useState, useEffect } from "react"
import { fetchProfile } from "./api"
import { hämtaToken, rensaToken } from "./token"
import Header from "./components/Header"
import Dashboard from "./components/Dashboard"
import Chat from "./components/Chat"
import Login from "./components/Login"
import TraningsPlan from "./components/TraningsPlan"
import Trender from "./components/Trender"

export default function App() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("dashboard")
  const [chatInitialInput, setChatInitialInput] = useState("")
  const [token, setToken] = useState(hämtaToken())

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }
    fetchProfile()
      .then(data => {
        if (data?.detail) {  // utgånget/ogiltigt token → tillbaka till inloggning
          rensaToken()
          setToken(null)
        } else {
          setProfile(data)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [token])

  function uppdateraProfil() {
    return fetchProfile().then(setProfile)
  }

  function onLogin(token) {
    setToken(token)
  }

  function onLogout() {
    rensaToken()
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
          <Dashboard profile={profile} onOpenChat={() => setActiveTab("chat")} onUppdatera={uppdateraProfil} />
        )}
        {activeTab === "trender" && <Trender />}
        {activeTab === "chat" && (
          <Chat
            initialInput={chatInitialInput}
            onInitialInputConsumed={() => setChatInitialInput("")}
          />
        )}
        {activeTab === "plan" && (
          <TraningsPlan onChatWithGoal={(msg) => {
            setChatInitialInput(msg)
            setActiveTab("chat")
          }} />
        )}
      </div>
    </div>
  )
}