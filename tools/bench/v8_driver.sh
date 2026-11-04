#!/bin/bash
# v0.8 resumable benchmark driver. Every unit is a small chunk saved on completion, so a container restart loses at
# most one chunk; rerun this script to continue. Order: fullBudget confirmation → Fairy-Stockfish at 100/300/1000 ms →
# doubling-time ladder. Needs FAIRY_STOCKFISH=/path/to/stockfish (dev-only, never bundled).
cd "$(dirname "$0")/../.."
C=tools/bench/results/chunks; mkdir -p $C
chunk() { # name A B pairs offset
  local name=$1 A=$2 B=$3 P=$4 OFF=$5 out="$C/$1-o$5.json"
  [ -f "$out" ] && return 0
  OPENINGS=4ply OPENING_OFFSET=$OFF RESULT_TAG=tmpchunk THREADS=4 npx tsx tools/bench/run.ts match "$A" "$B" $P || return 1
  mv tools/bench/results/match-*-tmpchunk.json "$out"
}
cfg() { echo "{\"kind\":\"config\",\"id\":\"$1\",\"nodes\":0,\"timeMs\":$2,\"features\":{$3}}"; }
# 1. fullBudget (640 games, 200 ms)
for o in 0 40 80 120 160 200 240 280; do chunk "fb-match-fullbudgetT200-vs-v7maxT200-v8c" "$(cfg fullbudgetT200 200 '"partialRoot":true,"fullBudget":true')" "$(cfg v7maxT200 200 '"partialRoot":true')" 40 $o || exit 1; done
# 2. Fairy-Stockfish (shipped configuration)
for T in 100 300 1000; do
  case $T in 100) N="0 16 32 48";; 300) N="0 16 32";; 1000) N="0 16";; esac
  for o in $N; do chunk "fairy-v8shipT$T-vs-fairy-${T}ms" "$(cfg v8shipT$T $T '"partialRoot":true')" "{\"kind\":\"fairy\",\"id\":\"fairy-${T}ms\",\"limit\":\"movetime $T\"}" 16 $o || exit 1; done
done
# 3. doubling ladder
for T in 50 100 200; do
  for o in 0 32; do chunk "scale-shipT$((T*2))-vs-shipT$T" "$(cfg shipT$((T*2)) $((T*2)) '"partialRoot":true')" "$(cfg shipT$T $T '"partialRoot":true')" 32 $o || exit 1; done
done
echo ALL-DONE
