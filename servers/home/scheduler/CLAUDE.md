# Scheduler (in progress)

Replaces `dispatch.js` entirely. A centralized daemon that owns all `ns.exec` calls for scheduled work — callers request threads via ports, the scheduler allocates and launches directly, never handing thread counts back to the caller to exec themselves (this is what prevents the RAM-consumed-between-check-and-launch race).

**Ports** (priority queue only for now — normal/non-priority queue deferred):
- `PORT_REQ_PRIORITY` — requests in. Single-job shape for now: `{requestId, callerPid, script, ramPerThread, threads, args}`.
- `PORT_RESP` — responses out, shared by all callers. `{requestId, success, allocations: [{host, threads, pid}], reason?}`.
  - Port capacity (max items in queue at once) matters: check `NetscriptDefinitions.d.ts` to confirm before finalizing port-heavy designs.
  - Callers read responses via pop-check-requeue: `ns.readPort` (pop) the front message, if `requestId` doesn't match, `ns.writePort` it straight back with no `await` in between, repeat. A message can get "lapped" under concurrent load — that's latency, not a correctness issue.
  - Use `ns.getPortHandle(port).nextWrite()` to await new messages instead of busy-polling (prevents game/script starvation from infinite tight loops).
  - `ns.peek()` only ever shows the front of the queue, non-destructively — it cannot be used to scan for a specific message further back. This is why response routing needs pop-check-requeue rather than peek-and-filter.

**Allocation algorithm** (worst-fit bin-packing — sort candidate hosts by free threads descending, fill the largest-capacity host first until the requirement is met or hosts run out):
1. Snapshot free threads per host at the requested `ramPerThread`.
   - Home: `total - reserved - cfg.leaveRamFree`. This ceiling applies to the *entire* snapshot (fillers and real requests both), so home never drops below the user's reserved headroom for manually launching scripts.
   - Clouds: `total - reserved`, no reserve — fillers can consume clouds down to 0 if needed.
2. If total free < required threads: proceed to eviction step.
3. Eviction (only if needed): kill targeted filler PIDs on the bin-pack candidate hosts (starting with largest-free-first to close the gap most efficiently), re-snapshot free threads.
4. If still short after eviction: increment `failCounter`, log failure, write failure response with reason, loop.
5. Else (threads now available): increment `waitCounter` (request was delayed but satisfied), bin-pack threads across hosts (worst-fit: fill largest-capacity hosts first), `ns.exec` each allocation directly from the scheduler with its allotted thread count, collect resulting PIDs, write success response with `allocations: [{host, threads, pid}]`.
6. When no request is pending (on a timeout or loop): top up filler threads on any host with free room under its respective ceiling.

**Counters** (in `/data/state.json`, written via `jsonEdit` dot-notation):
- `waitCounter` — increments when a request's needed threads weren't immediately available but became available after evicting fillers. Signals "fillers are doing their job, buying you headroom."
- `failCounter` — increments when a request is rejected because insufficient threads remain even after evicting all reachable fillers. Signals "you're structurally out of RAM and need to either reduce workload or upgrade capacity."
- Both accumulate indefinitely, never reset by the scheduler itself or by `init.js`'s post-reset flow (same treatment as `cfg.json` — only explicit user action should zero these).

**Filler/backfill processes**: low-priority work (share-for-rep via `ns.share()` or XP-grind hacks, configurable via `cfg.json`) that fills otherwise-idle RAM and gets pre-empted the instant a real request needs the room. `fillerPids` is tracked as an in-memory module-level object in the scheduler script itself (`{host: [pid,...]}`) — not persisted, since PIDs are only ever valid for the scheduler process that spawned them and are meaningless across a restart.

**Failure logging** — deliberate exception to the `ns.print`-for-daemons convention: on `failCounter` increment, the scheduler both appends a line to a `.txt` log (timestamp, `requestId`, script/threads requested, reason — no RAM snapshot) *and* `ns.tprint`s it, since a structural RAM shortage needs to surface to the user regardless of the scheduler being a background process. Log grows unbounded, no rotation.

**Server list caching** — `refresh.js` calls `getRootedServers(ns)` from `lib/util.js` each cycle (after `scanNetwork`/`scanCloud`), which computes and caches the result to `/data/rooted.json`. This merges `networks.json` (filtered by `hasAdminRights && !purchasedByPlayer`) with `clouds.json` keys, avoiding double-counting cloud servers (which appear in both as `purchasedByPlayer` entries and as owned servers). The scheduler and other consumers then read `rooted.json` directly instead of recomputing the merge, keeping the list in sync with `refresh.js`'s live scan cadence.

## Related horizon item
Batcher (classic synced HWGW — weaken1/grow/weaken2/hack land in a fixed offset sequence): not yet designed. Open question when it's picked up: whether a batch's 4 sub-jobs need one atomic multi-job request type (all 4 succeed or none do) so another caller can't consume RAM mid-batch, or whether single-job requests are enough and the batcher handles partial-failure cleanup itself.
