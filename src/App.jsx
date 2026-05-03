import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "./supabaseClient";
import {
  Trophy, Target, Zap, Shield, ArrowUpRight, ArrowLeft,
  Calendar, MapPin, Lock, Plus, Sparkles, Edit3, Trash2,
  X, Check, Star, Award
} from "lucide-react";

// ——————————————————————————————————————————————————————————————
// FONTS
// ——————————————————————————————————————————————————————————————
function useFonts() {
  useEffect(() => {
    const id = "league-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Anton&family=Instrument+Serif:ital@0;1&family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap";
    document.head.appendChild(link);
  }, []);
}
const FONT_DISPLAY = "'Anton', 'Arial Narrow', sans-serif";
const FONT_SERIF   = "'Instrument Serif', 'Times New Roman', serif";
const FONT_BODY    = "'Manrope', system-ui, sans-serif";
const FONT_MONO    = "'JetBrains Mono', ui-monospace, monospace";

// ——————————————————————————————————————————————————————————————
// DESIGN TOKENS
// ——————————————————————————————————————————————————————————————
const COLORS = {
  bg:       "#0d0d0d",
  bg2:      "#151515",
  bg3:      "#1e1e1e",
  line:     "#2a2a2a",
  lineSoft: "#1f1f1f",
  ink:      "#f5ecd9",
  inkMuted: "#8a8580",
  accent:   "#d4ff00",
  attacker: "#ff5a4d",
  mid:      "#d4ff00",
  defender: "#6ba6ff",
};
const roleColor = (r) => r === "Attacker" ? COLORS.attacker : r === "Midfielder" ? COLORS.mid : COLORS.defender;
const roleIcon  = (r) => r === "Attacker" ? Target     : r === "Midfielder" ? Zap       : Shield;

// ——————————————————————————————————————————————————————————————
// INITIAL DATA
// ——————————————————————————————————————————————————————————————
const INITIAL_PLAYERS = [];

// Empty match list — backend will populate. Pre-season state.
const INITIAL_MATCHES = [];

const ADMIN_PASSWORD = "admin123";

// ——————————————————————————————————————————————————————————————
// STATS — computed from matches
// ——————————————————————————————————————————————————————————————
function computeStats(playerName, matches) {
  let mp = 0, w = 0, d = 0, l = 0, g = 0, a = 0;
  for (const m of matches) {
    if (m.status !== "completed") continue;
    const inHome = m.homeSquad.includes(playerName);
    const inAway = m.awaySquad.includes(playerName);
    if (inHome || inAway) {
      mp++;
      const forScore = inHome ? m.homeScore : m.awayScore;
      const agScore  = inHome ? m.awayScore : m.homeScore;
      if (forScore > agScore) w++;
      else if (forScore === agScore) d++;
      else l++;
    }
    for (const goal of m.goals) {
      if (!goal.isRinger && goal.scorer === playerName) g++;
      if (goal.assister === playerName) a++;
    }
  }
  return { mp, w, d, l, g, a, pts: 3 * w + d };
}

function getStandings(players, matches) {
  return players
    .map((p) => ({ ...p, ...computeStats(p.name, matches) }))
    .sort((A, B) => {
      if (B.pts !== A.pts) return B.pts - A.pts;
      const adA = A.g - 0, adB = B.g - 0; // tiebreak by goals
      if (adB !== adA) return adB - adA;
      return (B.g + B.a) - (A.g + A.a);
    });
}

// ——————————————————————————————————————————————————————————————
// SHARED LITTLE BITS
// ——————————————————————————————————————————————————————————————
const Grain = () => (
  <svg className="pointer-events-none fixed inset-0 w-full h-full opacity-[0.06] mix-blend-overlay z-50" aria-hidden>
    <filter id="grainy">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
      <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0" />
    </filter>
    <rect width="100%" height="100%" filter="url(#grainy)" />
  </svg>
);

const SectionTag = ({ n, label }) => (
  <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: COLORS.inkMuted, letterSpacing: "0.2em" }}>
    / SECTION {String(n).padStart(2, "0")} {label && `· ${label.toUpperCase()}`}
  </div>
);

const HugeHeading = ({ children }) => (
  <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 56, lineHeight: 0.95, color: COLORS.ink, marginTop: 8 }}>
    {children}
  </h2>
);

const Italic = ({ children, color = COLORS.inkMuted, size = 18 }) => (
  <span style={{ fontFamily: FONT_SERIF, fontStyle: "italic", color, fontSize: size }}>{children}</span>
);

const Btn = ({ children, onClick, variant = "primary", type = "button", className = "", style = {} }) => {
  const base = {
    fontFamily: FONT_DISPLAY,
    fontSize: 14,
    letterSpacing: "0.1em",
    padding: "10px 16px",
    cursor: "pointer",
    border: "none",
    transition: "all 150ms",
  };
  const variants = {
    primary: { background: COLORS.accent, color: "#000" },
    ghost:   { background: "transparent", color: COLORS.ink, border: `1px solid ${COLORS.line}` },
    danger:  { background: "transparent", color: COLORS.attacker, border: `1px solid ${COLORS.attacker}` },
  };
  return (
    <button type={type} onClick={onClick} className={className} style={{ ...base, ...variants[variant], ...style }}>
      {children}
    </button>
  );
};

const Field = ({ label, children }) => (
  <div>
    <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: COLORS.inkMuted, letterSpacing: "0.15em", marginBottom: 6 }}>
      {label.toUpperCase()}
    </div>
    {children}
  </div>
);

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  background: COLORS.bg,
  border: `1px solid ${COLORS.line}`,
  color: COLORS.ink,
  fontFamily: FONT_MONO,
  fontSize: 13,
  outline: "none",
};

const EmptyPanel = ({ title, sub }) => (
  <div className="p-10 text-center" style={{ background: COLORS.bg2, border: `1px dashed ${COLORS.line}` }}>
    <div style={{ fontFamily: FONT_DISPLAY, fontSize: 48, color: COLORS.ink, letterSpacing: "0.02em" }}>{title}</div>
    <div style={{ fontFamily: FONT_SERIF, fontStyle: "italic", fontSize: 18, color: COLORS.inkMuted, marginTop: 6 }}>{sub}</div>
  </div>
);

// ——————————————————————————————————————————————————————————————
// TICKER
// ——————————————————————————————————————————————————————————————
const Ticker = ({ players, matches }) => {
  const completed = matches.filter((m) => m.status === "completed").length;
  const scheduled = matches.filter((m) => m.status === "scheduled").length;
  const items = [
    completed === 0 ? "NEW SEASON — KICK-OFF" : `MATCHWEEK ${completed} IN THE BOOKS`,
    `${players.length} PLAYERS ON THE BOOKS`,
    scheduled > 0 ? `${scheduled} FIXTURE${scheduled === 1 ? "" : "S"} INCOMING` : "NO FIXTURES SCHEDULED",
    "FRIDAY NIGHT FOOTBALL — SINCE SEP '25",
    "ALL OPINIONS IN THE GROUP CHAT ARE FINAL",
  ];
  const row = [...items, ...items];
  return (
    <div className="w-full border-y overflow-hidden whitespace-nowrap" style={{ background: COLORS.accent, color: "#000", borderColor: "#000" }}>
      <div className="inline-flex gap-10 py-2 animate-[ticker_45s_linear_infinite]" style={{ fontFamily: FONT_DISPLAY, letterSpacing: "0.05em", fontSize: "0.95rem" }}>
        {row.map((t, i) => <span key={i} className="inline-flex items-center gap-3">{t}<span>●</span></span>)}
      </div>
      <style>{`@keyframes ticker { from { transform: translateX(0) } to { transform: translateX(-50%) } }`}</style>
    </div>
  );
};

// ——————————————————————————————————————————————————————————————
// HEADER
// ——————————————————————————————————————————————————————————————
const Header = ({ tab, setTab, matches }) => {
  const tabs = ["table", "top performers", "fixtures", "results", "admin"];
  const completed = matches.filter((m) => m.status === "completed").length;
  return (
    <header className="w-full border-b" style={{ borderColor: COLORS.line, background: COLORS.bg }}>
      <div className="max-w-[1400px] mx-auto px-6 md:px-10">
        <div className="flex items-center justify-between py-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 flex items-center justify-center" style={{ background: COLORS.accent, color: "#000" }}>
              <Trophy size={18} strokeWidth={2.5} />
            </div>
            <div className="leading-none">
              <div style={{ fontFamily: FONT_SERIF, fontStyle: "italic", fontSize: 13, color: COLORS.inkMuted }}>est. September 2025</div>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, letterSpacing: "0.04em", color: COLORS.ink, marginTop: -2 }}>FRIDAY NIGHT FOOTBALL</div>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-6" style={{ fontFamily: FONT_MONO, fontSize: 11, color: COLORS.inkMuted, letterSpacing: "0.1em" }}>
            <span>SEASON 25/26</span>
            <span style={{ color: COLORS.accent }}>● LIVE</span>
            <span>MW {String(completed).padStart(2, "0")}</span>
          </div>
        </div>
      </div>
      <nav className="border-t" style={{ borderColor: COLORS.line }}>
        <div className="max-w-[1400px] mx-auto px-6 md:px-10 flex gap-1 overflow-x-auto">
          {tabs.map((t) => {
            const active = tab === t;
            return (
              <button key={t} onClick={() => setTab(t)} className="relative py-4 px-4 transition-colors whitespace-nowrap" style={{ fontFamily: FONT_DISPLAY, letterSpacing: "0.08em", fontSize: 15, color: active ? COLORS.ink : COLORS.inkMuted, background: "transparent", border: "none", cursor: "pointer" }}>
                {t.toUpperCase()}
                {active && <span className="absolute left-0 right-0 bottom-0 h-[3px]" style={{ background: COLORS.accent }} />}
              </button>
            );
          })}
        </div>
      </nav>
    </header>
  );
};

// ——————————————————————————————————————————————————————————————
// HERO
// ——————————————————————————————————————————————————————————————
const Hero = ({ players, matches, standings }) => {
  const completed = matches.filter((m) => m.status === "completed");
  const noMatches = completed.length === 0;
  const leader = noMatches ? null : standings[0];

  return (
    <section className="w-full" style={{ background: COLORS.bg }}>
      <div className="max-w-[1400px] mx-auto px-6 md:px-10 pt-14 pb-10 grid grid-cols-12 gap-6 items-end">
        <div className="col-span-12 md:col-span-8">
          <div className="flex items-center gap-3 mb-5" style={{ fontFamily: FONT_MONO, fontSize: 11, color: COLORS.inkMuted, letterSpacing: "0.2em" }}>
            <span style={{ width: 24, height: 1, background: COLORS.inkMuted, display: "inline-block" }} />
            {noMatches ? "NEW SEASON — LEAGUE OVERVIEW" : `MATCHWEEK ${completed.length} — LEAGUE OVERVIEW`}
          </div>
          <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: "clamp(60px, 10vw, 148px)", lineHeight: 0.85, color: COLORS.ink, letterSpacing: "-0.01em" }}>
            {noMatches ? "FRESH SLATE." : "THE TABLE"}<br />
            <span style={{ color: COLORS.accent, fontFamily: FONT_SERIF, fontStyle: "italic", fontWeight: 400, letterSpacing: "-0.02em" }}>
              {noMatches ? "everyone's on nought." : "doesn't lie."}
            </span>
          </h1>
          <p className="max-w-xl mt-6" style={{ color: COLORS.inkMuted, fontFamily: FONT_BODY, fontSize: 16, lineHeight: 1.5 }}>
            {noMatches
              ? `${players.length} names on the teamsheet, zero points on the board. The season starts the moment the first whistle blows.`
              : `${completed.length} match${completed.length === 1 ? "" : "es"} played. ${players.length} players in the running. The points are real now.`}
          </p>
        </div>

        <div className="col-span-12 md:col-span-4">
          <div className="p-6 relative overflow-hidden" style={{ background: COLORS.accent, color: "#000" }}>
            <div className="absolute -right-6 -bottom-10" style={{ fontFamily: FONT_DISPLAY, fontSize: 180, lineHeight: 1, color: "rgba(0,0,0,0.08)" }}>
              {noMatches ? "25" : "01"}
            </div>
            <div className="flex items-center gap-2 relative z-10">
              {noMatches ? <Sparkles size={14} strokeWidth={2.5} /> : <Trophy size={14} strokeWidth={2.5} />}
              <span style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.2em" }}>{noMatches ? "NEW SEASON" : "CURRENT LEADER"}</span>
            </div>
            {noMatches ? (
              <>
                <div style={{ fontFamily: FONT_DISPLAY, fontSize: 72, lineHeight: 0.9, marginTop: 10, letterSpacing: "-0.01em" }}>KICK-OFF</div>
                <div style={{ fontFamily: FONT_SERIF, fontStyle: "italic", fontSize: 20, marginTop: 4 }}>— everything still to play for.</div>
              </>
            ) : (
              <>
                <div style={{ fontFamily: FONT_DISPLAY, fontSize: 72, lineHeight: 0.9, marginTop: 10, letterSpacing: "-0.01em" }}>{leader.name.toUpperCase()}</div>
                <div style={{ fontFamily: FONT_SERIF, fontStyle: "italic", fontSize: 20, marginTop: 4 }}>— {leader.role.toLowerCase()}</div>
              </>
            )}
            <div className="mt-6 grid grid-cols-4 gap-3 relative z-10">
              {(noMatches
                ? [["SQUAD", players.length], ["ATK", players.filter(p => p.role === "Attacker").length], ["MID", players.filter(p => p.role === "Midfielder").length], ["DEF", players.filter(p => p.role === "Defender").length]]
                : [["PTS", leader.pts], ["G", leader.g], ["A", leader.a], ["G/A", leader.g + leader.a]]
              ).map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.15em", opacity: 0.7 }}>{k}</div>
                  <div style={{ fontFamily: FONT_DISPLAY, fontSize: 32, lineHeight: 1 }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

// ——————————————————————————————————————————————————————————————
// LEAGUE TABLE
// ——————————————————————————————————————————————————————————————
const LeagueTable = ({ standings, matches }) => {
  const [filter, setFilter] = useState("All");
  const roles = ["All", "Attacker", "Midfielder", "Defender"];
  const rows = useMemo(() => filter === "All" ? standings : standings.filter((p) => p.role === filter), [filter, standings]);
  const noMatches = matches.filter(m => m.status === "completed").length === 0;

  return (
    <section className="max-w-[1400px] mx-auto px-6 md:px-10 py-10">
      <div className="flex items-end justify-between flex-wrap gap-6 mb-8">
        <div>
          <SectionTag n={1} />
          <HugeHeading>FULL STANDINGS</HugeHeading>
          {noMatches && <div className="mt-2"><Italic>— no matches played. Ranking unlocks after matchweek 1.</Italic></div>}
        </div>
        <div className="flex gap-1 border" style={{ borderColor: COLORS.line }}>
          {roles.map((r) => {
            const active = filter === r;
            return (
              <button key={r} onClick={() => setFilter(r)} className="px-4 py-2 transition-colors" style={{ fontFamily: FONT_DISPLAY, fontSize: 13, letterSpacing: "0.1em", background: active ? COLORS.accent : "transparent", color: active ? "#000" : COLORS.ink, border: "none", cursor: "pointer" }}>
                {r.toUpperCase()}
              </button>
            );
          })}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse" style={{ minWidth: 880 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${COLORS.line}` }}>
              {["#", "Player", "Role", "MP", "W", "D", "L", "G", "A", "G/A", "PTS"].map((h, i) => (
                <th key={h} className="text-left py-3 px-3" style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.15em", color: COLORS.inkMuted, textAlign: i >= 3 ? "right" : "left" }}>
                  {h.toUpperCase()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p, idx) => {
              const RoleIcon = roleIcon(p.role);
              const showPos = !noMatches && idx < 3;
              return (
                <tr key={p.name} style={{ borderBottom: `1px solid ${COLORS.lineSoft}` }}
                    onMouseOver={(e) => (e.currentTarget.style.background = COLORS.bg2)}
                    onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}>
                  <td className="py-4 px-3">
                    <span style={{ fontFamily: FONT_DISPLAY, fontSize: 28, color: noMatches ? COLORS.inkMuted : (showPos ? COLORS.accent : COLORS.ink), lineHeight: 1, minWidth: 32 }}>
                      {noMatches ? "—" : String(idx + 1).padStart(2, "0")}
                    </span>
                  </td>
                  <td className="py-4 px-3">
                    <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, color: COLORS.ink, letterSpacing: "0.02em" }}>{p.name.toUpperCase()}</div>
                  </td>
                  <td className="py-4 px-3">
                    <span className="inline-flex items-center gap-2 px-2 py-1" style={{ border: `1px solid ${roleColor(p.role)}`, color: roleColor(p.role), fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.15em" }}>
                      <RoleIcon size={11} />
                      {p.role.toUpperCase()}
                    </span>
                  </td>
                  {[p.mp, p.w, p.d, p.l, p.g, p.a, p.g + p.a].map((v, i) => (
                    <td key={i} className="py-4 px-3 text-right" style={{ fontFamily: FONT_MONO, fontSize: 15, color: v === 0 ? COLORS.inkMuted : COLORS.ink }}>{v}</td>
                  ))}
                  <td className="py-4 px-3 text-right">
                    <span style={{ fontFamily: FONT_DISPLAY, fontSize: 28, color: p.pts === 0 ? COLORS.inkMuted : COLORS.accent, lineHeight: 1 }}>{p.pts}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};

// ——————————————————————————————————————————————————————————————
// TOP PERFORMERS
// ——————————————————————————————————————————————————————————————
const TopPerformers = ({ standings, matches }) => {
  const noData = matches.filter(m => m.status === "completed").length === 0;
  const topScorer  = [...standings].sort((a, b) => b.g - a.g)[0];
  const topAssist  = [...standings].sort((a, b) => b.a - a.a)[0];
  const topGA      = [...standings].sort((a, b) => (b.g + b.a) - (a.g + a.a))[0];
  const topWinRate = [...standings].sort((a, b) => (b.mp ? b.w / b.mp : 0) - (a.mp ? a.w / a.mp : 0))[0];

  const cards = [
    { label: "GOLDEN BOOT",  sub: "most goals",      player: topScorer,  stat: topScorer.g,           unit: "goals"   },
    { label: "PLAYMAKER",    sub: "most assists",    player: topAssist,  stat: topAssist.a,           unit: "assists" },
    { label: "ALL-ROUND",    sub: "goals + assists", player: topGA,      stat: topGA.g + topGA.a,     unit: "G+A"     },
    { label: "WIN MERCHANT", sub: "highest win %",   player: topWinRate, stat: topWinRate.mp ? Math.round(100 * topWinRate.w / topWinRate.mp) : 0, unit: "%" },
  ];

  return (
    <section className="max-w-[1400px] mx-auto px-6 md:px-10 py-10">
      <div className="mb-8">
        <SectionTag n={2} />
        <HugeHeading>TOP PERFORMERS</HugeHeading>
        {noData && <div className="mt-2"><Italic>— awards are sleeping. They wake up once goals start going in.</Italic></div>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c, i) => (
          <div key={c.label} className="relative overflow-hidden p-6" style={{ background: COLORS.bg2, border: `1px solid ${COLORS.line}`, minHeight: 240 }}>
            <div className="absolute -right-2 -top-4" style={{ fontFamily: FONT_DISPLAY, fontSize: 140, lineHeight: 1, color: COLORS.bg3 }}>{String(i + 1).padStart(2, "0")}</div>
            <div className="relative z-10">
              <div style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.2em", color: COLORS.inkMuted }}>{c.label}</div>
              <div style={{ fontFamily: FONT_SERIF, fontStyle: "italic", fontSize: 14, color: COLORS.inkMuted, marginTop: 2 }}>{c.sub}</div>
              {noData ? (
                <>
                  <div style={{ fontFamily: FONT_SERIF, fontStyle: "italic", fontSize: 36, lineHeight: 1, color: COLORS.inkMuted, marginTop: 20 }}>yet to be claimed</div>
                  <div className="mt-6 flex items-baseline gap-2">
                    <span style={{ fontFamily: FONT_DISPLAY, fontSize: 64, color: COLORS.inkMuted, lineHeight: 1 }}>—</span>
                    <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: COLORS.inkMuted, letterSpacing: "0.15em" }}>{c.unit.toUpperCase()}</span>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontFamily: FONT_DISPLAY, fontSize: 46, lineHeight: 0.95, color: COLORS.ink, marginTop: 20, letterSpacing: "0.01em" }}>{c.player.name.toUpperCase()}</div>
                  <div className="mt-2 flex items-center gap-2">
                    {React.createElement(roleIcon(c.player.role), { size: 12, style: { color: roleColor(c.player.role) } })}
                    <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: roleColor(c.player.role), letterSpacing: "0.1em" }}>{c.player.role.toUpperCase()}</span>
                  </div>
                  <div className="mt-6 flex items-baseline gap-2">
                    <span style={{ fontFamily: FONT_DISPLAY, fontSize: 64, color: COLORS.accent, lineHeight: 1 }}>{c.stat}</span>
                    <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: COLORS.inkMuted, letterSpacing: "0.15em" }}>{c.unit.toUpperCase()}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

// ——————————————————————————————————————————————————————————————
// FIXTURES (scheduled matches)
// ——————————————————————————————————————————————————————————————
const formatDate = (iso) => {
  if (!iso) return "TBC";
  try {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  } catch { return iso; }
};

const Fixtures = ({ matches }) => {
  const fixtures = matches.filter((m) => m.status === "scheduled");
  return (
    <section className="max-w-[1400px] mx-auto px-6 md:px-10 py-10">
      <div className="mb-8">
        <SectionTag n={3} />
        <HugeHeading>UPCOMING FIXTURES</HugeHeading>
      </div>
      {fixtures.length === 0 ? (
        <EmptyPanel title="NO FIXTURES YET" sub="Head to the Admin tab to schedule the next match." />
      ) : (
        <div className="space-y-3">
          {fixtures.map((f) => (
            <div key={f.id} className="grid grid-cols-12 gap-4 items-center p-5" style={{ background: COLORS.bg2, border: `1px solid ${COLORS.line}` }}>
              <div className="col-span-12 md:col-span-2">
                <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, color: COLORS.ink, lineHeight: 1 }}>{formatDate(f.date).toUpperCase()}</div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: COLORS.accent, marginTop: 4 }}>{f.time}</div>
              </div>
              <div className="col-span-12 md:col-span-6 flex items-center gap-4 flex-wrap">
                <span style={{ fontFamily: FONT_DISPLAY, fontSize: 24, color: COLORS.ink }}>{f.homeCaptain.toUpperCase()}'S XI</span>
                <Italic size={20}>vs</Italic>
                <span style={{ fontFamily: FONT_DISPLAY, fontSize: 24, color: COLORS.ink }}>{f.awayCaptain.toUpperCase()}'S XI</span>
              </div>
              <div className="col-span-12 md:col-span-3 flex items-center gap-2" style={{ color: COLORS.inkMuted }}>
                <MapPin size={14} />
                <span style={{ fontFamily: FONT_BODY, fontSize: 13 }}>{f.pitch}</span>
              </div>
              <div className="col-span-12 md:col-span-1 flex justify-end">
                <ArrowUpRight size={20} style={{ color: COLORS.accent }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

// ——————————————————————————————————————————————————————————————
// RESULTS
// ——————————————————————————————————————————————————————————————
const Results = ({ matches, onOpenMatch }) => {
  const results = matches.filter((m) => m.status === "completed").slice().reverse();
  return (
    <section className="max-w-[1400px] mx-auto px-6 md:px-10 py-10">
      <div className="mb-8">
        <SectionTag n={4} />
        <HugeHeading>RECENT RESULTS</HugeHeading>
        <div className="mt-2"><Italic>— click any match for the full breakdown.</Italic></div>
      </div>
      {results.length === 0 ? (
        <EmptyPanel title="NO RESULTS YET" sub="The first final whistle hasn't blown this season." />
      ) : (
        <div className="space-y-3">
          {results.map((r) => {
            const homeWin = r.homeScore > r.awayScore;
            const awayWin = r.awayScore > r.homeScore;
            return (
              <button key={r.id} onClick={() => onOpenMatch(r.id)}
                className="w-full grid grid-cols-12 gap-4 items-center p-5 text-left transition-colors"
                style={{ background: COLORS.bg2, border: `1px solid ${COLORS.line}`, cursor: "pointer" }}
                onMouseOver={(e) => (e.currentTarget.style.borderColor = COLORS.accent)}
                onMouseOut={(e) => (e.currentTarget.style.borderColor = COLORS.line)}>
                <div className="col-span-12 md:col-span-2">
                  <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: COLORS.inkMuted, letterSpacing: "0.15em" }}>MW {String(r.matchweek).padStart(2, "0")}</div>
                  <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: COLORS.ink, marginTop: 4 }}>{formatDate(r.date).toUpperCase()}</div>
                </div>
                <div className="col-span-12 md:col-span-4 text-right">
                  <span style={{ fontFamily: FONT_DISPLAY, fontSize: 22, color: homeWin ? COLORS.accent : COLORS.ink }}>{r.homeCaptain.toUpperCase()}'S XI</span>
                </div>
                <div className="col-span-12 md:col-span-2 flex justify-center">
                  <div className="px-4 py-2 flex items-center gap-3" style={{ background: COLORS.bg3, border: `1px solid ${COLORS.line}` }}>
                    <span style={{ fontFamily: FONT_DISPLAY, fontSize: 32, color: homeWin ? COLORS.accent : COLORS.ink, lineHeight: 1 }}>{r.homeScore}</span>
                    <span style={{ color: COLORS.inkMuted }}>—</span>
                    <span style={{ fontFamily: FONT_DISPLAY, fontSize: 32, color: awayWin ? COLORS.accent : COLORS.ink, lineHeight: 1 }}>{r.awayScore}</span>
                  </div>
                </div>
                <div className="col-span-12 md:col-span-3">
                  <span style={{ fontFamily: FONT_DISPLAY, fontSize: 22, color: awayWin ? COLORS.accent : COLORS.ink }}>{r.awayCaptain.toUpperCase()}'S XI</span>
                </div>
                <div className="col-span-12 md:col-span-1 flex justify-end">
                  <ArrowUpRight size={18} style={{ color: COLORS.inkMuted }} />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
};

// ——————————————————————————————————————————————————————————————
// MATCH DETAIL — Fotmob-style page
// ——————————————————————————————————————————————————————————————
const MatchDetail = ({ match, onBack }) => {
  const homeWin = match.homeScore > match.awayScore;
  const awayWin = match.awayScore > match.homeScore;
  const homeGoals = match.goals.filter((g) => g.team === "home");
  const awayGoals = match.goals.filter((g) => g.team === "away");

  const goalLabel = (g) => {
    const name = g.isRinger ? `${g.ringerName} (Ringer)` : g.scorer;
    const min  = g.minute ? ` ${g.minute}'` : "";
    const ass  = g.assister ? ` (a: ${g.assister})` : "";
    return `${name}${min}${ass}`;
  };

  return (
    <section className="max-w-[1400px] mx-auto px-6 md:px-10 py-10">
      <button onClick={onBack} className="flex items-center gap-2 mb-6" style={{ fontFamily: FONT_MONO, fontSize: 12, color: COLORS.inkMuted, letterSpacing: "0.15em", background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>
        <ArrowLeft size={14} />
        BACK TO RESULTS
      </button>

      <div className="grid grid-cols-12 gap-6">
        {/* MAIN */}
        <div className="col-span-12 lg:col-span-8">
          {/* Header card */}
          <div className="p-6 md:p-10" style={{ background: COLORS.bg2, border: `1px solid ${COLORS.line}` }}>
            <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 flex items-center justify-center" style={{ background: COLORS.accent, color: "#000" }}>
                  <Trophy size={14} strokeWidth={2.5} />
                </div>
                <span style={{ fontFamily: FONT_DISPLAY, fontSize: 16, letterSpacing: "0.08em", color: COLORS.ink }}>FRIDAY NIGHT FOOTBALL — MW {String(match.matchweek).padStart(2, "0")}</span>
              </div>
              <div className="flex items-center gap-4 flex-wrap" style={{ fontFamily: FONT_MONO, fontSize: 11, color: COLORS.inkMuted, letterSpacing: "0.1em" }}>
                <span className="flex items-center gap-2"><Calendar size={12} />{formatDate(match.date).toUpperCase()} {match.time && `· ${match.time}`}</span>
                <span className="flex items-center gap-2"><MapPin size={12} />{match.pitch.toUpperCase()}</span>
              </div>
            </div>

            {/* Big score */}
            <div className="grid grid-cols-12 items-center gap-4 my-8">
              <div className="col-span-5 text-right">
                <div style={{ fontFamily: FONT_DISPLAY, fontSize: "clamp(28px, 5vw, 48px)", color: homeWin ? COLORS.accent : COLORS.ink, lineHeight: 1, letterSpacing: "0.01em" }}>
                  {match.homeCaptain.toUpperCase()}'S XI
                </div>
              </div>
              <div className="col-span-2 text-center">
                <div className="flex items-center justify-center gap-3">
                  <span style={{ fontFamily: FONT_DISPLAY, fontSize: "clamp(56px, 10vw, 96px)", color: homeWin ? COLORS.accent : COLORS.ink, lineHeight: 1 }}>{match.homeScore}</span>
                  <span style={{ color: COLORS.inkMuted, fontSize: 32 }}>—</span>
                  <span style={{ fontFamily: FONT_DISPLAY, fontSize: "clamp(56px, 10vw, 96px)", color: awayWin ? COLORS.accent : COLORS.ink, lineHeight: 1 }}>{match.awayScore}</span>
                </div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: COLORS.inkMuted, letterSpacing: "0.2em", marginTop: 8 }}>FULL TIME</div>
              </div>
              <div className="col-span-5 text-left">
                <div style={{ fontFamily: FONT_DISPLAY, fontSize: "clamp(28px, 5vw, 48px)", color: awayWin ? COLORS.accent : COLORS.ink, lineHeight: 1, letterSpacing: "0.01em" }}>
                  {match.awayCaptain.toUpperCase()}'S XI
                </div>
              </div>
            </div>

            {/* Goals split */}
            <div className="grid grid-cols-12 gap-4 mt-8 pt-8" style={{ borderTop: `1px solid ${COLORS.line}` }}>
              <div className="col-span-6 text-right">
                {homeGoals.length === 0 ? (
                  <Italic>no goals</Italic>
                ) : homeGoals.map((g, i) => (
                  <div key={i} className="flex items-center justify-end gap-2" style={{ fontFamily: FONT_BODY, fontSize: 15, color: COLORS.ink, marginBottom: 4 }}>
                    <span>{goalLabel(g)}</span>
                    <Target size={12} style={{ color: COLORS.accent }} />
                  </div>
                ))}
              </div>
              <div className="col-span-6 text-left">
                {awayGoals.length === 0 ? (
                  <Italic>no goals</Italic>
                ) : awayGoals.map((g, i) => (
                  <div key={i} className="flex items-center gap-2" style={{ fontFamily: FONT_BODY, fontSize: 15, color: COLORS.ink, marginBottom: 4 }}>
                    <Target size={12} style={{ color: COLORS.accent }} />
                    <span>{goalLabel(g)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Lineups */}
          <div className="mt-6 p-6" style={{ background: COLORS.bg2, border: `1px solid ${COLORS.line}` }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: COLORS.inkMuted, letterSpacing: "0.2em", marginBottom: 16 }}>LINEUPS</div>
            <div className="grid grid-cols-2 gap-6">
              {[
                { label: match.homeCaptain, captain: match.homeCaptain, squad: match.homeSquad, ringers: match.homeRingers || [] },
                { label: match.awayCaptain, captain: match.awayCaptain, squad: match.awaySquad, ringers: match.awayRingers || [] },
              ].map((side, idx) => (
                <div key={idx}>
                  <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
                    <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, color: COLORS.ink }}>{side.label.toUpperCase()}'S XI</div>
                    <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: COLORS.inkMuted, letterSpacing: "0.15em" }}>
                      {side.squad.length + side.ringers.length}/7
                    </div>
                  </div>
                  {side.squad.length === 0 && side.ringers.length === 0 ? (
                    <Italic>No squad recorded.</Italic>
                  ) : (
                    <>
                      {side.squad.map((n) => (
                        <div key={n} className="flex items-center gap-2 mb-1" style={{ fontFamily: FONT_BODY, fontSize: 14, color: COLORS.ink }}>
                          {n === side.captain && <Star size={12} style={{ color: COLORS.accent, fill: COLORS.accent }} />}
                          {n}
                          {n === match.motm && <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.accent, letterSpacing: "0.15em", marginLeft: 4 }}>· MOTM</span>}
                        </div>
                      ))}
                      {side.ringers.map((r) => (
                        <div key={"r-" + r} className="flex items-center gap-2 mb-1" style={{ fontFamily: FONT_BODY, fontSize: 14, color: COLORS.inkMuted }}>
                          {r}
                          <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.attacker, letterSpacing: "0.15em", marginLeft: 4 }}>· RINGER</span>
                          {r === match.motm && <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.accent, letterSpacing: "0.15em", marginLeft: 4 }}>· MOTM</span>}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          {match.notes && (
            <div className="mt-6 p-6" style={{ background: COLORS.bg2, border: `1px solid ${COLORS.line}` }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: COLORS.inkMuted, letterSpacing: "0.2em", marginBottom: 12 }}>MATCH NOTES</div>
              <div style={{ fontFamily: FONT_SERIF, fontStyle: "italic", fontSize: 22, color: COLORS.ink, lineHeight: 1.4 }}>"{match.notes}"</div>
            </div>
          )}
        </div>

        {/* SIDEBAR */}
        <div className="col-span-12 lg:col-span-4 space-y-4">
          {/* MOTM */}
          <div className="p-6 relative overflow-hidden" style={{ background: COLORS.accent, color: "#000" }}>
            <div className="absolute -right-4 -bottom-6" style={{ fontFamily: FONT_DISPLAY, fontSize: 140, lineHeight: 1, color: "rgba(0,0,0,0.08)" }}>★</div>
            <div className="flex items-center gap-2 relative z-10">
              <Award size={14} strokeWidth={2.5} />
              <span style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.2em" }}>MAN OF THE MATCH</span>
            </div>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 56, lineHeight: 0.9, marginTop: 12, letterSpacing: "-0.01em" }} className="relative z-10">
              {match.motm ? match.motm.toUpperCase() : "—"}
            </div>
          </div>

          {/* Match facts */}
          <div className="p-6" style={{ background: COLORS.bg2, border: `1px solid ${COLORS.line}` }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: COLORS.inkMuted, letterSpacing: "0.2em", marginBottom: 16 }}>MATCH FACTS</div>
            {[
              ["Total goals", match.homeScore + match.awayScore],
              ["Goal difference", Math.abs(match.homeScore - match.awayScore)],
              ["Ringers used", (match.homeRingers || []).length + (match.awayRingers || []).length],
              ["Match-week", match.matchweek],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between py-2" style={{ borderBottom: `1px solid ${COLORS.lineSoft}` }}>
                <span style={{ fontFamily: FONT_BODY, fontSize: 13, color: COLORS.inkMuted }}>{k}</span>
                <span style={{ fontFamily: FONT_DISPLAY, fontSize: 22, color: COLORS.ink }}>{v}</span>
              </div>
            ))}
          </div>

          {/* Top scorer in this match */}
          {(() => {
            const scorerCounts = {};
            match.goals.forEach((g) => {
              if (g.isRinger) return;
              scorerCounts[g.scorer] = (scorerCounts[g.scorer] || 0) + 1;
            });
            const top = Object.entries(scorerCounts).sort((a, b) => b[1] - a[1])[0];
            if (!top) return null;
            return (
              <div className="p-6" style={{ background: COLORS.bg2, border: `1px solid ${COLORS.line}` }}>
                <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: COLORS.inkMuted, letterSpacing: "0.2em", marginBottom: 8 }}>TOP SCORER</div>
                <div style={{ fontFamily: FONT_DISPLAY, fontSize: 32, color: COLORS.ink, lineHeight: 1 }}>{top[0].toUpperCase()}</div>
                <div style={{ fontFamily: FONT_SERIF, fontStyle: "italic", fontSize: 16, color: COLORS.accent, marginTop: 4 }}>
                  {top[1]} {top[1] === 1 ? "goal" : "goals"}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </section>
  );
};

// ——————————————————————————————————————————————————————————————
// ADMIN — Match form (used for creating + editing)
// ——————————————————————————————————————————————————————————————
const newEmptyGoal = (team) => ({ team, scorer: "", assister: "", minute: "", isRinger: false, ringerName: "" });

// ——————————————————————————————————————————————————————————————
// TEAM ROSTER — squad chips + ringer input + 7-cap
// (defined outside MatchForm so its local input state survives re-renders)
// ——————————————————————————————————————————————————————————————
const SQUAD_LIMIT = 7;

const TeamRoster = ({ side, label, players, draft, toggleSquad, addRinger, removeRinger }) => {
  const squadKey   = side === "home" ? "homeSquad"   : "awaySquad";
  const ringersKey = side === "home" ? "homeRingers" : "awayRingers";
  const oppSquadKey = side === "home" ? "awaySquad"  : "homeSquad";
  const squad   = draft[squadKey] || [];
  const ringers = draft[ringersKey] || [];
  const total   = squad.length + ringers.length;
  const full    = total >= SQUAD_LIMIT;

  const [ringerInput, setRingerInput] = useState("");
  const [error, setError] = useState("");

  const handleAdd = () => {
    const trimmed = ringerInput.trim();
    if (!trimmed) return;
    if (full) { setError("Squad already full (7/7)."); return; }
    if (ringers.some((r) => r.toLowerCase() === trimmed.toLowerCase())) { setError("Ringer already added."); return; }
    if (players.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) { setError("That's a regular player — pick them in the squad above."); return; }
    if (addRinger(side, trimmed)) {
      setRingerInput("");
      setError("");
    }
  };

  return (
    <div>
      <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
        <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: COLORS.inkMuted, letterSpacing: "0.2em" }}>
          SQUAD · {label.toUpperCase()}
        </div>
        <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: full ? COLORS.attacker : COLORS.accent, letterSpacing: "0.15em" }}>
          {total}/{SQUAD_LIMIT} {full && "· FULL"}
        </div>
      </div>

      {/* Player chips */}
      <div className="flex flex-wrap gap-2 mb-5">
        {players.map((p) => {
          const checked = squad.includes(p.name);
          const isOpponent = (draft[oppSquadKey] || []).includes(p.name);
          const capLocked = full && !checked;
          const disabled = isOpponent || capLocked;
          return (
            <button
              key={p.name}
              type="button"
              onClick={() => !disabled && toggleSquad(side, p.name)}
              disabled={disabled}
              title={isOpponent ? "Already on the other team" : (capLocked ? "Squad full — remove someone first" : "")}
              style={{
                fontFamily: FONT_MONO, fontSize: 12, letterSpacing: "0.1em",
                padding: "6px 10px",
                background: checked ? COLORS.accent : "transparent",
                color: checked ? "#000" : (disabled ? COLORS.lineSoft : COLORS.ink),
                border: `1px solid ${checked ? COLORS.accent : COLORS.line}`,
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.4 : 1,
              }}
            >
              {p.name}
            </button>
          );
        })}
      </div>

      {/* Ringers */}
      <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: COLORS.inkMuted, letterSpacing: "0.2em", marginBottom: 8 }}>
        RINGERS · STAND-INS
      </div>
      <div className="flex gap-2 mb-2">
        <input
          type="text"
          placeholder={full ? "Squad full — remove someone first" : "Ringer name…"}
          value={ringerInput}
          onChange={(e) => { setRingerInput(e.target.value); setError(""); }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
          disabled={full}
          style={{ ...inputStyle, opacity: full ? 0.5 : 1 }}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={full || !ringerInput.trim()}
          style={{
            fontFamily: FONT_DISPLAY, fontSize: 13, letterSpacing: "0.1em",
            padding: "10px 18px",
            background: full || !ringerInput.trim() ? COLORS.bg3 : COLORS.accent,
            color:      full || !ringerInput.trim() ? COLORS.inkMuted : "#000",
            border: "none",
            cursor: full || !ringerInput.trim() ? "not-allowed" : "pointer",
            whiteSpace: "nowrap",
          }}
        >
          + ADD
        </button>
      </div>
      {error && (
        <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: COLORS.attacker, letterSpacing: "0.1em", marginBottom: 6 }}>
          {error.toUpperCase()}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mt-2">
        {ringers.length === 0 ? (
          <Italic size={13}>— no ringers added —</Italic>
        ) : ringers.map((r) => (
          <span
            key={r}
            className="inline-flex items-center gap-2"
            style={{
              fontFamily: FONT_MONO, fontSize: 12, letterSpacing: "0.1em",
              padding: "6px 10px",
              background: "transparent",
              color: COLORS.ink,
              border: `1px solid ${COLORS.attacker}`,
            }}
          >
            {r}
            <span style={{ fontSize: 9, color: COLORS.attacker, letterSpacing: "0.15em" }}>R</span>
            <button
              type="button"
              onClick={() => removeRinger(side, r)}
              style={{ background: "transparent", border: "none", color: COLORS.inkMuted, cursor: "pointer", padding: 0, display: "flex" }}
            >
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
};

const MatchForm = ({ players, match, onCancel, onSave, onDelete, nextMatchweek }) => {
  const isNew = !match;
  const [draft, setDraft] = useState(() => {
    const base = match || {
      id: "m" + Date.now(),
      matchweek: nextMatchweek,
      date: "",
      time: "20:00",
      pitch: "Powerleague",
      status: "scheduled",
      homeCaptain: players[0]?.name || "",
      awayCaptain: players[1]?.name || "",
      homeScore: 0,
      awayScore: 0,
      homeSquad: [],
      awaySquad: [],
      goals: [],
      motm: "",
      notes: "",
    };
    return {
      ...base,
      homeRingers: base.homeRingers || [],
      awayRingers: base.awayRingers || [],
    };
  });

  const update = (patch) => setDraft({ ...draft, ...patch });
  const updateGoal = (i, patch) => {
    const goals = draft.goals.slice();
    goals[i] = { ...goals[i], ...patch };
    update({ goals });
  };
  const addGoal = (team) => update({ goals: [...draft.goals, newEmptyGoal(team)] });
  const removeGoal = (i) => update({ goals: draft.goals.filter((_, idx) => idx !== i) });

  const toggleSquad = (side, name) => {
    const key = side === "home" ? "homeSquad" : "awaySquad";
    const ringersKey = side === "home" ? "homeRingers" : "awayRingers";
    const arr = draft[key];
    if (arr.includes(name)) {
      // remove
      update({ [key]: arr.filter((n) => n !== name) });
    } else {
      // add — but enforce 7-cap
      const total = arr.length + (draft[ringersKey] || []).length;
      if (total >= SQUAD_LIMIT) return;
      update({ [key]: [...arr, name] });
    }
  };

  const addRinger = (side, name) => {
    const ringersKey = side === "home" ? "homeRingers" : "awayRingers";
    const squadKey   = side === "home" ? "homeSquad"   : "awaySquad";
    const total = (draft[squadKey] || []).length + (draft[ringersKey] || []).length;
    if (total >= SQUAD_LIMIT) return false;
    update({ [ringersKey]: [...(draft[ringersKey] || []), name] });
    return true;
  };

  const removeRinger = (side, name) => {
    const ringersKey = side === "home" ? "homeRingers" : "awayRingers";
    // Also clear this ringer's name from any goals where they were credited
    const cleanedGoals = draft.goals.map((g) =>
      g.team === side && g.isRinger && g.ringerName === name
        ? { ...g, ringerName: "" }
        : g
    );
    setDraft({
      ...draft,
      [ringersKey]: (draft[ringersKey] || []).filter((r) => r !== name),
      goals: cleanedGoals,
    });
  };

  // Auto-derive scores from goals
  const derivedHome = draft.goals.filter((g) => g.team === "home").length;
  const derivedAway = draft.goals.filter((g) => g.team === "away").length;

  const save = () => {
    // Force scores to match goals length
    const finalised = {
      ...draft,
      homeScore: derivedHome,
      awayScore: derivedAway,
      // If completed, ensure captains are in their squads
      homeSquad: Array.from(new Set([...(draft.homeSquad || []), draft.homeCaptain].filter(Boolean))),
      awaySquad: Array.from(new Set([...(draft.awaySquad || []), draft.awayCaptain].filter(Boolean))),
      homeRingers: draft.homeRingers || [],
      awayRingers: draft.awayRingers || [],
    };
    onSave(finalised);
  };

  return (
    <div className="p-6" style={{ background: COLORS.bg2, border: `1px solid ${COLORS.line}` }}>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 28, color: COLORS.ink, letterSpacing: "0.02em" }}>
          {isNew ? "NEW MATCH" : `EDIT MATCH — MW ${String(draft.matchweek).padStart(2, "0")}`}
        </div>
        <div className="flex gap-2">
          {!isNew && onDelete && (
            <Btn variant="danger" onClick={() => { if (confirm("Delete this match?")) onDelete(draft.id); }}>
              <Trash2 size={12} style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />
              DELETE
            </Btn>
          )}
          <Btn variant="ghost" onClick={onCancel}>CANCEL</Btn>
          <Btn onClick={save}>SAVE →</Btn>
        </div>
      </div>

      {/* Basic */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Field label="Matchweek">
          <input type="number" value={draft.matchweek} onChange={(e) => update({ matchweek: parseInt(e.target.value) || 1 })} style={inputStyle} />
        </Field>
        <Field label="Date">
          <input type="date" value={draft.date} onChange={(e) => update({ date: e.target.value })} style={inputStyle} />
        </Field>
        <Field label="Time">
          <input type="time" value={draft.time} onChange={(e) => update({ time: e.target.value })} style={inputStyle} />
        </Field>
        <Field label="Pitch / Venue">
          <input type="text" value={draft.pitch} onChange={(e) => update({ pitch: e.target.value })} style={inputStyle} />
        </Field>
      </div>

      {/* Captains */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Field label="Home Captain">
          <select value={draft.homeCaptain} onChange={(e) => update({ homeCaptain: e.target.value })} style={inputStyle}>
            <option value="">— Select —</option>
            {players.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Away Captain">
          <select value={draft.awayCaptain} onChange={(e) => update({ awayCaptain: e.target.value })} style={inputStyle}>
            <option value="">— Select —</option>
            {players.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
          </select>
        </Field>
      </div>

      {/* Status */}
      <div className="mb-6">
        <Field label="Status">
          <div className="flex gap-2">
            {["scheduled", "completed"].map((s) => (
              <button key={s} onClick={() => update({ status: s })} style={{
                fontFamily: FONT_DISPLAY,
                fontSize: 13,
                letterSpacing: "0.1em",
                padding: "8px 16px",
                background: draft.status === s ? COLORS.accent : "transparent",
                color: draft.status === s ? "#000" : COLORS.ink,
                border: `1px solid ${draft.status === s ? COLORS.accent : COLORS.line}`,
                cursor: "pointer",
              }}>{s.toUpperCase()}</button>
            ))}
          </div>
        </Field>
      </div>

      {/* Goals (only meaningful if completed) */}
      {draft.status === "completed" && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: COLORS.inkMuted, letterSpacing: "0.2em" }}>
              GOALS · DERIVED SCORE: {derivedHome} — {derivedAway}
            </div>
            <div className="flex gap-2">
              <Btn variant="ghost" onClick={() => addGoal("home")}><Plus size={12} style={{ display: "inline", marginRight: 4 }} />HOME GOAL</Btn>
              <Btn variant="ghost" onClick={() => addGoal("away")}><Plus size={12} style={{ display: "inline", marginRight: 4 }} />AWAY GOAL</Btn>
            </div>
          </div>
          {draft.goals.length === 0 ? (
            <div className="p-4 text-center" style={{ background: COLORS.bg, border: `1px dashed ${COLORS.line}`, fontFamily: FONT_SERIF, fontStyle: "italic", color: COLORS.inkMuted }}>
              No goals recorded yet.
            </div>
          ) : (
            <div className="space-y-2">
              {draft.goals.map((g, i) => (
                <div key={i} className="p-3 grid grid-cols-12 gap-2 items-center" style={{ background: COLORS.bg, border: `1px solid ${COLORS.line}` }}>
                  <div className="col-span-12 md:col-span-1">
                    <span style={{
                      fontFamily: FONT_MONO, fontSize: 10, padding: "4px 8px",
                      background: g.team === "home" ? COLORS.bg3 : COLORS.bg3,
                      color: g.team === "home" ? COLORS.accent : COLORS.attacker,
                      letterSpacing: "0.15em",
                    }}>{g.team.toUpperCase()}</span>
                  </div>
                  <div className="col-span-6 md:col-span-3">
                    {g.isRinger ? (
                      (() => {
                        const teamRingers = g.team === "home" ? (draft.homeRingers || []) : (draft.awayRingers || []);
                        return (
                          <select value={g.ringerName || ""} onChange={(e) => updateGoal(i, { ringerName: e.target.value })} style={inputStyle}>
                            <option value="">{teamRingers.length === 0 ? "— Add ringers in lineup —" : "— Pick ringer —"}</option>
                            {teamRingers.map((r) => <option key={r} value={r}>{r}</option>)}
                          </select>
                        );
                      })()
                    ) : (
                      <select value={g.scorer} onChange={(e) => updateGoal(i, { scorer: e.target.value })} style={inputStyle}>
                        <option value="">— Scorer —</option>
                        {players.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
                      </select>
                    )}
                  </div>
                  <div className="col-span-6 md:col-span-3">
                    <select value={g.assister || ""} onChange={(e) => updateGoal(i, { assister: e.target.value || null })} style={inputStyle}>
                      <option value="">— Assist (optional) —</option>
                      {players.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
                      {(g.team === "home" ? (draft.homeRingers || []) : (draft.awayRingers || [])).map((r) => (
                        <option key={"r-" + r} value={r}>{r} (R)</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-4 md:col-span-2">
                    <input type="number" placeholder="Min" value={g.minute || ""} onChange={(e) => updateGoal(i, { minute: e.target.value })} style={inputStyle} />
                  </div>
                  <div className="col-span-6 md:col-span-2 flex items-center gap-2">
                    <label className="flex items-center gap-2 cursor-pointer" style={{ fontFamily: FONT_MONO, fontSize: 11, color: COLORS.inkMuted, letterSpacing: "0.1em" }}>
                      <input type="checkbox" checked={g.isRinger} onChange={(e) => updateGoal(i, { isRinger: e.target.checked, scorer: e.target.checked ? null : "", assister: e.target.checked ? null : "" })} />
                      RINGER
                    </label>
                  </div>
                  <div className="col-span-2 md:col-span-1 flex justify-end">
                    <button onClick={() => removeGoal(i)} style={{ background: "transparent", border: "none", color: COLORS.inkMuted, cursor: "pointer", padding: 4 }}><X size={16} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Squads + Ringers (only for completed) */}
      {draft.status === "completed" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <TeamRoster
            side="home"
            label={`${draft.homeCaptain || "Home"}'s XI`}
            players={players}
            draft={draft}
            toggleSquad={toggleSquad}
            addRinger={addRinger}
            removeRinger={removeRinger}
          />
          <TeamRoster
            side="away"
            label={`${draft.awayCaptain || "Away"}'s XI`}
            players={players}
            draft={draft}
            toggleSquad={toggleSquad}
            addRinger={addRinger}
            removeRinger={removeRinger}
          />
        </div>
      )}

      {/* MOTM + notes */}
      {draft.status === "completed" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
          <Field label="Man of the Match">
            <select value={draft.motm} onChange={(e) => update({ motm: e.target.value })} style={inputStyle}>
              <option value="">— Select —</option>
              {[...draft.homeSquad, ...draft.awaySquad].map((n) => <option key={n} value={n}>{n}</option>)}
              {[...(draft.homeRingers || []), ...(draft.awayRingers || [])].map((r) => (
                <option key={"r-" + r} value={r}>{r} (R)</option>
              ))}
            </select>
          </Field>
          <Field label="Match notes (optional)">
            <input type="text" value={draft.notes} onChange={(e) => update({ notes: e.target.value })} placeholder="One-liner from the night..." style={inputStyle} />
          </Field>
        </div>
      )}
    </div>
  );
};

// ────────────────────────────────────────────────
// ROSTER MANAGER
// ────────────────────────────────────────────────
const RosterManager = ({ players, addPlayer, updatePlayerRole, deletePlayer, onBack }) => {
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("Midfielder");
  const [busy, setBusy] = useState(false);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    const ok = await addPlayer(newName, newRole);
    setBusy(false);
    if (ok) { setNewName(""); setNewRole("Midfielder"); }
  };

  const handleRoleChange = async (name, currentRole) => {
    const order = ["Attacker", "Midfielder", "Defender"];
    const next = order[(order.indexOf(currentRole) + 1) % 3];
    await updatePlayerRole(name, next);
  };

  const handleDelete = async (name) => {
    if (!confirm(`Remove ${name} from the active roster?\n\nTheir match history will be preserved, but they won't appear in standings or fixtures anymore.`)) return;
    await deletePlayer(name);
  };

  const roleColor = (role) => role === "Attacker" ? COLORS.attacker : role === "Defender" ? COLORS.defender : COLORS.mid;
  const roleLabel = (role) => (role || "Midfielder").toUpperCase();

  return (
    <section className="max-w-[1400px] mx-auto px-6 md:px-10 py-10">
      <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
        <div>
          <SectionTag n={5} label="roster" />
          <HugeHeading>MANAGE ROSTER</HugeHeading>
          <Italic size={18} color={COLORS.inkMuted}>— {players.length} players on the books</Italic>
        </div>
        <Btn variant="ghost" onClick={onBack}>← BACK TO MATCHES</Btn>
      </div>

      {/* Add player form */}
      <div className="mb-10 p-6" style={{ background: COLORS.bg2, border: `1px solid ${COLORS.line}` }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: COLORS.inkMuted, letterSpacing: "0.2em", marginBottom: 14 }}>NEW PLAYER</div>
        <div className="grid gap-3" style={{ gridTemplateColumns: "2fr 1.2fr auto", alignItems: "end" }}>
          <div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: COLORS.inkMuted, marginBottom: 6, letterSpacing: "0.15em" }}>NAME</div>
            <input
              type="text"
              placeholder="e.g. Karim"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              style={{ ...inputStyle, padding: "10px 14px" }}
            />
          </div>
          <div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: COLORS.inkMuted, marginBottom: 6, letterSpacing: "0.15em" }}>ROLE</div>
            <select value={newRole} onChange={(e) => setNewRole(e.target.value)} style={{ ...inputStyle, padding: "10px 14px" }}>
              <option value="Attacker">Attacker</option>
              <option value="Midfielder">Midfielder</option>
              <option value="Defender">Defender</option>
            </select>
          </div>
          <Btn onClick={handleAdd} style={{ opacity: busy ? 0.5 : 1, whiteSpace: "nowrap" }}>{busy ? "ADDING…" : "ADD →"}</Btn>
        </div>
      </div>

      {/* Roster table */}
      <div style={{ borderTop: `1px solid ${COLORS.line}` }}>
        <div className="grid items-center px-4 py-3" style={{ gridTemplateColumns: "60px 1fr 180px 220px", borderBottom: `1px solid ${COLORS.line}`, fontFamily: FONT_MONO, fontSize: 11, color: COLORS.inkMuted, letterSpacing: "0.2em" }}>
          <div>#</div>
          <div>PLAYER</div>
          <div>ROLE</div>
          <div style={{ textAlign: "right" }}>ACTIONS</div>
        </div>
        {players.map((p, i) => (
          <div key={p.name} className="grid items-center px-4 py-4" style={{ gridTemplateColumns: "60px 1fr 180px 220px", borderBottom: `1px solid ${COLORS.line}` }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, color: COLORS.inkMuted }}>{String(i + 1).padStart(2, "0")}</div>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, letterSpacing: "0.02em" }}>{p.name.toUpperCase()}</div>
            <div>
              <span style={{ fontFamily: FONT_MONO, fontSize: 11, padding: "4px 8px", border: `1px solid ${roleColor(p.role)}`, color: roleColor(p.role), letterSpacing: "0.15em" }}>{roleLabel(p.role)}</span>
            </div>
            <div style={{ textAlign: "right" }}>
              <button onClick={() => handleRoleChange(p.name, p.role)} style={{ ...miniBtnStyle, marginRight: 6 }}>CHANGE ROLE</button>
              <button onClick={() => handleDelete(p.name)} style={{ ...miniBtnStyle, color: COLORS.attacker, borderColor: COLORS.attacker }}>DELETE</button>
            </div>
          </div>
        ))}
        {players.length === 0 && (
          <div style={{ padding: "60px 20px", textAlign: "center", color: COLORS.inkMuted, fontFamily: FONT_SERIF, fontStyle: "italic", fontSize: 18 }}>
            No players yet. Add the first one above.
          </div>
        )}
      </div>
    </section>
  );
};

const miniBtnStyle = {
  padding: "6px 10px",
  fontSize: 11,
  background: "transparent",
  color: "#f5ecd9",
  border: "1px solid #2a2a2a",
  fontFamily: "Anton, sans-serif",
  letterSpacing: "0.1em",
  cursor: "pointer",
};
// ——————————————————————————————————————————————————————————————
// ADMIN PANEL
// ——————————————————————————————————————————————————————————————
const Admin = ({ players, matches, setMatches, session, addPlayer, updatePlayerRole, deletePlayer }) => {
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [error, setError] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [view, setView] = useState("matches"); // "matches" or "roster"
  const [editingId, setEditingId] = useState(null);
  const [creatingNew, setCreatingNew] = useState(false);

  const attempt = async () => {
    if (!email || !pwd) { setError("Email and password required."); return; }
    setSigningIn(true);
    setError("");
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: pwd,
    });
    setSigningIn(false);
    if (signInError) {
      setError(signInError.message || "Login failed.");
      setPwd("");
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setEmail("");
    setPwd("");
    setError("");
  };

  const nextMatchweek = matches.length === 0 ? 1 : Math.max(...matches.map((m) => m.matchweek)) + 1;
  const currentMatch = matches.find((m) => m.id === editingId);

  const saveMatch = async (m) => {
  // Convert camelCase → snake_case for Supabase
  const dbRow = {
    id: m.id,
    matchweek: m.matchweek,
    date: m.date || null,
    time: m.time || null,
    pitch: m.pitch || null,
    status: m.status,
    home_captain: m.homeCaptain || null,
    away_captain: m.awayCaptain || null,
    home_score: m.homeScore || 0,
    away_score: m.awayScore || 0,
    home_squad: m.homeSquad || [],
    away_squad: m.awaySquad || [],
    home_ringers: m.homeRingers || [],
    away_ringers: m.awayRingers || [],
    goals: m.goals || [],
    motm: m.motm || null,
    notes: m.notes || null,
  };

  const { error } = await supabase
    .from("matches")
    .upsert(dbRow);

  if (error) {
    console.error("Failed to save match:", error);
    alert("Failed to save match — check console.");
    return;
  }

  // Update local state so the UI reflects the change immediately
  setMatches((prev) => {
    const exists = prev.find((x) => x.id === m.id);
    return exists ? prev.map((x) => x.id === m.id ? m : x) : [...prev, m];
  });
  setEditingId(null);
  setCreatingNew(false);
};

const deleteMatch = async (id) => {
  const { error } = await supabase
    .from("matches")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Failed to delete match:", error);
    alert("Failed to delete match — check console.");
    return;
  }

  setMatches((prev) => prev.filter((m) => m.id !== id));
  setEditingId(null);
};

  if (!session) {
    return (
      <section className="max-w-[1400px] mx-auto px-6 md:px-10 py-10">
        <div className="mb-8"><SectionTag n={5} /><HugeHeading>ADMIN ACCESS</HugeHeading></div>
        <div className="max-w-md p-8" style={{ background: COLORS.bg2, border: `1px solid ${COLORS.line}` }}>
          <div className="flex items-center gap-2 mb-6" style={{ color: COLORS.accent }}>
            <Lock size={16} />
            <span style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.2em" }}>RESTRICTED AREA</span>
          </div>
          <Italic size={18} color={COLORS.ink}>Sign in to manage matches</Italic>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(""); }}
            style={{ ...inputStyle, marginTop: 12, padding: "12px 16px" }}
          />
          <input
            type="password"
            placeholder="Password"
            value={pwd}
            onChange={(e) => { setPwd(e.target.value); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && attempt()}
            style={{ ...inputStyle, marginTop: 8, padding: "12px 16px", borderColor: error ? COLORS.attacker : COLORS.line }}
          />
          {error && <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: COLORS.attacker, marginTop: 8, letterSpacing: "0.1em" }}>{error.toUpperCase()}</div>}
          <div className="mt-4">
            <Btn onClick={attempt} style={{ width: "100%", padding: "12px", opacity: signingIn ? 0.6 : 1 }}>
              {signingIn ? "SIGNING IN…" : "SIGN IN →"}
            </Btn>
          </div>
          <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: COLORS.inkMuted, marginTop: 16, lineHeight: 1.5 }}>
            Real authentication via Supabase. Only authorised accounts can save changes.
          </p>
        </div>
      </section>
    );
  }

  // Editing or creating
  if (editingId || creatingNew) {
    return (
      <section className="max-w-[1400px] mx-auto px-6 md:px-10 py-10">
        <div className="mb-8"><SectionTag n={5} label="match editor" /><HugeHeading>{creatingNew ? "NEW FIXTURE" : "UPDATE MATCH"}</HugeHeading></div>
        <MatchForm
          players={players}
          match={creatingNew ? null : currentMatch}
          onCancel={() => { setEditingId(null); setCreatingNew(false); }}
          onSave={saveMatch}
          onDelete={deleteMatch}
          nextMatchweek={nextMatchweek}
        />
      </section>
    );
  }

  // If user clicked "Manage Roster", show that screen instead
  if (view === "roster") {
    return <RosterManager players={players} addPlayer={addPlayer} updatePlayerRole={updatePlayerRole} deletePlayer={deletePlayer} onBack={() => setView("matches")} />;
  }
  // Default admin dashboard
  const scheduled = matches.filter((m) => m.status === "scheduled");
  const completed = matches.filter((m) => m.status === "completed").slice().reverse();

  return (
    <section className="max-w-[1400px] mx-auto px-6 md:px-10 py-10">
      <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
        <div><SectionTag n={5} label="dashboard" /><HugeHeading>ADMIN DASHBOARD</HugeHeading></div>
        <div className="flex gap-2">
          <Btn variant="ghost" onClick={() => setView(view === "matches" ? "roster" : "matches")}>{view === "matches" ? "MANAGE ROSTER" : "← BACK TO MATCHES"}</Btn>
          <Btn variant="ghost" onClick={signOut}>SIGN OUT</Btn>
          <Btn onClick={() => setCreatingNew(true)}><Plus size={14} style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />NEW MATCH</Btn>
        </div>
        </div>

      {/* Scheduled fixtures */}
      <div className="mb-10">
        <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: COLORS.inkMuted, letterSpacing: "0.2em", marginBottom: 12 }}>SCHEDULED FIXTURES — UPDATE WHEN PLAYED</div>
        {scheduled.length === 0 ? (
          <EmptyPanel title="NOTHING SCHEDULED" sub="Hit 'New Match' to add the next fixture." />
        ) : (
          <div className="space-y-2">
            {scheduled.map((m) => (
              <div key={m.id} className="grid grid-cols-12 gap-3 items-center p-4" style={{ background: COLORS.bg2, border: `1px solid ${COLORS.line}` }}>
                <div className="col-span-12 md:col-span-2">
                  <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: COLORS.inkMuted, letterSpacing: "0.15em" }}>MW {String(m.matchweek).padStart(2, "0")}</div>
                  <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: COLORS.ink, marginTop: 2 }}>{formatDate(m.date).toUpperCase()}</div>
                </div>
                <div className="col-span-12 md:col-span-7">
                  <span style={{ fontFamily: FONT_DISPLAY, fontSize: 20, color: COLORS.ink }}>{m.homeCaptain.toUpperCase()}'S XI</span>
                  <Italic size={16}>  vs  </Italic>
                  <span style={{ fontFamily: FONT_DISPLAY, fontSize: 20, color: COLORS.ink }}>{m.awayCaptain.toUpperCase()}'S XI</span>
                </div>
                <div className="col-span-12 md:col-span-3 flex justify-end gap-2">
                  <Btn onClick={() => setEditingId(m.id)}><Edit3 size={12} style={{ display: "inline", marginRight: 4, verticalAlign: "middle" }} />UPDATE RESULT</Btn>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Completed matches */}
      <div>
        <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: COLORS.inkMuted, letterSpacing: "0.2em", marginBottom: 12 }}>COMPLETED MATCHES — EDIT IF NEEDED</div>
        {completed.length === 0 ? (
          <EmptyPanel title="NO RESULTS YET" sub="Logged matches will appear here." />
        ) : (
          <div className="space-y-2">
            {completed.map((m) => (
              <div key={m.id} className="grid grid-cols-12 gap-3 items-center p-4" style={{ background: COLORS.bg2, border: `1px solid ${COLORS.line}` }}>
                <div className="col-span-12 md:col-span-2">
                  <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: COLORS.inkMuted, letterSpacing: "0.15em" }}>MW {String(m.matchweek).padStart(2, "0")}</div>
                  <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: COLORS.ink, marginTop: 2 }}>{formatDate(m.date).toUpperCase()}</div>
                </div>
                <div className="col-span-12 md:col-span-7 flex items-center gap-3 flex-wrap">
                  <span style={{ fontFamily: FONT_DISPLAY, fontSize: 20, color: COLORS.ink }}>{m.homeCaptain.toUpperCase()}'S XI</span>
                  <span style={{ fontFamily: FONT_DISPLAY, fontSize: 22, color: COLORS.accent }}>{m.homeScore} — {m.awayScore}</span>
                  <span style={{ fontFamily: FONT_DISPLAY, fontSize: 20, color: COLORS.ink }}>{m.awayCaptain.toUpperCase()}'S XI</span>
                </div>
                <div className="col-span-12 md:col-span-3 flex justify-end gap-2">
                  <Btn variant="ghost" onClick={() => setEditingId(m.id)}><Edit3 size={12} style={{ display: "inline", marginRight: 4, verticalAlign: "middle" }} />EDIT</Btn>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

// ——————————————————————————————————————————————————————————————
// FOOTER
// ——————————————————————————————————————————————————————————————
const Footer = ({ players }) => (
  <footer className="border-t mt-10" style={{ borderColor: COLORS.line }}>
    <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-10 grid grid-cols-12 gap-6">
      <div className="col-span-12 md:col-span-6">
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 48, color: COLORS.ink, lineHeight: 0.9 }}>FRIDAY NIGHT<br />FOOTBALL.</div>
        <div style={{ fontFamily: FONT_SERIF, fontStyle: "italic", fontSize: 18, color: COLORS.inkMuted, marginTop: 8 }}>— playing regularly since September 2025.</div>
      </div>
      <div className="col-span-6 md:col-span-3">
        <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: COLORS.inkMuted, letterSpacing: "0.2em", marginBottom: 12 }}>SECTIONS</div>
        {["The Table", "Top Performers", "Fixtures", "Results"].map((s) => (
          <div key={s} style={{ fontFamily: FONT_BODY, fontSize: 14, color: COLORS.ink, marginBottom: 6 }}>{s}</div>
        ))}
      </div>
      <div className="col-span-6 md:col-span-3">
        <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: COLORS.inkMuted, letterSpacing: "0.2em", marginBottom: 12 }}>META</div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: COLORS.ink, marginBottom: 6 }}>Season 25/26</div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: COLORS.ink, marginBottom: 6 }}>{players.length} players</div>
      </div>
    </div>
    <div className="border-t py-4 px-6 md:px-10 max-w-[1400px] mx-auto flex justify-between flex-wrap gap-2"
      style={{ borderColor: COLORS.line, fontFamily: FONT_MONO, fontSize: 11, color: COLORS.inkMuted, letterSpacing: "0.15em" }}>
      <span>© FRIDAY NIGHT FOOTBALL — ALL OPINIONS IN THE GROUP CHAT ARE FINAL</span>
      <span>BUILT WITH ONE TOUCH.</span>
    </div>
  </footer>
);

// ——————————————————————————————————————————————————————————————
// APP
// ——————————————————————————————————————————————————————————————
export default function App() {
  useFonts();
  const [players, setPlayers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [tab, setTab] = useState("table");
  const [matchDetailId, setMatchDetailId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);

  // Fetch players + matches from Supabase when the app loads
  useEffect(() => {
    async function loadData() {
      const { data: playersData, error: playersError } = await supabase
        .from("players")
        .select("*")
        .order("id");

      const { data: matchesData, error: matchesError } = await supabase
        .from("matches")
        .select("*")
        .order("matchweek", { ascending: true });

      if (playersError) console.error("Failed to load players:", playersError);
      if (matchesError) console.error("Failed to load matches:", matchesError);

      // Convert DB column names (snake_case) → JS field names (camelCase)
      const normalisedMatches = (matchesData || []).map((m) => ({
        id: m.id,
        matchweek: m.matchweek,
        date: m.date,
        time: m.time,
        pitch: m.pitch,
        status: m.status,
        homeCaptain: m.home_captain,
        awayCaptain: m.away_captain,
        homeScore: m.home_score,
        awayScore: m.away_score,
        homeSquad: m.home_squad || [],
        awaySquad: m.away_squad || [],
        homeRingers: m.home_ringers || [],
        awayRingers: m.away_ringers || [],
        goals: m.goals || [],
        motm: m.motm,
        notes: m.notes,
      }));

      setPlayers(playersData || []);
      setMatches(normalisedMatches);
      setLoading(false);
    }
    loadData();
  }, []);
  // Track Supabase auth session (login/logout)
useEffect(() => {
  supabase.auth.getSession().then(({ data: { session } }) => {
    setSession(session);
  });

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    setSession(session);
  });

  return () => subscription.unsubscribe();
}, []);

  const standings = useMemo(() => getStandings(players, matches), [players, matches]);
  const detailMatch = matchDetailId ? matches.find((m) => m.id === matchDetailId) : null;

  // ────────────────────────────────────────────────
  // PLAYER MANAGEMENT — talks to Supabase
  // ────────────────────────────────────────────────
  async function addPlayer(name, role) {
    const trimmed = name.trim();
    if (!trimmed) { alert("Player name is required."); return false; }
    if (players.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
      alert("A player with that name already exists.");
      return false;
    }
    const { data, error } = await supabase
      .from("players")
      .insert([{ name: trimmed, role }])
      .select()
      .single();
    if (error) { alert("Failed to add player: " + error.message); return false; }
    setPlayers([...players, data]);
    return true;
  }

  async function updatePlayerRole(name, newRole) {
    const { error } = await supabase
      .from("players")
      .update({ role: newRole })
      .eq("name", name);
    if (error) { alert("Failed to update role: " + error.message); return false; }
    setPlayers(players.map((p) => p.name === name ? { ...p, role: newRole } : p));
    return true;
  }

  async function deletePlayer(name) {
    // History is preserved — old matches still show their lineups, goals, assists.
    // We just remove them from the active roster.
    const { error } = await supabase.from("players").delete().eq("name", name);
    if (error) { alert("Failed to delete player: " + error.message); return false; }
    setPlayers(players.filter((p) => p.name !== name));
    return true;
  }
  // Reset detail view when changing tab
  useEffect(() => { setMatchDetailId(null); }, [tab]);

  return (
    <div className="min-h-screen w-full" style={{ background: COLORS.bg, color: COLORS.ink, fontFamily: FONT_BODY }}>
      <Grain />
      <Ticker players={players} matches={matches} />
      <Header tab={tab} setTab={setTab} matches={matches} />

      {detailMatch ? (
        <MatchDetail match={detailMatch} onBack={() => setMatchDetailId(null)} />
      ) : (
        <>
          {tab === "table" && (<><Hero players={players} matches={matches} standings={standings} /><LeagueTable standings={standings} matches={matches} /></>)}
          {tab === "top performers" && <TopPerformers standings={standings} matches={matches} />}
          {tab === "fixtures" && <Fixtures matches={matches} />}
          {tab === "results" && <Results matches={matches} onOpenMatch={(id) => setMatchDetailId(id)} />}
          {tab === "admin" && <Admin players={players} matches={matches} setMatches={setMatches} session={session} addPlayer={addPlayer} updatePlayerRole={updatePlayerRole} deletePlayer={deletePlayer} />}
        </>
      )}

      <Footer players={players} />
    </div>
  );
}