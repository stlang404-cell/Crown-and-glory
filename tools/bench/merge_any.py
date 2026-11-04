"""Merge chunk files by prefix: python3 tools/bench/merge_any.py <chunk-prefix> → W/D/L, Elo, pair-bootstrap 95% CI, depth."""
import glob, json, math, random, sys
pre = sys.argv[1]
files = sorted(glob.glob(f'tools/bench/results/chunks/{pre}-o*.json'))
if not files: sys.exit(f'no chunks for {pre}')
d0 = json.load(open(files[0])); a = d0['summary']['a']
games = [g for f in files for g in json.load(open(f))['games']]
sc = lambda g: 0.5 if g['result'] == '1/2-1/2' else (1.0 if (g['result'] == '1-0') == (g['white'] == a) else 0.0)
pairs = [sc(games[i]) + sc(games[i + 1]) for i in range(0, len(games) - 1, 2)]
W = sum(sc(g) == 1 for g in games); D = sum(sc(g) == 0.5 for g in games); L = len(games) - W - D
elo = lambda s: -400 * math.log10(1 / min(max(s, 1e-6), 1 - 1e-6) - 1)
s = (W + D / 2) / len(games); random.seed(1)
b = sorted(sum(random.choice(pairs) for _ in pairs) / (2 * len(pairs)) for _ in range(4000))
dep = {}
for f in files:
    for k, v in json.load(open(f))['summary'].get('avgDepth', {}).items(): dep.setdefault(k, []).append(v)
ill = sum(json.load(open(f))['summary'].get('illegal', 0) for f in files)
print(f"{pre}: {len(games)} games +{W} ={D} -{L} score {s:.3f} elo {round(elo(s))} [{round(elo(b[100]))}, {round(elo(b[3899]))}] depth {{{', '.join(f'{k}: {sum(v)/len(v):.1f}' for k, v in dep.items())}}} illegal {ill}")
