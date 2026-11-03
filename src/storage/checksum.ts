/** SHA-256 helpers (WebCrypto, available in browsers and Node >= 19). */
import type { GameRecord } from '../games/types';

export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Canonical content of a game used for its checksum (rules-relevant record content only). */
export function canonicalGame(g: GameRecord): string {
  return JSON.stringify({
    id: g.id, variantId: g.variantId, rulesVersion: g.rulesVersion, initialFen: g.initialFen,
    moves: g.moves.map(m => m.ccn), result: g.result, termination: g.termination,
  });
}

export const gameChecksum = (g: GameRecord) => sha256Hex(canonicalGame(g));
