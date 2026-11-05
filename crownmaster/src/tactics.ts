import { Position } from '../../src/rules/position';
import { RAYS } from '../../src/rules/tables';
import { parseLegalCcn } from '../../src/rules/notation';
import { pieceType, pieceColor, moveFrom, moveTo, squareName } from '../../src/rules/types';
/** Conservative motifs: observable geometry and legally replayed PV events. No claims of forced material gains. */
export function tacticalFacts(root: Position, line: string[]): string[] {
  const first = parseLegalCcn(root, line[0] ?? ''); if (first < 0) return [];
  const p = root.clone(), mover = root.side, from = moveFrom(first), to = moveTo(first); p.makeMove(first);
  const facts: string[] = [];
  for (let sq = 0; sq < 36; sq++) {
    const piece = p.board[sq], type = pieceType(piece); if (!piece || pieceColor(piece) !== mover || (type !== 3 && type !== 4)) continue;
    for (let dir = 0; dir < 8; dir++) {
      // Ray order is checked against geometry rather than relying on table direction numbering.
      const ray = RAYS[sq][dir]; if (!ray?.length) continue;
      const diagonal = Math.abs(ray[0] % 6 - sq % 6) === 1 && Math.abs(Math.floor(ray[0]/6)-Math.floor(sq/6)) === 1;
      if (type === 3 && diagonal) continue;
      const occupied = ray.filter(x => p.board[x]); if (occupied.length < 2) continue;
      const [a,b] = occupied; if (pieceColor(p.board[a]) === mover || pieceColor(p.board[b]) === mover) continue;
      if (pieceType(p.board[b]) === 5 && pieceType(p.board[a]) !== 5) facts.push(`Pin: the piece on ${squareName(a)} shields its king from the ${type === 3 ? 'rook' : 'queen'} on ${squareName(sq)}.`);
      if (pieceType(p.board[a]) === 5) facts.push(`Skewer geometry: the king on ${squareName(a)} stands in front of ${squareName(b)} on the ${squareName(sq)} attack line. This alone does not prove that the rear piece can be won.`);
      if (sq !== to && a === from) continue;
    }
  }
  // A stationary slider gains a direct line attack by the first move vacating its ray.
  for (let sq = 0; sq < 36; sq++) {
    if (sq === to || !p.board[sq] || pieceColor(p.board[sq]) !== mover || ![3,4].includes(pieceType(p.board[sq]))) continue;
    for (const ray of RAYS[sq]) {
      const diagonal = ray.length > 0 && Math.abs(ray[0]%6-sq%6)===1 && Math.abs(Math.floor(ray[0]/6)-Math.floor(sq/6))===1;
      if (pieceType(p.board[sq]) === 3 && diagonal) continue;
      const target = ray.find(x => !!p.board[x]);
      if (target !== undefined && ray.indexOf(from) >= 0 && ray.indexOf(from) < ray.indexOf(target) && pieceColor(p.board[target]) !== mover) facts.push(`Discovered attack: vacating ${squareName(from)} opens the ${squareName(sq)}–${squareName(target)} line.`);
    }
  }
  if (root.inCheck()) facts.push('Defensive resource: this move is a legal answer to the current check.');
  // Hanging means attacked and no geometric defender, not necessarily safely capturable.
  const enemy = p.side;
  for (let sq = 0; sq < 36; sq++) if (p.board[sq] && pieceColor(p.board[sq]) === enemy && pieceType(p.board[sq]) !== 5 && p.isAttacked(sq, mover) && !p.isAttacked(sq, enemy)) facts.push(`Hanging-piece warning: ${squareName(sq)} is attacked and has no geometric defender. Check the reply before assuming a safe capture.`);
  const q = root.clone(); const events: {i:number; from:number; to:number; capture:boolean; type:number; side:number}[] = [];
  for (let i=0;i<line.length;i++) { const m=parseLegalCcn(q,line[i]); if(m<0) throw new Error('Illegal tactical evidence line'); events.push({i,from:moveFrom(m),to:moveTo(m),capture:!!q.board[moveTo(m)],type:pieceType(q.board[moveFrom(m)]),side:q.side}); q.makeMove(m); }
  if (events.length >= 3 && events[1].capture && events[1].to === to) facts.push(`Sacrifice candidate in the searched line: the opponent captures the moved piece on ${squareName(to)}. The continuation, rather than the sacrifice alone, determines its value.`);
  if (events.some(e => e.i>0 && line[e.i].length===5)) facts.push('Promotion combination: the displayed legal continuation includes a promotion. Follow each reply to see how it is reached.');
  return [...new Set(facts)].slice(0,6);
}
