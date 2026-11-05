/**
 * First-run guide (crown-tour-1, v1.0 package V): an optional, progressive, replayable set of steps that introduces
 * the game's features when they become relevant. Pure logic here; the UI is src/ui/Onboarding.tsx.
 *
 * Persistence: one additive meta record `tour:state` (carried in backups as learning progress, docs/SAVE_FORMAT.md).
 * A step is *done* when the save shows it happened (facts, e.g. a finished rated game) or when the player
 * acknowledged it ("Got it"). Explanations ("explain" steps) are shown until acknowledged; action steps disappear
 * once the action happened. Nothing here blocks play: every step can be skipped and the whole guide hidden.
 */
export const TOUR_KEY = 'tour:state';
export const TOUR_MODEL = 'crown-tour-1';

export type TourStepId = 'rules' | 'first-game' | 'first-rated' | 'replay' | 'federation' | 'tournament' | 'market' | 'honours' | 'trophy';

export interface TourState {
  v: 1;
  /** The whole guide is hidden (Settings → Help & Tutorials shows it again). */
  dismissed: boolean;
  /** Acknowledged / skipped steps: ISO time. */
  ack: Partial<Record<TourStepId, string>>;
  /** Things seen (e.g. `analysis` when a finished game's analysis was opened). */
  seen: Partial<Record<string, string>>;
  /** Times the guide was restarted from Settings. */
  restarts: number;
}

export const emptyTour = (): TourState => ({ v: 1, dismissed: false, ack: {}, seen: {}, restarts: 0 });

/** Validate an untrusted stored value (old or malformed records fall back to a fresh guide). */
export function sanitizeTour(raw: unknown): TourState {
  const t = emptyTour();
  if (!raw || typeof raw !== 'object') return t;
  const r = raw as Record<string, unknown>;
  const map = (x: unknown): Record<string, string> => {
    const out: Record<string, string> = {};
    if (x && typeof x === 'object') for (const [k, v] of Object.entries(x as Record<string, unknown>)) if (typeof v === 'string') out[k] = v;
    return out;
  };
  t.dismissed = r.dismissed === true;
  const ack = map(r.ack);
  for (const k of Object.keys(ack)) if (STEP_IDS.includes(k as TourStepId)) t.ack[k as TourStepId] = ack[k];
  t.seen = map(r.seen);
  t.restarts = typeof r.restarts === 'number' && Number.isFinite(r.restarts) ? Math.max(0, Math.floor(r.restarts)) : 0;
  return t;
}

/** What the save says about the player's progress (read-only facts). */
export interface TourFacts {
  games: number;
  ratedGames: number;
  federationGames: number;
  federation: boolean;
  /** Registered for or qualified into a Federation tournament (Swiss, knockout). */
  tournamentEntry: boolean;
  /** Ever held a position in a real (non-sandbox) market. */
  traded: boolean;
  trophies: number;
}

export type StepTarget = { name: 'play' } | { name: 'world' } | { name: 'tournaments' } | { name: 'exchange' } | { name: 'ranks' } | { name: 'hall' } | { name: 'grimoire'; path?: string } | { name: 'library' } | { name: 'profile' };

export interface TourStep {
  id: TourStepId;
  kind: 'action' | 'explain';
  title: string;
  /** One-line reason shown in the checklist. */
  why: string;
  /** The explanation (plain sentences; shown in the guide card and the screen's hint). */
  body: string[];
  cta: { label: string; to: StepTarget };
  more?: { label: string; to: StepTarget };
  /** When the step becomes relevant (progressive disclosure). */
  unlocked: (f: TourFacts, s: TourState) => boolean;
  /** Done from the save's facts (explain steps are done by acknowledgement only, unless stated). */
  happened: (f: TourFacts, s: TourState) => boolean;
  /** Shown while locked. */
  unlocksAfter: string;
}

export const STEPS: TourStep[] = [
  {
    id: 'rules', kind: 'explain', title: 'Learn the six-square rules',
    why: 'crown-la6-v1 is chess on a 6×6 board, with a few differences.',
    body: [
      'The board has six files (a–f) and six ranks. Each side has a king, a queen, two rooks, two knights and six pawns: there are no bishops.',
      'Pawns move one square only (no double step, no en passant) and promote on the last rank to a queen, rook or knight. There is no castling.',
      'Checkmate wins. Stalemate, king against king and repetition draw; if your flag falls you lose only when your opponent still has a piece besides the king.',
      'Book I of the Grimoire teaches the board and the pieces with short exercises; the Play screen keeps a "Rules at a Glance" summary.',
    ],
    cta: { label: 'Open the Rulebook (Grimoire, Book I)', to: { name: 'grimoire', path: 'b1' } },
    more: { label: 'Glossary', to: { name: 'grimoire', path: 'b8' } },
    unlocked: () => true, happened: () => false, unlocksAfter: '',
  },
  {
    id: 'first-game', kind: 'action', title: 'Play your first beginner opponent',
    why: 'Your career starts at 0 career Elo and the rank Commoner III.',
    body: [
      'New careers start at a career Elo of 0 and the Competitive Rank Commoner III, so the Play screen suggests the four calibrated beginners (measured below 800) first.',
      'Pick one, choose Casual or Rated, and play. Every game is saved and analysed afterwards; nothing about your first games is lost.',
    ],
    cta: { label: 'Choose a beginner on the Play screen', to: { name: 'play' } },
    unlocked: () => true, happened: f => f.games > 0, unlocksAfter: '',
  },
  {
    id: 'first-rated', kind: 'action', title: 'Finish a rated match',
    why: 'Rated games are unassisted and move your career Elo.',
    body: [
      'Choose Rated on the Play screen (30 minutes or longer, Classical 60+60 by default; shorter and untimed games are casual). There is no hint, evaluation bar or engine help while a rated game is in progress.',
      'After the game you see your career Elo before and after, with the change. It is provisional for your first 20 rated games and moves quickly; it only changes through results.',
    ],
    cta: { label: 'Start a rated game', to: { name: 'play' } },
    unlocked: f => f.games > 0, happened: f => f.ratedGames > 0, unlocksAfter: 'your first game',
  },
  {
    id: 'replay', kind: 'explain', title: 'Study your first game',
    why: 'Every finished game gets a move-by-move analysis.',
    body: [
      'Open a finished game from Games or the result screen. The analysis grades every move, draws the evaluation graph and marks the turning points; step through it with the arrow keys or the move list.',
      'The evaluation bar appears here (and when spectating), never in your own game in progress. Played Like estimates the strength each side showed in this one game.',
      'Mistakes from analysed games become puzzles in the Academy, so a loss turns into practice.',
    ],
    cta: { label: 'Open your games', to: { name: 'library' } },
    unlocked: f => f.games > 0, happened: (_f, s) => !!s.seen.analysis, unlocksAfter: 'your first finished game',
  },
  {
    id: 'federation', kind: 'action', title: 'Join the Federation',
    why: 'A shared league of AI competitors with seasons, tournaments and prizes.',
    body: [
      'Found the Six-Square Federation from the Federation screen: you join the Open Division of your home region with $1,000 of fictional money.',
      'Each round pairs you with a league opponent. Your own games are never played for you: play them, postpone them, or forfeit them before the round advances.',
    ],
    cta: { label: 'Go to the Federation', to: { name: 'world' } },
    unlocked: f => f.games > 0 || f.federation, happened: f => f.federation, unlocksAfter: 'your first game',
  },
  {
    id: 'tournament', kind: 'action', title: 'Play your first Federation match or tournament',
    why: 'League results, Swiss events and cups decide promotion, ranks and prizes.',
    body: [
      'Your league fixtures are under "Your Fixtures This Round". Swiss events (Federation Open, Challenger Open) and cups open by division and qualification; the Dashboard\'s "Qualification · What You Need" lists what you can enter and what it takes.',
      'Results move your division standing and, at each checkpoint, your Competitive Rank.',
    ],
    cta: { label: 'Open Tournaments', to: { name: 'tournaments' } },
    more: { label: 'Your fixtures', to: { name: 'world' } },
    unlocked: f => f.federation, happened: f => f.federationGames > 0 || f.tournamentEntry, unlocksAfter: 'joining the Federation',
  },
  {
    id: 'market', kind: 'explain', title: 'Your first live market',
    why: 'Trade fictional shares on match results at the Crown Exchange.',
    body: [
      'All money in this game is fictional. It cannot be bought, cashed out or transferred, and nothing here involves real money.',
      'A market sells shares in each outcome (White wins, draw, Black wins). A share pays $1 if its outcome happens and $0 if not, so its price — for example $0.62 — is the market\'s probability for that outcome.',
      'How losses work: you pay the price per share now. If your outcome does not happen, the shares are worth $0 and you lose what you paid (plus the small trading fee) — never more. You can sell (close) a position early at the current price while trading is open. If a market is cancelled (VOID), every share pays a third of $1.',
      'Trading closes when the game starts or the event begins; the market settles when the result is known, and your Finance screen shows every payment.',
    ],
    cta: { label: 'Open the Crown Exchange', to: { name: 'exchange' } },
    more: { label: 'Book VI: probability and prices', to: { name: 'grimoire', path: 'b6' } },
    unlocked: f => f.federation, happened: f => f.traded, unlocksAfter: 'joining the Federation',
  },
  {
    id: 'honours', kind: 'explain', title: 'Ranks, titles, Elo and Played Like',
    why: 'Four different measures that are easy to mix up.',
    body: [
      'Career Elo is your rating: a number (from 0 upward) that changes after every rated game, with an uncertainty (±).',
      'Competitive Rank (the Circuit Grade, Commoner III up to High Sovereign I, 48 steps) follows your division and standing at season checkpoints. It goes up and down by season; your highest rank is kept forever.',
      'Federation Titles are honours won in competitions and norms. They are never taken away and are independent of your rank.',
      'Played Like is a per-game performance estimate from the analysis of that game alone. It never changes your career Elo.',
    ],
    cta: { label: 'Open the rank guide', to: { name: 'ranks' } },
    more: { label: 'Your career', to: { name: 'profile' } },
    unlocked: f => f.ratedGames > 0 || f.federation, happened: () => false, unlocksAfter: 'your first rated game or joining the Federation',
  },
  {
    id: 'trophy', kind: 'action', title: 'Earn your first trophy',
    why: 'Trophies are awarded from your recorded results.',
    body: [
      'Trophies come from real results: a first Federation win, promotions, division titles, tournament podiums and more. They appear in a short ceremony and stay in your Trophy Hall.',
      'The Hall of Fame shows every trophy you can earn and what it takes; the Vault collects smaller achievements.',
    ],
    cta: { label: 'Open the Hall of Fame', to: { name: 'hall' } },
    unlocked: f => f.federation, happened: f => f.trophies > 0, unlocksAfter: 'joining the Federation',
  },
];
export const STEP_IDS: TourStepId[] = STEPS.map(s => s.id);
export const stepById = (id: TourStepId): TourStep => STEPS.find(s => s.id === id)!;

export type StepStatus = 'done' | 'current' | 'open' | 'locked';
export interface TourView {
  steps: { step: TourStep; status: StepStatus }[];
  current: TourStep | null;
  done: number;
  total: number;
  complete: boolean;
}

export const stepDone = (step: TourStep, f: TourFacts, s: TourState): boolean => !!s.ack[step.id] || step.happened(f, s);

/** The checklist: done / current (the first open step, in order) / open / locked. */
export function tourView(s: TourState, f: TourFacts): TourView {
  let current: TourStep | null = null;
  const steps = STEPS.map(step => {
    let status: StepStatus;
    if (stepDone(step, f, s)) status = 'done';
    else if (!step.unlocked(f, s)) status = 'locked';
    else if (!current) { current = step; status = 'current'; }
    else status = 'open';
    return { step, status };
  });
  const done = steps.filter(x => x.status === 'done').length;
  return { steps, current, done, total: STEPS.length, complete: done === STEPS.length };
}

/**
 * Whether a screen shows the contextual hint for a step: the guide is on, the step is relevant (unlocked) and not
 * acknowledged; action steps also disappear once they happened.
 */
export function hintVisible(id: TourStepId, s: TourState, f: TourFacts): boolean {
  if (s.dismissed) return false;
  const step = stepById(id);
  if (s.ack[id] || !step.unlocked(f, s)) return false;
  return step.kind === 'explain' || !step.happened(f, s);
}

export const ackStep = (s: TourState, id: TourStepId, nowIso: string): TourState => ({ ...s, ack: { ...s.ack, [id]: s.ack[id] ?? nowIso } });
export const markSeen = (s: TourState, key: string, nowIso: string): TourState => (s.seen[key] ? s : { ...s, seen: { ...s.seen, [key]: nowIso } });
/** Replay the guide: every explanation and hint shows again; facts already recorded stay done. */
export const restartTour = (s: TourState): TourState => ({ ...s, dismissed: false, ack: {}, restarts: s.restarts + 1 });
export const setDismissed = (s: TourState, dismissed: boolean): TourState => ({ ...s, dismissed });
