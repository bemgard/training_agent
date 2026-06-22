import { useState } from "react"
import { loginUser, registerUser } from "../api"

const colors = {
    bg: "#0a0a0f",
    surface: "#1a1a26",
    border: "#2a2a3a",
    muted: "#64748b",
    accent: "#6ee7b7",
    accentDim: "#1a3a2e",
    text: "#e2e8f0",
    error: "#f87171",
}

export default function Login({ onLogin }) {
    const [mode, setMode] = useState("login")
    const [email, setEmail] = useState("")
    const [lösenord, setLösenord] = useState("")
    const [garminEmail, setGarminEmail] = useState("")
    const [garminPassword, setGarminPassword] = useState("")
    const [fel, setFel] = useState("")
    const [laddar, setLaddar] = useState(false)

    async function submit() {
        if (!email || !lösenord) {
            setFel("Fyll i email och lösenord")
            return
        }
        if (mode === "register" && (!garminEmail || !garminPassword)) {
            setFel("Fyll i dina Garmin-uppgifter")
            return
        }
        setFel("")
        setLaddar(true)
        try {
            const result = mode === "register"
                ? await registerUser(email, lösenord, garminEmail, garminPassword)
                : await loginUser(email, lösenord)

            if (!result.ok) {
                setFel(result.data.detail || "Något gick fel")
            } else {
                localStorage.setItem("token", result.data.token)
                localStorage.setItem("email", result.data.email)
                onLogin(result.data.token)
            }
        } catch {
            setFel("Kunde inte nå servern")
        } finally {
            setLaddar(false)
        }
    }

    return (
        <div style={{
            minHeight: "100vh",
            background: colors.bg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
        }}>
            <div style={{
                background: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: 16,
                padding: "40px 48px",
                width: "100%",
                maxWidth: 420,
            }}>
                <div style={{ marginBottom: 28 }}>
                    <div style={{ fontSize: 11, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                        Training Agent
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: colors.text, marginTop: 4 }}>
                        {mode === "login" ? "Logga in" : "Skapa konto"}
                    </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {mode === "register" && (
                        <div style={{ fontSize: 12, fontWeight: 600, color: colors.accent, letterSpacing: "0.05em" }}>
                            STEG 1 · DITT KONTO HÄR I APPEN
                        </div>
                    )}
                    <input
                        type="email"
                        placeholder="Din email (för inloggning)"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        style={inputStyle(colors)}
                    />
                    <input
                        type="password"
                        placeholder="Ditt lösenord (för inloggning)"
                        value={lösenord}
                        onChange={e => setLösenord(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && submit()}
                        style={inputStyle(colors)}
                    />

                    {mode === "register" && (
                        <div style={{
                            background: colors.accentDim,
                            border: `1px solid ${colors.accent}40`,
                            borderRadius: 10,
                            padding: "14px 16px",
                            marginTop: 8,
                            display: "flex",
                            flexDirection: "column",
                            gap: 12,
                        }}>
                            <div>
                                <div style={{ fontSize: 12, fontWeight: 600, color: colors.accent, letterSpacing: "0.05em" }}>
                                    STEG 2 · DITT GARMIN-KONTO
                                </div>
                                <div style={{ fontSize: 12, color: colors.muted, marginTop: 4, lineHeight: 1.5 }}>
                                    Samma uppgifter du loggar in med i Garmin Connect-appen. Krypteras och används bara för att hämta din träningsdata.
                                </div>
                            </div>
                            <input
                                type="email"
                                placeholder="Din email på Garmin Connect"
                                value={garminEmail}
                                onChange={e => setGarminEmail(e.target.value)}
                                style={inputStyle(colors)}
                            />
                            <input
                                type="password"
                                placeholder="Ditt lösenord på Garmin Connect"
                                value={garminPassword}
                                onChange={e => setGarminPassword(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && submit()}
                                style={inputStyle(colors)}
                            />
                        </div>
                    )}

                    {fel && (
                        <div style={{ fontSize: 13, color: colors.error }}>{fel}</div>
                    )}

                    <button onClick={submit} disabled={laddar} style={{
                        background: colors.accentDim,
                        border: `1px solid ${colors.accent}60`,
                        color: colors.accent,
                        padding: "12px",
                        borderRadius: 10,
                        cursor: laddar ? "not-allowed" : "pointer",
                        fontSize: 14,
                        fontWeight: 500,
                        marginTop: 4,
                    }}>
                        {laddar ? "Vänta..." : mode === "login" ? "Logga in" : "Skapa konto"}
                    </button>

                    <button onClick={() => setMode(mode === "login" ? "register" : "login")} style={{
                        background: "transparent",
                        border: "none",
                        color: colors.muted,
                        fontSize: 13,
                        cursor: "pointer",
                        padding: "4px 0",
                    }}>
                        {mode === "login" ? "Inget konto? Registrera dig" : "Har redan ett konto? Logga in"}
                    </button>
                </div>
            </div>
        </div>
    )
}

function inputStyle(colors) {
    return {
        background: "#12121a",
        border: `1px solid ${colors.border}`,
        borderRadius: 8,
        padding: "11px 14px",
        color: colors.text,
        fontSize: 14,
        outline: "none",
        width: "100%",
        boxSizing: "border-box",
    }
}