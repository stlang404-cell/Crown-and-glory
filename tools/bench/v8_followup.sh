#!/bin/bash
# v0.8 follow-up queue (resumable): fullBudget confirmation, then the shipped Sovereign configuration vs
# Fairy-Stockfish (dev-only benchmark binary, never bundled) at three move times.
cd "$(dirname "$0")/../.."
while pgrep -f "confirm_chunked.sh (singular|seemain)" >/dev/null; do sleep 30; done
bash tools/bench/confirm_chunked.sh fullbudget '"fullBudget":true' 200 4
for T in 100 300 1000; do
  case $T in 100) P=64;; 300) P=48;; 1000) P=32;; esac
  out="tools/bench/results/match-v8shipT$T-vs-fairy-${T}ms-v8fairy.json"
  [ -f "$out" ] && continue
  OPENINGS=4ply RESULT_TAG=v8fairy THREADS=4 npx tsx tools/bench/run.ts match \
    "{\"kind\":\"config\",\"id\":\"v8shipT$T\",\"nodes\":0,\"timeMs\":$T,\"features\":{\"partialRoot\":true}}" \
    "{\"kind\":\"fairy\",\"id\":\"fairy-${T}ms\",\"limit\":\"movetime $T\"}" $P
  python3 -c "import json;s=json.load(open('$out'))['summary'];print('v8ship vs fairy T$T', s['games'], s['wins'], s['draws'], s['losses'], s['eloDiff'], s['eloCI'], 'depth', s['avgDepth'], 'illegal', s['illegal'])" >> tools/bench/results/v8fairy-summary.txt
done
echo DONE >> tools/bench/results/v8fairy-summary.txt
