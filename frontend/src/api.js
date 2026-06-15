const API = import.meta.env.VITE_API_URL || "http://localhost:8000/api"

function getHeaders() {
    const token = localStorage.getItem("token")
    return {
        "Content-Type": "application/json",
        ...(token ? { "Authorization": `Bearer ${token}` } : {})
    }
}

export async function fetchProfile() {
    const res = await fetch(`${API}/profile`, { headers: getHeaders() })
    return res.json()
}

export async function streamChat(message, history, onChunk) {
    const response = await fetch(`${API}/chat`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ message, history })
    })

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let full = ""

    while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        full += chunk
        onChunk(full)
    }

    return full
}

export async function syncGarmin() {
    const res = await fetch(`${API}/sync`, { method: "POST", headers: getHeaders() })
    return res.json()
}
export async function loginUser(email, lösenord) {
    const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, lösenord })
    })
    return { ok: res.ok, data: await res.json() }
}

export async function registerUser(email, lösenord, garmin_email, garmin_password) {
    const res = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, lösenord, garmin_email, garmin_password })
    })
    return { ok: res.ok, data: await res.json() }
}