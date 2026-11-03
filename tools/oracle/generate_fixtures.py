"""Generate independent differential-rules fixtures for crown-la6-v1 using Fairy-Stockfish (pyffish).

Usage (from repo root, inside an isolated venv):
    pip install pyffish==0.0.90
    python -I tools/oracle/generate_fixtures.py --positions 5000 --seed 20261103 --out tests/fixtures/oracle_positions.json

pyffish (GPL-3.0) is a development-only oracle; it is NOT bundled with or required by the game.
Each record: FEN (Fairy-Stockfish 6-file FEN), sorted legal UCI moves, and for every legal move the
resulting FEN, so both move generation and successor-state transitions are cross-checked.
Positions are sampled along seeded random games that are biased towards captures, checks and
promotions to cover tactical edge cases (pins, evasions, promotion choices, king adjacency).
"""
import argparse, json, random
import pyffish as sf

V = 'losalamos'

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--positions', type=int, default=5000)
    ap.add_argument('--seed', type=int, default=20261103)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    rng = random.Random(a.seed)
    start = sf.start_fen(V)
    out, games = [], 0
    while len(out) < a.positions:
        games += 1
        fen = start
        for ply in range(220):
            moves = sorted(sf.legal_moves(V, fen, []))
            succ = {m: sf.get_fen(V, fen, [m]) for m in moves}
            out.append({'fen': fen, 'moves': moves, 'next': [succ[m] for m in moves],
                        'check': bool(sf.gives_check(V, fen, [])),
                        'result': sf.game_result(V, fen, []) if not moves else None})
            if not moves or len(out) >= a.positions:
                break
            # bias: promotions and captures more likely
            weights = []
            for m in moves:
                w = 1.0
                if len(m) == 5: w += 3.0
                if sf.gives_check(V, fen, [m]): w += 1.5
                tgt = m[2:4]
                # crude capture detection: piece count drops
                if sf.get_fen(V, fen, [m]).split(' ')[0].count('/') == 5:
                    before = sum(c.isalpha() for c in fen.split(' ')[0])
                    after = sum(c.isalpha() for c in succ[m].split(' ')[0])
                    if after < before: w += 2.0
                weights.append(w)
            fen = succ[rng.choices(moves, weights=weights)[0]]
    meta = {'oracle': 'pyffish', 'pyffish_version': '.'.join(map(str, sf.version())), 'variant': V,
            'seed': a.seed, 'games': games, 'positions': len(out)}
    with open(a.out, 'w') as f:
        json.dump({'meta': meta, 'positions': out}, f, separators=(',', ':'))
    print(json.dumps(meta))

if __name__ == '__main__':
    main()
