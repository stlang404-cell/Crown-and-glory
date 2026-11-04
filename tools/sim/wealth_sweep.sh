#!/bin/sh
# v0.11 wealth sweep (docs/ECONOMY_V11.md §5), at most two processes at a time (docs/V10_PLAN.md CPU rule).
# The simulator is resumable: runs already in an output file are skipped.
#   sh tools/sim/wealth_sweep.sh 1   # 2,048: six archetypes × 10 seeds, skill references × 5 seeds; 10,240 seeds 106–108
#   sh tools/sim/wealth_sweep.sh 2   # 10,240: seeds 101–105, then seeds 109–110 (file c; chess-only and club-owner 109–110 are in file b)
CORE=chess-only,club-owner,sponsor,trader,magnate,reckless
if [ "$1" = 1 ]; then
  npx tsx tools/sim/wealth.ts 24 docs/sim/wealth/wealth-2048.json 16 101,102,103,104,105,106,107,108,109,110 $CORE
  npx tsx tools/sim/wealth.ts 24 docs/sim/wealth/wealth-2048-skill.json 16 101,102,103,104,105 chess-weak,chess-strong
  npx tsx tools/sim/wealth.ts 24 docs/sim/wealth/wealth-10240-b.json 80 106,107,108,109,110 chess-only,club-owner
  npx tsx tools/sim/wealth.ts 24 docs/sim/wealth/wealth-10240-b.json 80 106,107,108 $CORE
else
  npx tsx tools/sim/wealth.ts 24 docs/sim/wealth/wealth-10240-a.json 80 101,102,103,104,105 $CORE
  npx tsx tools/sim/wealth.ts 24 docs/sim/wealth/wealth-10240-c.json 80 109,110 sponsor,trader,magnate,reckless
fi
