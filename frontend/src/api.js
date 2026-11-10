import { hämtaToken } from "./token"
const API = import.meta.env.VITE_API_URL || "http://localhost:8000/api"

function getHeaders() {
    const token = hämtaToken()
    return {
        "Content-Type": "application/json",
        ...(token ? { "Authorization": `Bearer ${token}` } : {})
    }
}

export async function fetchProfile() {
    const res = await fetch(`${API}/profile`, { headers: getHeaders() })
    return res.json()
}

export async function streamChat(message, samtalId, onChunk) {
    const response = await fetch(`${API}/chat`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ message, samtal_id: samtalId })
    })
    if (!response.ok) {
        onChunk("⚠️ Kunde inte skicka meddelandet.")
        return
    }

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
export async function loginUser(email, lösenord, kom_ihag = false) {
    const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, lösenord, kom_ihag })
    })
    return { ok: res.ok, data: await res.json() }
}

export async function fetchVecka(start, idag) {
    const res = await fetch(`${API}/planer/vecka?start=${start}&idag=${idag}`, { headers: getHeaders() })
    return res.ok ? res.json() : null
}

export async function sparaPlan(plan, idag, samtalId) {
    const res = await fetch(`${API}/planer`, {
        method: "POST", headers: getHeaders(), body: JSON.stringify({ plan, idag, samtal_id: samtalId ?? null })
    })
    return { ok: res.ok, data: await res.json() }
}

export async function flyttaPass(id, datum, idag) {
    const res = await fetch(`${API}/passes/${id}`, { method: "PATCH", headers: getHeaders(), body: JSON.stringify({ datum, idag }) })
    return { ok: res.ok }
}

export async function deletePass(id) {
    const res = await fetch(`${API}/passes/${id}`, { method: "DELETE", headers: getHeaders() })
    return { ok: res.ok }
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

export async function fetchMal() {
    const res = await fetch(`${API}/mal`, { headers: getHeaders() })
    return res.json()
}

export async function sparaMal(mal, id) {
    const res = await fetch(id ? `${API}/mal/${id}` : `${API}/mal`, {
        method: id ? "PUT" : "POST", headers: getHeaders(), body: JSON.stringify(mal)
    })
    return { ok: res.ok, data: await res.json() }
}

export async function avslutaMal(id) {
    const res = await fetch(`${API}/mal/${id}`, { method: "DELETE", headers: getHeaders() })
    return { ok: res.ok }
}

export async function fetchOmMig() {
    const res = await fetch(`${API}/om-mig`, { headers: getHeaders() })
    return res.json()
}

export async function sparaOmMig(profil) {
    const res = await fetch(`${API}/om-mig`, { method: "PUT", headers: getHeaders(), body: JSON.stringify(profil) })
    return { ok: res.ok }
}

export async function läggTillRegel(regel) {
    const res = await fetch(`${API}/aktivitetsregler`, { method: "POST", headers: getHeaders(), body: JSON.stringify(regel) })
    return { ok: res.ok, data: await res.json() }
}

export async function taBortRegel(id) {
    const res = await fetch(`${API}/aktivitetsregler/${id}`, { method: "DELETE", headers: getHeaders() })
    return { ok: res.ok }
}

export async function fetchDagsform(datum) {
    const res = await fetch(`${API}/dagsform?datum=${datum}`, { headers: getHeaders() })
    return res.json()
}

export async function sparaDagsform(data) {
    const res = await fetch(`${API}/dagsform`, { method: "PUT", headers: getHeaders(), body: JSON.stringify(data) })
    return { ok: res.ok }
}

export async function nyttBesvar(data) {
    const res = await fetch(`${API}/besvar`, { method: "POST", headers: getHeaders(), body: JSON.stringify(data) })
    return { ok: res.ok, data: await res.json() }
}

export async function uppdateraBesvar(id, data) {
    const res = await fetch(`${API}/besvar/${id}`, { method: "PATCH", headers: getHeaders(), body: JSON.stringify(data) })
    return { ok: res.ok }
}

export async function skapaSamtal() {
    const res = await fetch(`${API}/samtal`, { method: "POST", headers: getHeaders(), body: JSON.stringify({}) })
    return (await res.json()).id
}

export async function fetchSamtalLista() {
    const res = await fetch(`${API}/samtal`, { headers: getHeaders() })
    return res.ok ? res.json() : []
}

export async function fetchSamtal(id) {
    const res = await fetch(`${API}/samtal/${id}`, { headers: getHeaders() })
    return res.ok ? res.json() : null
}

export async function taBortSamtal(id) {
    const res = await fetch(`${API}/samtal/${id}`, { method: "DELETE", headers: getHeaders() })
    return { ok: res.ok }
}

export async function fetchInsikt(datum) {
    const res = await fetch(`${API}/insikt?datum=${datum}`, { headers: getHeaders() })
    return res.ok ? res.json() : null
}

export async function uppdateraInsikt(datum) {
    const res = await fetch(`${API}/insikt/morgon`, { method: "POST", headers: getHeaders(), body: JSON.stringify({ datum }) })
    return { ok: res.ok, status: res.status, data: await res.json() }
}

export async function skickaTillGarmin(passIds, idag) {
    const res = await fetch(`${API}/planer/garmin`, { method: "POST", headers: getHeaders(), body: JSON.stringify({ pass_ids: passIds, idag }) })
    return { ok: res.ok, data: await res.json() }
}

export async function taBortFrånGarmin(id) {
    const res = await fetch(`${API}/passes/${id}/garmin`, { method: "DELETE", headers: getHeaders() })
    return { ok: res.ok }
}
