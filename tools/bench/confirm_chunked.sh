#!/bin/bash
# Resumable 640-game confirmation (v0.8): 320 opening pairs from the 4-ply book in 8 chunks of 40 pairs, each saved
# as soon as it finishes (a container restart loses at most one chunk). Merge with tools/bench/merge_chunks.py.
#   bash tools/bench/confirm_chunked.sh <id> '<features JSON fragment>' [timeMs=100] [threads=2] [base features fragment]
cd "$(dirname "$0")/../.."
id=$1; feat=$2; T=${3:-100}; TH=${4:-2}; BASEF=${5:-'"partialRoot":true'}
A="{\"kind\":\"config\",\"id\":\"${id}T$T\",\"nodes\":0,\"timeMs\":$T,\"features\":{\"partialRoot\":true,$feat}}"
B="{\"kind\":\"config\",\"id\":\"v7maxT$T\",\"nodes\":0,\"timeMs\":$T,\"features\":{$BASEF}}"
for off in 0 40 80 120 160 200 240 280; do
  out="tools/bench/results/chunks/match-${id}T$T-vs-v7maxT$T-v8c-o$off.json"
  [ -f "$out" ] && continue
  mkdir -p tools/bench/results/chunks
  OPENINGS=4ply OPENING_OFFSET=$off RESULT_TAG=v8c-o$off THREADS=$TH npx tsx tools/bench/run.ts match "$A" "$B" 40 || exit 1
  mv "tools/bench/results/match-${id}T$T-vs-v7maxT$T-v8c-o$off.json" "$out"
done
python3 tools/bench/merge_chunks.py "${id}T$T" "v7maxT$T" >> tools/bench/results/v8confirm-summary.txt
