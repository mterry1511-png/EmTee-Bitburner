# Bitburner Automation (Matthew)

## Purpose
Matthew is building a modular Bitburner game automation system in JavaScript, using it as a vehicle for learning JS fundamentals alongside game progression. This is a learning project as much as a functional one — explanations of *why* matter as much as the fix itself.

## Architecture / Core Files
All game code lives under `servers/home/`. `docs/memory.md` used to hold this file's content before it was reformed into `CLAUDE.md`, and has since been deleted — all notes (current state, learnings, on-the-horizon items) belong in this file (or the directory-scoped `CLAUDE.md`s it links out to) going forward, not in `docs/`.

- Build: esbuild + `bb-external-editor` (shyguy1412 template) for bidirectional Remote File API sync over WebSocket, port 12525.

## Current State
- Post-aug-reset detection in `init.js`: compares `ns.getResetInfo().lastAugReset` against a stored value in `cfg.json`; uses PID-polling (`while (ns.isRunning(pid)) await ns.sleep(200)`) since `ns.run()` doesn't block.
- `buyhacknetnodes.js` has a working `buyCheapest(ns)`.
- HGW automation confirmed working with two config profiles (RAM-limited steps 1–3, RAM-abundant steps 4–6), using named profile objects + spread syntax in `go.js` to avoid duplication.
- **Resolved:** `cfgall.js` is updated manually (code changes) whenever new keys are added to `cfg.json` — no auto-detecting/prompting for new keys at runtime. Bypassing the interactive flow via a `"default"` arg is still NOT wanted.
- `lib/util.js` now exports `promptField(ns, field, current, defaultValue)` — the shared prompt/parse routine for every `cfg/*.js` editor. It picks `ns.prompt`'s `{ type: "boolean" }` UI for `field.type === "boolean"` fields (a real yes/no dialog) and `{ type: "text" }` for everything else, then parses per `field.type` (`"number"`, `"array"`, or plain text), returning `undefined` when the field should be left unchanged (cancelled, empty, or an invalid number). All five interactive `cfg/*.js` scripts (`cfgtoggle`, `cfghacknet`, `cfgall`, `cfgcloud`, `cfgtarget`) route through it now — previously each script had its own copy-pasted prompt loop, and several of them hardcoded `{ type: "text" }` even for boolean fields, which is why toggle prompts showed a text box instead of Yes/No buttons.
- `lib/util.js` also exports `getByPath(obj, key)` — reads a dotted key path (`"purchaseConfig.maxPercSpend"`) out of any object. Used to look up both a field's live value from `cfg.json` and its canonical default from `defaultcfg.json` without duplicating the reducer inline in every script.
- `cfg/cfgdefaults.js` built: full-reset-only (no per-key mode), confirms via the new `confirmAction(ns, message)` helper in `util.js`, reads `/data/defaultcfg.json`, and writes every key it finds there into `cfg.json` via `jsonEdit` (flattened to dot-notation first). Keys absent from `defaultcfg.json` — currently just `lastAugReset`, which is runtime state written by `init.js`, not user config — are left untouched by design. Wired into `cfg.js`'s autocomplete/switch as the `"defaults"` choice.
- `confirmAction(ns, message)` extracted from `nukeclouds.js`'s inline confirm-then-act prompt into `util.js`; `nukeclouds.js` now uses it too. Any future destructive/irreversible action prompt should route through this instead of a bespoke `ns.prompt(..., { type: "boolean" })` + switch.
- **Resolved:** the `default:` values hardcoded per-field in every `cfg/*.js` editor (`cfgtoggle`, `cfghacknet`, `cfgall`, `cfgcloud`, `cfgtarget`) are gone. Each editor now loads `/data/defaultcfg.json` once, looks up each field's default via `getByPath(defaults, field.key)`, and passes it into `promptField` for display — and the `useDefaults`/`"default"` arg branches in `cfgtoggle`/`cfghacknet`/`cfgall` reset via the same lookup instead of `field.default`. Since `defaultcfg.json` was seeded from `data/examplecfg.json` rather than any one script's old literals, the displayed/reset defaults for a few keys have changed from what they showed before this change (e.g. `autobuyHacknet` now shows/resets to `false` everywhere, not `true` as `cfghacknet.js`/`cfgtoggle.js` used to claim) — worth a once-over against `defaultcfg.json` to confirm the values are actually what's wanted, since they were previously silently inconsistent across scripts.


## Key Learnings (Bitburner/JS specifics — don't re-explain these from scratch)
- `ns.run()` returns a PID synchronously and does NOT block; poll `ns.isRunning(pid)` to wait.
- `ns.scp` preserves source paths, no rename option; `ns.isRunning` must use the exact exec'd path.
- After `cfgall.js` rewrites `cfg.json`, any in-memory `cfg` object is stale — re-read from disk.
- `ns.ls` is per-host, not network-wide; second arg is a plain substring, not a glob.
- Bitburner's terminal is a custom parser — Unix idioms (`rm -rf *`) don't work; use the Netscript API.
- `ns.kill(filename, host, ...args)` needs exact argument matching or it silently fails; prefer PID-based killing via `ns.ps()`.
- Terminal boolean args are always strings — use `String(ns.args[n] ?? false).toLowerCase() === "true"`.
- `const` inside `switch` cases needs `{}` per-case to avoid redeclaration errors.
- `ns.hacknet.*` needs no SF4 gate — fully available without Singularity.
- `cfg.json` is game-owned; treat as read-only in VS Code to avoid Remote API overwriting in-game changes. It's not even readable from VS Code — only from the game client. `data/examplecfg.json` is a static, non-live example of its shape and can be used as a true structural reference while coding.
- `ns.prompt(message, options)`'s `options.type` controls the dialog UI, not just validation — `"boolean"` renders Yes/No buttons and resolves to a real `boolean`; `"text"` always renders a text box (and resolves to a string, or `false` if cancelled) even if you intend the input to represent a boolean/number. Match `type` to the field's actual data type instead of defaulting to `"text"` everywhere.

## Working Style / Preferences (apply these without being asked)
- **Correct inaccurate terminology, nonconventional usage, and convention violations directly and without hedging.** Explain the reasoning so it generalizes — don't just patch the instance.
- Do not soften feedback or massage ego. Be willing to say "this is wrong" plainly.
- Distinguish confirmed bugs from hypotheses explicitly when diagnosing.
- Don't re-raise an issue once it's been flagged and consciously deferred — trust the decision was made.
- Design decisions get reasoned through conversationally before code is written; review code before moving to the next stage.
- Prefer complete corrected files over isolated snippets where practical.
- Be open to explaining *how* an answer was reached, not just delivering it.
- When a fix generalizes across multiple similar files (e.g. one bug pattern copy-pasted into several scripts), fix it once via a shared helper and apply it everywhere, rather than patching only the file that was asked about.

## Coding Conventions to Enforce
- `const` over `let` unless reassignment is needed.
- `===` over `==`.
- `for...of` for array values, `for...in` for object keys.
- camelCase naming throughout.
- JSDoc annotations matching `NetscriptDefinitions.d.ts` style.
- `ns.print` for background/daemon scripts; `ns.tprint` for terminal-facing scripts.
- Keep data-retrieval functions separate from printing/output functions.
- Self-kill guard pattern: capture `const selfPid = ns.pid` before process-enumeration loops, exclude it from kill conditions.
- Flag on sight: dead/commented-out code, misleading names, shadowed variables, comment typos, DRY violations.

## Tools & Environment
- VS Code + esbuild + `bb-external-editor` for sync; GitHub Desktop for version control.
- JSDoc + `NetscriptDefinitions.d.ts` for autocomplete; `"ignoreDeprecations": "6.0"` in `tsconfig.json`.
- `NetscriptDefinitions.d.ts` is the authoritative source for API signatures — check it over assumption.
- Filesystem MCP is available at `C:\!Coding\BitBurner\Projects\bb-external-editor-main\servers\home\`.

## Scheduler (in progress)
Replaces `dispatch.js` entirely. A centralized daemon that owns all `ns.exec` calls for scheduled work — callers request threads via ports, the scheduler allocates and launches directly, never handing thread counts back to the caller to exec themselves (this is what prevents the RAM-consumed-between-check-and-launch race).

**Ports** (priority queue only for now — normal/non-priority queue deferred):
- `PORT_REQ_PRIORITY` — requests in. Single-job shape for now: `{requestId, callerPid, script, ramPerThread, threads, args}`.
- `PORT_RESP` — responses out, shared by all callers. `{requestId, success, allocations: [{host, threads, pid}], reason?}`.
- Callers read responses via pop-check-requeue: `ns.readPort` (pop) the front message, if `requestId` doesn't match, `ns.writePort` it straight back with no `await` in between, repeat. A message can get "lapped" under concurrent load — that's latency, not a correctness issue.
- Use `ns.getPortHandle(port).nextWrite()` to await new messages instead of busy-polling.
- `ns.peek()` only ever shows the front of the queue, non-destructively — it cannot be used to scan for a specific message further back. This is why response routing needs pop-check-requeue rather than peek-and-filter.

**Allocation algorithm** (worst-fit bin-packing — sort candidate hosts by free threads descending, fill the largest first until the requirement is met or hosts run out):
1. Snapshot free threads per host at the requested `ramPerThread`.
   - Home: `total - reserved - cfg.leaveRamFree`. This ceiling applies to the *entire* snapshot (fillers and real requests both), so home never drops below the user's reserved headroom for manually launching scripts.
   - Clouds: `total - reserved`, no reserve — fillers can consume clouds down to zero.
2. If short: evict targeted filler PIDs on the candidate hosts (largest-free-first), re-snapshot.
3. Still short → increment `failCounter`, log failure, write failure response.
4. Otherwise (evict-then-succeed → increment `waitCounter` first) bin-pack, `ns.exec` each allocation directly from the scheduler, write success response with resulting PIDs.
5. Idle (no pending request): top up filler threads on any host with room under its respective ceiling.

**Filler/backfill processes**: low-priority processes (share-for-rep or XP-grind scripts, configurable via `cfg.json`) that fill otherwise-idle RAM and get pre-empted the instant a real request needs the room. `fillerPids` is tracked as an in-memory module-level object in the scheduler script itself (`{host: [pid,...]}`) — not persisted, since PIDs are only ever valid for the scheduler process that spawned them and are meaningless across a restart.

**`/data/state.json`** — scheduler-owned, written via `jsonEdit` dot-notation each cycle (same pattern as `cfg.json`):
- `waitCounter`, `failCounter` — accumulate indefinitely, never reset by the scheduler itself or by `init.js`'s post-reset flow (same treatment as `cfg.json` — only explicit user action should zero these, and no such reset script exists yet).

**Failure logging** — deliberate exception to the `ns.print`-for-daemons convention: on `failCounter` increment, the scheduler both appends a line to a `.txt` log (timestamp, `requestId`, script/threads requested, reason — no RAM snapshot) *and* `ns.tprint`s it, since a structural RAM shortage needs to surface to the user regardless of the scheduler being a background process. Log grows unbounded, no rotation.

## On the Horizon
- ~~Dispatch v2: kill all existing deployers, sort cloud servers by available RAM, assign ranked targets by index zipping.~~ Superseded by the scheduler above.
- Batcher (classic synced HWGW — weaken1/grow/weaken2/hack land in a fixed offset sequence): not yet designed. Open question when it's picked up: whether a batch's 4 sub-jobs need one atomic multi-job request type (all 4 succeed or none do) so another caller can't consume RAM mid-batch, or whether single-job requests are enough and the batcher handles partial-failure cleanup itself.
- Normal/non-priority request queue for the scheduler — deferred until priority-only is working.
- Extract the confirm-then-act prompt pattern from the file-removal script into `confirmAction` as well (already done for `nukeclouds.js`).
- Add home RAM upgrade support to cloud watcher once Singularity (SF4) is unlocked.

Planned work on the cfg.json restructure lives in [servers/home/cfg/CLAUDE.md](servers/home/cfg/CLAUDE.md); the stockmarket.js logic outline lives in [servers/home/stocks/CLAUDE.md](servers/home/stocks/CLAUDE.md).
