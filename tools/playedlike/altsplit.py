"""Robustness check: refit and validate on the other three opening splits (held out iff hash(opening) % 4 == k, k = 1..3)
and on a leave-pairings-out split (every game of a set of engine pairings held out). Prints the held-out metrics and gate
for each; restores nothing — run tools/playedlike/fit.py afterwards to rewrite the shipped model.
   python3 tools/playedlike/altsplit.py
"""
import json, subprocess, sys

def h(s):
    x = 2166136261
    for ch in s.encode('utf-16-le')[::2]:
        x ^= ch; x = (x * 16777619) & 0xffffffff
    x ^= x >> 16; x = (x * 0x85ebca6b) & 0xffffffff; x ^= x >> 13; x = (x * 0xc2b2ae35) & 0xffffffff; x ^= x >> 16
    return x

rows = [json.loads(l) for l in open('tools/playedlike/data/features-std-d7.jsonl') if l.strip()]
splits = {f'opening%4=={k}': (lambda r, k=k: h(r['opening']) % 4 == k) for k in (1, 2, 3)}
splits['pairings%4==0'] = lambda r: h(r['pairing'] + '#p') % 4 == 0
for name, f in splits.items():
    with open('tools/playedlike/data/features-alt.jsonl', 'w') as out:
        for r in rows: out.write(json.dumps({**r, 'test': bool(f(r))}) + '\n')
    subprocess.run([sys.executable, 'tools/playedlike/fit.py', 'alt', '8'], capture_output=True, check=True)
    V = json.load(open('src/analysis/played-like-model.json'))['validation']
    H, A = V['heldOut'], V['baselineAccuracyLine']
    print(name, {k: H[k] for k in ('n', 'mae', 'rmse', 'spearman', 'cover80', 'cover95')}, 'accLine', {k: A[k] for k in ('mae', 'rmse', 'spearman')},
          'bands', [(b['meanTrue'], b['meanPred']) for b in H['bands'].values()], 'gate', V['gate']['passed'])
