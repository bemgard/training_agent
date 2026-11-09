// "Kom ihåg mig" → localStorage (överlever omstart). Annars sessionStorage (rensas när webbläsaren stängs).
export function hämtaToken() {
  return localStorage.getItem("token") || sessionStorage.getItem("token")
}

export function sparaToken(token, email, kommaIhåg) {
  rensaToken()
  const lager = kommaIhåg ? localStorage : sessionStorage
  lager.setItem("token", token)
  lager.setItem("email", email)
}

export function rensaToken() {
  for (const lager of [localStorage, sessionStorage]) {
    lager.removeItem("token")
    lager.removeItem("email")
  }
}
