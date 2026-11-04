"""Print the held-out validation stored in src/analysis/played-like-model.json as compact tables."""
import json
m = json.load(open('src/analysis/played-like-model.json'))
V = m['validation']
print('model', m['id'], 'minMoves', m['minMoves'], 'uncertainty', m['uncertainty'])
print('split', V['split'])
print('ridge', V['ridge'])
print(f"{'model':24} {'n':>5} {'MAE':>7} {'RMSE':>7} {'Spear':>6} {'bias':>7} {'cov80':>6} {'cov95':>6}")
for k in ['heldOut', 'trainOutOfFold', 'baselineMean', 'baselineAccuracyLine', 'baselineLossLine']:
    v = V[k]
    print(f"{k:24} {v['n']:>5} {v['mae']:>7} {v['rmse']:>7} {str(v['spearman']):>6} {v['bias']:>7} {str(v.get('cover80', '')):>6} {str(v.get('cover95', '')):>6}")
for k in ['heldOut', 'baselineAccuracyLine']:
    print('bands', k)
    for b, bv in V[k]['bands'].items():
        print(f"   {b:24} n={bv['n']:>4} true={bv['meanTrue']:>5} pred={bv['meanPred']:>5}±{bv['sePred']:<5} bias={bv['bias']:>7} mae={bv['mae']:>6} cov80={bv.get('cover80', '')} cov95={bv.get('cover95', '')} predBand={list(bv['predBand'].values())}")
print('by moves', V['heldOutByMoves'])
for e, v in V['heldOutByEngine'].items(): print('  ', e, v)
print('gate', V['gate'])
