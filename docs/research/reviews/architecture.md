# Independent architecture and QA review

Scope: documents12/15/16/17, research experiment/validation scripts. This is a separate reasoning pass, not a production-code certification. No game, browser or device tests exist to certify. Main documents were not edited by this reviewer.

## Findings and concrete corrections

1. **High — cancellation mechanism is underspecified for synchronous WASM.** A `stopSearch` worker message cannot be processed while the worker is inside a long nonyielding search. Generation IDs prevent stale commits but do not stop CPU work. Specify either periodic asynchronous search slices, an atomic shared cancellation flag when cross-origin isolation is available, or terminate-and-recreate fallback. Persist job/cache/report state outside disposable workers. Test cancellation of an actually blocking search and a late reply after recreation. A250ms target is a measured budget, not a guarantee merely from posting a message.

2. **High — staged world ticks need a visibility/commit rule.** Idempotent stages alone do not prevent UI, trading or rating readers seeing a partially advanced round. Add tick states `preparing/committed/failed`, a committed-world cursor and expected-version checks. Freeze affected commands while preparing or expose only read models at the committed cursor. Specify whether all stages fit one transaction or are journaled resumable stages with a final publish marker. Fault-inject after every stage, including result publication and settlement.

3. **High — IndexedDB transaction lifetime must be explicit.** Do not await search, network, worker or arbitrary non-IDB promises inside a readwrite transaction. Compute immutable inputs first, then open short transactions; validate revision/fencing token and commit DB requests only. Use transaction-completion as durable application success, not an individual request's success. Test quota errors, version-change blocking, abort and browser-close recovery. The current architecture is directionally sound but leaves this critical implementation detail implicit.

4. **High — migration copies and rollback need an operational storage policy.** Copy-before-migrate can fail precisely when quota is tight; a same-origin copy does not protect against eviction. Require size preflight, available-capacity checks, a downloadable consistent export, explicit migration-failure/read-only recovery and never destructive overwrite until verification succeeds. Concurrent tabs/service-worker versions must not open incompatible DB code. Test old-tab writes after upgrade and restart during migration.

5. **Medium — worker envelopes and score types are only sketches.** Define versioned message discriminated unions, result bounds, bestMove/PV origin, request settings hash, terminal-state semantics, input validation and all error codes. Signed mate plies need a clear convention, including mate-at-current-state versus terminal outcome. Reject incompatible engine/variant hashes rather than only echoing them. This is acceptable for a research blueprint but not yet a finished API contract.

6. **Medium — clocks and wall time require separated contracts.** The package distinguishes world ticks from UTC, but needs elapsed-time measurement using a monotonic clock during active sessions, explicit persisted suspension/resume events, and rollback/forward system-clock change handling. UTC timestamps must never determine arbitrary rated elapsed time. Test OS backgrounding, tab visibility, process termination and manual clock change. Rated timing cannot be certified by pause-policy prose alone.

7. **Medium — reproducibility depends on invocation order.** `experiments.py` shares one RNG across A–I and loop evaluation. Changing A's sample count changes subsequent fixtures/results; seed20261103 alone does not isolate experiments. Assign independent per-experiment seeds and manifest script hash, parameters, interpreter/hardware and output checksums. Preserve current measured outputs as a named version rather than silently replacing them. This is a correction for future research runs, not a reason to discard the currently documented exploratory results.

8. **Medium — document generator is not self-contained in a standalone ZIP.** `write_documents.py` copies the original expansion from `R.parent/docs/...`, outside the research folder. In a ZIP containing only research/, the document regeneration step fails even though requirements/INTELLIGENCE_EXPANSION.md is already present. Prefer use bundled requirements as the canonical source, with optional original import only if available. README does not currently instruct running the generator, so core experiment reproduction is unaffected; nevertheless ship a portable generator or remove it from the reproduction contract.

9. **Medium — pdftotext is labeled optional but fetch handling makes it mandatory for PDF success.** `fetch_sources.py` invokes the executable inside the overall fetch try block; absent executable marks a successfully downloaded source as a failed fetch. Separate download result from optional extraction result, record both, and preserve the hash/status even if extraction is unavailable. Do not overwrite evidence availability because an extraction helper is missing.

10. **Evidence boundary — acceptance is future work, not demonstrated.** The research fixtures test same-engine replay round trips, not an independent decoder, IndexedDB persistence, cancellation, migrations or UI alignment. Documents generally disclose this honestly. Keep explicit NOT RUN evidence rows for those services and devices. M2's actual mobile verification may block M2 independently of M5 packaging; make this dependency deliberate and visible.

## Positive assessment

The separation of pure domain logic, worker search, immutable reports, rating events, financial journals and indexed read models is appropriate. The no-placeholder and no-compilation-only acceptance rules are strong. The archive/report retention and external-export distinction correctly recognize browser storage limits. Engine licensing is treated as a real gate rather than assumed solved by process separation.

## Recommendation

Approve the architecture direction as a research blueprint with the above operational contracts added. Do not call it a production-ready implementation or claim device feasibility until blocking tests have executable evidence. Highest priority additions: cancellable search mechanics, committed tick visibility, transaction lifetime rules, and migration capacity recovery.
