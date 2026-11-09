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

export async function fetchPasses() {
    const res = await fetch(`${API}/passes`, { headers: getHeaders() })
    return res.json()
}

export async function deletePass(id) {
    const res = await fetch(`${API}/passes/${id}`, { method: "DELETE", headers: getHeaders() })
    return res.json()
}

export async function registerUser(email, lösenord, garmin_email, garmin_password) {
    const res = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, lösenord, garmin_email, garmin_password })
    })
    return { ok: res.ok, data: await res.json() }
}
export async function setAktivitetstyp(activityId, typ) {
    const res = await fetch(`${API}/activities/${activityId}/typ`, {
        method: "PATCH",
        headers: getHeaders(),
        body: JSON.stringify({ typ })
    })
    return { ok: res.ok, data: await res.json() }
}

export async function fetchKropp() {
    const res = await fetch(`${API}/kropp`, { headers: getHeaders() })
    return res.json()
}

export async function sparaKroppsprofil(profil) {
    const res = await fetch(`${API}/kroppsprofil`, { method: "PUT", headers: getHeaders(), body: JSON.stringify(profil) })
    return { ok: res.ok, data: await res.json() }
}

export async function sparaVikt(mätning) {
    const res = await fetch(`${API}/vikt`, { method: "POST", headers: getHeaders(), body: JSON.stringify(mätning) })
    return { ok: res.ok, data: await res.json() }
}

export async function taBortVikt(id) {
    const res = await fetch(`${API}/vikt/${id}`, { method: "DELETE", headers: getHeaders() })
    return { ok: res.ok }
}

export async function fetchTrender(dagar) {
    const res = await fetch(`${API}/trender${dagar ? `?dagar=${dagar}` : "?dagar=0"}`, { headers: getHeaders() })
    return res.json()
}

export async function fetchSomn(dagar) {
    const res = await fetch(`${API}/somn?dagar=${dagar ?? 0}`, { headers: getHeaders() })
    return res.json()
}
