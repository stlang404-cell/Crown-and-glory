"""Merge chunked match results (tools/bench/results/chunks) into one summary with a pair-based Elo CI.
   python3 tools/bench/merge_chunks.py <idA> <idB>"""
import glob, json, math, random, sys
a, b = sys.argv[1], sys.argv[2]
files = sorted(glob.glob(f'tools/bench/results/chunks/match-{a}-vs-{b}-v8c-o*.json'))
games = [g for f in files for g in json.load(open(f))['games']]
def score(g):  # score of A in one game
    r = g['result']; wa = g['white'] == a
    return 0.5 if r == '1/2-1/2' else (1.0 if (r == '1-0') == wa else 0.0)
pairs = [score(games[i]) + score(games[i + 1]) for i in range(0, len(games) - 1, 2)]
W = sum(1 for g in games if score(g) == 1); D = sum(1 for g in games if score(g) == 0.5); L = len(games) - W - D
elo = lambda s: -400 * math.log10(1 / min(max(s, 1e-6), 1 - 1e-6) - 1)
s = (W + D / 2) / len(games)
random.seed(1); boots = sorted(sum(random.choice(pairs) for _ in pairs) / (2 * len(pairs)) for _ in range(4000))
lo, hi = elo(boots[100]), elo(boots[3899])
ill = sum(1 for f in files for _ in [0] if json.load(open(f))['summary'].get('illegal', 0))
print(f"{a} vs {b}: {len(games)} games ({len(files)} chunks) +{W} ={D} -{L} score {s:.3f} elo {round(elo(s))} [{round(lo)}, {round(hi)}] illegal-chunks {ill}")
json.dump({'a': a, 'b': b, 'games': len(games), 'wins': W, 'draws': D, 'losses': L, 'score': s, 'eloDiff': round(elo(s)), 'eloCI': [round(lo), round(hi)], 'chunks': files},
          open(f'tools/bench/results/match-{a}-vs-{b}-v8confirm-merged.json', 'w'), indent=1)
