import { useState } from "react"
import { Mail, Lock, Eye, EyeOff, Watch, UserRound, Gauge, Flame, MessageCircle, ShieldCheck, AlertTriangle } from "lucide-react"
import { loginUser, registerUser } from "../api"
import { sparaToken } from "../token"

const F = {
  bg: "#0a0a0f", panel: "#12121a", surface: "#161b25", border: "#232a38",
  text: "#f1f5f9", sub: "#94a3b8", muted: "#64748b",
  accent: "#6ee7b7", garmin: "#11a9ed", fel: "#f87171", varning: "#fbbf24",
}

function Fält({ etikett, ikon: Ikon, typ = "text", värde, setVärde, platshållare, autoComplete, hjälp, accent = F.accent }) {
  const [visa, setVisa] = useState(false)
  const [fokus, setFokus] = useState(false)
  const lösenord = typ === "password"
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: F.sub, marginBottom: 6 }}>{etikett}</div>
      <div style={{
        display: "flex", alignItems: "center", gap: 10, background: F.bg, borderRadius: 10, padding: "0 12px",
        border: `1px solid ${fokus ? accent : F.border}`, boxShadow: fokus ? `0 0 0 3px ${accent}22` : "none", transition: "all 0.15s",
      }}>
        <Ikon size={16} color={fokus ? accent : F.muted} />
        <input type={lösenord && !visa ? "password" : lösenord ? "text" : typ} value={värde}
          onChange={e => setVärde(e.target.value)} placeholder={platshållare} autoComplete={autoComplete}
          onFocus={() => setFokus(true)} onBlur={() => setFokus(false)}
          style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: F.text, fontSize: 14, padding: "12px 0" }} />
        {lösenord && (
          <button type="button" onClick={() => setVisa(v => !v)} title={visa ? "Dölj lösenord" : "Visa lösenord"}
            style={{ background: "none", border: "none", color: F.muted, cursor: "pointer", padding: 0, display: "flex" }}>
            {visa ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
      {hjälp && <div style={{ fontSize: 11, color: F.muted, marginTop: 5 }}>{hjälp}</div>}
    </label>
  )
}

function Kryssruta({ markerad, setMarkerad, children }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: F.sub, userSelect: "none" }}>
      <input type="checkbox" checked={markerad} onChange={e => setMarkerad(e.target.checked)}
        style={{ width: 16, height: 16, accentColor: F.accent, cursor: "pointer" }} />
      {children}
    </label>
  )
}

function Sektion({ nummer, titel, ikon: Ikon, färg, beskrivning, children }) {
  return (
    <div style={{ border: `1px solid ${färg}40`, background: `${färg}0a`, borderRadius: 14, padding: "18px 18px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <span style={{
          width: 24, height: 24, borderRadius: "50%", background: färg, color: F.bg, fontSize: 13, fontWeight: 800,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>{nummer}</span>
        <Ikon size={16} color={färg} />
        <span style={{ fontSize: 15, fontWeight: 700, color: F.text }}>{titel}</span>
      </div>
      <div style={{ fontSize: 12.5, color: F.sub, lineHeight: 1.5, marginBottom: 14 }}>{beskrivning}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{children}</div>
    </div>
  )
}

function Presentation() {
  const punkter = [
    { ikon: Gauge, färg: "#6ee7b7", titel: "Dagens form", text: "Training readiness, HRV och sömn mot din egen baslinje" },
    { ikon: Flame, färg: "#fb923c", titel: "All träning räknas", text: "Belastning för löpning, fotboll och styrka på samma skala" },
    { ikon: MessageCircle, färg: "#a78bfa", titel: "AI-coach", text: "Svar och passförslag utifrån din egen data — inte mallar" },
  ]
  return (
    <div className="login-presentation" style={{
      flex: 1, padding: "56px 56px", display: "flex", flexDirection: "column", justifyContent: "space-between",
      background: "radial-gradient(ellipse at 20% 0%, #1a3a2e 0%, transparent 55%), radial-gradient(ellipse at 100% 100%, #1e1b3a 0%, transparent 50%), #0d0d14",
      borderRight: `1px solid ${F.border}`,
    }}>
      <div>
        <div style={{ fontSize: 12, color: F.accent, textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: 600 }}>Training Agent</div>
        <div style={{ fontSize: 34, fontWeight: 800, color: F.text, lineHeight: 1.15, marginTop: 18, maxWidth: 420, letterSpacing: "-0.02em" }}>
          Din coach som faktiskt läser din Garmin-data
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22, marginTop: 44 }}>
          {punkter.map(p => (
            <div key={p.titel} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: p.färg + "1a", border: `1px solid ${p.färg}40`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <p.ikon size={18} color={p.färg} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: F.text }}>{p.titel}</div>
                <div style={{ fontSize: 13, color: F.sub, marginTop: 2, lineHeight: 1.45 }}>{p.text}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: F.muted }}>
        <ShieldCheck size={14} /> Garmin-uppgifterna krypteras och används bara för att hämta din data.
      </div>
    </div>
  )
}

export default function Login({ onLogin }) {
  const [läge, setLäge] = useState("login")
  const [email, setEmail] = useState("")
  const [lösenord, setLösenord] = useState("")
  const [kommaIhåg, setKommaIhåg] = useState(true)
  const [garminEmail, setGarminEmail] = useState("")
  const [sammaEmail, setSammaEmail] = useState(true)
  const [garminLösenord, setGarminLösenord] = useState("")
  const [fel, setFel] = useState("")
  const [laddar, setLaddar] = useState(false)
  const reg = läge === "register"
  const effektivGarminEmail = sammaEmail ? email : garminEmail

  function byt(nytt) {
    setLäge(nytt)
    setFel("")
  }

  async function skicka(e) {
    e.preventDefault()
    if (!email || !lösenord) return setFel("Fyll i e-post och lösenord")
    if (reg && lösenord.length < 8) return setFel("Välj ett lösenord på minst 8 tecken för appen")
    if (reg && (!effektivGarminEmail || !garminLösenord)) return setFel("Fyll i dina Garmin Connect-uppgifter i steg 2")
    setFel("")
    setLaddar(true)
    try {
      const r = reg
        ? await registerUser(email, lösenord, effektivGarminEmail, garminLösenord)
        : await loginUser(email, lösenord, kommaIhåg)
      if (!r.ok) {
        setFel(r.data.detail || "Något gick fel")
      } else {
        sparaToken(r.data.token, r.data.email, reg ? true : kommaIhåg)
        onLogin(r.data.token)
      }
    } catch {
      setFel("Kunde inte nå servern — försök igen om en stund")
    } finally {
      setLaddar(false)
    }
  }

  const sammaLösenord = reg && lösenord && garminLösenord && lösenord === garminLösenord

  return (
    <div style={{ minHeight: "100vh", background: F.bg, display: "flex", fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" }}>
      <style>{`@media (max-width: 900px) { .login-presentation { display: none !important; } }`}</style>
      <Presentation />

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px", overflowY: "auto" }}>
        <form onSubmit={skicka} style={{ width: "100%", maxWidth: reg ? 460 : 380 }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: F.text, letterSpacing: "-0.02em" }}>
            {reg ? "Skapa konto" : "Välkommen tillbaka"}
          </div>
          <div style={{ fontSize: 14, color: F.sub, marginTop: 6, marginBottom: 28 }}>
            {reg ? "Två steg: ett konto för appen, och kopplingen till Garmin." : "Logga in med ditt Training Agent-konto."}
          </div>

          {!reg && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Fält etikett="E-post" ikon={Mail} typ="email" värde={email} setVärde={setEmail} platshållare="namn@exempel.se" autoComplete="email" />
              <Fält etikett="Lösenord" ikon={Lock} typ="password" värde={lösenord} setVärde={setLösenord} autoComplete="current-password" />
              <Kryssruta markerad={kommaIhåg} setMarkerad={setKommaIhåg}>
                Kom ihåg mig <span style={{ color: F.muted }}>· håll mig inloggad i 30 dagar</span>
              </Kryssruta>
            </div>
          )}

          {reg && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Sektion nummer="1" titel="Ditt Training Agent-konto" ikon={UserRound} färg={F.accent}
                beskrivning={<>Ett <b style={{ color: F.text }}>nytt konto bara för den här appen</b>. Det är det du loggar in med här. Välj ett eget lösenord — inte ditt Garmin-lösenord.</>}>
                <Fält etikett="E-post" ikon={Mail} typ="email" värde={email} setVärde={setEmail} platshållare="namn@exempel.se" autoComplete="email" />
                <Fält etikett="Välj ett lösenord för appen" ikon={Lock} typ="password" värde={lösenord} setVärde={setLösenord}
                  autoComplete="new-password" hjälp={lösenord && lösenord.length < 8 ? `Minst 8 tecken (${lösenord.length}/8)` : "Minst 8 tecken"} />
              </Sektion>

              <Sektion nummer="2" titel="Koppla Garmin Connect" ikon={Watch} färg={F.garmin}
                beskrivning={<>Samma uppgifter som du loggar in med i <b style={{ color: F.text }}>Garmin Connect-appen</b>. De krypteras och används bara för att hämta din träningsdata — aldrig för något annat.</>}>
                <Kryssruta markerad={sammaEmail} setMarkerad={setSammaEmail}>Samma e-post som i steg 1</Kryssruta>
                {!sammaEmail && (
                  <Fält etikett="E-post på Garmin Connect" ikon={Mail} typ="email" värde={garminEmail} setVärde={setGarminEmail}
                    autoComplete="off" accent={F.garmin} />
                )}
                <Fält etikett="Lösenord på Garmin Connect" ikon={Lock} typ="password" värde={garminLösenord} setVärde={setGarminLösenord}
                  autoComplete="off" accent={F.garmin} hjälp="Tvåstegsverifiering i Garmin stöds inte ännu." />
              </Sektion>

              {sammaLösenord && (
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: F.varning, background: "#3a2e1233", border: `1px solid ${F.varning}40`, borderRadius: 10, padding: "10px 12px" }}>
                  <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                  Du har valt samma lösenord för appen som för Garmin. Det fungerar, men ett eget lösenord för appen är säkrare.
                </div>
              )}
            </div>
          )}

          {fel && (
            <div style={{ marginTop: 16, fontSize: 13, color: F.fel, background: "#3a121233", border: `1px solid ${F.fel}40`, borderRadius: 10, padding: "10px 12px" }}>
              {fel}
            </div>
          )}

          <button type="submit" disabled={laddar} style={{
            marginTop: 22, width: "100%", padding: "13px 0", borderRadius: 10, border: "none", cursor: laddar ? "default" : "pointer",
            background: laddar ? "#2a5a48" : F.accent, color: "#062a1e", fontSize: 15, fontWeight: 700, transition: "background 0.15s",
          }}>
            {laddar ? (reg ? "Skapar konto…" : "Loggar in…") : reg ? "Skapa konto och koppla Garmin" : "Logga in"}
          </button>

          <div style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: F.muted }}>
            {reg ? "Har du redan ett konto? " : "Inget konto än? "}
            <button type="button" onClick={() => byt(reg ? "login" : "register")}
              style={{ background: "none", border: "none", color: F.accent, cursor: "pointer", fontSize: 13, fontWeight: 600, padding: 0 }}>
              {reg ? "Logga in" : "Skapa konto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
