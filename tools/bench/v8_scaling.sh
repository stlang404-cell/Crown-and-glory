#!/bin/bash
# v0.8 time-scaling ladder (resumable): does doubling the thinking time still gain strength?
cd "$(dirname "$0")/../.."
while pgrep -f "v8_followup.sh" >/dev/null; do sleep 30; done
for T in 50 100 200; do
  T2=$((T * 2))
  out="tools/bench/results/match-shipT$T2-vs-shipT$T-v8scale.json"
  [ -f "$out" ] && continue
  OPENINGS=4ply RESULT_TAG=v8scale THREADS=4 npx tsx tools/bench/run.ts match \
    "{\"kind\":\"config\",\"id\":\"shipT$T2\",\"nodes\":0,\"timeMs\":$T2,\"features\":{\"partialRoot\":true}}" \
    "{\"kind\":\"config\",\"id\":\"shipT$T\",\"nodes\":0,\"timeMs\":$T,\"features\":{\"partialRoot\":true}}" 64
  python3 -c "import json;s=json.load(open('$out'))['summary'];print('${T2}ms vs ${T}ms', s['games'], s['wins'], s['draws'], s['losses'], s['eloDiff'], s['eloCI'], 'depth', s['avgDepth'])" >> tools/bench/results/v8scale-summary.txt
done
