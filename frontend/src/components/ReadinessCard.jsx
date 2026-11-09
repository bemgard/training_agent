import { Gauge } from "lucide-react"

const NIVÅER = {
  PRIME: { label: "Topp", color: "#6ee7b7" },
  HIGH: { label: "Hög", color: "#6ee7b7" },
  MODERATE: { label: "Måttlig", color: "#fbbf24" },
  LOW: { label: "Låg", color: "#fb923c" },
  POOR: { label: "Dålig", color: "#ef4444" },
}

const FEEDBACK = {
  // PRIME / HIGH
  AT_YOUR_BEST: "I toppform",
  PRIMED_AND_READY: "Laddad och redo",
  READY_FOR_ACTION: "Redo för action",
  READY_TO_GO: "Redo att köra",
  RESTED_AND_READY: "Utvilad och redo",
  RECOVERED_AND_READY: "Återhämtad och redo",
  WELL_RECOVERED: "Väl återhämtad",
  WELL_RESTED: "Väl utvilad",
  WELL_RESTED_AND_RECOVERED: "Utvilad och återhämtad",
  EXCELLENT_RECOVERY: "Utmärkt återhämtning",
  ENERGIZED_BY_GOOD_SLEEP: "Pigg efter bra sömn",
  BOOSTED_BY_GOOD_SLEEP: "Bra sömn ger skjuts",
  GOOD_SLEEP_LAST_NIGHT: "Bra sömn i natt",
  GOOD_SLEEP_HISTORY: "Bra sömnhistorik",
  // MODERATE
  LISTEN_TO_YOUR_BODY: "Lyssna på kroppen",
  RECOVERY_IN_PROGRESS: "Återhämtning pågår",
  WORKING_HARD: "Du har tränat hårt",
  BALANCE_STRESS_AND_RECOVERY: "Balansera stress och återhämtning",
  // LOW / POOR
  BALANCE_YOUR_TRAINING_LOAD: "Balansera träningsbelastningen",
  FIND_TIME_TO_RELAX: "Hitta tid att varva ner",
  FOCUS_ON_ENERGY_LEVELS: "Fokusera på energinivån",
  FOCUS_ON_SLEEP_QUALITY: "Fokusera på sömnkvaliteten",
  FOCUS_ON_RECOVERY: "Fokusera på återhämtning",
  TIME_TO_SLOW_DOWN: "Dags att sakta ner",
  TIME_TO_RECHARGE: "Dags att ladda om",
  UNKNOWN: "",
}

function feedbackText(nyckel) {
  if (!nyckel) return ""
  if (FEEDBACK[nyckel]) return FEEDBACK[nyckel]
  const t = nyckel.replaceAll("_", " ").toLowerCase()
  return t.charAt(0).toUpperCase() + t.slice(1)
}

function faktorFärg(p) {
  if (p == null) return "#334155"
  if (p >= 70) return "#6ee7b7"
  if (p >= 40) return "#fbbf24"
  return "#fb923c"
}

function Ring({ värde, färg }) {
  const r = 46, omkrets = 2 * Math.PI * r
  const andel = Math.max(0, Math.min(100, värde ?? 0)) / 100
  return (
    <svg width="120" height="120" viewBox="0 0 120 120">
      <circle cx="60" cy="60" r={r} fill="none" stroke="#1e2736" strokeWidth="10" />
      <circle cx="60" cy="60" r={r} fill="none" stroke={färg} strokeWidth="10"
        strokeLinecap="round" strokeDasharray={`${omkrets * andel} ${omkrets}`}
        transform="rotate(-90 60 60)" />
      <text x="60" y="58" textAnchor="middle" fill="#f1f5f9" fontSize="34" fontWeight="900"
        letterSpacing="-1.5" fontFamily="-apple-system, BlinkMacSystemFont, 'Inter', sans-serif">
        {värde ?? "—"}
      </text>
      <text x="60" y="78" textAnchor="middle" fill="#475569" fontSize="11">/ 100</text>
    </svg>
  )
}

export default function ReadinessCard({ readiness }) {
  const rader = readiness || []
  const senaste = rader[0]
  const idag = new Date().toLocaleDateString("sv-SE")

  if (!senaste) {
    return (
      <Kort färg="#334155">
        <Rubrik färg="#475569" />
        <div style={{ color: "#475569", fontSize: 13, padding: "24px 0" }}>
          Ingen Training Readiness tillgänglig — din Garmin-enhet stödjer troligen inte måttet.
        </div>
      </Kort>
    )
  }

  const nivå = NIVÅER[senaste.niva] || { label: senaste.niva, color: "#94a3b8" }
  const ärIdag = senaste.datum === idag
  const tid = (senaste.uppdaterad || "").slice(11, 16)

  const faktorer = [
    { namn: "Sömn", p: senaste.somn_faktor },
    { namn: "Sömnhistorik", p: senaste.somnhistorik_faktor },
    { namn: "Återhämtning", p: senaste.aterhamtning_faktor,
      extra: senaste.aterhamtning_min != null ? `${Math.round(senaste.aterhamtning_min / 60)} h kvar` : null },
    { namn: "Belastning", p: senaste.belastning_faktor,
      extra: senaste.akut_belastning != null ? `akut ${senaste.akut_belastning}` : null },
    { namn: "Stresshistorik", p: senaste.stress_faktor },
    { namn: "HRV", p: senaste.hrv_faktor },
  ]
  const svaga = faktorer.filter(f => f.p != null && f.p < 50).sort((a, b) => a.p - b.p)
  const lägsta = svaga[0] || faktorer.filter(f => f.p != null && f.p < 70).sort((a, b) => a.p - b.p)[0]
  const trend = [...rader].reverse()

  return (
    <Kort färg={nivå.color}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Rubrik färg={nivå.color} />
        <span style={{ fontSize: 11, color: ärIdag ? "#475569" : "#fbbf24", fontFamily: "monospace" }}>
          {ärIdag ? `Idag · ${tid}` : `Från ${senaste.datum.slice(5)} — synka för dagens värde`}
        </span>
      </div>

      <div style={{ display: "flex", gap: 24, alignItems: "center", marginTop: 12 }}>
        <div style={{ textAlign: "center", flexShrink: 0 }}>
          <Ring värde={senaste.poang} färg={nivå.color} />
          <div style={{ color: nivå.color, fontWeight: 700, fontSize: 15, marginTop: 4 }}>{nivå.label}</div>
          <div style={{ color: "#64748b", fontSize: 12 }}>{feedbackText(senaste.feedback)}</div>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7 }}>
          {faktorer.map(f => (
            <div key={f.namn}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                <span style={{ color: svaga.includes(f) || f === lägsta ? "#e2e8f0" : "#94a3b8" }}>{f.namn}</span>
                <span style={{ color: "#475569", fontFamily: "monospace" }}>
                  {f.extra ? `${f.extra} · ` : ""}{f.p ?? "—"}%
                </span>
              </div>
              <div style={{ height: 5, background: "#1e2736", borderRadius: 3 }}>
                <div style={{ width: `${f.p ?? 0}%`, height: "100%", background: faktorFärg(f.p), borderRadius: 3 }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {lägsta && (
        <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 12 }}>
          Drar ner: {(svaga.length ? svaga : [lägsta]).map((f, i, arr) => (
            <span key={f.namn}>
              <span style={{ color: faktorFärg(f.p) }}>{f.namn.toLowerCase()} ({f.p} %)</span>
              {i < arr.length - 2 ? ", " : i === arr.length - 2 ? " och " : ""}
            </span>
          ))}
        </div>
      )}

      {trend.length > 1 && (
        <div style={{ display: "flex", gap: 6, marginTop: 14, alignItems: "flex-end", height: 62 }}>
          {trend.map(d => (
            <div key={d.datum} style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 10, color: d === senaste ? "#e2e8f0" : "#64748b", marginBottom: 2, fontFamily: "monospace" }}>
                {d.poang}
              </div>
              <div style={{
                height: Math.max(3, (d.poang ?? 0) * 0.3), borderRadius: 2,
                background: (NIVÅER[d.niva] || {}).color || "#334155",
                opacity: d === senaste ? 1 : 0.45,
              }} title={`${d.datum}: ${d.poang}`} />
              <div style={{ fontSize: 10, color: "#475569", marginTop: 3 }}>
                {new Date(d.datum + "T12:00:00").toLocaleDateString("sv-SE", { weekday: "short" })}
              </div>
            </div>
          ))}
        </div>
      )}
    </Kort>
  )
}

function Kort({ färg, children }) {
  return (
    <div style={{
      background: "#161b25", border: "1px solid #1e2736", borderRadius: 10,
      padding: "16px 18px", position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: färg }} />
      {children}
    </div>
  )
}

function Rubrik({ färg }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6, fontSize: 10, fontWeight: 500,
      color: "#475569", textTransform: "uppercase", letterSpacing: "0.09em",
    }}>
      <Gauge size={13} color={färg} /> Training Readiness
    </div>
  )
}
