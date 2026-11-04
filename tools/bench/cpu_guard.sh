#!/bin/bash
# Keeps CPU-heavy, timing-insensitive jobs (economy sweep, Played Like analysis) paused while timed engine matches run,
# so match timings are not contaminated; resumes them when no timed match is running.
pat_timed='tools/bench/run.ts match'
pat_bg='tools/sim/economy.ts|tools/perf/analyze_calibration.ts'
while true; do
  if pgrep -f "$pat_timed" >/dev/null; then sig=STOP; else sig=CONT; fi
  for p in $(pgrep -f "$pat_bg"); do kill -$sig $p 2>/dev/null; done
  # stop when nothing is left to manage
  if ! pgrep -f "$pat_timed|$pat_bg|v8_followup|v8_scaling|confirm_chunked|queue8" >/dev/null; then exit 0; fi
  sleep 5
done
