"""Fit and validate Played Like (crown-played-like-2) on the analysed spectrum corpus.

Input: tools/playedlike/data/features-<settings>.jsonl (tools/playedlike/features.ts; one row per side; true target =
the calibrated rating of the engine that played that side). Never uses the result, the opponent or any rating as input.

Model (numpy only, deterministic):
  1. z = standardised features (train means/SDs); score s = ridge regression of rating on z, ridge λ chosen by
     grouped 5-fold cross-validation on the TRAINING set (groups = openings), rows weighted n / (n + 10);
  2. a monotone piecewise-linear calibration g(s) (knots at training quantiles of s, least squares, made monotone by
     pooling adjacent violators) — rating = g(s), clipped to the calibrated range;
  3. uncertainty: out-of-fold residuals r on the training set; var(r | n) = a + b / n fitted by least squares on r²;
     intervals rating ± z·sd(n), checked by coverage on the held-out set.
Held out: hash(opening) % 4 == 0 (assigned in features.ts). Baselines (fitted on the same training rows): the training
mean, and the "accuracy line" rating = a + b × accuracy.

Writes src/analysis/played-like-model.json and prints the validation.
   python3 tools/playedlike/fit.py [settings=std-d7] [minMoves=8]
"""
import json, math, sys
import numpy as np

SETTINGS = sys.argv[1] if len(sys.argv) > 1 else 'std-d7'
MIN_MOVES = int(sys.argv[2]) if len(sys.argv) > 2 else 8
FEATURES = ['lnMean', 'lnTrim', 'blunder', 'mistake', 'precise', 'lnHard', 'lnEasy', 'onlyFound', 'lnLegal', 'swing', 'endShare']
BANDS = [(0, 799, 'weak 0-799'), (800, 1599, 'intermediate 800-1599'), (1600, 2399, 'advanced 1600-2399'), (2400, 99999, 'elite 2400+')]
W_K = 10.0
KNOTS = 7

rows = [json.loads(l) for l in open(f'tools/playedlike/data/features-{SETTINGS}.jsonl') if l.strip()]
all_rows = rows
rows = [r for r in rows if r['n'] >= MIN_MOVES]
train = [r for r in rows if not r['test']]
test = [r for r in rows if r['test']]

def X_of(rs): return np.array([[r[f] for f in FEATURES] for r in rs], dtype=float)
def y_of(rs): return np.array([r['rating'] for r in rs], dtype=float)
import os
BALANCE = os.environ.get('BALANCE', '1') == '1'
def w_of(rs):
    w = np.array([r['n'] / (r['n'] + W_K) for r in rs], dtype=float)
    if BALANCE:  # each engine strength carries the same total weight (the corpus is ~70 % beginner games)
        cnt = {}
        for r in rs: cnt[r['engine']] = cnt.get(r['engine'], 0) + 1
        w = w * np.array([len(rs) / len(cnt) / cnt[r['engine']] for r in rs])
    return w

def fnv(s):
    x = 2166136261
    for ch in s.encode('utf-16-le')[::2]:  # JS charCodeAt for ASCII
        x ^= ch; x = (x * 16777619) & 0xffffffff
    x ^= x >> 16; x = (x * 0x85ebca6b) & 0xffffffff; x ^= x >> 13; x = (x * 0xc2b2ae35) & 0xffffffff; x ^= x >> 16
    return x

# Sign constraints (monotonicity): more loss must never read as stronger. -1: coefficient <= 0, +1: >= 0, 0: free
# (context features that describe the positions, not the quality of the moves).
SIGNS = {'lnMean': -1, 'lnTrim': -1, 'blunder': -1, 'mistake': -1, 'precise': 1, 'lnHard': -1, 'lnEasy': -1, 'onlyFound': 1, 'lnLegal': 0, 'swing': 0, 'endShare': 0}

def fit_ridge(X, y, w, lam):
    """weighted ridge with sign constraints: refit with violating coefficients fixed at 0 until none violates."""
    mu = np.average(X, axis=0, weights=w); sd = np.sqrt(np.average((X - mu) ** 2, axis=0, weights=w)); sd[sd == 0] = 1
    Z = (X - mu) / sd
    A = np.hstack([np.ones((len(Z), 1)), Z])
    W = np.diag(w)
    active = np.ones(A.shape[1], dtype=bool)
    sgn = np.array([0] + [SIGNS[f] for f in FEATURES])
    for _ in range(A.shape[1]):
        idx = np.where(active)[0]
        As = A[:, idx]
        P = lam * np.eye(len(idx)); P[0, 0] = 0
        b = np.linalg.solve(As.T @ W @ As + P, As.T @ W @ y)
        beta = np.zeros(A.shape[1]); beta[idx] = b
        bad = (sgn * beta < 0)
        if not bad.any(): break
        # drop the most violating coefficient (in standardised units) and refit
        k = int(np.argmax(np.where(bad, np.abs(beta), -1))); active[k] = False
    return mu, sd, beta

def score(m, X):
    mu, sd, beta = m
    return beta[0] + ((X - mu) / sd) @ beta[1:]

def pava(y, w):
    """weighted pool-adjacent-violators (non-decreasing)."""
    blocks = [[yi, wi, 1] for yi, wi in zip(y, w)]
    out = []
    for b in blocks:
        out.append(b)
        while len(out) > 1 and out[-2][0] > out[-1][0]:
            b2 = out.pop(); b1 = out.pop()
            ww = b1[1] + b2[1]
            out.append([(b1[0] * b1[1] + b2[0] * b2[1]) / ww, ww, b1[2] + b2[2]])
    res = []
    for v, _, c in out: res += [v] * c
    return np.array(res)

def fit_calib(s, y, w):
    """monotone piecewise-linear g(s): knots at quantiles of s; values by least squares on hat functions, then PAVA."""
    q = np.quantile(s, np.linspace(0, 1, KNOTS))
    q = np.unique(q)
    B = np.zeros((len(s), len(q)))
    for i, x in enumerate(s):
        if x <= q[0]: B[i, 0] = 1; continue
        if x >= q[-1]: B[i, -1] = 1; continue
        j = np.searchsorted(q, x) - 1
        t = (x - q[j]) / (q[j + 1] - q[j]); B[i, j] = 1 - t; B[i, j + 1] = t
    W = np.diag(w)
    v = np.linalg.solve(B.T @ W @ B + 1e-6 * np.eye(len(q)), B.T @ W @ y)
    v = pava(v, B.sum(axis=0) + 1e-9)
    return q, v

def apply_calib(c, s):
    q, v = c
    return np.interp(s, q, v)

LO = min(r['rating'] for r in all_rows); HI = max(r['rating'] for r in all_rows)

def fit_all(rs, lam):
    X, y, w = X_of(rs), y_of(rs), w_of(rs)
    m = fit_ridge(X, y, w, lam)
    c = fit_calib(score(m, X), y, w)
    return m, c

def predict(model, rs):
    m, c = model
    return np.clip(apply_calib(c, score(m, X_of(rs))), LO, HI)

# grouped folds on the training set (by opening)
folds = [fnv(r['opening'] + '#fold') % 5 for r in train]

def oof(lam):
    p = np.zeros(len(train))
    for k in range(5):
        tr = [r for r, f in zip(train, folds) if f != k]; te_i = [i for i, f in enumerate(folds) if f == k]
        model = fit_all(tr, lam)
        p[te_i] = predict(model, [train[i] for i in te_i])
    return p

y_tr = y_of(train)
lams = [0.1, 1, 3, 10, 30, 100, 300]
cv = {lam: float(np.sqrt(np.mean((oof(lam) - y_tr) ** 2))) for lam in lams}
LAM = min(cv, key=cv.get)
model = fit_all(train, LAM)
p_oof = oof(LAM)
res = p_oof - y_tr
n_tr = np.array([r['n'] for r in train], dtype=float)
# heteroscedastic: the residual scale depends on the number of informative moves AND on the predicted level.
# log-linear scale model (always positive): log r^2 ~ a + b ln n + c q + d q^2, q = predicted rating / 1000, fitted by
# least squares on the out-of-fold residuals; the constant offset of E[log r^2] is absorbed by the multipliers below.
pk = p_oof / 1000
A = np.stack([np.ones_like(n_tr), np.log(n_tr), pk, pk ** 2], axis=1)
coef, *_ = np.linalg.lstsq(A, np.log(res ** 2 + 25.0 ** 2), rcond=None)
a_var, b_var, c_var, d_var = (float(x) for x in coef)
VAR_MIN = 0.0
def sd_of(n, p):
    q = p / 1000
    return math.exp(0.5 * (a_var + b_var * math.log(n) + c_var * q + d_var * q * q))
# interval multipliers from the out-of-fold standardised residuals (not the normal 1.28 / 1.96: residuals are
# heavy-tailed), so the 80 % / 95 % intervals have their nominal coverage out of fold; held out checks them
zs = np.abs(res) / np.array([sd_of(n, p) for n, p in zip(n_tr, p_oof)])
Z80 = float(np.quantile(zs, 0.80)); Z95 = float(np.quantile(zs, 0.95))

def spearman(a, b):
    ra = np.argsort(np.argsort(a)).astype(float); rb = np.argsort(np.argsort(b)).astype(float)
    # average ties
    def avg_rank(x):
        order = np.argsort(x, kind='mergesort'); ranks = np.empty(len(x)); xs = np.array(x)[order]
        i = 0
        while i < len(xs):
            j = i
            while j + 1 < len(xs) and xs[j + 1] == xs[i]: j += 1
            ranks[order[i:j + 1]] = (i + j) / 2; i = j + 1
        return ranks
    ra, rb = avg_rank(a), avg_rank(b)
    return float(np.corrcoef(ra, rb)[0, 1])

def band_of(x):
    for lo, hi, name in BANDS:
        if lo <= x <= hi: return name
    return BANDS[-1][2]

def metrics(pred, rs, with_sd=True):
    y = y_of(rs); e = pred - y
    out = {'n': len(rs), 'mae': round(float(np.mean(np.abs(e))), 1), 'rmse': round(float(np.sqrt(np.mean(e ** 2))), 1),
           'spearman': round(spearman(pred, y), 3), 'pearson': round(float(np.corrcoef(pred, y)[0, 1]), 3) if np.std(pred) > 0 else None,
           'bias': round(float(np.mean(e)), 1)}
    if with_sd:
        sds = np.array([sd_of(r['n'], p) for r, p in zip(rs, pred)])
        out['cover80'] = round(float(np.mean(np.abs(e) <= Z80 * sds)), 3)
        out['cover95'] = round(float(np.mean(np.abs(e) <= Z95 * sds)), 3)
    bands = {}
    for lo, hi, name in BANDS:
        idx = [i for i, r in enumerate(rs) if lo <= r['rating'] <= hi]
        if not idx: continue
        ei = e[idx]; pi = pred[idx]
        b = {'n': len(idx), 'meanTrue': round(float(np.mean(y[idx]))), 'meanPred': round(float(np.mean(pi))), 'bias': round(float(np.mean(ei)), 1),
             'mae': round(float(np.mean(np.abs(ei))), 1), 'sePred': round(float(np.std(pi) / math.sqrt(len(idx))), 1)}
        if with_sd:
            sds = np.array([sd_of(rs[i]['n'], pred[i]) for i in idx])
            b['cover80'] = round(float(np.mean(np.abs(ei) <= Z80 * sds)), 3); b['cover95'] = round(float(np.mean(np.abs(ei) <= Z95 * sds)), 3)
        b['predBand'] = {nm: int(sum(1 for v in pi if band_of(v) == nm)) for _, _, nm in BANDS}
        bands[name] = b
    out['bands'] = bands
    return out

pred_te = predict(model, test)
pred_tr = predict(model, train)
# baselines
mean_base = np.full(len(test), float(np.mean(y_tr)))
acc_tr = np.array([r['accuracy'] if r['accuracy'] is not None else 0 for r in train]); acc_te = np.array([r['accuracy'] if r['accuracy'] is not None else 0 for r in test])
ba, *_ = np.linalg.lstsq(np.stack([np.ones_like(acc_tr), acc_tr], 1), y_tr, rcond=None)
acc_base = np.clip(ba[0] + ba[1] * acc_te, LO, HI)
lm_tr = np.array([r['lnMean'] for r in train]); lm_te = np.array([r['lnMean'] for r in test])
bl, *_ = np.linalg.lstsq(np.stack([np.ones_like(lm_tr), lm_tr], 1), y_tr, rcond=None)
loss_base = np.clip(bl[0] + bl[1] * lm_te, LO, HI)

V = {
    'heldOut': metrics(pred_te, test),
    'train': metrics(pred_tr, train),
    'trainOutOfFold': metrics(p_oof, train),
    'baselineMean': metrics(mean_base, test, False),
    'baselineAccuracyLine': {**metrics(acc_base, test, False), 'coef': [round(float(x), 3) for x in ba]},
    'baselineLossLine': {**metrics(loss_base, test, False), 'coef': [round(float(x), 3) for x in bl]},
}
# per engine (held out)
eng = {}
for r, p in zip(test, pred_te):
    eng.setdefault(r['engine'], {'true': r['rating'], 'p': []})['p'].append(float(p))
V['heldOutByEngine'] = {k: {'true': v['true'], 'n': len(v['p']), 'meanPred': round(float(np.mean(v['p']))), 'sdPred': round(float(np.std(v['p'])))} for k, v in sorted(eng.items(), key=lambda kv: kv[1]['true'])}
# by informative-move count (held out)
byn = {}
for lo, hi in [(MIN_MOVES, 11), (12, 19), (20, 29), (30, 999)]:
    idx = [i for i, r in enumerate(test) if lo <= r['n'] <= hi]
    if not idx: continue
    e = pred_te[idx] - y_of(test)[idx]; sds = np.array([sd_of(test[i]['n'], pred_te[i]) for i in idx])
    byn[f'{lo}-{hi}'] = {'n': len(idx), 'rmse': round(float(np.sqrt(np.mean(e ** 2))), 1), 'sdModel': round(float(np.mean(sds))), 'cover80': round(float(np.mean(np.abs(e) <= Z80 * sds)), 3), 'cover95': round(float(np.mean(np.abs(e) <= Z95 * sds)), 3)}
V['heldOutByMoves'] = byn

# gate
H = V['heldOut']; bands = H['bands']
band_means = [bands[nm]['meanPred'] for _, _, nm in BANDS if nm in bands]
band_ses = [bands[nm]['sePred'] for _, _, nm in BANDS if nm in bands]
distinct = len(band_means) == 4 and all(band_means[i + 1] - band_means[i] > 1.96 * math.hypot(band_ses[i], band_ses[i + 1]) for i in range(3))
beats = all(H[k] < V[b][k] for b in ('baselineMean', 'baselineAccuracyLine') for k in ('mae', 'rmse')) and H['spearman'] > V['baselineAccuracyLine']['spearman']
coverage_ok = 0.75 <= H['cover80'] <= 0.88 and 0.91 <= H['cover95'] <= 0.98
gate = {'beatsBaselines': bool(beats), 'bandsDistinguishable': bool(distinct), 'coverageOk': bool(coverage_ok), 'passed': bool(beats and distinct and coverage_ok),
        'rule': 'held-out MAE and RMSE below both the mean and the accuracy-line baselines, Spearman above the accuracy line; held-out mean prediction strictly increasing across the four bands with gaps > 1.96 combined SE; held-out 80 % coverage in [0.75, 0.88] and 95 % in [0.91, 0.98]'}
V['gate'] = gate
V['split'] = {'rule': 'held out iff hash(opening plies) % 4 == 0 (FNV-1a + murmur3 finaliser) (all games of an opening on one side)', 'trainRows': len(train), 'testRows': len(test),
              'trainGames': len({r['id'] for r in train}), 'testGames': len({r['id'] for r in test}),
              'trainOpenings': len({r['opening'] for r in train}), 'testOpenings': len({r['opening'] for r in test}),
              'excludedInsufficient': len(all_rows) - len(rows), 'totalRows': len(all_rows)}
V['ridge'] = {'lambda': LAM, 'cvRmse': {str(k): round(v, 1) for k, v in cv.items()}}

mu, sd, beta = model[0]
q, v = model[1]
out = {
    'id': 'crown-played-like-2',
    'status': 'calibrated on engine-vs-engine games only (spectrum corpus, calibrated ratings 71-3,038 on the Crown scale); no human games; not FIDE',
    'analysis': {'engine': train[0].get('build', 'crown-search-2+crown-eval-4'), 'settings': SETTINGS, 'grading': 'crown-grade-v3-experimental'},
    'features': FEATURES, 'mu': [round(float(x), 6) for x in mu], 'sd': [round(float(x), 6) for x in sd], 'beta': [round(float(x), 4) for x in beta],
    'calibration': {'knots': [round(float(x), 3) for x in q], 'values': [round(float(x), 2) for x in v]},
    'minMoves': MIN_MOVES, 'uncertainty': {'a': round(a_var, 6), 'b': round(b_var, 6), 'c': round(c_var, 6), 'd': round(d_var, 6), 'z80': round(Z80, 4), 'z95': round(Z95, 4), 'form': 'scale = exp((a + b ln n + c q + d q^2) / 2), n = informative moves, q = predicted rating / 1000; 80 % interval = rating +/- z80 * scale, 95 % = +/- z95 * scale'},
    'calibratedRange': [int(LO), int(HI)],
    'validation': V,
    # parity fixtures: a few held-out rows with the fitted prediction, so the TypeScript implementation can be tested
    'fixtures': [{'features': {f: r[f] for f in FEATURES}, 'n': r['n'], 'pred': round(float(p), 3)} for r, p in list(zip(test, pred_te))[:: max(1, len(test) // 8)][:8]],
}
def clean(o):
    if isinstance(o, float) and (math.isnan(o) or math.isinf(o)): return None
    if isinstance(o, dict): return {k: clean(v) for k, v in o.items()}
    if isinstance(o, list): return [clean(v) for v in o]
    return o
out = clean(out)
json.dump(out, open('src/analysis/played-like-model.json', 'w'), indent=1, allow_nan=False)
print(json.dumps({k: out['validation'][k] for k in ('heldOut', 'baselineMean', 'baselineAccuracyLine', 'baselineLossLine', 'gate', 'split', 'ridge', 'heldOutByMoves', 'heldOutByEngine')}, indent=1))
print('beta', out['beta']); print('sd(n=10/20/40 @1500)', [round(sd_of(n, 1500)) for n in (10, 20, 40)], 'sd(n=20 @ 500/2500)', round(sd_of(20, 500)), round(sd_of(20, 2500)))
