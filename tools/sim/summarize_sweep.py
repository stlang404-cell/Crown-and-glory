"""Summarise economy sweep JSON files (tools/sim/economy.ts output) into a markdown table + JSON.
   python3 tools/sim/summarize_sweep.py out.json in1.json [in2.json ...]"""
import json, sys, statistics as st
out, files = sys.argv[1], sys.argv[2:]
runs = [r for f in files for r in json.load(open(f))['results']]
by = {}
for r in runs: by.setdefault(r['strategy'], []).append(r)
rows, checks = [], {'runs': len(runs), 'seasonsPerRun': None, 'allConserved': True, 'negativeAccounts': 0, 'subsidyBoundViolations': 0}
for s, rs in by.items():
    fin = [r['seasons'][-1] for r in rs]
    checks['seasonsPerRun'] = len(rs[0]['seasons'])
    for r in rs:
        for x in r['seasons']:
            checks['allConserved'] &= bool(x['conserved'])
            checks['negativeAccounts'] += x['negativeAccounts']
            checks['subsidyBoundViolations'] += x.get('subsidyBoundViolations', 0)
    broke = [r['bankruptcy']['firstSeasonBelowThreshold'] for r in rs]
    rec = [r['bankruptcy']['recoveredSeason'] for r in rs]
    rows.append({'strategy': s, 'seeds': len(rs),
        'netWorthMedian': round(st.median(f['netWorth'] for f in fin)), 'netWorthRange': [round(min(f['netWorth'] for f in fin)), round(max(f['netWorth'] for f in fin))],
        'cashMin': round(min(min(x['minCash'] for x in r['seasons']) for r in rs), 1),
        'everBelowRecovery': sum(b is not None for b in broke), 'recovered': sum(x is not None for x in rec),
        'recoveryLatency': [x - b for b, x in zip(broke, rec) if b is not None and x is not None],
        'finalDivision': [f['playerDivision'] for f in fin], 'titles': sum(len(x['titles']) for r in rs for x in r['seasons']),
        'record': [f"{r['record']['w']}-{r['record']['d']}-{r['record']['l']}" for r in rs]})
# macro (per run, then median across runs): supply growth after season 5, rating mean drift, gini
def series(k): return [[x[k] for x in r['seasons']] for r in runs]
circ = series('circulating'); rating = series('ratingMean'); gini = series('earningsGini'); corr = series('latentRatingCorr')
growth = [((c[-1] / c[4]) ** (1 / (len(c) - 5)) - 1) * 100 for c in circ if len(c) > 5 and c[4] > 0]
macro = {'circulatingGrowthPctPerSeasonAfterS5': {'median': round(st.median(growth), 2), 'min': round(min(growth), 2), 'max': round(max(growth), 2)},
    'ratingMeanS1': round(st.median(r[0] for r in rating), 1), 'ratingMeanFinal': round(st.median(r[-1] for r in rating), 1), 'ratingMeanFinalRange': [min(r[-1] for r in rating), max(r[-1] for r in rating)],
    'earningsGiniFinal': round(st.median(g[-1] for g in gini), 3), 'latentRatingCorrFinal': round(st.median(c[-1] for c in corr), 3)}
json.dump({'checks': checks, 'macro': macro, 'strategies': rows}, open(out, 'w'), indent=1)
print(json.dumps(checks)); print(json.dumps(macro))
print('| Strategy | Seeds | Net worth S-final median [range] | Min cash | Below recovery / recovered | Final division | Titles |')
print('|---|---|---|---|---|---|---|')
for r in sorted(rows, key=lambda r: -r['netWorthMedian']):
    print(f"| {r['strategy']} | {r['seeds']} | {r['netWorthMedian']} [{r['netWorthRange'][0]}, {r['netWorthRange'][1]}] | {r['cashMin']} | {r['everBelowRecovery']} / {r['recovered']} {r['recoveryLatency'] or ''} | {r['finalDivision']} | {r['titles']} |")
