# Review Findings — project-wide JSDoc/comment pass

Code issues found during the JSDoc/comment pass of 2026-07-26. **Nothing here has been
fixed** — that pass was deliberately comments-only, so every item below is still live in
the code.

This is a work queue, not project state. Work through it, delete it, and promote anything
durable into `CLAUDE.md`.

**Line numbers shifted during the pass**, because adding JSDoc blocks pushes code down.
Numbers below are post-pass where verified, but treat them as approximate.

Status key:
- **CONFIRMED** — verified by reading the code directly.
- **REPORTED** — raised by a review agent, not yet independently checked.

---

## cfg/ — the interactive config editors

### 1. `lib/util.js:224` — a dismissed boolean dialog writes `false` instead of skipping
**CONFIRMED. Highest-impact item in this batch.**

`promptField` returns `ns.prompt`'s result directly for `type: "boolean"`:

```js
if (type === "boolean") {
    return await ns.prompt(message, { type: "boolean" });
}
```

`ns.prompt` yields `false` both for "No" *and* for a dismissed dialog — the two are
indistinguishable at that boundary. Every caller then does `if (value === undefined) continue;`
to mean "leave unchanged", and that skip can never fire for a boolean field.

Consequence: backing out of `cfgtoggle` partway through **turns every remaining switch off**.
Each dismissed prompt writes `false`. `cfgtoggle` is worst hit because all four of its fields
are boolean; `cfgcloud` and `cfghacknet` have one each.

Root cause lives in `lib/util.js`, so the fix is one place for all five editors.

**Suggested fix:** make "leave unchanged" expressible. Render boolean fields as
`{type: "select", choices: ["true", "false", "skip"]}` rather than a raw boolean dialog.

### 2. `cfg.js:64` — `ns.run(script, 1)` runs with `script === undefined` on a cancelled prompt
**CONFIRMED.**

A cancelled select-prompt resolves to `false`, which matches no `case` in the switch, so
`script` is never assigned. Execution falls through to `ns.run(undefined, 1)` regardless — a
runtime error for an ordinary "changed my mind". Same path for any unrecognised `ns.args[0]`.

**Suggested fix:** `if (!script) return;` before the `ns.run`, or a `default:` case that
prints the valid choices and returns.

### 3. `cfg/*.js` (all five prompt editors) — the prompt-and-write loop is copy-pasted five times
**REPORTED.** DRY violation.

Byte-identical in each editor:
`for (const field of fields) { getByPath ×2; promptField; if undefined continue; jsonEdit }`
plus a trailing `ns.tprint("Config updated.")`. Three also carry an identical `useDefaults` block.

`promptField` centralised the per-field work, but the loop *around* it never got extracted — so
any future change (validation, a back option, batched writes) has to be made five times. Note
that finding #1 is exactly such a change.

**Suggested fix:** `runFieldEditor(ns, fields, {useDefaults})` in `lib/util.js`. Each editor
collapses to an import, a `fields` array, and one call.

### 4. `cfg/cfgall.js` — "all" is misleading; it covers only numeric fields
**REPORTED.**

Missing from the "all" editor: all four booleans, `refreshInterval`, `watchedScripts`, and the
entire `gangCfg` block.

**Suggested fix:** either genuinely include everything (trivial once field groups are shared per
finding #3), or rename it honestly.

### 5. `cfgall.js` vs `cfgcloud.js` / `cfgtarget.js` — duplicated descriptors with drifting labels
**REPORTED.**

Same config keys, different wording depending on which menu entry you came in through:
"Max Percent Spend" vs "Max % Spend", "Min Cloud RAM (GB)" vs "Min Cloud RAM". The user is asked
a differently-worded question for the same setting.

**Suggested fix:** a `cfg/fields.js` exporting named field groups; `cfgall` becomes their
concatenation. Fixes #4 at the same time.

### 6. `cfg/cfgcloud.js`, `cfg/cfgtarget.js` — no `"default"` arg support, unlike their three siblings
**REPORTED.** `run cfg/cfgcloud.js default` silently prompts anyway instead of resetting.
Falls out for free from the #3 extraction.

### 7. `cfg/cfgtoggle.js:17` — label `"Deploy to home? Bool"` leaks the type into the UI
**REPORTED.** Leftover from when booleans went through a text box. Redundant now that
`promptField` renders a real Yes/No dialog.

### 8. `data/defaultcfg.json:33` — key misspelled `englableBuyAugs` (should be `enableBuyAugs`)
**CONFIRMED, but latent — not currently breaking anything.**

The typo is real. However, **no script currently reads either spelling** — a grep across all of
`servers/home` for `enableBuyAugs|englableBuyAugs` returns only the `defaultcfg.json` line itself.
(The reviewing agent claimed gang scripts silently never buy augs because of this; that
overstates it — there is no consumer yet.) It is a trap for whenever `gang/buystuff.js` grows to
read it.

Invisible from the UI, since no cfg editor exposes `gangCfg` at all (see #4).

**Suggested fix:** rename in `defaultcfg.json` now, before a consumer exists. Note the misspelled
key will linger in the live in-game `cfg.json` afterwards — `jsonEdit` only writes, never prunes.

### 9. `cfg.js:11` and `cfg.js:32` — the seven-element choice list is duplicated verbatim
**CONFIRMED.** Present in `autocomplete`, again in the `ns.prompt` call, with the switch as a
third place that must be kept in step. The JSDoc now warns about this, but a comment is not a fix.

**Suggested fix:** one module-level `{choice: script}` map that all three read from.

### 10. `cfg/cfgdefaults.js` — reset never removes keys that have left `defaultcfg.json`
**REPORTED. Working as designed — logged as a known limit, not a bug.**

`cfgdefaults` is write-only by construction, so a renamed or dropped key persists in `cfg.json`
forever. This is precisely what protects `lastAugReset` from being wiped, so it should probably
stay. Recorded only so the limit of "reset to defaults" is written down somewhere.

---

## lib/ — shared foundation

12 JSDoc blocks rewritten, 0 added — every function already had one. Agent verified all eight
files are byte-identical to `HEAD` once comments and blank lines are stripped.

### `lib/targeting.js`

- **`:130` — "hacklvl" mode throws.** CONFIRMED by agent. `getBestHackLvlTarget` returns a single
  object, but the case does `const targets = getBestHackLvlTarget(ns); const target = targets[0];`.
  `targets[0]` is `undefined`, so `target.hostname` throws. This is the "DOESNT WORK YET" already
  noted above the function. *Fix:* drop the `[0]`, or return `[bestTarget]` so both helpers share
  a shape.
- **`:44, :113` — empty-result path throws.** `getBestMoney` deliberately returns `[]` when nothing
  qualifies, but `"best"` and `default` both do `targets[0].hostname` unguarded. The one branch
  that handles it gracefully (`"ranked"`) is the one that doesn't need to.
- **`:202`, `~:285` — `scanNetwork` is async and never awaited.** Both helpers call it bare then
  immediately `ns.read("data/networks.json")` — the read races the rescan, so targeting can select
  against the previous cycle's data. Fixing it properly makes both helpers async and ripples up
  through `getTarget`.
- **`:197` / `~:250` — the two helpers are ~90% duplicated.** Rescan, cfg load, `hasFormulas`,
  `player`, all four filter `continue`s, and both money/sec branches are copy-pasted verbatim; only
  the final comparison differs. Copies have already drifted stylistically. *Fix:* extract one
  `getQualifyingTargets(ns)` returning `[{hostname, moneyPerSec, requiredHackingSkill}]`, then
  sort vs reduce.
- **`:110-125` — `default` case is a third copy of `"best"`**, differing only in the hardcoded
  `"best"` passed to `printTarget`. Normalise the mode up front instead.
- **`:2` — unused import** `import * as format`.
- **`~:150` — `printTarget` takes `moneyPerSec` and never uses it.** Three call sites pass it.
- **`:102` — `validateTargetRooted`'s boolean return is ignored by all four callers.** Purely a
  warning side-effect; the name promises gating it doesn't do.
- **Path inconsistency** — reads `"data/cfg.json"` where `util.js`/`remotekill.js` use
  `"/data/cfg.json"`. Both resolve; standardise.
- **Missing semicolons** at `:78` and both `serverAtThresh` object literals. `:22` — `main()`
  returns a value Bitburner discards.

### `lib/util.js`

- **`:12` — shadowed `getAvailableThreads`.** CONFIRMED. The flag const shadows the exported
  function declared at `:144`; `:21` calls the boolean as a function → `TypeError`, and passes 2
  args to a 3-arg function. *Fix:* rename the flag to `wantsThreadCount`.
- **`:12` — the flag can never match anyway.** `argmap` is lowercased via `.map(a => a.toLowerCase())`,
  then compared against the mixed-case literal `"--getAvailableThreads"`. Unreachable regardless of
  the shadowing. `--openports`/`help` only work because they're already lowercase.
- **`:14` — `targetServer` picks up the flag as a hostname.** `ns.args[0] ?? ns.getHostname()` — for
  the documented `run util.js --openports`, `args[0]` *is* the flag, so `autoNuke(ns, "--openports")`
  gets called. Only the two-arg form works.
- **`~:300` — `getRootedServers` includes `home`.** The JSDoc claimed "(excluding home)"; the agent
  corrected the doc, not the code. `scanner.js` seeds its BFS with `home` and pushes it into
  `networks.json`; home has `hasAdminRights === true`, `purchasedByPlayer === false`, so it passes
  the filter into `rooted.json`. **Scheduler-relevant:** the spec gives home a different RAM ceiling
  than clouds, so uniform iteration over `rooted.json` would give home cloud treatment.
- **`~:160` — `getAvailableThreads` subtracts `leaveRamFree` on every host, not just home.**
  Conflicts with the scheduler spec (`total - reserved`, no reserve on clouds). Can also return a
  negative thread count on a small cloud; nothing clamps at 0.
- **`~:120` — unreachable `else`, and nothing logs for already-rooted servers.** The `else` runs
  only when `quiet === true`, then guards on `!quiet` — "Already had root" can never print. The
  whole block including the backdoor-status report is nested inside `if (!ns.hasRootAccess(...))`,
  so the already-had-root path is silent by construction.
- **`~:255` — `ensureRunning`'s `pid` param is an unimplemented no-op.** Empty `default:` case; any
  non-null pid silently returns `undefined`, a third return type on a function documented boolean.
- **`:313` — esbuild `sourceMappingURL` blob.** CONFIRMED. Decoded, it holds a *stale* util.js
  containing an `openPorts` function that no longer exists and a 3-arg `getAvailableThreads`
  signature that no longer matches — actively misleading to a debugger, not just dead weight.
- **`:1` — unused import** `scanNetwork`. **`:262`** uses `==`. **`:63`** `let runExes` never reassigned.

### `lib/remotekill.js` / `lib/format.js`

- **`remotekill.js:7` — `async` with nothing to await.** `ns.ps`/`ns.kill` are synchronous.
- **`format.js:10` — `main` is an empty exported stub** in a pure-library file. Not required for an
  import-only module.
- **`format.js:28` — `let sign` + if/else** where `const sign = number < 0 ? "-" : "";` fits the
  const-over-let convention.

### `lib/share.js`, `lib/hgw/*.js` — no findings

Correct as minimal single-call payloads. **The three HGW scripts being structurally identical is
*correct* duplication** — they can't share a module without adding per-thread RAM cost, which sets
achievable thread counts for the whole deployer. Do not DRY these up. Cosmetic only: `share.js`
has no trailing newline.

---

## cloud/ + scanning

20 blocks rewritten, 0 added. Agent verified only comment text changed, and all ten files pass
`node --check`.

### `scanner.js:80-90` — the BFS marks `visited` on dequeue, not enqueue, so `networks.json` contains duplicates

**Most important finding in this batch.** `visited.add(currentServer)` runs after `queue.shift()`,
while the enqueue guard is `if (!visited.has(neighbor)) queue.push(neighbor)`. Any server reachable
from two already-queued servers is pushed twice, dequeued twice, and `allServers.push`ed twice. The
game's network is dense, so this is the common case, not a corner case.

Consequences cascade: `refresh.js` runs `autoNuke` once per duplicate, and `getRootedServers` emits
duplicate hostnames into `rooted.json` — which means **the scheduler will treat one host as two
allocation candidates and double-count its free RAM.** That will surface as failed `ns.exec`s that
look like a scheduler bug.

*Fix:* move `visited.add(neighbor)` to the enqueue site and drop the redundant `visited.add(currentServer)`.

### `cloud/upgradeclouds.js`

- **`:41-52` — infinite tight loop with no `await` when the name pool is exhausted.** If
  `targetCloudServs` exceeds the number of unique names in `cloudNamePresets`, every iteration hits
  `continue`, neither condition can change, and there is no `await` on that path. Bitburner spins
  forever and starves the game loop — and `daemon.js` awaits this every tick, so the daemon hangs
  with it. Even below the threshold it's a coupon-collector loop burning ~N iterations per buy.
  *Fix:* iterate a shuffled copy of the presets and break when the pool empties. Minimum viable:
  `await ns.sleep(0)` before `continue`.
- **`:65` — `player` captured once per server, goes stale.** Sits outside the size-halving loop, so
  the same pre-upgrade `player.money` is used for the spend-cap test at every size tried.
- **`:67` — `isFirstLoop` is a misleading name.** Only cleared in the can't-afford branch, so it
  means "shortfall warning not yet printed". The success branch reads it as "first iteration".
- **`:27-29` — validation warning duplicates the clamp's logic.** Prints "falling back to 2GB" but
  the fallback happens unconditionally on the next line. Pure logging branch that will lie if the
  two drift. **`:34`** — warning says "rounded up" but also fires for values rounded *down* by the cap.
- **`:69` — attempts an upgrade to the size the server already has.** Condition is `>=`; should be `>`.

### `cloud/buycloud.js`

- **`:78` — `buy()` writes a garbage registry entry when the player can't afford 2GB.**
  `ns.cloud.purchaseServer` **returns `""` on failure** (money shortfall *or* the max-servers cap),
  and the return is unchecked. Then `ns.getServerMaxRam("")` throws — after a false
  `"Bought server  with 2GB…"` has already hit the terminal. Had it not thrown, a `""` key would
  land in `clouds.json` and every consumer would iterate it. *Fix:* guard on the empty string before
  printing or writing. `minBuy()` needs the same guard.
- **`:36-41` — `printusage` describes a signature the script no longer has.** Three wrong things:
  "from targetserver" (no such arg), "force 32GB server" (`minBuy` buys 2GB), and `run buyserver.js`
  (file is `/cloud/buycloud.js`, so the printed command doesn't work).
- **`:22` — `==` on the min-buy flag, and it's load-bearing.** Terminal parses bare `1` as a number,
  but an `ns.exec` caller passing `"1"` relies on `"1" == 1`. Decide the contract before tightening.
- **`:63-64`** — same ~150-char message built twice, re-calling `getServerCost` and `getPlayer()`.
  **`:77-79, 124-126`** — duplicated dead `cloudpush` exec blocks in both `buy()` and `minBuy()`.

### `cloud/renamecloud.js`

- **`:18, 22` — `renameServer` return ignored, then the registry is corrupted on failure.**
  Returns `false` on failure; discarded. `clouds[newName] = clouds[oldName]; delete clouds[oldName];`
  runs unconditionally. Two failure modes: (1) rename fails but registry updates → `clouds.json`
  lists a phantom host and loses the real one, which `daemon.js`/`killall.js`/`upgradeclouds.js` then
  act on; (2) `oldName` absent → value is `undefined`, which `JSON.stringify` **drops silently**, so
  the entry vanishes and `upgradeclouds.js:64` then reads `clouds[cloud].maxRam`. Success message
  prints either way.
- **`:17` — `killAll` not awaited before the rename.** Safe only because the body happens to be
  synchronous. The message "All processes stopped on …" asserts an ordering the code doesn't enforce.
- **No rescan after rename** — `networks.json` still lists the old hostname, so `rooted.json` (and
  the scheduler) target a host that no longer exists.
- `:12` `==`; `:37` `printusage` exported but never imported, unlike every other one in the batch.

### `cloud/nukeclouds.js`

- **`:47` — `deleteServer` silently fails on any cloud with scripts still running.** Per
  `NetscriptDefinitions.d.ts` it will not delete a server with running scripts; returns `false`,
  doesn't throw. Killing `daemon.js` stops new dispatch and its `atExit` kills what *it* spawned —
  but not deployers, the scheduler, or manually-launched scripts. Those servers survive while the
  script prints `"Deleted " + cloud` for each. The rescan at `:52` re-lists them, so the user is told
  everything was deleted while the registry disagrees. *Fix:* `killAll(ns, cloud)` before each
  delete, and branch on the return value.
- **`:17` — `ns.getRunningScript("/daemon.js", "home")` may not match. HYPOTHESIS, not confirmed.**
  The project's own rule is that `ns.isRunning` needs the exact exec'd path. `daemon.js:63` itself
  checks `ns.isRunning("scheduler.js", "home")` with no leading slash. If normalisation doesn't strip
  the `/`, the daemon is never killed and races the `clouds.json` writes — the exact thing the block
  exists to prevent. Needs a one-line in-game test.
- **`:32-33, 40-41, 54-55`** — "Restarting daemon.js" + `ns.run` triplicated across three exit paths.

### `cloudpush.js`

- **`:36-37` — the `.json` push is entirely redundant; `.js` already matches it.** `ns.ls`'s second
  arg is a plain substring, and `".json"` **contains** `".js"`. So `ns.ls("home", ".js")` already
  returns every JSON file, and `:37` appends a duplicate subset — every cycle, every cloud, forever.
  Textbook form of the `ns.ls`-substring gotcha. *Fix:* drop `:37`, or filter with `.endsWith()`.
- **`:36` — pushes the entire home filesystem every cycle**, including `/old/`, `/new/`, all of
  `cfg/` and `stocks/`, to every cloud regardless of whether it will run them. Consider an allowlist
  (`cfg.watchedScripts` + `/lib/` + `/data/`).

### `killall.js` / `removeall.js`

- **`killall.js:33` — bare `run killall.js` takes down the daemon with no confirmation and no
  restart.** `safetyGuard` correctly protects the script from its own `ns.killall("home")`, but a
  no-arg invocation silently kills `daemon.js` and the scheduler, and unlike `nukeclouds.js` nothing
  relaunches them. *Fix:* route the no-target branch through `confirmAction`.
- **`killall.js:27` — no try/catch on the `clouds.json` read**, unlike `nukeclouds.js:29` and
  `upgradeclouds.js:17`. `JSON.parse("")` throws on a missing file, and `home` then never gets killed.
- **`removeall.js:8` — bespoke `ns.prompt` instead of `confirmAction`.** `CLAUDE.md` lists this exact
  extraction as outstanding; this is the last remaining copy now that `nukeclouds.js` is migrated.
- **`removeall.js:15-17` — `ns.rm`'s return value discarded, so failures report as success.** Run on
  `home` it will fail to remove at least `removeall.js` itself. Consider refusing outright when
  `hostname === "home"` — one Yes click deletes `cfg.json` and the entire codebase with no in-game
  recovery.

### `refresh.js`

- **`:16` — `//doesn't take args by design` contradicts `main(ns, quiet = false)` on the next line**,
  which also reads `ns.args` for `-q`. Comment corrected; the underlying ambiguity should be resolved.
- **`:17` — `quiet` is accepted but nearly inert.** Only calls `disableLog("ALL")`; both nested scans
  and `autoNuke` are hardcoded `true`, and the `tprint`s are commented out at `:40-42`. So
  `refresh(ns, false)` and `refresh(ns, true)` are indistinguishable.
- **`:24` and `:35` — `scanNetwork` runs twice per daemon tick.** Deliberate and documented, but it's
  the most expensive thing in the hot loop — full BFS plus an `ns.getServer()` per node, twice, and
  doubled again by the duplicate-hostname bug above. *Fix:* have `autoNuke` report whether it rooted
  anything and skip the second scan when nothing changed.
- **`:2-3`** two `import`s from the same module. **`:8`** stale IDEA comment describing the
  deployer/dispatch design `CLAUDE.md` records as superseded by the scheduler.

### `scanner.js` (beyond the BFS bug)

- **`:29` — `printusage` is called from the wrong scope.** The `help` check (and the `-q` sniff at
  `:46`/`:142`) lives inside `scanNetwork`/`scanCloud`, not `main`. So when another script imports
  `scanNetwork` and *that* process was launched with a `help` arg, the scan silently does nothing and
  prints usage — `ns.args` belongs to the process, not the function. **A library function should
  never read `ns.args`**; this is the general form of the bug.
- **`:7, 44, 140` — `main` never awaits the async scan functions.** Neither contains an `await` so
  they complete synchronously today — but **`scanCloud` reads the `networks.json` that `scanNetwork`
  writes**, so the ordering dependency is real and unprotected.
- **`:85-116` — 30 lines of commented-out alternative implementation**, which has duplicate keys
  (`minDifficulty` at `:102` and `:113`, `serverGrowth` at `:111` and `:115`) so it wouldn't work if
  uncommented. **`:176-205`** — ~30 blank lines. **`:9-19`** — the `mode == null` branch is
  byte-identical to the `else` branch.

### `clouds.js`

`:7` uses `"./data/clouds.json"` where every other file uses `"/data/..."` (and `lib/targeting.js`
uses a third form, `"data/..."`). No try/catch on the read.

### Cross-cutting (cloud batch)

- **Leftover esbuild sourcemap blobs** in `cloud/buycloud.js:129`, `scanner.js:206`, and
  `lib/util.js:313`. They cost real space **on every cloud server**, since `cloudpush.js` copies every
  `.js` file to every host every cycle. Check `sourcemap` in the esbuild config so they don't regenerate.
- **`async` without `await` is pervasive** — `scanNetwork`, `scanCloud`, `killAll`, `pushScripts`,
  `clouds.js:main`. Combined with call sites that omit `await`, this works *only* because none of
  these functions actually suspend. The first `await` added inside any of them turns a latent ordering
  assumption into a live race. Highest-leverage cleanup in the batch: if the body has no `await`, drop
  `async`; otherwise add `await` everywhere. Don't leave the mixed state.
- **`clouds.json` has two competing write paths.** `scanCloud` rebuilds it wholesale from
  `networks.json`; `buycloud.js`/`renamecloud.js`/`upgradeclouds.js` hand-patch it in place. The
  hand-patches exist so the registry is correct immediately after a purchase — reasonable — but the
  authoritative source now depends on which script touched it last, and a hand-patch bug (see
  `renamecloud.js`) persists until a rescan silently overwrites it. Worth a decision during the
  scheduler work: either make `scanCloud` the sole writer, or formalise
  `upsertCloud(ns, hostname, maxRam)` / `removeCloud(ns, hostname)` in `lib/util.js`.

---

## Orchestration (init/go/daemon/deployer/dispatch)

11 JSDoc blocks added, 12 rewritten. Agent verified zero executable code changed.

> **`CLAUDE.md` line 14 is stale.** `go.js` no longer holds the two HGW config profiles — it was
> rewritten into a numbered task launcher (kill buyrep/hackexp on clouds; start buyrep; start
> hackexp). The HGW thresholds now live in `cfg.json` (`moneyThresh`, `securityThresh`,
> `targetHackFraction`) and are consumed by `deployer.js`. Fix `CLAUDE.md` when convenient.

### ~~`deployer.js:~150` — WEAKEN's `queue` is never decremented, so the weaken phase can never end~~ RESOLVED

Fixed: WEAKEN now has a recompute branch symmetric with GROW/HACK
(`queue = Math.max(0, Math.ceil((currentSec - securityThreshActual) / weakenPerThread) - runningThreads)`),
run every tick alongside the other two. All three phases now obey the same rule, and it
self-corrects if something else raises security mid-phase instead of trusting a stale
phase-entry estimate.

### `init.js:~68` — `cfg.lastAugReset` is NEVER written, so the bootstrap fires on every run

The only `jsonEdit(ns, "lastAugReset", ...)` in the codebase is inside a commented-out draft block
(agent grepped all of `servers/home`). `cfgdefaults.js` deliberately skips the key and it's absent
from `defaultcfg.json`. So the stored value never advances, the comparison is always unequal, and
**every** `init.js` run does the full bootstrap — including resetting `cfg.json` to defaults.

**Re-running `init.js` silently discards all config tuning.** The guard is decorative.

*Fix:* restore `jsonEdit(ns, "lastAugReset", resetInfo.lastAugReset);` at the **end** of the
`isFirstRunSinceReset` block, so a mid-bootstrap crash retries next run. `jsonEdit` is already
imported for this and is otherwise unused.

### `deployer.js`

- **`~205` check-RAM-then-exec race (scheduler evidence).** `getAvailableThreads` reads free RAM,
  `ns.exec` spends it on the next line. `dispatch.js` launches one deployer *per target on the same
  scriptHost*, so every deployer races every other one, every tick. Loser gets `pid === 0`. Don't
  patch — this is the canonical case for the scheduler owning all `ns.exec`.
- **`~215` `counts` tallies launches, not threads.** `counts[phase]++` increments once per exec
  regardless of thread count, but the atExit report labels it "Run Counts". Cosmetic.

### `init.js`

- **`~101` `ns.kill("daemon.js", "home")` only matches an arg-less daemon.** Works today only
  because init.js launches it arg-free. Any daemon started with args survives → two daemons, both
  ticking, both calling `refresh.js`, fighting over the json files. *Fix:* PID-based kill via
  `ns.ps("home")`.
- **`~200` `flash()` does not flash.** No `cls()` in the loop, so odd iterations do nothing and even
  ones append another copy — `flash(text, 6)` stacks three copies. Cosmetic.
- **`~60` `const results = ""`** declared, passed to `printResults`, never read.
- **`~166` dead "Phase 7" header** with no body; the countdown already happens in Phase 5.

### `daemon.js`

- **`~120` `firstLoop` branch is a no-op** — both arms call `buyHacknetNodes.main(ns)`.
  `buyCheapest(ns)` sits commented beside the else, so the intent is clear. As written, `firstLoop`
  is tracked and assigned for nothing. The half-state is the worst of the three options.
- **`~50` `ns.atExit` kills children by filename+args.** `ns.kill(script, cloudName, cloudName)`
  only matches because `ensureRunning` happens to launch with exactly `ns.exec(script, host, 1, host)`.
  That coupling is load-bearing and documented only at the launch site. Any watched script gaining a
  second arg leaks on shutdown. *Fix:* have `ensureRunning` return the pid, track them, kill by pid.
- **`~130` `==` instead of `===`** on `cfg.autobuyHacknet`, inconsistent with `cfg.autobuyClouds === true`
  three lines above.

### `dispatch.js`

- **`~85` `launched++` fires even when `ns.exec` fails.** A failed launch counts toward
  `minDispatchServers`, so the "wait for RAM until minimum" guarantee can be satisfied by deployers
  that never started, and "Launched N of M" overcounts. Cheap worthwhile fix even pre-scheduler.
- **`~48` unused `const clouds`** — parsed and never referenced. The preceding `scanCloud(ns, true)`
  *is* useful (refreshes the file on disk); the parse is not.
- **`~185` `printUsage` omits `hacklvl`.** Accepted by `targeting.knownModes` but undiscoverable.
  *Fix:* generate the Modes list from `targeting.knownModes` so it can't drift.

### `dispatchall.js`

- **`~55` `rankedTargets.pop()` hands out the WORST targets first, including to home.**
  `getTarget(ns, "ranked")` is best-first; `pop()` takes from the end. Home is launched first
  *deliberately* ("so certain augmentation bonuses can apply") but therefore receives the
  lowest-value target. Intent and effect are opposites. Separately, the whole fleet ends up on the
  **bottom** N ranked servers rather than the top N. *Fix:* `shift()` instead of `pop()` — fixes both.
- **`~55` no check that `dispatch.js` exists on each cloud.** Relies entirely on `cloudpush.js`
  having run. A cloud purchased since the last push gets `pid === 0` and is silently skipped.
- **`~10` `let clouds` / `let cloudNames`** never reassigned → should be `const`.

### `buyrep.js`

- **`~40` `ns.args[0] ?? ns.getServer()` yields a Server *object*, not a hostname.** With no arg,
  `host` is an object → `host == "home"` never true, `currentServer.hostname == host` never true,
  `Object.hasOwn(clouds, host)` stringifies to `"[object Object]"` and never matches. Falls through
  to "ERROR: Invalid host target", which is why it looks like working validation.
  *Fix:* `ns.getHostname()`.
- **`~90` `await ns.exec(...)` — `ns.exec` is synchronous.** Returns a pid, not a Promise. The
  `await` does nothing but makes the call read as though it waits for the launched script.
- **`~83` 100ms retry busy-loop when RAM is unavailable.** Success path tops up every 10s; the
  no-RAM path retries at 10 Hz with an `ns.print` each iteration — and a full host is the *expected*
  steady state for a filler. Also prints *after* sleeping, so log ordering is off.
- **`~72` unused `const cfg`**; **`~35,43`** `==` instead of `===`; **`:8`** `printusage` vs the
  camelCase `printUsage` used in `dispatch.js`/`go.js`/`hackexp.js`.

### `hackexp.js`

- **`~55` `ns.read("data/cfg.json")` missing its leading slash** — every other cfg read uses
  `"/data/cfg.json"`. `ns.read` returns `""` for a missing file, so a path-handling change would
  make `JSON.parse` throw and kill the script at startup.
- **`~76` hardcoded "Requires minimum 5.1GB"** while the check uses live `scriptRam`, and the three
  HGW scripts don't all cost the same. *Fix:* interpolate the real values.
- **`~30,76` `ns.tprint` from a script that runs on clouds.** `go.js` task 2 launches one per cloud,
  each tprinting its selected target — N background workers spamming the terminal. Convention is
  `ns.print`.

### Cross-cutting (orchestration)

- **The check-RAM-then-exec race appears 5× in this batch alone:** `deployer.js` (drain),
  `dispatch.js` (launch loop), `dispatchall.js` (fleet launch), `buyrep.js` (share top-up),
  `hackexp.js` (thread fill). Concrete justification for the scheduler owning every `ns.exec`.
- **Unchecked `ns.exec` return values:** `dispatch.js`, `dispatchall.js`, `buyrep.js`, `go.js`
  (tasks 1 and 2) all discard the pid. `deployer.js` is the only file here that checks it. Worth a
  house rule independent of the scheduler — a silent zero is indistinguishable from success in every
  log line these scripts emit.

---

## new/ + stocks + corp + gang

All items below are **REPORTED** — recorded verbatim from the review agent, not independently
verified, to save tokens. Verify before acting on any of them.

**Headline:** `new/singularity.js` contains **zero `ns.singularity.*` calls** and has no SF4
dependency at all. It is not an inert SF4 wrapper — it is a self-contained re-implementation of
the whole toolkit (scan, nuke, rank, dispatch, deployer, HGW workers, server buying, cloud push)
that self-execs as its own worker, and it will run today. The real SF4 placeholder is
`watch/buyprograms.js`.

### `new/singularity.js`

- **`:1` — the filename is a lie; nothing imports it.** Monolithic standalone toolkit, orphaned.
  If run, it fights the live `deployer.js`/`dispatch.js`/`refresh.js` for RAM and targets.
  *Fix:* rename to `new/monolith.js`, freeing `singularity.js` for a real SF4 wrapper.
- **`:58` — `cfg()` can never find the config file.** Tries `"./data/cfg.json"` then
  `"data/cfg.json"`; the project uses absolute `/data/cfg.json`. `ns.read` returns `""` for a
  missing file, so `JSON.parse("")` throws, the catch fires, and `DEFAULT_CFG` is returned **every
  call**. Nothing set in `cfg.json` reaches this script. Same at `:109` and `:273` for
  `networks.json`. *Fix:* absolute paths, or drop the read and own `DEFAULT_CFG`.
- **`:328` — `leaveRamFree` subtracted from every host, not just home.** `CLAUDE.md` specifies
  home gets `total - reserved - leaveRamFree`, clouds get `total - reserved`. On a fleet of small
  clouds this throws away 20GB per host.
  *Fix:* `const reserve = host === "home" ? (cfg(ns).leaveRamFree ?? 0) : 0;`
- **`:79-333` — wholesale DRY violation, already drifted.** Duplicates `scanner.js`, `lib/util.js`,
  and the deployer stack. Two copies are *better* than the originals: its `autoNuke` gates on
  `getServerNumPortsRequired(host) <= openedPorts(ns)` before nuking, and `cloudApi()` is a clean
  shim falling back from `ns.cloud.*` to `ns.getPurchasedServer*`. *Fix:* port those two ideas
  into `lib/util.js`, then delete or deliberately keep as a "bootstrap a fresh BitNode" artefact.
- **`:40-54` — `DEFAULT_CFG` is a third, divergent copy of the config schema**, alongside
  `defaultcfg.json` and `examplecfg.json`. Values already disagree — and per the `:58` finding,
  these are the ones that actually run.
- **`:137-144` — deployer launch loop can wait forever.** Below `minDispatchServers` the RAM wait
  sleeps 5s indefinitely with no deadline. *Fix:* deadline cap mirroring the scheduler's
  `failCounter` path.
- **`:276` — empty `catch { }` hides a corrupt `networks.json`.** Silently falls back to a live
  rescan; a corrupt cache looks like a slow script, not a broken file.
- **`:7` — worker threads pay the RAM cost of the entire monolith.** Self-exec'ing means every
  hack/grow/weaken thread carries the union of every API in the file (incl. `ns.formulas`).

### `stocks/`

- **Neither script supersedes the other yet — worst of both worlds.** `stockTrader5.js` (199
  lines) is a **working third-party script** that trades today: everything nested in `main`, `let`
  throughout, zero JSDoc. `stockmarket.js` (23 lines) is **your own stub**, designed to
  `stocks/CLAUDE.md`, and `daemon.js:102` already has its `ensureRunning` call written and
  commented out. So the repo holds an undocumented working script and a documented broken one.
  *Fix:* finish `stockmarket.js`, then delete `stockTrader5.js` or move it to `old/`.
- **`stockmarket.js:21` — two faults on one line.** `symbols = ns.stock.getSymbols();` sits after
  a `while (cfg.autoStocks == true)` loop with no `break` and **no `await`**. If `autoStocks` is
  true: tight infinite loop, starves the game, line unreachable. If false: loop skipped and this
  assigns to an **undeclared variable** → `ReferenceError` under module strict mode. Both branches
  broken, differently. Also `==` where the project mandates `===`.
- **`stockTrader5.js:115` — the forecast bar can never show `-`.** Confirmed by the agent:
  ```js
  let plusOrMinus = true ? 50 + symbolRepeat : 50 - symbolRepeat;
  let forcastDisplay = (plusOrMinus ? "+" : "-").repeat(Math.abs(symbolRepeat));
  ```
  The ternary condition is the literal `true` (dead false branch), and `plusOrMinus` is then a
  *number* in boolean position — falsy only if `symbolRepeat === -50`, impossible. Bearish stocks
  display `+`. *Fix:* `const bullish = forecast >= 0.5;`
- **`stockTrader5.js:30,46` — `format()` takes one arg, is always called with two.** The format
  string is silently discarded and **every** value renders with the hardcoded `'$0.000a'`. So
  `decimalPlaces` and the `"0." + "0".repeat(...)` construction are dead, the `e+0` scientific
  fallback is unreachable, and the recursive path emits a `$` mid-string.
- **`stockTrader5.js:35,121,122,127,140` — `ns.nFormat` is removed from current Bitburner.**
  Replaced by `ns.formatNumber`/`ns.formatPercent`. On a current build every one of these throws.
  *Fix:* switch to `lib/format.js`; that deletes `format`, `formatReallyBigNumber`, `extraFormats`,
  `extraNotations` and `decimalPlaces` outright.
- **`stockTrader5.js:14-15` — `minSharePercent`/`maxSharePercent`, neither is a percent.**
  `minSharePercent = 5` is a **share count**; `maxSharePercent = 1.00` is a **fraction**.
- **`stockTrader5.js:20,150` — `runScript` is a `const true` loop flag.** `while (runScript)` is
  `while (true)` with extra steps; the `// For debug purposes` comment describes an unfulfillable intent.
- **`stockTrader5.js:109,116` — typos in identifiers:** `sellIfOutsideThreshdold`, `forcastDisplay`.
- **`stockTrader5.js:167` — sell/buy interleaved per symbol.** Exactly the concentration bug
  `stocks/CLAUDE.md` calls out. Fix by finishing the replacement, not by patching here.
- **`stockTrader5.js` — commission hardcoded as bare `100000`** at `:81`, `:96`, `:178`, `:179`
  (and `200000` at `:117`).

### `corp/boostmaterials.js`

- **`:36` — `warehouse.sizedAt` is not a real property; the script cannot work.** The `Warehouse`
  interface exposes `size` and `sizeUsed`. `sizedAt` is `undefined` → `availableSpace` is `NaN` →
  `cappedBudget` `NaN` → `chunkBudget` `NaN` → `remaining < chunkBudget` is `false` (break never
  fires) → `qty` is `NaN` → `qty <= 0` is `false` → reaches `bulkPurchase(..., NaN)`. Blocking bug.
  *Fix:* `warehouse.size - warehouse.sizeUsed`.
- **`:52` — `currentRatio` is not a ratio.** `data.stored / (data.stored + 1e6)` is a saturating
  0–1 curve against a magic constant, with no reference to the other three materials.
  `targetRatio` *is* a genuine share, so `deviation` compares apples to oranges.
  *Fix:* sum `stored` across the four materials, then `currentRatio = data.stored / totalStored`.
- **`:66` — `continue` where `break` is meant.** Once the warehouse is full, every remaining
  iteration re-runs the whole four-material scoring loop and re-fails.
- **`:13` — usage string names a nonexistent file** (`corpboostonce.js`). *Fix:* `ns.getScriptName()`.
- **`:8-12` — guard is half dead, half wrong.** `divisionName`/`city` are `??`-defaulted
  immediately above, so those checks can never fire. `budget` is `Number(...)`, so `0` and `NaN`
  both trigger the same unhelpful message. *Fix:* `if (!Number.isFinite(budget) || budget <= 0)`.
- **`:37` — `availableSpace * 1e6` collapses two unrelated magic numbers.** Assumes 1 unit = 1
  space and $1e6 per space; materials have different per-unit sizes (`getMaterialData(m).size`).

### `gang/buystuff.js`

- **`:17` — `cfg` read and never used, and the comment claims otherwise.** `const cfg = JSON.parse(...)`
  is dead, and `// Observes cfg settings` four lines below asserts behaviour that does not exist.
- **`:53` — `brokie` cleared before any purchase is attempted.** Runs on the first inner iteration,
  before `purchaseEquipment` is called. "Could not afford anything" is only reachable when the
  shopping or member list is empty. Afford item 1 but every purchase fails → "all items owned
  already", possibly falsely.
- **`:26-37` — affordability filter runs once against pre-purchase money.** Never rebuilt as money
  drains, and the `// Update player object before reading it` comment is misleading — nothing is
  purchased in that loop. *Fix:* drop the filter; let the buy loop's own check gate it.
- **`:56` — trailing comma in the call argument list**, reads like a deleted third argument.
- **`:46-47` — indexed `for` loops where `for...of` is mandated.** The labelled `outer:` break
  works fine with `for...of`.
- **`:9` — daemon/terminal convention mismatch.** Force-opens a tail and uses `ns.print`, but is
  terminal-launched and `ns.tprint`s its error path.

### `watch/buyhacknetnodes.js`

**The briefed SF4-guard bug does not exist** — every call is `ns.hacknet.*`, no Singularity guard
anywhere. Nothing to flag there.

- **`:75-79` — the "NODE overwrite" discards the entire cheapest-upgrade search.** When a node is
  affordable (usually), `cheapest`/`cost` are reset and the whole scan loop above is wasted. The
  function stops being "buy cheapest" and becomes "buy a node, forever". Spending rules also
  differ between paths — nodes ignore `hacknetPercSpend`, upgrades don't — so a *low*
  `hacknetPercSpend` biases even harder toward nodes.
  *Fix:* rename to `buyNext`/`buyByPriority`, or gate the override behind `cfg.hacknetNodeFirst`.
- **`:59-63` — `<=` inverts the stated priority order.** On a cost tie the *later* candidate wins:
  CORE beats RAM beats LEVEL, highest node index beats lowest — backwards from the LEVEL → RAM →
  CORE priority in the comment at `:70`. Ties are common; fresh nodes have identical upgrade costs.
  *Fix:* use `<`.
- **`:93` — `msg` assigned but never printed in the `NODE` case.** Buying a node is silent while
  every upgrade announces itself.
- **`:129` — `switch` has no `default`, so `buyCheapest` can return `undefined`.**
  `while (buyCheapest(ns))` would then exit silently as if broke. Unreachable today.
- **`:38` — `getPurchaseNodeCost()` called twice, first result unused.** `newNodeCost` never read.
- **`:21,35` — config read twice per iteration under two names** (`cfgglobal`, `cfg`), one disk
  read per upgrade.

### `new/watch.js`, `new/cloudwatch.js`, `new/servwatch.js`

- **`cloudwatch.js:8` — exports `start`, not `main`, so it can never be run.** Bitburner's runner
  requires an exported `main`. Nothing imports it either.
- **All three — empty bodies that exit reporting success.** Design notes in `.js` clothing; the
  failure mode hardest to notice. *Fix:* `ns.tprint("NOT IMPLEMENTED")` and return, or move the
  notes to `CLAUDE.md` and delete the files until real.
- **`watch.js:23,32,41` — `printUsage()`, `watch()`, `status()` declare no parameters** though all
  three need `ns`. Their JSDoc claimed `@param {NS} ns` for a parameter that doesn't exist; the
  agent corrected the JSDoc to describe reality rather than adding the parameters.
- **`servwatch.js:8` — the design note prescribed a mechanism that doesn't work.** It said "use try
  and finally to kill all deployers.js when terminated". A `finally` block does **not** run when a
  Bitburner script is killed — `ns.atExit()` does, and `new/singularity.js:174` already uses it
  correctly. Note corrected in place.

### `templates/newScriptTemplate.js`

- **`:6` — empty `main` with no scaffold.** Every script copied from this starts as a silent no-op
  — which, given the state of `new/`, the template is arguably causing. *Fix:* seed it with a
  `printUsage(ns)` stub and an args switch, matching `cfg.js` and `lib/util.js`.
