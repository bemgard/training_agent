const API = import.meta.env.VITE_API_URL || "http://localhost:8000/api"

export async function fetchProfile() {
  const res = await fetch(`${API}/profile`)
  return res.json()
}

export async function streamChat(message, history, onChunk) {
  const response = await fetch(`${API}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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