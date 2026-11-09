// Delas av WeeklyLoad och ActivityLog. Nycklarna matchar scripts/aktivitetstyp.py (KATEGORIER).
export const KATEGORIER = {
  running: { namn: "Löpning", ikon: "🏃", färg: "#6ee7b7" },
  football: { namn: "Fotboll", ikon: "⚽", färg: "#60a5fa" },
  strength_training: { namn: "Styrketräning", ikon: "🏋️", färg: "#f97316" },
  hiit: { namn: "HIIT", ikon: "💪", färg: "#f43f5e" },
  cardio: { namn: "Cardio", ikon: "🚴", färg: "#fbbf24" },
  cycling: { namn: "Cykling", ikon: "🚲", färg: "#22d3ee" },
  skiing: { namn: "Skidor", ikon: "⛷️", färg: "#a5b4fc" },
  walking: { namn: "Promenad", ikon: "🚶", färg: "#94a3b8" },
  hiking: { namn: "Vandring", ikon: "🥾", färg: "#84cc16" },
  golf: { namn: "Golf", ikon: "⛳", färg: "#a3e635" },
  padel: { namn: "Padel", ikon: "🎾", färg: "#e879f9" },
  other: { namn: "Övrigt", ikon: "✨", färg: "#64748b" },
}

export const OKLASSAD = { namn: "Oklassat", ikon: "❔", färg: "#334155" }

export function kategoriInfo(kategori) {
  return KATEGORIER[kategori] || OKLASSAD
}

// Lokalt datum som YYYY-MM-DD (toISOString ger UTC och förskjuter dagen i Sverige)
export function lokaltDatum(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function formatMinuter(min) {
  if (!min) return "—"
  const h = Math.floor(min / 60), m = Math.round(min % 60)
  return h ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`
}
