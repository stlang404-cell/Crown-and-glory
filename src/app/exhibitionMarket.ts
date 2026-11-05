/**
 * Practice market on an exhibition (v1.1 AI vs AI Arena; docs/AI_ARENA.md). Optional, opened by the player before or
 * during an exhibition. It REUSES the casual Sandbox Exchange (FederationService.openSandbox and friends): the same
 * LMSR market engine (src/exchange/market.ts), kind 'sandbox', and the same practice wallet `sandbox:player`. Every
 * amount lives in `sandbox:*` accounts, which the ledger refuses to mix with official accounts in any journal
 * (src/exchange/ledger.ts), and which official cash, net worth, P&L, prestige, ratings and standings never read.
 *
 * Information policy (docs/ODDS_MODEL.md, crown-arena-policy-1): the only public information is the published moves and
 * the moving engine's own evaluation of each. After each published move a practice market maker (`sandbox:maker`,
 * funded by explicit sandbox mint entries) re-anchors prices to the public live model (crown-odds-2 on the two public
 * ratings/RDs, the published evaluation, the ply and the material) — so prices change only from published moves and
 * the player's own trades. No hidden strength and no future move is ever used. Trades carry the ply they were quoted
 * on and are rejected once another move has been published.
 *
 * Lifecycle: open → (trading between published moves) → closed when Skip to Result is pressed or the game ends →
 * settled exactly once on the result (journal `settle:<market>`, idempotent), or VOID (cancelled at the published
 * opening prices) when the exhibition is restarted, deleted unfinished, or ends at the 400-ply playing limit.
 */
import { pregameWdl, liveModelVector, whiteCp, materialOfFen } from '../exchange/odds';
import { normaliseModel } from '../exchange/families';
import type { ExhibitionGame } from './exhibition';

export const EXH_MARKET_PREFIX = 'sbx:';
export const exhibitionMarketId = (exhibitionId: string) => `${EXH_MARKET_PREFIX}${exhibitionId}`;
export const isExhibitionMarketId = (id: string) => id.startsWith(EXH_MARKET_PREFIX);
/** Liquidity of a practice market (crowns of practice money). */
export const EXH_MARKET_B = 80;
/** The practice market maker's account (sandbox money only). */
export const EXH_MAKER = 'sandbox:maker';
export const EXH_OUTCOMES = ['White wins', 'Draw', 'Black wins'];
export const EXH_MARKET_RULES = 'Practice market on an unofficial exhibition, traded with sandbox (practice) money only. Opens at the public rating-based forecast. '
  + 'After every published move a practice market maker moves the prices to the public live model (the two public ratings, the moving engine’s published evaluation, the move number and the material); between moves only your trades move them. '
  + 'Trading cutoff: trading stops when a move is being published (a trade quoted before it is rejected), when you press Skip to Result, and at the final move. '
  + 'Settlement: once, on the exhibition result (1 practice dollar per winning share; 1% fee on every trade). '
  + 'Void: if the exhibition is restarted, deleted before it ends, or reaches the 400-ply playing limit, the market is cancelled and every share pays its published opening price. '
  + 'Sandbox money never affects official cash, net worth, ratings, standings, records or prestige.';

const pub = (s: { rating: number; rd: number }) => ({ rating: s.rating, rd: s.rd });

/** Opening prices: the pre-game public forecast (ratings and RDs recorded at the start of the exhibition). */
export function exhibitionPrior(g: Pick<ExhibitionGame, 'white' | 'black'>): number[] {
  const p = pregameWdl(pub(g.white), pub(g.black));
  return normaliseModel([p.w, p.d, p.l], 0.02);
}

/** The public live model after the published moves (the prior before the first move). */
export function exhibitionLiveModel(g: Pick<ExhibitionGame, 'white' | 'black' | 'moves'>, ply = g.moves.length): number[] {
  if (ply <= 0) return exhibitionPrior(g);
  const m = g.moves[ply - 1];
  return liveModelVector({ white: pub(g.white), black: pub(g.black), ply, evalCp: whiteCp(m.score), material: materialOfFen(m.fen) });
}

/** State index of a result (White, Draw, Black). */
export const resultState = (r: '1-0' | '0-1' | '1/2-1/2'): number => (r === '1-0' ? 0 : r === '0-1' ? 2 : 1);
/** Terminations that void a practice market (as official in-play markets). */
export const voidsMarket = (termination: string | null) => termination === 'playing-limit';
