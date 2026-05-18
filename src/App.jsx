import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "./supabaseClient";
import {
  Trophy, Target, Zap, Shield, ArrowUpRight, ArrowLeft, ArrowRight,
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
// STATS
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
      const adA = A.g - 0, adB = B.g - 0;
      if (adB !== adA) return adB - adA;
      return (B.g + B.a) - (A.g + A.a);
    });
}

// ——————————————————————————————————————————————————————————————
// PLAYER PROFILE STATS — universal helpers
// ——————————————————————————————————————————————————————————————
function getPlayerMatchHistory(playerName, matches) {
  const history = [];
  for (const m of matches) {
    if (m.status !== "completed") continue;
    const inHome = m.homeSquad.includes(playerName);
    const inAway = m.awaySquad.includes(playerName);
    if (!inHome && !inAway) continue;

    const forScore = inHome ? m.homeScore : m.awayScore;
    const agScore  = inHome ? m.awayScore : m.homeScore;
    let result;
    if (forScore > agScore) result = "W";
    else if (forScore === agScore) result = "D";
    else result = "L";

    let goals = 0, assists = 0;
    for (const g of m.goals) {
      if (!g.isRinger && g.scorer === playerName) goals++;
      if (g.assister === playerName) assists++;
    }

    const teammates = (inHome ? m.homeSquad : m.awaySquad).filter((n) => n !== playerName);
    const opponents = inHome ? m.awaySquad : m.homeSquad;
    const isCaptain = (inHome && m.homeCaptain === playerName) || (inAway && m.awayCaptain === playerName);

    history.push({
      match: m,
      side: inHome ? "home" : "away",
      forScore,
      agScore,
      result,
      goals,
      assists,
      isCaptain,
      teammates,
      opponents,
    });
  }
  return history.sort((a, b) => b.match.matchweek - a.match.matchweek);
}

function getRecentForm(history) {
  return history.slice(0, 5).reverse().map((h) => h.result);
}

function getAttendance(history, matches) {
  const totalCompleted = matches.filter((m) => m.status === "completed").length;
  if (totalCompleted === 0) return { pct: 0, played: 0, total: 0 };
  const played = history.length;
  return {
    pct: Math.round(100 * played / totalCompleted),
    played,
    total: totalCompleted,
  };
}

function getChemistry(playerName, history) {
  const partnerStats = {};
  const opponentStats = {};

  for (const h of history) {
    for (const t of h.teammates) {
      if (!partnerStats[t]) partnerStats[t] = { games: 0, wins: 0, losses: 0, draws: 0 };
      partnerStats[t].games++;
      if (h.result === "W") partnerStats[t].wins++;
      else if (h.result === "L") partnerStats[t].losses++;
      else partnerStats[t].draws++;
    }
    for (const o of h.opponents) {
      if (!opponentStats[o]) opponentStats[o] = { games: 0, wins: 0, losses: 0, draws: 0 };
      opponentStats[o].games++;
      if (h.result === "W") opponentStats[o].wins++;
      else if (h.result === "L") opponentStats[o].losses++;
      else opponentStats[o].draws++;
    }
  }

  const partnerCandidates = Object.entries(partnerStats).filter(([_, s]) => s.games >= 2);
  partnerCandidates.sort((a, b) => {
    const rateA = a[1].wins / a[1].games;
    const rateB = b[1].wins / b[1].games;
    if (rateB !== rateA) return rateB - rateA;
    return b[1].games - a[1].games;
  });
  const best = partnerCandidates[0]
    ? { name: partnerCandidates[0][0], ...partnerCandidates[0][1] }
    : null;

  const oppCandidates = Object.entries(opponentStats).filter(([_, s]) => s.games >= 2);
  oppCandidates.sort((a, b) => {
    const rateA = a[1].wins / a[1].games;
    const rateB = b[1].wins / b[1].games;
    if (rateA !== rateB) return rateA - rateB;
    return b[1].losses - a[1].losses;
  });
  const nemesis = oppCandidates[0] && (oppCandidates[0][1].losses > 0 || oppCandidates[0][1].wins === 0)
    ? { name: oppCandidates[0][0], ...oppCandidates[0][1] }
    : null;

  return { best, nemesis };
}

function getStandoutMatches(history) {
  if (history.length === 0) return { best: null, worst: null };

  const scored = history.map((h) => ({
    h,
    contribution: h.goals + h.assists,
    resultScore: h.result === "W" ? 2 : h.result === "D" ? 1 : 0,
  }));

  const best = [...scored].sort((a, b) => {
    if (b.contribution !== a.contribution) return b.contribution - a.contribution;
    if (b.resultScore !== a.resultScore) return b.resultScore - a.resultScore;
    return (b.h.forScore - b.h.agScore) - (a.h.forScore - a.h.agScore);
  })[0]?.h;

  const worst = [...scored].sort((a, b) => {
    if (a.contribution !== b.contribution) return a.contribution - b.contribution;
    if (a.resultScore !== b.resultScore) return a.resultScore - b.resultScore;
    return (a.h.forScore - a.h.agScore) - (b.h.forScore - b.h.agScore);
  })[0]?.h;

  if (history.length === 1) return { best, worst: null };
  return { best, worst };
}

// ——————————————————————————————————————————————————————————————
// ROLE-SPECIFIC STATS
// ——————————————————————————————————————————————————————————————
function getAttackerStats(history) {
  if (history.length === 0) return null;
  const goals   = history.reduce((s, h) => s + h.goals,   0);
  const assists = history.reduce((s, h) => s + h.assists, 0);
  const mp      = history.length;
  const teamGoalsTotal = history.reduce((s, h) => s + h.forScore, 0);
  const involvement = teamGoalsTotal > 0
    ? Math.round(100 * (goals + assists) / teamGoalsTotal)
    : 0;
  return {
    goals,
    assists,
    gPlusA: goals + assists,
    gPlusAPerGame: mp > 0 ? ((goals + assists) / mp).toFixed(2) : "0.00",
    goalInvolvement: involvement,
  };
}

function getMidfielderStats(history) {
  if (history.length === 0) return null;
  const goals   = history.reduce((s, h) => s + h.goals,   0);
  const assists = history.reduce((s, h) => s + h.assists, 0);
  const mp      = history.length;
  const wins    = history.filter((h) => h.result === "W").length;
  const draws   = history.filter((h) => h.result === "D").length;
  const unbeatenPct = mp > 0 ? Math.round(100 * (wins + draws) / mp) : 0;

  const captainGames = history.filter((h) => h.isCaptain);
  const captainWins  = captainGames.filter((h) => h.result === "W").length;
  const captainWinPct = captainGames.length > 0
    ? Math.round(100 * captainWins / captainGames.length)
    : null;

  return {
    assists,
    goals,
    gPlusA: goals + assists,
    unbeatenPct,
    captainWinPct,
    captainGames: captainGames.length,
  };
}

function getDefenderStats(playerName, history, allPlayers, allMatches) {
  if (history.length === 0) return null;
  const goals   = history.reduce((s, h) => s + h.goals,   0);
  const assists = history.reduce((s, h) => s + h.assists, 0);
  const mp      = history.length;
  const totalConceded   = history.reduce((s, h) => s + h.agScore, 0);
  const concededPerGame = mp > 0 ? (totalConceded / mp).toFixed(2) : "0.00";
  const cleanSheets     = history.filter((h) => h.agScore === 0).length;

  let unbeatenRun = 0;
  for (const h of history) {
    if (h.result === "L") break;
    unbeatenRun++;
  }

  const wins  = history.filter((h) => h.result === "W").length;
  const draws = history.filter((h) => h.result === "D").length;
  const unbeatenPct = mp > 0 ? Math.round(100 * (wins + draws) / mp) : 0;

  const isFortress = (() => {
    if (mp < 3) return false;
    const defenders = (allPlayers || []).filter((p) => p.role === "Defender");
    const rates = [];
    for (const d of defenders) {
      const dh = getPlayerMatchHistory(d.name, allMatches);
      if (dh.length < 3) continue;
      const conc = dh.reduce((s, h) => s + h.agScore, 0);
      rates.push(conc / dh.length);
    }
    if (rates.length === 0) return false;
    const lowest = Math.min(...rates);
    const myRate = totalConceded / mp;
    return Math.abs(myRate - lowest) < 0.001;
  })();

  return {
    concededPerGame,
    totalConceded,
    cleanSheets,
    unbeatenRun,
    isFortress,
    goals,
    assists,
    gPlusA: goals + assists,
    unbeatenPct,
  };
}

// ——————————————————————————————————————————————————————————————
// HEAD-TO-HEAD HELPERS (Step 6 — Player Comparison)
// ——————————————————————————————————————————————————————————————

// Matches where p1 and p2 were on OPPOSITE sides. Result is from p1's perspective.
function getH2H(p1Name, p2Name, matches) {
  const list = [];
  for (const m of matches) {
    if (m.status !== "completed") continue;
    const p1Home = m.homeSquad.includes(p1Name);
    const p1Away = m.awaySquad.includes(p1Name);
    const p2Home = m.homeSquad.includes(p2Name);
    const p2Away = m.awaySquad.includes(p2Name);
    if (!(p1Home || p1Away) || !(p2Home || p2Away)) continue;
    const opposite = (p1Home && p2Away) || (p1Away && p2Home);
    if (!opposite) continue;

    const p1For = p1Home ? m.homeScore : m.awayScore;
    const p1Ag  = p1Home ? m.awayScore : m.homeScore;

    let p1Goals = 0, p1Assists = 0, p2Goals = 0, p2Assists = 0;
    for (const g of m.goals) {
      if (!g.isRinger && g.scorer === p1Name) p1Goals++;
      if (g.assister === p1Name) p1Assists++;
      if (!g.isRinger && g.scorer === p2Name) p2Goals++;
      if (g.assister === p2Name) p2Assists++;
    }

    let result;
    if (p1For > p1Ag) result = "W";
    else if (p1For === p1Ag) result = "D";
    else result = "L";

    list.push({
      match: m,
      p1Side: p1Home ? "home" : "away",
      p1For, p1Ag,
      result,
      p1Goals, p1Assists, p2Goals, p2Assists,
    });
  }
  return list.sort((a, b) => b.match.matchweek - a.match.matchweek);
}

// Matches where p1 and p2 were on the SAME side.
function getTogether(p1Name, p2Name, matches) {
  const list = [];
  for (const m of matches) {
    if (m.status !== "completed") continue;
    const p1Home = m.homeSquad.includes(p1Name);
    const p1Away = m.awaySquad.includes(p1Name);
    const p2Home = m.homeSquad.includes(p2Name);
    const p2Away = m.awaySquad.includes(p2Name);
    const sameHome = p1Home && p2Home;
    const sameAway = p1Away && p2Away;
    if (!sameHome && !sameAway) continue;

    const forScore = sameHome ? m.homeScore : m.awayScore;
    const agScore  = sameHome ? m.awayScore : m.homeScore;
    let result;
    if (forScore > agScore) result = "W";
    else if (forScore === agScore) result = "D";
    else result = "L";

    list.push({ match: m, forScore, agScore, result });
  }
  return list.sort((a, b) => b.match.matchweek - a.match.matchweek);
}

// Summarise a list of matches into W/D/L counts.
function summariseRecord(list) {
  const w = list.filter((x) => x.result === "W").length;
  const d = list.filter((x) => x.result === "D").length;
  const l = list.filter((x) => x.result === "L").length;
  return { w, d, l, total: list.length };
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

const FormDot = ({ result, size = 12 }) => {
  const colour =
    result === "W" ? COLORS.accent :
    result === "L" ? COLORS.attacker :
    COLORS.inkMuted;
  return (
    <span
      title={result}
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: "50%",
        background: colour,
        marginRight: 6,
      }}
    />
  );
};

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

const formatDate = (iso) => {
  if (!iso) return "TBC";
  try {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  } catch { return iso; }
};

// ——————————————————————————————————————————————————————————————
// ROLE STAT BLOCKS — used inside player profile
// ——————————————————————————————————————————————————————————————
const RoleStatBlock = ({ title, subtitle, stats }) => (
  <div className="mb-12">
    <div className="mb-6">
      <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: COLORS.accent, letterSpacing: "0.2em" }}>
        / ROLE STATS
      </div>
      <HugeHeading>{title}</HugeHeading>
      {subtitle && <div className="mt-2"><Italic>{subtitle}</Italic></div>}
    </div>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((s, i) => {
        const isHero = i === 0;
        return (
          <div
            key={s.label}
            className="p-6 relative"
            style={{
              background: COLORS.bg2,
              border: `1px solid ${isHero ? COLORS.accent : COLORS.line}`,
              minHeight: 130,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: COLORS.inkMuted, letterSpacing: "0.2em" }}>
                {s.label}
              </span>
              {s.tag && (
                <span style={{
                  fontFamily: FONT_MONO, fontSize: 9, color: COLORS.accent,
                  letterSpacing: "0.2em", padding: "2px 6px",
                  border: `1px solid ${COLORS.accent}`,
                }}>
                  ★ {s.tag}
                </span>
              )}
            </div>
            <div style={{
              fontFamily: FONT_DISPLAY,
              fontSize: isHero ? 64 : 40,
              color: s.value === "—" ? COLORS.inkMuted : (isHero ? COLORS.accent : COLORS.ink),
              lineHeight: 1,
            }}>
              {s.value}
            </div>
            {s.sub && (
              <div style={{
                fontFamily: FONT_SERIF, fontStyle: "italic", fontSize: 14,
                color: COLORS.inkMuted, marginTop: 8,
              }}>
                {s.sub}
              </div>
            )}
          </div>
        );
      })}
    </div>
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
// HEADER — adds "compare" tab between "top performers" and "fixtures"
// ——————————————————————————————————————————————————————————————
const Header = ({ tab, setTab, matches }) => {
  const tabs = ["table", "top performers", "compare", "fixtures", "results", "admin"];
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
const LeagueTable = ({ standings, matches, onOpenPlayer }) => {
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
                    <button
                      onClick={() => onOpenPlayer && onOpenPlayer(p.id)}
                      style={{
                        fontFamily: FONT_DISPLAY,
                        fontSize: 22,
                        color: COLORS.ink,
                        letterSpacing: "0.02em",
                        background: "transparent",
                        border: "none",
                        padding: 0,
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "color 150ms",
                      }}
                      onMouseOver={(e) => (e.currentTarget.style.color = COLORS.accent)}
                      onMouseOut={(e) => (e.currentTarget.style.color = COLORS.ink)}
                    >
                      {p.name.toUpperCase()}
                    </button>
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
// PLAYER PROFILE — with role-specific stat blocks
// ——————————————————————————————————————————————————————————————
const PerformanceCard = ({ h, flavour, onOpenMatch }) => {
  if (!h) {
    return (
      <div className="p-6" style={{ background: COLORS.bg2, border: `1px solid ${COLORS.line}` }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: COLORS.inkMuted, letterSpacing: "0.2em" }}>
          {flavour === "best" ? "★ BEST" : "▼ WORST"}
        </div>
        <div style={{ marginTop: 8 }}><Italic size={16}>Not enough matches yet.</Italic></div>
      </div>
    );
  }
  const tagColor = flavour === "best" ? COLORS.accent : COLORS.attacker;
  const tagLabel = flavour === "best" ? "★ BEST" : "▼ WORST";
  const m = h.match;
  const oppCaptain = h.side === "home" ? m.awayCaptain : m.homeCaptain;
  const resultText = h.result === "W" ? "WIN" : h.result === "D" ? "DRAW" : "LOSS";
  const contribution = h.goals + h.assists;
  const contributionText = contribution === 0
    ? "no goal involvement"
    : `${h.goals > 0 ? `${h.goals} goal${h.goals === 1 ? "" : "s"}` : ""}${h.goals > 0 && h.assists > 0 ? ", " : ""}${h.assists > 0 ? `${h.assists} assist${h.assists === 1 ? "" : "s"}` : ""}`;

  return (
    <button
      onClick={() => onOpenMatch && onOpenMatch(m.id)}
      className="w-full text-left p-6 transition-colors"
      style={{ background: COLORS.bg2, border: `1px solid ${COLORS.line}`, cursor: "pointer" }}
      onMouseOver={(e) => (e.currentTarget.style.borderColor = tagColor)}
      onMouseOut={(e) => (e.currentTarget.style.borderColor = COLORS.line)}
    >
      <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: tagColor, letterSpacing: "0.2em" }}>{tagLabel}</div>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 26, color: COLORS.ink, marginTop: 8, lineHeight: 1 }}>
        MW {String(m.matchweek).padStart(2, "0")} · {formatDate(m.date).toUpperCase()}
      </div>
      <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: COLORS.inkMuted, marginTop: 6 }}>
        vs {oppCaptain.toUpperCase()}'S XI · {h.forScore}—{h.agScore} {resultText}
      </div>
      <div style={{ fontFamily: FONT_SERIF, fontStyle: "italic", fontSize: 17, color: COLORS.ink, marginTop: 10, lineHeight: 1.4 }}>
        — {contributionText}.
      </div>
    </button>
  );
};

const RoleBlocks = ({ player, history, allPlayers, allMatches }) => {
  if (history.length === 0) {
    return (
      <div className="mb-12 p-8" style={{ background: COLORS.bg2, border: `1px dashed ${COLORS.line}` }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: COLORS.inkMuted, letterSpacing: "0.2em", marginBottom: 8 }}>
          / ROLE STATS
        </div>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 32, color: COLORS.ink, lineHeight: 1 }}>
          NO DATA YET
        </div>
        <div style={{ fontFamily: FONT_SERIF, fontStyle: "italic", fontSize: 16, color: COLORS.inkMuted, marginTop: 8 }}>
          — stats kick in once they take the pitch.
        </div>
      </div>
    );
  }

  if (player.role === "Attacker") {
    const s = getAttackerStats(history);
    return (
      <RoleStatBlock
        title="SCORING"
        subtitle="— how often the net bulges with him on the pitch."
        stats={[
          { label: "GOALS",            value: s.goals },
          { label: "ASSISTS",          value: s.assists },
          { label: "G+A / GAME",       value: s.gPlusAPerGame },
          { label: "GOAL INVOLVEMENT", value: `${s.goalInvolvement}%`, sub: "of team's goals" },
        ]}
      />
    );
  }

  if (player.role === "Midfielder") {
    const s = getMidfielderStats(history);
    return (
      <RoleStatBlock
        title="PLAYMAKING"
        subtitle="— the engine room. Sets the tempo, picks the pass."
        stats={[
          { label: "ASSISTS",      value: s.assists },
          { label: "G+A",          value: s.gPlusA },
          { label: "UNBEATEN %",   value: `${s.unbeatenPct}%`, sub: "wins + draws" },
          {
            label: "CAPTAIN W%",
            value: s.captainWinPct === null ? "—" : `${s.captainWinPct}%`,
            sub: s.captainGames > 0 ? `${s.captainGames} as captain` : "never captained",
          },
        ]}
      />
    );
  }

  const s = getDefenderStats(player.name, history, allPlayers, allMatches);
  return (
    <>
      <RoleStatBlock
        title="DEFENSIVE"
        subtitle="— the bread and butter. Shutting it down at the back."
        stats={[
          {
            label: "CONCEDED / GAME",
            value: s.concededPerGame,
            tag: s.isFortress ? "FORTRESS" : null,
            sub: s.isFortress ? "league's tightest" : null,
          },
          { label: "TOTAL CONCEDED", value: s.totalConceded },
          { label: "CLEAN SHEETS",   value: s.cleanSheets },
          { label: "UNBEATEN RUN",   value: s.unbeatenRun, sub: s.unbeatenRun === 0 ? "lost last out" : `last ${s.unbeatenRun} unbeaten` },
        ]}
      />
      <RoleStatBlock
        title="ATTACKING"
        subtitle="— when he chips in up the other end."
        stats={[
          { label: "GOALS",       value: s.goals },
          { label: "ASSISTS",     value: s.assists },
          { label: "G+A",         value: s.gPlusA },
          { label: "UNBEATEN %",  value: `${s.unbeatenPct}%`, sub: "wins + draws" },
        ]}
      />
    </>
  );
};

const PlayerProfile = ({ player, players, matches, onBack, onOpenMatch }) => {
  if (!player) return null;
  const stats = computeStats(player.name, matches);
  const idx = players.findIndex((p) => p.id === player.id);
  const totalPlayers = players.length;
  const RoleIcon = roleIcon(player.role);

  const history    = useMemo(() => getPlayerMatchHistory(player.name, matches), [player.name, matches]);
  const recentForm = useMemo(() => getRecentForm(history),                       [history]);
  const attendance = useMemo(() => getAttendance(history, matches),              [history, matches]);
  const chemistry  = useMemo(() => getChemistry(player.name, history),           [player.name, history]);
  const standouts  = useMemo(() => getStandoutMatches(history),                  [history]);

  const hasData = history.length > 0;

  return (
    <section className="max-w-[1400px] mx-auto px-6 md:px-10 py-10">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-10">
        <button
          onClick={onBack}
          style={{
            fontFamily: FONT_MONO, fontSize: 12, color: COLORS.inkMuted,
            letterSpacing: "0.15em", background: "transparent", border: "none",
            cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 8,
          }}
          onMouseOver={(e) => (e.currentTarget.style.color = COLORS.ink)}
          onMouseOut={(e) => (e.currentTarget.style.color = COLORS.inkMuted)}
        >
          <ArrowLeft size={14} />
          BACK TO TABLE
        </button>
        <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: COLORS.inkMuted, letterSpacing: "0.2em" }}>
          / PLAYER PROFILE · {String(idx + 1).padStart(2, "0")} OF {String(totalPlayers).padStart(2, "0")}
        </div>
      </div>

      <div className="flex items-start justify-between flex-wrap gap-6 mb-8">
        <div style={{ flex: 1, minWidth: 280 }}>
          <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: "clamp(56px, 9vw, 96px)", lineHeight: 0.9, color: COLORS.ink, letterSpacing: "-0.01em" }}>
            {player.name.toUpperCase()}
          </h1>
          {player.nickname && (
            <div style={{ fontFamily: FONT_SERIF, fontStyle: "italic", fontSize: 22, color: COLORS.inkMuted, marginTop: 8 }}>
              — "{player.nickname}"
            </div>
          )}
        </div>
        <div style={{ textAlign: "right", paddingTop: 12 }}>
          <span className="inline-flex items-center gap-2 px-3 py-1.5" style={{ border: `1px solid ${roleColor(player.role)}`, color: roleColor(player.role), fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.15em" }}>
            <RoleIcon size={12} />
            {player.role.toUpperCase()}
          </span>
          <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: COLORS.inkMuted, letterSpacing: "0.15em", marginTop: 12 }}>
            JOINED · SEP '25
          </div>
        </div>
      </div>

      <div
        className="grid grid-cols-1 md:grid-cols-3 gap-6 py-6 mb-12"
        style={{ borderTop: `1px solid ${COLORS.line}`, borderBottom: `1px solid ${COLORS.line}` }}
      >
        <div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: COLORS.inkMuted, letterSpacing: "0.2em", marginBottom: 8 }}>LAST 5</div>
          {recentForm.length === 0 ? (
            <Italic size={16}>— no matches yet</Italic>
          ) : (
            <div style={{ display: "flex", alignItems: "center" }}>
              {recentForm.map((r, i) => <FormDot key={i} result={r} size={14} />)}
            </div>
          )}
        </div>
        <div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: COLORS.inkMuted, letterSpacing: "0.2em", marginBottom: 8 }}>ATTENDANCE</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 36, color: attendance.played === 0 ? COLORS.inkMuted : COLORS.accent, lineHeight: 1 }}>
              {attendance.pct}%
            </span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: COLORS.inkMuted }}>
              {attendance.played}/{attendance.total}
            </span>
          </div>
        </div>
        <div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: COLORS.inkMuted, letterSpacing: "0.2em", marginBottom: 8 }}>RECORD</div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 36, color: COLORS.ink, lineHeight: 1 }}>
            {stats.w}<span style={{ color: COLORS.inkMuted, fontSize: 22 }}> · </span>{stats.d}<span style={{ color: COLORS.inkMuted, fontSize: 22 }}> · </span>{stats.l}
          </div>
        </div>
      </div>

      <RoleBlocks player={player} history={history} allPlayers={players} allMatches={matches} />

      <div className="mb-12">
        <div className="mb-6">
          <SectionTag n={2} />
          <HugeHeading>CHEMISTRY</HugeHeading>
        </div>
        {!hasData ? (
          <EmptyPanel title="NO DATA YET" sub="Chemistry unlocks after a few games together." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-6" style={{ background: COLORS.bg2, border: `1px solid ${COLORS.line}` }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: COLORS.inkMuted, letterSpacing: "0.2em" }}>BEST PARTNER</div>
              {chemistry.best ? (
                <>
                  <div style={{ fontFamily: FONT_DISPLAY, fontSize: 42, color: COLORS.ink, lineHeight: 1, marginTop: 8 }}>
                    {chemistry.best.name.toUpperCase()}
                  </div>
                  <div style={{ fontFamily: FONT_SERIF, fontStyle: "italic", fontSize: 15, color: COLORS.inkMuted, marginTop: 6 }}>
                    — {chemistry.best.wins}W {chemistry.best.draws}D {chemistry.best.losses}L together · {Math.round(100 * chemistry.best.wins / chemistry.best.games)}% win rate
                  </div>
                </>
              ) : (
                <div style={{ marginTop: 8 }}><Italic size={16}>Not enough shared games yet.</Italic></div>
              )}
            </div>
            <div className="p-6" style={{ background: COLORS.bg2, border: `1px solid ${COLORS.line}` }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: COLORS.inkMuted, letterSpacing: "0.2em" }}>NEMESIS</div>
              {chemistry.nemesis ? (
                <>
                  <div style={{ fontFamily: FONT_DISPLAY, fontSize: 42, color: COLORS.attacker, lineHeight: 1, marginTop: 8 }}>
                    {chemistry.nemesis.name.toUpperCase()}
                  </div>
                  <div style={{ fontFamily: FONT_SERIF, fontStyle: "italic", fontSize: 15, color: COLORS.inkMuted, marginTop: 6 }}>
                    — {chemistry.nemesis.wins}W {chemistry.nemesis.draws}D {chemistry.nemesis.losses}L against
                  </div>
                </>
              ) : (
                <div style={{ marginTop: 8 }}><Italic size={16}>No real rival yet — beating everyone they face.</Italic></div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mb-12">
        <div className="mb-6">
          <SectionTag n={3} />
          <HugeHeading>STANDOUT MATCHES</HugeHeading>
        </div>
        {!hasData ? (
          <EmptyPanel title="NO MATCHES YET" sub="Highlights will appear once games are in the books." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PerformanceCard h={standouts.best}  flavour="best"  onOpenMatch={onOpenMatch} />
            <PerformanceCard h={standouts.worst} flavour="worst" onOpenMatch={onOpenMatch} />
          </div>
        )}
      </div>

      <div className="mb-6">
        <div className="mb-6">
          <SectionTag n={4} />
          <HugeHeading>MATCH LOG</HugeHeading>
          <div className="mt-2"><Italic>— click any row for the full breakdown.</Italic></div>
        </div>
        {!hasData ? (
          <EmptyPanel title="NO MATCHES PLAYED" sub="Once they take the pitch, every game lands here." />
        ) : (
          <div style={{ background: COLORS.bg2, border: `1px solid ${COLORS.line}`, maxHeight: 480, overflowY: "auto" }}>
            {history.map((h) => {
              const m = h.match;
              const oppCaptain = h.side === "home" ? m.awayCaptain : m.homeCaptain;
              return (
                <button
                  key={m.id}
                  onClick={() => onOpenMatch && onOpenMatch(m.id)}
                  className="w-full grid grid-cols-12 gap-3 items-center px-5 py-4 text-left transition-colors"
                  style={{ background: "transparent", border: "none", borderBottom: `1px solid ${COLORS.lineSoft}`, cursor: "pointer" }}
                  onMouseOver={(e) => (e.currentTarget.style.background = COLORS.bg3)}
                  onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <div className="col-span-3 md:col-span-2">
                    <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: COLORS.inkMuted, letterSpacing: "0.15em" }}>MW {String(m.matchweek).padStart(2, "0")}</div>
                    <div style={{ fontFamily: FONT_DISPLAY, fontSize: 16, color: COLORS.ink, marginTop: 2 }}>{formatDate(m.date).toUpperCase()}</div>
                  </div>
                  <div className="col-span-5 md:col-span-5">
                    <span style={{ fontFamily: FONT_BODY, fontSize: 13, color: COLORS.inkMuted }}>vs </span>
                    <span style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: COLORS.ink }}>{oppCaptain.toUpperCase()}'S XI</span>
                    {h.isCaptain && (
                      <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.accent, letterSpacing: "0.15em", marginLeft: 8, padding: "2px 6px", border: `1px solid ${COLORS.accent}` }}>
                        CAPTAIN
                      </span>
                    )}
                  </div>
                  <div className="col-span-2 md:col-span-2 text-center">
                    <span style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: h.result === "W" ? COLORS.accent : h.result === "L" ? COLORS.attacker : COLORS.ink }}>
                      {h.forScore}—{h.agScore}
                    </span>
                  </div>
                  <div className="col-span-2 md:col-span-2 text-right">
                    {(h.goals + h.assists) === 0 ? (
                      <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: COLORS.inkMuted, letterSpacing: "0.1em" }}>—</span>
                    ) : (
                      <span style={{ fontFamily: FONT_DISPLAY, fontSize: 16, color: COLORS.accent }}>
                        {h.goals > 0 && `${h.goals}G`}
                        {h.goals > 0 && h.assists > 0 && " "}
                        {h.assists > 0 && `${h.assists}A`}
                      </span>
                    )}
                  </div>
                  <div className="col-span-12 md:col-span-1 flex md:justify-end items-center gap-2">
                    <FormDot result={h.result} size={10} />
                    <ArrowUpRight size={14} style={{ color: COLORS.inkMuted }} />
                  </div>
                </button>
              );
            })}
          </div>
        )}
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
// PLAYER COMPARE — Step 6 (new)
// ——————————————————————————————————————————————————————————————

// Build the stat rows for the comparison based on shared role.
function buildCompareRows(role, p1Name, p2Name, matches, allPlayers) {
  const p1History = getPlayerMatchHistory(p1Name, matches);
  const p2History = getPlayerMatchHistory(p2Name, matches);

  const wins1 = p1History.filter((h) => h.result === "W").length;
  const wins2 = p2History.filter((h) => h.result === "W").length;
  const winPct1 = p1History.length > 0 ? Math.round(100 * wins1 / p1History.length) : 0;
  const winPct2 = p2History.length > 0 ? Math.round(100 * wins2 / p2History.length) : 0;

  if (role === "Attacker") {
    const s1 = getAttackerStats(p1History) || { goals:0, assists:0, gPlusAPerGame:"0.00", goalInvolvement:0 };
    const s2 = getAttackerStats(p2History) || { goals:0, assists:0, gPlusAPerGame:"0.00", goalInvolvement:0 };
    return [
      { label: "GOALS",            p1: s1.goals,                   p2: s2.goals,                   p1Display: String(s1.goals),       p2Display: String(s2.goals),       inverse: false },
      { label: "ASSISTS",          p1: s1.assists,                 p2: s2.assists,                 p1Display: String(s1.assists),     p2Display: String(s2.assists),     inverse: false },
      { label: "G+A / GAME",       p1: parseFloat(s1.gPlusAPerGame), p2: parseFloat(s2.gPlusAPerGame), p1Display: s1.gPlusAPerGame,     p2Display: s2.gPlusAPerGame,       inverse: false, decimals: 2 },
      { label: "GOAL INVOLVEMENT", p1: s1.goalInvolvement,         p2: s2.goalInvolvement,         p1Display: `${s1.goalInvolvement}%`, p2Display: `${s2.goalInvolvement}%`, inverse: false, suffix: "%" },
      { label: "WIN %",            p1: winPct1,                    p2: winPct2,                    p1Display: `${winPct1}%`,          p2Display: `${winPct2}%`,          inverse: false, suffix: "%" },
    ];
  }

  if (role === "Midfielder") {
    const s1 = getMidfielderStats(p1History) || { assists:0, gPlusA:0, unbeatenPct:0, captainWinPct:null, captainGames:0 };
    const s2 = getMidfielderStats(p2History) || { assists:0, gPlusA:0, unbeatenPct:0, captainWinPct:null, captainGames:0 };
    const cap1Display = s1.captainWinPct === null ? "—" : `${s1.captainWinPct}%`;
    const cap2Display = s2.captainWinPct === null ? "—" : `${s2.captainWinPct}%`;
    const nullCap = s1.captainWinPct === null || s2.captainWinPct === null;
    return [
      { label: "ASSISTS",    p1: s1.assists,     p2: s2.assists,     p1Display: String(s1.assists), p2Display: String(s2.assists), inverse: false },
      { label: "G+A",        p1: s1.gPlusA,      p2: s2.gPlusA,      p1Display: String(s1.gPlusA),  p2Display: String(s2.gPlusA),  inverse: false },
      { label: "UNBEATEN %", p1: s1.unbeatenPct, p2: s2.unbeatenPct, p1Display: `${s1.unbeatenPct}%`, p2Display: `${s2.unbeatenPct}%`, inverse: false, suffix: "%" },
      { label: "CAPTAIN W%", p1: s1.captainWinPct ?? 0, p2: s2.captainWinPct ?? 0, p1Display: cap1Display, p2Display: cap2Display, inverse: false, suffix: "%", noWinner: nullCap },
      { label: "WIN %",      p1: winPct1,        p2: winPct2,        p1Display: `${winPct1}%`,      p2Display: `${winPct2}%`,      inverse: false, suffix: "%" },
    ];
  }

  // Defender
  const s1 = getDefenderStats(p1Name, p1History, allPlayers, matches) || { concededPerGame:"0.00", totalConceded:0, cleanSheets:0, unbeatenPct:0, gPlusA:0 };
  const s2 = getDefenderStats(p2Name, p2History, allPlayers, matches) || { concededPerGame:"0.00", totalConceded:0, cleanSheets:0, unbeatenPct:0, gPlusA:0 };
  return [
    { label: "CONCEDED / GAME", p1: parseFloat(s1.concededPerGame), p2: parseFloat(s2.concededPerGame), p1Display: s1.concededPerGame, p2Display: s2.concededPerGame, inverse: true,  decimals: 2 },
    { label: "TOTAL CONCEDED",  p1: s1.totalConceded, p2: s2.totalConceded, p1Display: String(s1.totalConceded), p2Display: String(s2.totalConceded), inverse: true },
    { label: "CLEAN SHEETS",    p1: s1.cleanSheets,   p2: s2.cleanSheets,   p1Display: String(s1.cleanSheets),   p2Display: String(s2.cleanSheets),   inverse: false },
    { label: "UNBEATEN %",      p1: s1.unbeatenPct,   p2: s2.unbeatenPct,   p1Display: `${s1.unbeatenPct}%`,     p2Display: `${s2.unbeatenPct}%`,     inverse: false, suffix: "%" },
    { label: "G+A",             p1: s1.gPlusA,        p2: s2.gPlusA,        p1Display: String(s1.gPlusA),        p2Display: String(s2.gPlusA),        inverse: false },
  ];
}

// Three-pill role filter
const RoleFilter = ({ role, setRole }) => (
  <div style={{ display: "flex", border: `1px solid ${COLORS.line}`, width: "fit-content" }}>
    {["Attacker", "Midfielder", "Defender"].map((r) => {
      const active = role === r;
      return (
        <button
          key={r}
          onClick={() => setRole(r)}
          style={{
            padding: "8px 16px",
            fontFamily: FONT_DISPLAY,
            fontSize: 13,
            letterSpacing: "0.1em",
            background: active ? roleColor(r) : "transparent",
            color: active ? "#000" : COLORS.ink,
            border: "none",
            cursor: "pointer",
          }}
        >
          {r.toUpperCase()}
        </button>
      );
    })}
  </div>
);

// Player picker card with native select + chevron + nickname
const PlayerPicker = ({ label, value, onChange, options }) => {
  const player = options.find((p) => p.id === value);
  return (
    <div style={{ background: COLORS.bg2, border: `1px solid ${COLORS.line}`, padding: 16 }}>
      <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: COLORS.inkMuted, letterSpacing: "0.2em", marginBottom: 6 }}>{label}</div>
      <div style={{ position: "relative" }}>
        <select
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 32,
            color: COLORS.ink,
            background: "transparent",
            border: "none",
            width: "100%",
            padding: "0 24px 0 0",
            appearance: "none",
            WebkitAppearance: "none",
            MozAppearance: "none",
            cursor: "pointer",
            outline: "none",
            lineHeight: 1,
            letterSpacing: "0.02em",
          }}
        >
          {options.map((p) => (
            <option key={p.id} value={p.id} style={{ background: COLORS.bg, color: COLORS.ink }}>
              {p.name.toUpperCase()}
            </option>
          ))}
        </select>
        <span style={{ position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)", color: COLORS.inkMuted, pointerEvents: "none", fontSize: 14 }}>▾</span>
      </div>
      {player?.nickname ? (
        <div style={{ fontFamily: FONT_SERIF, fontStyle: "italic", fontSize: 14, color: COLORS.inkMuted, marginTop: 6 }}>
          — "{player.nickname}"
        </div>
      ) : (
        <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: COLORS.lineSoft, letterSpacing: "0.15em", marginTop: 8 }}>
          NO NICKNAME
        </div>
      )}
    </div>
  );
};

// Single stat comparison row
const CompareRow = ({ row }) => {
  let winner = "tie";
  if (!row.noWinner && row.p1 !== row.p2) {
    if (row.inverse) {
      winner = row.p1 < row.p2 ? "p1" : "p2";
    } else {
      winner = row.p1 > row.p2 ? "p1" : "p2";
    }
  }

  const diff = Math.abs(row.p1 - row.p2);
  const decimals = row.decimals || 0;
  const suffix = row.suffix || "";
  const diffDisplay = decimals > 0 ? diff.toFixed(decimals) : String(diff);

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1fr 180px 1fr",
      alignItems: "center",
      padding: "14px 16px",
      background: COLORS.bg2,
      border: `1px solid ${COLORS.line}`,
    }}>
      <div style={{ textAlign: "right" }}>
        <div style={{
          fontFamily: FONT_DISPLAY,
          fontSize: 32,
          color: winner === "p1" ? COLORS.accent : COLORS.ink,
          lineHeight: 1,
        }}>
          {row.p1Display}
        </div>
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: COLORS.inkMuted, letterSpacing: "0.2em" }}>
          {row.label}
        </div>
        {winner !== "tie" && (
          <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: COLORS.accent, letterSpacing: "0.15em", marginTop: 4 }}>
            + {diffDisplay}{suffix}
          </div>
        )}
      </div>
      <div style={{ textAlign: "left" }}>
        <div style={{
          fontFamily: FONT_DISPLAY,
          fontSize: 32,
          color: winner === "p2" ? COLORS.accent : COLORS.ink,
          lineHeight: 1,
        }}>
          {row.p2Display}
        </div>
      </div>
    </div>
  );
};

// Record card (used for both H2H and Together)
const RecordCard = ({ title, record, leftLabel, rightLabel, subtitle, accentLeft, accentRight }) => (
  <div style={{ background: COLORS.bg2, border: `1px solid ${COLORS.line}`, padding: 20 }}>
    <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: COLORS.accent, letterSpacing: "0.2em", marginBottom: 16 }}>
      / {title}
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, alignItems: "end" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 48, color: record.w > 0 ? (accentLeft || COLORS.accent) : COLORS.inkMuted, lineHeight: 1 }}>
          {record.w}
        </div>
        <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: COLORS.inkMuted, letterSpacing: "0.15em", marginTop: 6 }}>
          {leftLabel}
        </div>
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 36, color: COLORS.inkMuted, lineHeight: 1 }}>
          {record.d}
        </div>
        <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: COLORS.inkMuted, letterSpacing: "0.15em", marginTop: 6 }}>
          DRAWS
        </div>
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 36, color: record.l > 0 ? (accentRight || COLORS.ink) : COLORS.inkMuted, lineHeight: 1 }}>
          {record.l}
        </div>
        <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: COLORS.inkMuted, letterSpacing: "0.15em", marginTop: 6 }}>
          {rightLabel}
        </div>
      </div>
    </div>
    <div style={{ fontFamily: FONT_SERIF, fontStyle: "italic", fontSize: 13, color: COLORS.inkMuted, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${COLORS.lineSoft}` }}>
      — {subtitle}
    </div>
  </div>
);

// H2H match list row (clickable)
const H2HMatchRow = ({ entry, p1Name, p2Name, onOpenMatch }) => {
  const m = entry.match;
  let titleNode;
  if (entry.result === "W") {
    titleNode = (<><span style={{ color: COLORS.accent }}>{p1Name.toUpperCase()}</span> beat {p2Name.toUpperCase()} · {entry.p1For}—{entry.p1Ag}</>);
  } else if (entry.result === "L") {
    titleNode = (<><span style={{ color: COLORS.ink }}>{p2Name.toUpperCase()}</span> beat {p1Name.toUpperCase()} · {entry.p1Ag}—{entry.p1For}</>);
  } else {
    titleNode = (<>DRAW · {entry.p1For}—{entry.p1Ag}</>);
  }

  return (
    <button
      onClick={() => onOpenMatch(m.id)}
      style={{
        display: "grid",
        gridTemplateColumns: "80px 1fr 100px 100px 30px",
        alignItems: "center",
        padding: "14px 16px",
        background: "transparent",
        border: "none",
        borderBottom: `1px solid ${COLORS.lineSoft}`,
        cursor: "pointer",
        width: "100%",
        textAlign: "left",
        transition: "background 120ms",
      }}
      onMouseOver={(e) => (e.currentTarget.style.background = COLORS.bg3)}
      onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <div>
        <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: COLORS.inkMuted, letterSpacing: "0.15em" }}>MW {String(m.matchweek).padStart(2, "0")}</div>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: COLORS.ink, marginTop: 2 }}>{formatDate(m.date).toUpperCase()}</div>
      </div>
      <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: COLORS.ink }}>{titleNode}</div>
      <div style={{ textAlign: "center", fontFamily: FONT_MONO, fontSize: 12, letterSpacing: "0.15em", color: (entry.p1Goals + entry.p1Assists) === 0 ? COLORS.inkMuted : COLORS.accent }}>
        {(entry.p1Goals + entry.p1Assists) === 0 ? "—" : `${entry.p1Goals > 0 ? `${entry.p1Goals}G` : ""}${entry.p1Goals > 0 && entry.p1Assists > 0 ? " " : ""}${entry.p1Assists > 0 ? `${entry.p1Assists}A` : ""}`}
      </div>
      <div style={{ textAlign: "center", fontFamily: FONT_MONO, fontSize: 12, letterSpacing: "0.15em", color: (entry.p2Goals + entry.p2Assists) === 0 ? COLORS.inkMuted : COLORS.accent }}>
        {(entry.p2Goals + entry.p2Assists) === 0 ? "—" : `${entry.p2Goals > 0 ? `${entry.p2Goals}G` : ""}${entry.p2Goals > 0 && entry.p2Assists > 0 ? " " : ""}${entry.p2Assists > 0 ? `${entry.p2Assists}A` : ""}`}
      </div>
      <div style={{ textAlign: "right" }}>
        <ArrowUpRight size={14} style={{ color: COLORS.inkMuted }} />
      </div>
    </button>
  );
};

const PlayerCompare = ({ players, matches, onOpenMatch }) => {
  const [role, setRole] = useState("Attacker");
  const [p1Id, setP1Id] = useState(null);
  const [p2Id, setP2Id] = useState(null);

  const rolePlayers = useMemo(() => players.filter((p) => p.role === role), [players, role]);

  // Default selections when role changes
  useEffect(() => {
    if (rolePlayers.length >= 2) {
      setP1Id(rolePlayers[0].id);
      setP2Id(rolePlayers[1].id);
    } else if (rolePlayers.length === 1) {
      setP1Id(rolePlayers[0].id);
      setP2Id(null);
    } else {
      setP1Id(null);
      setP2Id(null);
    }
  }, [role, players]);

  // Prevent picking the same player on both sides
  useEffect(() => {
    if (p1Id && p1Id === p2Id) {
      const other = rolePlayers.find((p) => p.id !== p1Id);
      if (other) setP2Id(other.id);
    }
  }, [p1Id, p2Id, rolePlayers]);

  const p1 = players.find((p) => p.id === p1Id);
  const p2 = players.find((p) => p.id === p2Id);

  const h2hList = useMemo(
    () => (p1 && p2) ? getH2H(p1.name, p2.name, matches) : [],
    [p1, p2, matches]
  );
  const togetherList = useMemo(
    () => (p1 && p2) ? getTogether(p1.name, p2.name, matches) : [],
    [p1, p2, matches]
  );
  const h2hRecord = useMemo(() => summariseRecord(h2hList), [h2hList]);
  const togetherRecord = useMemo(() => summariseRecord(togetherList), [togetherList]);

  const compareRows = useMemo(
    () => (p1 && p2) ? buildCompareRows(role, p1.name, p2.name, matches, players) : [],
    [p1, p2, role, matches, players]
  );

  // Options for each dropdown — exclude the OTHER player's selection
  const p1Options = rolePlayers.filter((p) => p.id !== p2Id);
  const p2Options = rolePlayers.filter((p) => p.id !== p1Id);

  return (
    <section className="max-w-[1400px] mx-auto px-6 md:px-10 py-10">
      <div className="mb-8">
        <SectionTag n={3} label="compare" />
        <HugeHeading>PLAYER COMPARISON</HugeHeading>
        <div className="mt-2"><Italic>— pick two of the same role and let the numbers fight it out.</Italic></div>
      </div>

      <div className="mb-6">
        <RoleFilter role={role} setRole={setRole} />
      </div>

      {rolePlayers.length < 2 ? (
        <EmptyPanel
          title={rolePlayers.length === 0 ? `NO ${role.toUpperCase()}S` : "NEED 1 MORE"}
          sub={rolePlayers.length === 0
            ? `Add two ${role.toLowerCase()}s in the Admin tab to compare.`
            : `Add another ${role.toLowerCase()} in the Admin tab to compare.`}
        />
      ) : !p1 || !p2 ? (
        <EmptyPanel title="LOADING" sub="Picking the first two..." />
      ) : (
        <>
          {/* Player pickers */}
          <div className="grid items-center gap-4 mb-8" style={{ gridTemplateColumns: "1fr 60px 1fr" }}>
            <PlayerPicker
              label="PLAYER 1"
              value={p1Id}
              onChange={setP1Id}
              options={p1Options.length > 0 ? p1Options : rolePlayers}
            />
            <div style={{ textAlign: "center", fontFamily: FONT_DISPLAY, fontSize: 24, color: COLORS.accent, letterSpacing: "0.05em" }}>
              VS
            </div>
            <PlayerPicker
              label="PLAYER 2"
              value={p2Id}
              onChange={setP2Id}
              options={p2Options.length > 0 ? p2Options : rolePlayers}
            />
          </div>

          {/* Two record cards side-by-side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <RecordCard
              title="HEAD-TO-HEAD"
              record={h2hRecord}
              leftLabel={`${p1.name.toUpperCase()} W`}
              rightLabel={`${p2.name.toUpperCase()} W`}
              accentLeft={COLORS.accent}
              accentRight={COLORS.ink}
              subtitle={
                h2hRecord.total === 0
                  ? "never faced each other yet."
                  : h2hRecord.total === 1
                  ? "1 match on opposite sides."
                  : `${h2hRecord.total} matches on opposite sides.`
              }
            />
            <RecordCard
              title="ON THE SAME TEAM"
              record={togetherRecord}
              leftLabel="WINS"
              rightLabel="LOSSES"
              accentLeft={COLORS.accent}
              accentRight={COLORS.attacker}
              subtitle={
                togetherRecord.total === 0
                  ? "never played together yet."
                  : `${togetherRecord.total} matches together · ${Math.round(100 * togetherRecord.w / togetherRecord.total)}% win rate.`
              }
            />
          </div>

          {/* Stat-by-stat */}
          <div className="mb-3">
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: COLORS.inkMuted, letterSpacing: "0.2em" }}>
              / {role.toUpperCase()} STATS
            </div>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 36, lineHeight: 1, color: COLORS.ink, marginTop: 6 }}>
              STAT-BY-STAT
            </div>
          </div>
          <div className="flex flex-col gap-2 mb-8">
            {compareRows.map((row) => (
              <CompareRow key={row.label} row={row} />
            ))}
          </div>

          {/* H2H match list */}
          <div className="mb-3">
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: COLORS.inkMuted, letterSpacing: "0.2em" }}>
              / HEAD-TO-HEAD · MATCH LIST
            </div>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 36, lineHeight: 1, color: COLORS.ink, marginTop: 6 }}>
              WHEN THEY CLASHED
            </div>
            <div className="mt-2"><Italic size={14}>— click any row for the full match.</Italic></div>
          </div>
          {h2hList.length === 0 ? (
            <EmptyPanel title="NO MATCHES YET" sub={`${p1.name} and ${p2.name} have not faced each other.`} />
          ) : (
            <div style={{ background: COLORS.bg2, border: `1px solid ${COLORS.line}` }}>
              {h2hList.map((entry) => (
                <H2HMatchRow
                  key={entry.match.id}
                  entry={entry}
                  p1Name={p1.name}
                  p2Name={p2.name}
                  onOpenMatch={onOpenMatch}
                />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
};

// ——————————————————————————————————————————————————————————————
// FIXTURES
// ——————————————————————————————————————————————————————————————
const Fixtures = ({ matches }) => {
  const fixtures = matches.filter((m) => m.status === "scheduled");
  return (
    <section className="max-w-[1400px] mx-auto px-6 md:px-10 py-10">
      <div className="mb-8">
        <SectionTag n={4} />
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
        <SectionTag n={5} />
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
// MATCH DETAIL
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
        <div className="col-span-12 lg:col-span-8">
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

          {match.notes && (
            <div className="mt-6 p-6" style={{ background: COLORS.bg2, border: `1px solid ${COLORS.line}` }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: COLORS.inkMuted, letterSpacing: "0.2em", marginBottom: 12 }}>MATCH NOTES</div>
              <div style={{ fontFamily: FONT_SERIF, fontStyle: "italic", fontSize: 22, color: COLORS.ink, lineHeight: 1.4 }}>"{match.notes}"</div>
            </div>
          )}
        </div>

        <div className="col-span-12 lg:col-span-4 space-y-4">
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
// MATCH FORM HELPERS + TEAM ROSTER
// ——————————————————————————————————————————————————————————————
const newEmptyGoal = (team) => ({ team, scorer: "", assister: "", minute: "", isRinger: false, ringerName: "" });

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
// ——————————————————————————————————————————————————————————————
// MATCH FORM
// ——————————————————————————————————————————————————————————————
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
      update({ [key]: arr.filter((n) => n !== name) });
    } else {
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

  const derivedHome = draft.goals.filter((g) => g.team === "home").length;
  const derivedAway = draft.goals.filter((g) => g.team === "away").length;

  const save = () => {
    const finalised = {
      ...draft,
      homeScore: derivedHome,
      awayScore: derivedAway,
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

// ——————————————————————————————————————————————————————————————
// ROSTER MANAGER
// ——————————————————————————————————————————————————————————————
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

const RosterManager = ({ players, addPlayer, updatePlayerRole, updatePlayerNickname, deletePlayer, onBack }) => {
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("Midfielder");
  const [newNickname, setNewNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingNicknameFor, setEditingNicknameFor] = useState(null);
  const [editNicknameValue, setEditNicknameValue] = useState("");

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    const ok = await addPlayer(newName, newRole, newNickname);
    setBusy(false);
    if (ok) { setNewName(""); setNewNickname(""); setNewRole("Midfielder"); }
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

  const startEditNickname = (player) => {
    setEditingNicknameFor(player.name);
    setEditNicknameValue(player.nickname || "");
  };

  const saveNickname = async () => {
    await updatePlayerNickname(editingNicknameFor, editNicknameValue);
    setEditingNicknameFor(null);
    setEditNicknameValue("");
  };

  const cancelEditNickname = () => {
    setEditingNicknameFor(null);
    setEditNicknameValue("");
  };

  const localRoleColor = (role) => role === "Attacker" ? COLORS.attacker : role === "Defender" ? COLORS.defender : COLORS.mid;
  const roleLabel = (role) => (role || "Midfielder").toUpperCase();

  return (
    <section className="max-w-[1400px] mx-auto px-6 md:px-10 py-10">
      <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
        <div>
          <SectionTag n={6} label="roster" />
          <HugeHeading>MANAGE ROSTER</HugeHeading>
          <Italic size={18} color={COLORS.inkMuted}>— {players.length} players on the books</Italic>
        </div>
        <Btn variant="ghost" onClick={onBack}>← BACK TO MATCHES</Btn>
      </div>

      <div className="mb-10 p-6" style={{ background: COLORS.bg2, border: `1px solid ${COLORS.line}` }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: COLORS.inkMuted, letterSpacing: "0.2em", marginBottom: 14 }}>NEW PLAYER</div>
        <div className="grid gap-3" style={{ gridTemplateColumns: "1.6fr 1.6fr 1.2fr auto", alignItems: "end" }}>
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
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: COLORS.inkMuted, marginBottom: 6, letterSpacing: "0.15em" }}>NICKNAME <span style={{ opacity: 0.5 }}>(OPTIONAL)</span></div>
            <input
              type="text"
              placeholder="e.g. The Sniper"
              value={newNickname}
              onChange={(e) => setNewNickname(e.target.value)}
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

      <div style={{ borderTop: `1px solid ${COLORS.line}` }}>
        <div className="grid items-center px-4 py-3" style={{ gridTemplateColumns: "60px 1fr 180px 280px", borderBottom: `1px solid ${COLORS.line}`, fontFamily: FONT_MONO, fontSize: 11, color: COLORS.inkMuted, letterSpacing: "0.2em" }}>
          <div>#</div>
          <div>PLAYER</div>
          <div>ROLE</div>
          <div style={{ textAlign: "right" }}>ACTIONS</div>
        </div>
        {players.map((p, i) => {
          const isEditing = editingNicknameFor === p.name;
          return (
            <div key={p.name} className="grid items-center px-4 py-4" style={{ gridTemplateColumns: "60px 1fr 180px 280px", borderBottom: `1px solid ${COLORS.line}` }}>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, color: COLORS.inkMuted }}>{String(i + 1).padStart(2, "0")}</div>
              <div>
                <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, letterSpacing: "0.02em" }}>{p.name.toUpperCase()}</div>
                {isEditing ? (
                  <div className="flex gap-2 items-center mt-1">
                    <input
                      type="text"
                      autoFocus
                      placeholder="Nickname (optional)"
                      value={editNicknameValue}
                      onChange={(e) => setEditNicknameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveNickname();
                        if (e.key === "Escape") cancelEditNickname();
                      }}
                      style={{ ...inputStyle, padding: "6px 10px", fontSize: 12, maxWidth: 240 }}
                    />
                    <button onClick={saveNickname} style={{ ...miniBtnStyle, color: COLORS.accent, borderColor: COLORS.accent, padding: "4px 8px" }}>SAVE</button>
                    <button onClick={cancelEditNickname} style={{ ...miniBtnStyle, padding: "4px 8px" }}>CANCEL</button>
                  </div>
                ) : (
                  p.nickname ? (
                    <div style={{ fontFamily: FONT_SERIF, fontStyle: "italic", fontSize: 14, color: COLORS.inkMuted, marginTop: 2 }}>— "{p.nickname}"</div>
                  ) : (
                    <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: COLORS.lineSoft, marginTop: 4, letterSpacing: "0.15em" }}>NO NICKNAME</div>
                  )
                )}
              </div>
              <div>
                <span style={{ fontFamily: FONT_MONO, fontSize: 11, padding: "4px 8px", border: `1px solid ${localRoleColor(p.role)}`, color: localRoleColor(p.role), letterSpacing: "0.15em" }}>{roleLabel(p.role)}</span>
              </div>
              <div style={{ textAlign: "right" }}>
                {!isEditing && (
                  <>
                    <button onClick={() => startEditNickname(p)} style={{ ...miniBtnStyle, marginRight: 6 }}>NICKNAME</button>
                    <button onClick={() => handleRoleChange(p.name, p.role)} style={{ ...miniBtnStyle, marginRight: 6 }}>ROLE</button>
                    <button onClick={() => handleDelete(p.name)} style={{ ...miniBtnStyle, color: COLORS.attacker, borderColor: COLORS.attacker }}>DELETE</button>
                  </>
                )}
              </div>
            </div>
          );
        })}
        {players.length === 0 && (
          <div style={{ padding: "60px 20px", textAlign: "center", color: COLORS.inkMuted, fontFamily: FONT_SERIF, fontStyle: "italic", fontSize: 18 }}>
            No players yet. Add the first one above.
          </div>
        )}
      </div>
    </section>
  );
};

// ——————————————————————————————————————————————————————————————
// ADMIN PANEL
// ——————————————————————————————————————————————————————————————
const Admin = ({ players, matches, setMatches, session, addPlayer, updatePlayerRole, updatePlayerNickname, deletePlayer }) => {
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [error, setError] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [view, setView] = useState("matches");
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

    const { error } = await supabase.from("matches").upsert(dbRow);

    if (error) {
      console.error("Failed to save match:", error);
      alert("Failed to save match — check console.");
      return;
    }

    setMatches((prev) => {
      const exists = prev.find((x) => x.id === m.id);
      return exists ? prev.map((x) => x.id === m.id ? m : x) : [...prev, m];
    });
    setEditingId(null);
    setCreatingNew(false);
  };

  const deleteMatch = async (id) => {
    const { error } = await supabase.from("matches").delete().eq("id", id);
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
        <div className="mb-8"><SectionTag n={6} /><HugeHeading>ADMIN ACCESS</HugeHeading></div>
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

  if (editingId || creatingNew) {
    return (
      <section className="max-w-[1400px] mx-auto px-6 md:px-10 py-10">
        <div className="mb-8"><SectionTag n={6} label="match editor" /><HugeHeading>{creatingNew ? "NEW FIXTURE" : "UPDATE MATCH"}</HugeHeading></div>
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

  if (view === "roster") {
    return <RosterManager players={players} addPlayer={addPlayer} updatePlayerRole={updatePlayerRole} updatePlayerNickname={updatePlayerNickname} deletePlayer={deletePlayer} onBack={() => setView("matches")} />;
  }

  const scheduled = matches.filter((m) => m.status === "scheduled");
  const completed = matches.filter((m) => m.status === "completed").slice().reverse();

  return (
    <section className="max-w-[1400px] mx-auto px-6 md:px-10 py-10">
      <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
        <div><SectionTag n={6} label="dashboard" /><HugeHeading>ADMIN DASHBOARD</HugeHeading></div>
        <div className="flex gap-2">
          <Btn variant="ghost" onClick={() => setView(view === "matches" ? "roster" : "matches")}>{view === "matches" ? "MANAGE ROSTER" : "← BACK TO MATCHES"}</Btn>
          <Btn variant="ghost" onClick={signOut}>SIGN OUT</Btn>
          <Btn onClick={() => setCreatingNew(true)}><Plus size={14} style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />NEW MATCH</Btn>
        </div>
      </div>

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
        {["The Table", "Top Performers", "Compare", "Fixtures", "Results"].map((s) => (
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
// APP — adds "compare" tab handling. Match-detail takes routing priority.
// ——————————————————————————————————————————————————————————————
export default function App() {
  useFonts();
  const [players, setPlayers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [tab, setTab] = useState("table");
  const [matchDetailId, setMatchDetailId] = useState(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [session, setSession] = useState(null);

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
    }
    loadData();
  }, []);

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
  const selectedPlayer = selectedPlayerId ? players.find((p) => p.id === selectedPlayerId) : null;

  async function addPlayer(name, role, nickname = "") {
    const trimmed = name.trim();
    const trimmedNick = nickname.trim();
    if (!trimmed) { alert("Player name is required."); return false; }
    if (players.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
      alert("A player with that name already exists.");
      return false;
    }
    const { data, error } = await supabase
      .from("players")
      .insert([{ name: trimmed, role, nickname: trimmedNick || null }])
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

  async function updatePlayerNickname(name, newNickname) {
    const trimmed = (newNickname || "").trim();
    const { error } = await supabase
      .from("players")
      .update({ nickname: trimmed || null })
      .eq("name", name);
    if (error) { alert("Failed to update nickname: " + error.message); return false; }
    setPlayers(players.map((p) => p.name === name ? { ...p, nickname: trimmed || null } : p));
    return true;
  }

  async function deletePlayer(name) {
    const { error } = await supabase.from("players").delete().eq("name", name);
    if (error) { alert("Failed to delete player: " + error.message); return false; }
    setPlayers(players.filter((p) => p.name !== name));
    return true;
  }

  useEffect(() => {
    setMatchDetailId(null);
    setSelectedPlayerId(null);
  }, [tab]);

  return (
    <div className="min-h-screen w-full" style={{ background: COLORS.bg, color: COLORS.ink, fontFamily: FONT_BODY }}>
      <Grain />
      <Ticker players={players} matches={matches} />
      <Header tab={tab} setTab={setTab} matches={matches} />

      {detailMatch ? (
        <MatchDetail
          match={detailMatch}
          onBack={() => setMatchDetailId(null)}
        />
      ) : selectedPlayer ? (
        <PlayerProfile
          player={selectedPlayer}
          players={players}
          matches={matches}
          onBack={() => setSelectedPlayerId(null)}
          onOpenMatch={(id) => {
            setMatchDetailId(id);
            setSelectedPlayerId(null);
          }}
        />
      ) : (
        <>
          {tab === "table" && (
            <>
              <Hero players={players} matches={matches} standings={standings} />
              <LeagueTable
                standings={standings}
                matches={matches}
                onOpenPlayer={(id) => setSelectedPlayerId(id)}
              />
            </>
          )}
          {tab === "top performers" && <TopPerformers standings={standings} matches={matches} />}
          {tab === "compare" && (
            <PlayerCompare
              players={players}
              matches={matches}
              onOpenMatch={(id) => setMatchDetailId(id)}
            />
          )}
          {tab === "fixtures" && <Fixtures matches={matches} />}
          {tab === "results" && <Results matches={matches} onOpenMatch={(id) => setMatchDetailId(id)} />}
          {tab === "admin" && <Admin players={players} matches={matches} setMatches={setMatches} session={session} addPlayer={addPlayer} updatePlayerRole={updatePlayerRole} updatePlayerNickname={updatePlayerNickname} deletePlayer={deletePlayer} />}
        </>
      )}

      <Footer players={players} />
    </div>
  );
}