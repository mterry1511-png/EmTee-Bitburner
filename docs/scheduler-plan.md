# scheduler.js Implementation Plan

## Context

`dispatch.js`/`deployer.js` currently launch HGW threads with no central coordination: each script independently checks free RAM, then execs — a check-then-act race where RAM consumed between the check and the exec can cause failed or oversized launches. The scheduler replaces this with a single process that owns every `ns.exec` call for scheduled work: callers request threads over a port, the scheduler allocates and launches directly, and never hands a thread count back to the caller to exec themselves. This also creates a place to run low-priority "filler" work (share-for-rep, XP-grinding) that fills idle RAM and gets pre-empted instantly when real work needs the room, and a place to own periodic housekeeping (network refresh) that `daemon.js` currently does inline.

This is a learning-project build the user is writing by hand — this document is the reference scaffold, not code to paste in.

The core design (ports, message shapes, worst-fit bin-packing, filler concept, state.json counters, failure logging) was already agreed in `CLAUDE.md`'s existing "Scheduler (in progress)" section; this plan formalizes it against the real codebase and resolves the remaining open decisions.

## Decisions made this session

- **"Reserved" RAM is not a separate concept** — `cfg.leaveRamFree` alone covers all home overhead. Home ceiling = `total - cfg.leaveRamFree`. Clouds have no reserve (ceiling = `total`).
- **Filler eviction is immediate and unconditional** — `ns.kill(pid)`, no waiting for the filler to finish or checkpoint progress.
- **`waitCounter`/`failCounter` increment once per cycle**, not once per request — e.g. 5 failures in one cycle is `failCounter += 1`, not `+= 5`. Mostly for future debug/telemetry, no consumer yet.
- **Failure log capped at last 1000 lines** (read-modify-write-full rewrite each failure; Bitburner's file API has no partial-truncate primitive).
- **Explicitly deferred — do not design for yet**: request timeout, request queue length limit, failure reason-code enum (free-text `reason` string is fine), non-priority queue, multi-job atomic batch requests.
- **One filler PID per host, never stacked.** Rather than actively resizing a running filler when free RAM shifts, the scheduler leaves an already-running filler alone and only replaces it when eviction (a real request) kills it first — top-up then just notices the empty slot and refills it. See Filler management below.
- **`refresh.js` handoff = Option A**: scheduler owns the refresh cadence itself and calls it in-process (`import { main as refresh } from "./refresh.js"; await refresh(ns, true)`), the same way `daemon.js` already does. `daemon.js`'s existing edit is correct as-is:
  ```js
  if (!ns.isRunning("scheduler.js", "home")) {
      await refresh(ns, true);
  }
  ```
  Reasons for in-process over `ns.exec`: `refresh.js`'s `main(ns, quiet)` is already designed to be awaited synchronously against a shared `ns` handle (drop-in reuse, zero new plumbing); spawning it separately would force the scheduler to poll `ns.isRunning` before resuming anyway (no real concurrency benefit, since the scheduler is single-threaded JS regardless); and it keeps `refresh.js`'s RAM cost baked into `scheduler.js`'s static footprint instead of a dynamic allocation the scheduler would need to account for against its own snapshot.
  - Trade-off to accept: `refresh()`'s duration blocks the scheduler's request-servicing loop. A request arriving mid-refresh just waits until the loop's next drain pass — acceptable per the no-timeout decision above.

## Bug to fix first

`daemon.js`'s staleness check reads `cfg.refreshInterval`, but the actual key in `data/defaultcfg.json` is `refreshSleep`. **Rename the cfg key `refreshSleep` → `refreshInterval`** (done). The value stays `5` — **milliseconds, not seconds, and this is intentional**: the scheduler needs to be hyper-responsive, so a 5ms refresh interval is deliberate, not the unit mismatch with `daemonSleep` I'd originally flagged.

Consequence worth flagging plainly: with `IDLE_TIMEOUT_MS` at ~1500ms (see main loop below), the elapsed-time check `Date.now() - lastRefreshTime >= cfg.refreshInterval` (no `* 1000` — it's already milliseconds) will be true on essentially every loop iteration, since 1500ms will always have elapsed past a 5ms threshold. In practice this means `refresh.js` — a full network scan + autoNuke pass over every server — runs on every single scheduler cycle, not periodically. If that's the intended behavior (always-fresh network data, cost accepted), no change needed; if not, `refreshInterval` may need a larger value than 5ms once you see the real scan cost in-game.

## File structure

Split by concern, matching the existing `scanner.js`/`deployer.js` granularity rather than growing `util.js`'s grab-bag further:

```
servers/home/
  scheduler.js                 <- entry point: main loop, port I/O, orchestration
  lib/
    ports.js                   <- port constants + JSDoc typedefs, shared with callers
    scheduler-utils.js         <- snapshot/bin-pack + fillerPids state + top-up/evict logic
    scheduler-log.js           <- rotating failure-log writer
```

`lib/ports.js` must be importable by future caller scripts (e.g. the eventual batcher) without pulling in scheduler internals — that's the main reason it's split out rather than living in `scheduler.js`. `scheduler-utils.js` combines what would otherwise be two small files (allocation math + filler bookkeeping) since both are scheduler-only concerns of similar size — split them apart later only if one grows large enough to justify it.

## Constants

`lib/ports.js`:
```js
export const PORT_REQ_PRIORITY = 1;   // requests in
export const PORT_RESP = 2;           // responses out, shared by all callers
// leave a numbering gap here — a future PORT_REQ_NORMAL shouldn't renumber PORT_RESP
```

`scheduler.js` top-level:
```js
const FAIL_LOG_PATH = "/data/schedulerfail.txt";
const FAIL_LOG_MAX_LINES = 1000;
const STATE_PATH = "/data/state.json";
const IDLE_TIMEOUT_MS = 1500; // scheduler's own port-wait/idle-check cadence — decoupled from cfg.refreshInterval
```

New `cfg.json`/`defaultcfg.json` keys needed (don't exist yet — add via the manual-update convention this repo already uses for `cfg/*.js` editors):
```json
"scheduler": {
  "fillerScript": "lib/share.js"
}
```
(No `fillerArgs` needed — `share.js` takes none.)

## Data shapes (JSDoc typedefs, in `lib/ports.js`)

```js
/**
 * @typedef {Object} ThreadRequest
 * @property {string} requestId
 * @property {number} callerPid
 * @property {string} script
 * @property {number} ramPerThread
 * @property {number} threads
 * @property {(string|number|boolean)[]} args
 */

/**
 * @typedef {Object} Allocation
 * @property {string} host
 * @property {number} threads
 * @property {number} pid
 */

/**
 * @typedef {Object} ThreadResponse
 * @property {string} requestId
 * @property {boolean} success
 * @property {Allocation[]} allocations
 * @property {string} [reason]
 */

/**
 * @typedef {Object} SchedulerState
 * @property {number} waitCounter
 * @property {number} failCounter
 */
```

## Existing code to reuse

- `lib/util.js`: `jsonEdit(ns, key, value, filepath)` (~L159-184) for `state.json` writes — **does not auto-vivify** nested keys, so `state.json` must be pre-seeded with `ns.write` before any `jsonEdit` call touches it (see State seeding below). `getByPath(obj, key)` (~L192-194) for reads.
- `lib/util.js`'s `getAvailableThreads` (~L144-148) is **not** directly reusable for the scheduler's multi-host snapshot: it re-parses `cfg.json` from disk per call (wasteful in a snapshot loop) and applies `leaveRamFree` uniformly to every host, which contradicts the home-only-ceiling rule. Write a new multi-host snapshot function in `scheduler-utils.js` instead, following the same RAM-formula shape.
- `/data/rooted.json` (written by `getRootedServers` in `util.js`) is the candidate-hosts list for everything except home — it already combines rooted network servers and cloud hostnames into one flat `string[]`, excluding `home` (since `home.purchasedByPlayer === true`). Candidate hosts for allocation = `["home", ...JSON.parse(ns.read("/data/rooted.json"))]`.
- `dispatch.js`'s RAM-wait formula (`maxRam - usedRam - cfg.leaveRamFree`, ~L91) is the same shape the scheduler's home-snapshot line should match.
- Self-kill guard: copy `daemon.js`'s existing pattern (~L18-23) — capture `selfPid = ns.pid`, kill any other `scheduler.js` instance on startup.
- Filler = `lib/share.js` only, for now (a single `ns.share()` call — same script `buyrep.js` already uses as its cloud-filling worker, see `buyrep.js` L70-93). `hackexp.js` and other filler options are deferred; don't design for them yet.

## Main loop structure

Left deliberately as a structural outline, not code — this is the part you want to write yourself.

Tension to resolve: react to new requests quickly, run `refresh.js` on its cadence, and top up fillers when idle — without busy-polling, and without one slow cycle (e.g. a request burst) starving the others.

Structure to aim for, per iteration of `while (true)`:
1. Re-read `cfg.json` and the candidate host list (`["home", ...rooted.json]`) at the top of the loop — both can change between iterations (cfg edits, newly rooted servers).
2. Wait for *either* a new port message or an idle timeout to elapse — whichever comes first. This is the key mechanism that avoids busy-polling: don't `ns.sleep()` unconditionally, and don't tight-loop checking the port either. Look at `ns.getPortHandle(PORT_REQ_PRIORITY).nextWrite()` (a promise that resolves when something is written) raced against a timer promise (`ns.sleep(IDLE_TIMEOUT_MS)`) — whichever resolves first tells you why you woke up.
3. If woken by a request: drain the *entire* queue before moving on (loop `ns.readPort` while `ns.peek()` isn't the port's "empty" sentinel), not just the one message that triggered the wake — otherwise a burst of requests only gets serviced one every `IDLE_TIMEOUT_MS`, which defeats the point of reacting to `nextWrite()` at all. For each drained request, run the allocation step (see below) and write a response to `PORT_RESP`.
4. After draining (or if woken by idle timeout with nothing queued): run filler top-up (see Filler management below).
5. Check whether enough time has elapsed since the last `refresh()` call (`Date.now()` comparison, not a cycle counter — a counter drifts because cycles take variable time depending on how many requests were drained). If due, `await refresh(ns, true)` in-process.
6. Update `state.json` counters if this cycle needed eviction (`waitCounter`) or hit a hard failure (`failCounter`) — once per cycle, not once per request, per the earlier decision.

Things worth getting right as you write it:
- `PORT_RESP` is shared by every caller — the scheduler only ever *writes* to it, never reads. Pop-check-requeue (skip a response that isn't yours, write it straight back) is the *caller's* responsibility, not the scheduler's.
- If you're calling `jsonEdit` for both counters in the same cycle, it reads-and-parses the whole file per call — read `state.json` once per cycle yourself and reuse that in-memory value for both checks rather than triggering two separate file reads.

## Allocation algorithm

`lib/scheduler-utils.js`:
```js
export function snapshotHosts(ns, hosts, ramPerThread, cfg) {
    const snapshot = [];
    for (const host of hosts) {
        const maxRam = ns.getServerMaxRam(host);
        const usedRam = ns.getServerUsedRam(host);
        const ceilingRam = host === "home" ? maxRam - cfg.leaveRamFree : maxRam;
        const freeRam = Math.max(0, ceilingRam - usedRam);
        snapshot.push({ host, freeThreads: Math.floor(freeRam / ramPerThread) });
    }
    snapshot.sort((a, b) => b.freeThreads - a.freeThreads); // worst-fit: largest free first
    return snapshot;
}

export function binPack(snapshot, threads) {
    const plan = [];
    let remaining = threads;
    for (const entry of snapshot) {
        if (remaining <= 0) break;
        if (entry.freeThreads <= 0) continue;
        const take = Math.min(entry.freeThreads, remaining);
        plan.push({ host: entry.host, threads: take });
        remaining -= take;
    }
    return remaining <= 0 ? plan : null;
}
```

`allocate()` (in `scheduler.js`, wiring the above together):
```js
function allocate(ns, request, cfg, hosts) {
    const { requestId, script, ramPerThread, threads, args } = request;

    let snapshot = snapshotHosts(ns, hosts, ramPerThread, cfg);
    let totalFree = snapshot.reduce((sum, e) => sum + e.freeThreads, 0);
    let neededEviction = false;

    if (totalFree < threads) {
        neededEviction = true;
        // fillerPids is { [host]: pid } — one filler PID per host, not an array (see Filler management)
        for (const entry of snapshot) {
            if (totalFree >= threads) break;
            const pid = fillerPids[entry.host];
            if (pid === undefined) continue;
            ns.kill(pid); // immediate, no wait for filler to finish
            delete fillerPids[entry.host];
        }
        snapshot = snapshotHosts(ns, hosts, ramPerThread, cfg); // usedRam is live, safe to re-check right away
        totalFree = snapshot.reduce((sum, e) => sum + e.freeThreads, 0);
    }

    if (totalFree < threads) {
        const reason = `Insufficient threads: needed ${threads}, found ${totalFree} across ${hosts.length} hosts after evicting fillers.`;
        logFailure(ns, { requestId, script, threads, reason });
        return { success: false, neededEviction, response: { requestId, success: false, allocations: [], reason } };
    }

    const plan = binPack(snapshot, threads);
    const allocations = plan.map(({ host, threads: t }) => ({ host, threads: t, pid: ns.exec(script, host, t, ...args) }));
    return { success: true, neededEviction, response: { requestId, success: true, allocations } };
}
```

## Filler management

Keep this as simple as `buyrep.js` already is (`buyrep.js` L70-93) — one filler script (`lib/share.js`, plain `ns.share()`), one PID tracked per host, no options/config surface yet. Don't build a general filler-script framework; that's for later if a second filler type is ever needed.

`lib/scheduler-utils.js`, module-level `fillerPids = {}` (`{ [host]: pid }`, one entry per host — never an array):

- **Top-up, per host, per cycle:**
  1. If `fillerPids[host]` is tracked but `!ns.isRunning(fillerPids[host])` (it ended on its own, or got killed by the eviction step and the tracking wasn't cleared there — belt-and-braces), clear the entry.
  2. If nothing is tracked for this host, compute how many `share.js` threads fit in the host's free RAM (same ceiling rule as allocation: `maxRam - cfg.leaveRamFree` on home, `maxRam` on clouds, minus `ns.getServerUsedRam(host)`), and if `> 0`, `ns.exec` it and track the PID.
  3. If something *is* already tracked and running, leave it alone — don't kill-and-relaunch on every idle cycle just because free RAM shifted slightly. That would restart `share.js` constantly and undercut its own ramp-up benefit. Kill-and-relaunch only happens via the eviction path in `allocate()` (a real request needed the room) — top-up's job is just to notice the gap that eviction left behind and refill it once.

This means "kill-and-relaunch" isn't something `topUpFillers` does directly — it's a natural consequence of eviction clearing `fillerPids[host]` (in `allocate()`) and the next top-up pass seeing an empty slot to fill. Simpler than tracking desired-vs-actual thread counts.

## State seeding

**"Auto-vivify"** means a function that, when asked to set a nested value, automatically creates any missing intermediate structure to get there — e.g. calling `jsonEdit(ns, "waitCounter", 0)` against a file that doesn't exist yet would need `jsonEdit` to first invent `{}` for it to write `waitCounter` into. `jsonEdit` doesn't do this: it assumes the file already parses into a real object and only ever *sets a key that's already reachable* on it.

**"No-op"** means "does nothing" — the call runs, doesn't throw an error you'd notice, but has no effect. Concretely here: if you call `jsonEdit` against `state.json` before that file exists, `ns.read` on a missing file returns `""`, `JSON.parse("")` throws, `jsonEdit` catches that internally and just prints an error — it does **not** create the file or write your value. The very first `jsonEdit` call in the scheduler's life would silently fail to seed the counters, and every read after that would see `undefined` instead of `0`.

The fix is to sidestep `jsonEdit` for the very first write and create the file directly with `ns.write`, which — unlike `jsonEdit` — *does* create a file that doesn't exist yet:

```js
function ensureStateSeeded(ns) {
    if (!ns.fileExists(STATE_PATH, "home")) {
        ns.write(STATE_PATH, JSON.stringify({ waitCounter: 0, failCounter: 0 }), "w");
    }
}
```

Call once before the main loop starts. Since `state.json`'s shape is flat (no nesting), this is sufficient even if more top-level counters are added later.

## Failure log rotation

`lib/scheduler-log.js`:
```js
export function logFailure(ns, { requestId, script, threads, reason }) {
    const line = `[${new Date().toISOString()}] requestId=${requestId} script=${script} threads=${threads} reason="${reason}"`;
    ns.tprint(`SCHEDULER FAIL: ${line}`); // deliberate ns.tprint exception to the ns.print-for-daemons convention

    const existing = ns.read(FAIL_LOG_PATH); // "" if file doesn't exist — ns.read never throws
    const lines = existing === "" ? [] : existing.split("\n");
    lines.push(line);
    ns.write(FAIL_LOG_PATH, lines.slice(-FAIL_LOG_MAX_LINES).join("\n"), "w"); // full overwrite — no partial-truncate API exists
}
```

## Open risks worth a second look once running

- **Port capacity**: `NetscriptDefinitions.d.ts` confirms ports have a capacity (`full()`, bump-off on write) but not the number — worth an in-game check (`ns.getPortHandle(n).full()` after writing several items) before assuming `PORT_RESP` traffic can never overflow under heavy concurrent-caller load. Not a blocker for a first version with one or two callers.
- **`refresh()` running every cycle** (per the `refreshInterval: 5ms` decision above) blocks the request-servicing loop for the duration of a full network scan, every single cycle — not just occasionally. Accepted trade-off given the no-timeout decision, but worth eyeballing the actual scan duration once running in a large network, in case it visibly stalls request-servicing under real conditions.

## Implementation Checklist

### Setup & Config

- [ ] Add `"scheduler": { "fillerScript": "lib/share.js" }` to `data/defaultcfg.json`
- [ ] Rename `refreshSleep` → `refreshInterval` in `data/defaultcfg.json` (value stays `5`)
- [ ] Update `cfg/cfgall.js` (or relevant cfg editor) to include the new scheduler cfg key (manual-update convention)

### lib/ports.js

- [ ] Define port constants: `PORT_REQ_PRIORITY = 1`, `PORT_RESP = 2`
- [ ] Add JSDoc typedefs: `ThreadRequest`, `Allocation`, `ThreadResponse`, `SchedulerState`
- [ ] Export constants and typedefs

### lib/scheduler-utils.js

- [ ] Declare module-level `fillerPids = {}`
- [ ] Implement `snapshotHosts(ns, hosts, ramPerThread, cfg)` — worst-fit bin-packing snapshot
- [ ] Implement `binPack(snapshot, threads)` — returns allocation plan or null if insufficient
- [ ] Implement `topUpFillers(ns, cfg, hosts)` — maintain one filler PID per host
- [ ] Test snapshot/binPack logic independently (unit-testable math)

### lib/scheduler-log.js

- [ ] Implement `logFailure(ns, { requestId, script, threads, reason })`
- [ ] Read existing log, append line, trim to last 1000, rewrite
- [ ] Include `ns.tprint` exception behavior (deliberate print-to-terminal on failure)

### scheduler.js — Setup

- [ ] Import ports, utils, refresh, jsonEdit
- [ ] Define top-level constants: `FAIL_LOG_PATH`, `FAIL_LOG_MAX_LINES`, `STATE_PATH`, `IDLE_TIMEOUT_MS`
- [ ] Implement `ensureStateSeeded(ns)` — create `/data/state.json` if missing
- [ ] Implement self-kill guard (capture `selfPid`, kill other `scheduler.js` instances)
- [ ] Disable logs, set up `ns.atExit` handler (optional cleanup)

### scheduler.js — Main Loop

- [ ] Implement `while (true)` main loop with 6 steps per iteration:
  - [ ] Step 1: Re-read cfg and hosts list
  - [ ] Step 2: Race `nextWrite()` vs `ns.sleep(IDLE_TIMEOUT_MS)`, determine woken cause
  - [ ] Step 3: Drain entire request queue (loop until `peek() === "NULL PORT DATA"`), call `allocate()` per request, write responses to `PORT_RESP`
  - [ ] Step 4: Run `topUpFillers(ns, cfg, hosts)`
  - [ ] Step 5: Check refresh cadence (`Date.now() - lastRefreshTime >= cfg.refreshInterval`), call `refresh(ns, true)` if due
  - [ ] Step 6: Update `state.json` counters (`waitCounter`, `failCounter`) based on cycle flags

### scheduler.js — Allocation

- [ ] Implement `allocate(ns, request, cfg, hosts)` function:
  - [ ] Snapshot hosts, compute total free threads
  - [ ] If short: evict fillers (largest-free-first, kill immediately, delete from tracking)
  - [ ] Re-snapshot after eviction
  - [ ] If still short: log failure, return failure response
  - [ ] Otherwise: bin-pack, execute on each host via `ns.exec`, return success response with PIDs

### daemon.js — Already Done

- [ ] Verify `if (!ns.isRunning("scheduler.js", "home")) { await refresh(ns, true); }` is in place
- [ ] Verify staleness check `if (cfg.daemonSleep < cfg.refreshInterval)` references correct key

## Verification (in-game)

- No automated test harness exists for this codebase (game-driven, run via the Remote File API). Verify by:
  1. [ ] Running `scheduler.js` standalone in-game and confirming it seeds `/data/state.json` and starts filling idle RAM with `share.js` on home and rooted hosts.
  2. [ ] Writing a throwaway caller script that posts a `ThreadRequest` to `PORT_REQ_PRIORITY` and reads its matching `ThreadResponse` back off `PORT_RESP` (via pop-check-requeue), confirming `allocations` reflects real PIDs via `ns.ps`.
  3. [ ] Forcing an eviction path by requesting more threads than free capacity while fillers are running, confirming `waitCounter` increments in `state.json` and the fillers are killed before the request succeeds.
  4. [ ] Forcing a hard failure (request more threads than total capacity even after eviction), confirming `failCounter` increments, `/data/schedulerfail.txt` gets a line, and `ns.tprint` fires.
  5. [ ] Confirming `daemon.js` stops calling `refresh.js` while `scheduler.js` is running (add a temporary print in `refresh.js` to see calls stop from `daemon.js` and start from `scheduler.js` on its own cadence).
