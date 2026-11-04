"""Fit and validate the "Played Like" estimator (crown-played-like-1) on the analysed calibration games.

Target: the measured strength of the engine level that played the side (src/engine/calibration.json, 800–2926 on
the Crown scale, measured by results — not FIDE). Inputs: move quality only (expected-score losses from the
canonical analysis), never the result and never the opponent's rating (in the calibration suite opponents are
adjacent levels, so the opponent's rating would leak the answer through the pairing).

Split: by colour-swapped opening pair — every third pair is held out, so no opening is in both sets.
Writes src/analysis/played-like-model.json and prints held-out metrics.
   python3 tools/perf/fit_played_like.py [features=tools/perf/calibration-features.jsonl]
"""
import json, math, sys
import numpy as np

FEAT = sys.argv[1] if len(sys.argv) > 1 else 'tools/perf/calibration-features.jsonl'
cal = json.load(open('src/engine/calibration.json'))
LEVEL = {f"crown-L{l['level']}": l['rating'] for l in cal['levels']}
BOOK_PLIES = 4          # first plies come from the benchmark opening book (and are book-like in real games)
MIN_MOVES = 8           # fewer eligible moves => "Insufficient data"
EPS = 0.005

def feats(losses):
    a = np.array(losses)
    m = float(a.mean())
    return [1.0, math.log(m + EPS), float((a >= 0.10).mean()), float((a <= 0.005).mean())]

rows = []
for line in open(FEAT):
    g = json.loads(line)
    match, idx = g['key'].split('#'); idx = int(idx)
    for pov, s in (('white', g['w']), ('black', g['b'])):
        name = g[pov]
        losses = [l for l, p in zip(s['losses'], s['plies']) if p > BOOK_PLIES]
        rows.append({'match': match, 'pair': idx // 2, 'test': (idx // 2) % 3 == 2, 'rating': LEVEL[name], 'level': name,
                     'n': len(losses), 'losses': losses, 'acc': g['accuracy'][pov]})

usable = [r for r in rows if r['n'] >= MIN_MOVES]
train = [r for r in usable if not r['test']]; test = [r for r in usable if r['test']]
X = np.array([feats(r['losses']) for r in train]); y = np.array([r['rating'] for r in train])
w = np.sqrt(np.array([r['n'] for r in train]))  # longer games carry more information
beta, *_ = np.linalg.lstsq(X * w[:, None], y * w, rcond=None)

def predict(r): return float(np.dot(beta, feats(r['losses'])))
res_train = np.array([predict(r) - r['rating'] for r in train])
# uncertainty model: residual variance = s0^2 + s1^2 / n, fitted on training residuals by least squares on squares
A = np.array([[1.0, 1.0 / r['n']] for r in train]); v = res_train ** 2
s, *_ = np.linalg.lstsq(A, v, rcond=None); s = np.maximum(s, 0)
sd = lambda n: math.sqrt(s[0] + s[1] / n)

def metrics(rs, f):
    e = np.array([f(r) - r['rating'] for r in rs]); t = np.array([r['rating'] for r in rs]); p = t + e
    inside = np.mean([abs(f(r) - r['rating']) <= 1.645 * sd(r['n']) for r in rs]) if f is predict else None
    return {'n': len(rs), 'mae': round(float(np.abs(e).mean())), 'rmse': round(float(np.sqrt((e ** 2).mean()))),
            'r': round(float(np.corrcoef(p, t)[0, 1]), 3), 'bias': round(float(e.mean())), 'cover90': None if inside is None else round(float(inside), 3)}

# naive baseline: rating as a straight line in accuracy (the "accuracy × constant" family)
Xa = np.array([[1.0, r['acc'] or 0] for r in train]); ba, *_ = np.linalg.lstsq(Xa, y, rcond=None)
naive = lambda r: float(ba[0] + ba[1] * (r['acc'] or 0))
# null model: everyone gets the training mean
null = lambda r: float(y.mean())

by_level = {}
for r in test:
    by_level.setdefault(r['level'], []).append(predict(r))
levels = {k: {'true': LEVEL[k], 'meanPredicted': round(float(np.mean(v))), 'n': len(v)} for k, v in sorted(by_level.items(), key=lambda kv: LEVEL[kv[0]])}
mono = all(a['meanPredicted'] < b['meanPredicted'] for a, b in zip(list(levels.values()), list(levels.values())[1:]))

out = {
    'id': 'crown-played-like-1-experimental',
    'status': 'experimental: fitted on engine-vs-engine games only (L1–L8, 800–2926 Crown scale); no human games',
    'analysis': {'engine': 'crown-search-2+crown-eval-4', 'settings': 'std-d7', 'grading': 'crown-grade-v3-experimental'},
    'features': ['intercept', 'ln(mean expected-score loss + 0.005)', 'share of moves losing >= 0.10', 'share of moves losing <= 0.005'],
    'beta': [round(float(b), 3) for b in beta], 'eps': EPS, 'bookPlies': BOOK_PLIES, 'minMoves': MIN_MOVES,
    'sd': {'s0sq': round(float(s[0]), 1), 's1sq': round(float(s[1]), 1)},
    'calibratedRange': [int(min(LEVEL.values())), int(max(r['rating'] for r in rows))],
    'validation': {'heldOut': metrics(test, predict), 'train': metrics(train, predict), 'naiveAccuracyLine': metrics(test, naive), 'nullMean': metrics(test, null),
                   'heldOutByLevel': levels, 'monotoneByLevel': mono,
                   'excludedInsufficient': len(rows) - len(usable), 'samples': len(rows)},
}
json.dump(out, open('src/analysis/played-like-model.json', 'w'), indent=1)
print(json.dumps(out['validation'], indent=1)); print('beta', out['beta'], 'sd(n=20)', round(sd(20)), 'sd(n=40)', round(sd(40)))
