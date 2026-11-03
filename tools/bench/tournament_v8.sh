#!/bin/bash
# v0.8 engine laboratory: equal-time screening of search candidates against the v0.7 Max configuration
# (crown-search-2 + crown-eval-4 + partialRoot, 100 ms/move). Resumable: finished matches are skipped.
#   bash tools/bench/tournament_v8.sh [pairs=100] [timeMs=100]
cd "$(dirname "$0")/../.."
PAIRS=${1:-100}; T=${2:-100}
BASE="{\"kind\":\"config\",\"id\":\"v7maxT$T\",\"nodes\":0,\"timeMs\":$T,\"features\":{\"partialRoot\":true}}"
cand() { echo "{\"kind\":\"config\",\"id\":\"$1T$T\",\"nodes\":0,\"timeMs\":$T,\"features\":{\"partialRoot\":true,$2}}"; }
for c in "lmr2|\"lmr2\":true" "nulladapt|\"nullAdaptive\":true" "histcm|\"histGravity\":true,\"counterMove\":true" "lmp|\"lmp\":true" "rfpdeep|\"rfpDeep\":true" "iir|\"iir\":true" "ttb|\"ttBucket\":true,\"qsTT\":true" "seemain|\"seeMain\":true" "razor|\"razoring\":true" "singular|\"singular\":true"; do
  id=${c%%|*}; feat=${c#*|}
  out="tools/bench/results/match-${id}T$T-vs-v7maxT$T-v8screen.json"
  [ -f "$out" ] && continue
  RESULT_TAG=v8screen THREADS=${THREADS:-3} npx tsx tools/bench/run.ts match "$(cand $id "$feat")" "$BASE" $PAIRS > /dev/null 2>&1
  python3 -c "import json;d=json.load(open('$out'))['summary'];print('$id', d['wins'],d['draws'],d['losses'], d['eloDiff'], d['eloCI'])" >> tools/bench/results/v8screen-summary.txt
done
echo DONE >> tools/bench/results/v8screen-summary.txt
