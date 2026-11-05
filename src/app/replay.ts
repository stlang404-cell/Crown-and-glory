/**
 * Replay & Analysis Center data (crown-replay-1): pure functions over recorded data only.
 *
 *  - Historical markets: the published price points of an in-play game (`LiveGame.points`), the market's trade
 *    history and the player's ledger journals, synchronised to a replay ply. Nothing is interpolated or invented:
 *    a ply without a recorded point shows the latest earlier recorded point, labelled with the ply it belongs to.
 *  - Turning points: the largest changes of White's expected score between consecutive plies.
 *  - Match events: captures, checks, promotions, big evaluation swings, big recorded price moves, the player's trades.
 *  - Sandbox: an alternative line from a replay position, kept entirely apart from the saved game.
 *  - Replay library: one row per recorded game (the player's own and federation games) and its filters.
 *
 * Exchange logic stays in src/exchange (claims, prices); this module only reads what was recorded.
 */
import { STUDY_LABEL, isStudyGame } from './study';
import type { Market } from '../exchange/market';
import { claimsOf } from '../exchange/market';
import type { Journal } from '../exchange/ledger';
import { MICRO } from '../exchange/ledger';
import { Position } from '../rules/position';
import { moveToCcn, moveToSan, parseLegalCcn } from '../rules/notation';
import type { GameRecord } from '../games/types';
import type { AnalysisReport, EngineScore } from '../analysis/types';
import { expectedU, toPov } from '../analysis/methodology';

export const REPLAY_ID = 'crown-replay-1';

/* ------------------------------------------------------------------ historical markets */

export interface RecordedPoint { ply: number; prices: number[]; model: number[]; at: string; revision?: string }

export interface RecordedTrade {
  /** Index in the market's trade history (0 is the opening entry, never a trade). */
  index: number;
  at: string;
  by: string;
  /** Replay ply whose trading window the trade happened in (the position on the board when it was made). */
  ply: number;
  /** Claim prices before and after the trade, as recorded. */
  before: number[];
  after: number[];
  /** The player's own trades only (from the ledger journal); null for other traders or when not recorded. */
  side: 'buy' | 'sell' | null;
  claim: number | null;
  shares: number | null;
  /** Signed cash flow of the player (µ): negative for a purchase, positive for a sale. */
  cash: number | null;
}

export interface MarketTimeline {
  marketId: string;
  claims: string[];
  points: RecordedPoint[];
  trades: RecordedTrade[];
  playerTrades: RecordedTrade[];
  /** Settlement or cancellation as recorded on the market and the player's position (µ). */
  resolution: { status: 'settled' | 'cancelled'; at: string | null; result: number | null; payout: number[] | null; received: number | null; spent: number | null } | null;
}

const tradeCount = (p: RecordedPoint): number | null => {
  if (!p.revision) return null;
  const n = Number(p.revision.split('.')[0]);
  return Number.isFinite(n) ? n : null;
};

/** Claim prices of a recorded state-price vector. */
function claimVector(m: Market, statePrices: number[]): number[] {
  return claimsOf(m).map(c => c.states.reduce((a, s) => a + (statePrices[s] ?? 0), 0));
}

/**
 * Build the recorded timeline of a match market. `points` are the published price points of the live game
 * (empty when the game was not traded in play); `journals` are the player's ledger entries (any subset, e.g.
 * `FederationService.playerJournal()`); `position` is the player's recorded position, if any.
 */
export function buildMarketTimeline(m: Market, points: RecordedPoint[], journals: Journal[], position?: { spent: number; received: number } | null, holder = 'player:cash'): MarketTimeline {
  const claims = claimsOf(m).map(c => c.label);
  const pts = [...points].sort((a, b) => a.ply - b.ply);
  const byId = new Map(journals.filter(j => j.id.startsWith(`trade:${m.id}:`)).map(j => [j.id, j]));
  const plyOf = (index: number, at: string): number => {
    let ply = 0;
    for (const p of pts) {
      const t = tradeCount(p);
      // a point with a revision tells exactly how many history entries existed when it was published
      if (t !== null ? t <= index : p.at <= at) ply = Math.max(ply, p.ply);
    }
    return ply;
  };
  const trades: RecordedTrade[] = [];
  for (let k = 1; k < m.history.length; k++) {
    const h = m.history[k];
    const t: RecordedTrade = { index: k, at: h.at, by: h.by, ply: plyOf(k, h.at), before: claimVector(m, m.history[k - 1].prices), after: claimVector(m, h.prices), side: null, claim: null, shares: null, cash: null };
    if (h.by === holder) {
      const j = byId.get(`trade:${m.id}:${h.seq}`);
      if (j) {
        const mm = /^(Buy|Sell) (\d+(?:\.\d+)?) × (.+?) — /.exec(j.memo);
        t.side = j.kind === 'trade-sell' || mm?.[1] === 'Sell' ? 'sell' : 'buy';
        if (mm) { t.shares = Number(mm[2]); const ci = claims.indexOf(mm[3]); t.claim = ci >= 0 ? ci : null; }
        t.cash = j.lines.filter(l => l.account === holder).reduce((a, l) => a + l.amount, 0);
      }
    }
    trades.push(t);
  }
  const resolution = m.status === 'settled' || m.status === 'cancelled'
    ? { status: m.status, at: m.settledAt, result: m.result, payout: m.payout ?? (m.result !== null ? claims.map((_, i) => (i === m.result ? 1 : 0)) : null), received: position?.received ?? null, spent: position?.spent ?? null }
    : null;
  return { marketId: m.id, claims, points: pts, trades, playerTrades: trades.filter(t => t.by === holder), resolution };
}

export interface MarketAtPly {
  /** The recorded point shown for this ply (the latest at or before it), or null before the first one. */
  point: RecordedPoint | null;
  /** Change of each claim price against the previous recorded point (display only). */
  change: number[] | null;
  /** Trades made in this ply's trading window (all traders) and the player's trades so far. */
  windowTrades: RecordedTrade[];
  playerTradesSoFar: RecordedTrade[];
  /** The player's holdings per claim after their trades so far. */
  holdings: number[];
  /** Net cash flow of the player so far (µ): proceeds minus purchases. */
  netCash: number;
  /** Holdings marked at the shown recorded prices (µ). */
  markValue: number;
  /** netCash + markValue (µ): unrealised profit or loss at the recorded prices. */
  pnl: number;
  /** True once the replay reaches the end and the market was settled or cancelled. */
  resolved: boolean;
  /** Recorded realised profit or loss after resolution (µ): received − spent from the player's position. */
  realised: number | null;
  /** Some of the player's trades lack recorded details (older saves); holdings are then incomplete. */
  incomplete: boolean;
}

/** The market as it was recorded at a replay ply. `finalPly` is the last ply of the game (resolution shows there). */
export function marketAtPly(t: MarketTimeline, ply: number, finalPly: number): MarketAtPly {
  let idx = -1;
  for (let i = 0; i < t.points.length; i++) if (t.points[i].ply <= ply) idx = i;
  const point = idx >= 0 ? t.points[idx] : null;
  const prev = idx > 0 ? t.points[idx - 1] : null;
  const change = point && prev ? point.prices.map((x, i) => x - (prev.prices[i] ?? x)) : null;
  const so = t.playerTrades.filter(x => x.ply <= ply);
  const holdings = t.claims.map(() => 0);
  let netCash = 0, incomplete = false;
  for (const x of so) {
    if (x.claim === null || x.shares === null || x.cash === null) { incomplete = true; continue; }
    holdings[x.claim] += x.side === 'sell' ? -x.shares : x.shares;
    netCash += x.cash;
  }
  const resolved = !!t.resolution && ply >= finalPly;
  const prices = point?.prices ?? null;
  let markValue = 0;
  if (resolved && t.resolution!.payout) markValue = Math.floor(holdings.reduce((a, s, i) => a + s * (t.resolution!.payout![i] ?? 0), 0) * MICRO);
  else if (prices) markValue = Math.round(holdings.reduce((a, s, i) => a + s * (prices[i] ?? 0), 0) * MICRO);
  const realised = resolved && t.resolution!.received !== null && t.resolution!.spent !== null ? t.resolution!.received - t.resolution!.spent : null;
  return { point, change, windowTrades: t.trades.filter(x => x.ply === ply), playerTradesSoFar: so, holdings, netCash, markValue, pnl: netCash + markValue, resolved, realised, incomplete };
}

/** Largest absolute change between consecutive recorded price points (biggest market move of a game). */
export function biggestPriceMove(points: RecordedPoint[]): { ply: number; claim: number; delta: number } | null {
  let best: { ply: number; claim: number; delta: number } | null = null;
  const pts = [...points].sort((a, b) => a.ply - b.ply);
  for (let i = 1; i < pts.length; i++) {
    pts[i].prices.forEach((x, c) => {
      const d = x - (pts[i - 1].prices[c] ?? x);
      if (!best || Math.abs(d) > Math.abs(best.delta)) best = { ply: pts[i].ply, claim: c, delta: d };
    });
  }
  return best;
}

/* ------------------------------------------------------------------ turning points and events */

export interface TurningPoint { ply: number; before: number; after: number; swing: number; favours: 'white' | 'black' }

/**
 * The plies with the largest changes of White's expected score. `us[i]` is White's expected score after ply i+1;
 * the start position counts as 0.5. Only swings of at least `min` are returned, largest first, at most `count`.
 */
export function turningPoints(us: number[], count = 3, min = 0.1): TurningPoint[] {
  const out: TurningPoint[] = [];
  for (let i = 0; i < us.length; i++) {
    const before = i === 0 ? 0.5 : us[i - 1], after = us[i];
    const swing = after - before;
    if (Math.abs(swing) >= min) out.push({ ply: i + 1, before, after, swing, favours: swing > 0 ? 'white' : 'black' });
  }
  return out.sort((a, b) => Math.abs(b.swing) - Math.abs(a.swing) || a.ply - b.ply).slice(0, count);
}

/** Largest absolute expected-score swing of a game (0 when there are no evaluations). */
export const maxSwing = (us: number[]): number => us.reduce((m, u, i) => Math.max(m, Math.abs(u - (i === 0 ? 0.5 : us[i - 1]))), 0);

const fmtP = (p: number) => `$${p.toFixed(3)}`;

export type MatchEventKind = 'start' | 'capture' | 'check' | 'promotion' | 'swing' | 'price' | 'trade' | 'end' | 'settlement';
export interface MatchEvent { ply: number; kind: MatchEventKind; text: string }

/** Events of a game from recorded data only (moves, evaluations, recorded prices, the player's trades). */
export function matchEvents(o: {
  sans: string[]; us?: number[] | null; timeline?: MarketTimeline | null; result?: string | null; termination?: string | null;
  swingMin?: number; priceMin?: number; fmtMoney?: (micro: number) => string;
}): MatchEvent[] {
  const ev: MatchEvent[] = [{ ply: 0, kind: 'start', text: 'Game started' }];
  const money = o.fmtMoney ?? ((x: number) => `$${(x / MICRO).toFixed(2)}`);
  o.sans.forEach((san, i) => {
    const ply = i + 1, no = `${Math.ceil(ply / 2)}${ply % 2 ? '.' : '…'} ${san}`;
    if (san.includes('#')) ev.push({ ply, kind: 'check', text: `${no}: checkmate` });
    else if (san.includes('+')) ev.push({ ply, kind: 'check', text: `${no}: check` });
    if (san.includes('=')) ev.push({ ply, kind: 'promotion', text: `${no}: promotion` });
    else if (san.includes('x')) ev.push({ ply, kind: 'capture', text: `${no}: capture` });
  });
  if (o.us) for (const t of turningPoints(o.us, 5, o.swingMin ?? 0.15)) ev.push({ ply: t.ply, kind: 'swing', text: `Evaluation swing toward ${t.favours === 'white' ? 'White' : 'Black'}: ${Math.round(t.before * 100)}% → ${Math.round(t.after * 100)}% (White's expected score)` });
  const tl = o.timeline;
  if (tl) {
    const pts = tl.points;
    for (let i = 1; i < pts.length; i++) {
      pts[i].prices.forEach((x, c) => {
        const d = x - (pts[i - 1].prices[c] ?? x);
        if (Math.abs(d) >= (o.priceMin ?? 0.08)) ev.push({ ply: pts[i].ply, kind: 'price', text: `${tl.claims[c]} price ${d > 0 ? 'rose' : 'fell'} ${fmtP(Math.abs(d))} to ${fmtP(x)} (recorded)` });
      });
    }
    for (const t of tl.playerTrades) ev.push({ ply: t.ply, kind: 'trade', text: t.shares !== null && t.claim !== null ? `You ${t.side === 'sell' ? 'sold' : 'bought'} ${t.shares} × ${tl.claims[t.claim]}${t.cash !== null ? ` for ${money(Math.abs(t.cash))}` : ''}` : 'You traded (details not recorded)' });
  }
  if (o.result) ev.push({ ply: o.sans.length, kind: 'end', text: `Result ${o.result}${o.termination ? ` · ${o.termination.replace(/-/g, ' ')}` : ''}` });
  if (tl?.resolution) ev.push({ ply: o.sans.length, kind: 'settlement', text: tl.resolution.status === 'settled' ? `Market settled on ${tl.resolution.result !== null ? tl.claims[tl.resolution.result] ?? 'the result' : 'the result'}` : 'Market cancelled' });
  const order: Record<MatchEventKind, number> = { start: 0, trade: 1, capture: 2, promotion: 3, check: 4, swing: 5, price: 6, end: 7, settlement: 8 };
  return ev.sort((a, b) => a.ply - b.ply || order[a.kind] - order[b.kind]);
}

/* ------------------------------------------------------------------ sandbox */

/**
 * An alternative line from a replay position. The sandbox keeps its own move list and FENs; it never reads or
 * writes the saved game after creation (the base moves are copied), so exploring can never change a record.
 */
export interface Sandbox {
  /** Mainline ply the sandbox starts from (the position after that many moves). */
  origin: number;
  /** Initial position and the mainline moves up to the origin (copied, for an exact move history). */
  initialFen: string;
  baseMoves: readonly string[];
  /** The sandbox line in CCN and SAN, and the FEN after each sandbox move. */
  line: readonly string[];
  sans: readonly string[];
  fens: readonly string[];
}

export function createSandbox(initialFen: string, mainline: readonly string[], origin: number): Sandbox {
  const o = Math.max(0, Math.min(mainline.length, origin));
  return { origin: o, initialFen, baseMoves: Object.freeze(mainline.slice(0, o)), line: Object.freeze([]), sans: Object.freeze([]), fens: Object.freeze([]) };
}

function sandboxPosition(s: Sandbox, upto = s.line.length): Position {
  const p = Position.fromFen(s.initialFen);
  for (const c of s.baseMoves) p.makeMove(parseLegalCcn(p, c));
  for (const c of s.line.slice(0, upto)) p.makeMove(parseLegalCcn(p, c));
  return p;
}

/** FEN of the sandbox position (start FEN when no sandbox move has been made). */
export const sandboxFen = (s: Sandbox): string => (s.fens.length ? s.fens[s.fens.length - 1] : sandboxPosition(s).toFen());
/** Legal moves in CCN from the current sandbox position. */
export const sandboxLegal = (s: Sandbox): string[] => sandboxPosition(s).legalMoves().map(moveToCcn);

/** Play a legal move in the sandbox; returns a new sandbox (the old one is unchanged), or null if illegal. */
export function sandboxMove(s: Sandbox, ccn: string): Sandbox | null {
  const p = sandboxPosition(s);
  const mv = p.legalMoves().find(m => moveToCcn(m) === ccn);
  if (mv === undefined) return null;
  const san = moveToSan(p, mv);
  p.makeMove(mv);
  return { ...s, line: Object.freeze([...s.line, ccn]), sans: Object.freeze([...s.sans, san]), fens: Object.freeze([...s.fens, p.toFen()]) };
}

/** Take back the last sandbox move (a new sandbox). */
export const sandboxUndo = (s: Sandbox): Sandbox => ({ ...s, line: Object.freeze(s.line.slice(0, -1)), sans: Object.freeze(s.sans.slice(0, -1)), fens: Object.freeze(s.fens.slice(0, -1)) });

/** The full move history of the sandbox position (for engine requests). */
export const sandboxHistory = (s: Sandbox): string[] => [...s.baseMoves, ...s.line];

/* ------------------------------------------------------------------ Grimoire links */

/** Grimoire chapters for analysis topics (coach note topics, src/academy/coach.ts) and replay situations. */
export const TOPIC_CHAPTERS: Record<string, string[]> = {
  'hanging-pieces': ['b1-4-capturing-and-piece-safety', 'b2-5-removing-the-defender-and-overloading'],
  'knight-forks': ['b2-1-double-attacks-and-forks'],
  'double-attacks': ['b2-1-double-attacks-and-forks'],
  'mating-nets': ['b2-9-mate-threats-and-sacrifices', 'b1-6-checkmate-king-and-queen-king-and-rook'],
  'threat-awareness': ['b4-iv-3-the-unbroken-ward-defensive-resources'],
  'promotion-races': ['b1-9-the-pawns-road-four-steps-to-the-crown', 'b2-10-promotion-tactics'],
  'converting-advantages': ['b3-iii-9-turning-gold-into-crowns-conversion-tactics-and-patience'],
  calculation: ['b2-11-forcing-move-calculation', 'b4-iv-1-the-branching-path-candidate-moves-and-calculation'],
  endgame: ['b4-iv-4-the-crowns-march-king-activity-and-king-and-pawn-endings'],
  'turning-points': ['b5-v-5-critical-moments-stronger-opponents-and-predictable-mistakes'],
  'postgame-study': ['b5-v-6-the-engines-mirror-postgame-study-evaluations-and-losses'],
  'live-odds': ['b6-vi-6-live-odds-and-the-uncertain-board'],
};

/** Distinct chapter ids for the given topics, in order, keeping only chapters that exist in `known`. */
export function lessonsFor(topics: string[], known: Set<string>): string[] {
  const out: string[] = [];
  for (const t of topics) for (const c of TOPIC_CHAPTERS[t] ?? []) if (known.has(c) && !out.includes(c)) out.push(c);
  return out;
}

/* ------------------------------------------------------------------ replay library */

export interface ReplayEntry {
  /** Stable id: the game id for the player's games, `wg:<fixture>` for federation games. */
  id: string;
  /** v0.11 'exhibition': an unofficial Exhibition Arena game (id `exh:…`). */
  kind: 'personal' | 'federation' | 'exhibition';
  white: string; black: string;
  whiteRating: number | null; blackRating: number | null;
  /** 1 white won, 0.5 draw, 0 black won, null unfinished. */
  score: number | null;
  result: string;
  event: string; stage: string | null;
  season: number | null; round: number | null;
  at: string;
  plies: number;
  /** Largest expected-score swing between consecutive plies (from the evaluations available), or null if none. */
  swing: number | null;
  /** Largest recorded price move between two published points, or null without a recorded in-play market. */
  priceMove: number | null;
  hasMarket: boolean;
  championshipFinal: boolean;
  /** Both sides are in a recorded rivalry (ids of the pair), or the game involves one of the player's rivals. */
  rivalry: boolean;
  /** Rating gap won by the lower-rated side (positive), else 0. */
  upsetGap: number;
}

export type ReplayFilter = 'all' | 'personal' | 'federation' | 'exhibitions' | 'finals' | 'rivalries' | 'upsets' | 'swings' | 'market' | 'favourites';
export const REPLAY_FILTERS: { id: ReplayFilter; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'personal', label: 'My Games' }, { id: 'federation', label: 'Federation' }, { id: 'exhibitions', label: 'Exhibitions' },
  { id: 'finals', label: 'Championship Finals' }, { id: 'rivalries', label: 'Rivalries' }, { id: 'upsets', label: 'Upsets' },
  { id: 'swings', label: 'Dramatic Swings' }, { id: 'market', label: 'Market Moments' }, { id: 'favourites', label: 'Favourites' },
];
/** Thresholds (documented in the library's filter help). */
export const UPSET_GAP = 100;
export const DRAMATIC_SWING = 0.35;
export const MARKET_MOVE = 0.15;

export const upsetGapOf = (wr: number | null, br: number | null, score: number | null): number => {
  if (wr === null || br === null || score === null || score === 0.5) return 0;
  const winnerR = score === 1 ? wr : br, loserR = score === 1 ? br : wr;
  return Math.max(0, loserR - winnerR);
};

export function filterReplays(rows: ReplayEntry[], f: ReplayFilter, favourites: Set<string>, query = ''): ReplayEntry[] {
  const q = query.trim().toLowerCase();
  const keep = (r: ReplayEntry): boolean => {
    switch (f) {
      case 'personal': return r.kind === 'personal';
      case 'federation': return r.kind === 'federation';
      case 'exhibitions': return r.kind === 'exhibition';
      case 'finals': return r.championshipFinal;
      case 'rivalries': return r.rivalry;
      case 'upsets': return r.upsetGap >= UPSET_GAP;
      case 'swings': return (r.swing ?? 0) >= DRAMATIC_SWING;
      case 'market': return (r.priceMove ?? 0) >= MARKET_MOVE;
      case 'favourites': return favourites.has(r.id);
      default: return true;
    }
  };
  const out = rows.filter(r => keep(r) && (!q || `${r.white} ${r.black} ${r.event} ${r.stage ?? ''}`.toLowerCase().includes(q)));
  const rank = (r: ReplayEntry) => (f === 'upsets' ? r.upsetGap : f === 'swings' ? r.swing ?? 0 : f === 'market' ? r.priceMove ?? 0 : 0);
  return out.sort((a, b) => rank(b) - rank(a) || b.at.localeCompare(a.at) || a.id.localeCompare(b.id));
}

const scoreOf = (r: string | null | undefined): number | null => (r === '1-0' ? 1 : r === '0-1' ? 0 : r === '1/2-1/2' ? 0.5 : null);
const resultLabel = (r: string | null | undefined) => (r === '1/2-1/2' ? '½-½' : r ?? '*');

/** Library row for one of the player's finished games (swing from its latest complete analysis, if any). */
export function personalEntry(g: GameRecord, report: AnalysisReport | null, rivals: Set<string>): ReplayEntry {
  const us = report && report.status === 'complete' ? report.plies.map(p => expectedU(toPov(p.evalAfter, 'white'), report.methodology.accuracyId)) : null;
  const score = scoreOf(g.result);
  const opp = g.humanColor === 'white' ? g.black : g.white;
  return {
    id: g.id, kind: 'personal', white: g.white.name, black: g.black.name, whiteRating: g.white.rating, blackRating: g.black.rating, score, result: resultLabel(g.result),
    event: g.context.eventName ?? (isStudyGame(g) ? STUDY_LABEL : g.mode === 'training' ? 'Training' : g.rated ? 'Rated game' : 'Casual game'), stage: null, season: null, round: null,
    at: g.endedAt ?? g.startedAt, plies: g.moves.length, swing: us ? maxSwing(us) : null, priceMove: null, hasMarket: false, championshipFinal: false,
    // only rated games carry ratings that mean something for an upset
    rivalry: rivals.has(opp.id), upsetGap: g.rated ? upsetGapOf(g.white.rating, g.black.rating, score) : 0,
  };
}

/** Library row for a recorded federation game (swing from the published evaluations; price move from recorded points). */
export function federationEntry(wg: { id: string; event: string; stage?: string; season: number; round: number; white: string; black: string; whiteName: string; blackName: string; whiteRating: number; blackRating: number; moves: { score: EngineScore }[]; result: string; createdAt: string },
  points: RecordedPoint[] | null, rivalPairs: Set<string>, rivals: Set<string>, eventLabel: (e: string) => string = e => e): ReplayEntry {
  const us = wg.moves.map(m => expectedU(toPov(m.score, 'white')));
  const score = scoreOf(wg.result);
  const pm = points && points.length > 1 ? biggestPriceMove(points) : null;
  const pair = wg.white < wg.black ? `${wg.white}|${wg.black}` : `${wg.black}|${wg.white}`;
  return {
    id: wg.id, kind: 'federation', white: wg.whiteName, black: wg.blackName, whiteRating: wg.whiteRating, blackRating: wg.blackRating, score, result: resultLabel(wg.result),
    event: eventLabel(wg.event), stage: wg.stage ?? null, season: wg.season, round: wg.round, at: wg.createdAt, plies: wg.moves.length,
    swing: us.length ? maxSwing(us) : null, priceMove: pm ? Math.abs(pm.delta) : null, hasMarket: !!points && points.length > 0,
    championshipFinal: (wg.event === 'champ' || wg.event === 'club') && wg.stage === 'Final',
    rivalry: rivalPairs.has(pair) || rivals.has(wg.white) || rivals.has(wg.black), upsetGap: upsetGapOf(wg.whiteRating, wg.blackRating, score),
  };
}

/** Library row for an archived exhibition (unofficial: never a final, a rivalry game or an upset). */
export function exhibitionEntry(g: { id: string; white: { name: string; rating: number }; black: { name: string; rating: number }; moves: { score: EngineScore }[]; result: string | null; status: string; createdAt: string; finishedAt: string | null }): ReplayEntry {
  const us = g.moves.map(m => expectedU(toPov(m.score, 'white')));
  return {
    id: g.id, kind: 'exhibition', white: g.white.name, black: g.black.name, whiteRating: g.white.rating, blackRating: g.black.rating, score: scoreOf(g.result), result: g.status === 'finished' ? resultLabel(g.result) : '*',
    event: g.status === 'finished' ? 'Exhibition (unofficial)' : 'Exhibition (unfinished)', stage: null, season: null, round: null, at: g.finishedAt ?? g.createdAt, plies: g.moves.length,
    swing: us.length ? maxSwing(us) : null, priceMove: null, hasMarket: false, championshipFinal: false, rivalry: false, upsetGap: 0,
  };
}

/** Favourites and saved replay positions are bookmark records (store `bookmarks`, backed up with the career). */
export const favouriteId = (replayId: string) => `fav:${replayId}`;
export interface ReplayBookmark { id: string; gameId: string; ply: number; memorable: boolean; note: string; at: string; kind?: 'favourite' | 'position'; fen?: string; line?: string[]; sans?: string[] }
