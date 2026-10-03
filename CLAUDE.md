# Bitburner Automation (Matthew)

## Purpose
Matthew is building a modular Bitburner game automation system in JavaScript, using it as a vehicle for learning JS fundamentals alongside game progression. This is a learning project as much as a functional one — explanations of *why* matter as much as the fix itself.

## Where things live
- **This file** — conventions, key learnings, and how the system works *now*. No to-do items, no history.
- **[TODO.md](TODO.md)** — the single working list: every open work item, deferred idea and SF4-gated plan. Add new work items there, not here.
- **[CHANGELOG.md](CHANGELOG.md)** — audit trail of completed changes, newest first, grouped by date.
- **[docs/](docs/)** — design and reference docs too detailed for this file:
  - [docs/scheduler-plan.md](docs/scheduler-plan.md) — the scheduler's authoritative design + implementation checklist.
  - [docs/review-findings.md](docs/review-findings.md) — *transient* bug queue from the 2026-07-26 JSDoc pass. Work through it, then delete it, promoting anything durable into this file.
  - [docs/stocks-api.md](docs/stocks-api.md) — `ns.stock` API surface for the stock market script.
  - [docs/git-cheatsheet.md](docs/git-cheatsheet.md) — personal git reference.
- **Directory-scoped `CLAUDE.md`s** — design notes for one area: [servers/home/cfg/CLAUDE.md](servers/home/cfg/CLAUDE.md) (cfg.json restructure, cfgview open question), [servers/home/stocks/CLAUDE.md](servers/home/stocks/CLAUDE.md) (stockmarket.js logic outline).

## Architecture
All game code lives under `servers/home/`.

- Build: esbuild + `bb-external-editor` (shyguy1412 template) for Remote File API sync over WebSocket, port 12525. Only `.js` and `.json` files under `servers/` are built and synced.
- `init.js` — entry point after an aug reset. Resets `cfg.json` to defaults (`resetCfgToDefaults(ns)`) unconditionally, every run. The rest of the bootstrap (boot animation, network/cloud scan, autoNuke, daemon restart) only runs after an aug reset: it compares `ns.getResetInfo().lastAugReset` against the value stored in `cfg.json`, then writes the new value back via `jsonEdit` so it doesn't re-fire on the next run.
- `daemon.js` — the long-running caretaker: refreshes the network map (unless `scheduler.js` is running), upgrades clouds, supervises watched scripts, buys hacknet nodes, auto-ascends gang members. See its header JSDoc.
- HGW: `deployer.js` runs the hack/grow/weaken phases against one target, using thresholds from `cfg.json` (`moneyThresh` — a fraction of max money; `securityThresh` — an allowance above min security; `targetHackFraction`). `dispatch.js`/`dispatchall.js` launch deployers. All three will be superseded by the scheduler.
- `go.js` — a numbered task launcher for frequent manual cloud chores (`run go.js [n]`; no arg prints the menu). Not part of the automated startup chain.
- `watch/buyhacknetnodes.js` exports `buyCheapest(ns)`.

### Config (`cfg.json`)
- `data/defaultcfg.json` is the single source of truth for default values. `data/examplecfg.json` is a static example of `cfg.json`'s shape, safe to use as a structural reference while coding.
- `cfg/cfgall.js` is updated manually (code changes) whenever new keys are added to `cfg.json` — no auto-detecting/prompting for new keys at runtime. A `"default"` arg on an editor skips the prompts and resets `cfg.json` to defaults (currently it resets only that editor's own fields; making it a full reset is in TODO.md).
- `cfg/cfgdefaults.js` — full reset, confirm-gated. Writes every key in `defaultcfg.json` into `cfg.json`. Keys absent from `defaultcfg.json` (currently just `lastAugReset`, runtime state written by `init.js`) are left untouched by design. Wired into `cfg.js` as the `"defaults"` choice.
- The five interactive editors (`cfgtoggle`, `cfghacknet`, `cfgall`, `cfgcloud`, `cfgtarget`) load `defaultcfg.json` once, look up each field's default via `getByPath`, and prompt through the shared `promptField`. None hardcodes default values.

### Shared helpers in `lib/util.js`
- `promptField(ns, field, current, defaultValue)` — the shared prompt/parse routine for every `cfg/*.js` editor. Boolean fields get a 3-choice select ("Yes" / "No" / "Skip (leave unchanged)"); `"select"` fields get their `choices`; everything else gets a text box parsed per `field.type` (`"number"`, `"array"`, or plain text). Returns `undefined` when the field should be left unchanged (skipped, cancelled, empty, or an invalid number).
- `getByPath(obj, key)` — reads a dotted key path (`"purchaseConfig.maxPercSpend"`) out of any object.
- `jsonEdit(ns, key, value, filepath)` — writes one dotted key into a JSON file. Does not create missing files.
- `resetCfgToDefaults(ns)` — flattens `defaultcfg.json` and writes every key via `jsonEdit`. Used by both `init.js` (no prompt) and `cfgdefaults.js` (confirm-gated).
- `confirmAction(ns, message)` — the confirm-then-act prompt. Every destructive/irreversible action should route through this instead of a bespoke `ns.prompt(..., { type: "boolean" })` + switch.
- `ensureRunning(ns, script, host)` — used by `daemon.js` to supervise watched scripts (see below).

### Watched scripts (daemon-supervised)
Scripts listed in `cfg.watchedScripts` are kept running on every cloud server by `daemon.js`, which calls `ensureRunning()` per cloud per tick.
- **Argument contract:** `ensureRunning` launches every watched script as `ns.exec(script, host, 1, host)` — the cloud's hostname is always `ns.args[0]`, and it's the only arg. New watched scripts must read their target cloud from `ns.args[0]`. Supporting more args needs `ensureRunning` extended. `daemon.js`'s `atExit` kill also depends on this exact arg list, since `ns.kill` by filename matches args exactly.
- **Placement:** scripts live on home. `cloudpush.js` copies home scripts to clouds, so don't add `scp` logic to `ensureRunning` or `daemon.js`. (`cloudpush.js` itself is the exception — `ensureRunning` scps it, since it can't push itself.)
- **Behaviour:** watched scripts run on the cloud, are self-contained loops with their own sleep, read `cfg.json` directly if they need config, and get re-exec'd on the next tick if they exit or crash.
- **Adding one:** write it with `ns.args[0]` as the cloud name, add the filename to `watchedScripts`. Nothing else.

## Scheduler (in progress)
Replaces `dispatch.js` entirely. A centralized daemon that owns all `ns.exec` calls for scheduled work — callers request threads via ports, the scheduler allocates and launches directly, never handing thread counts back to the caller to exec themselves (this is what prevents the RAM-consumed-between-check-and-launch race). Full design: [docs/scheduler-plan.md](docs/scheduler-plan.md).

## Key Learnings (Bitburner/JS specifics — don't re-explain these from scratch)
- `ns.run()` returns a PID synchronously and does NOT block; poll `ns.isRunning(pid)` to wait.
- `ns.scp` preserves source paths, no rename option; `ns.isRunning` must use the exact exec'd path.
- After any script writes `cfg.json` (`jsonEdit`, `resetCfgToDefaults`, `cfgall.js`, etc.), any in-memory `cfg` object is stale — re-read from disk.
- `ns.ls` is per-host, not network-wide; second arg is a plain substring, not a glob (so `".js"` also matches `".json"`).
- Bitburner's terminal is a custom parser — Unix idioms (`rm -rf *`) don't work; use the Netscript API.
- `ns.kill(filename, host, ...args)` needs exact argument matching or it silently fails; prefer PID-based killing via `ns.ps()`.
- Terminal boolean args are always strings — use `String(ns.args[n] ?? false).toLowerCase() === "true"`.
- `const` inside `switch` cases needs `{}` per-case to avoid redeclaration errors.
- `ns.hacknet.*` needs no SF4 gate — fully available without Singularity.
- `cfg.json` is game-owned and not readable from VS Code — only from the game client. Changes to it have to happen by running a script in-game.
- `ns.prompt(message, options)`'s `options.type` controls the dialog UI, not just validation: `"boolean"` renders Yes/No buttons and resolves to a real `boolean`; `"text"` always renders a text box and resolves to a string. **But a dismissed `"boolean"` dialog resolves to `false`, indistinguishable from "No"** — so when "leave unchanged" must be expressible, use a `"select"` with an explicit skip choice (what `promptField` does).
- `ns.cloud.purchaseServer()` returns `""` on failure (invalid args, insufficient money, or the max-cloud-servers cap) — check for it before using the return value as a hostname.
- `ns.sleep()` counts as a pending Netscript call: racing it with another promise (e.g. `Promise.race([port.nextWrite(), ns.sleep(ms)])`) and then calling an ns function while it's still pending throws a concurrent-call error. Use `ns.asleep()` for races.
- `ns.exec` returns `0` on failure, which looks like success unless checked.

## Working Style / Preferences (apply these without being asked)
- **Correct inaccurate terminology, nonconventional usage, and convention violations directly and without hedging.** Explain the reasoning so it generalizes — don't just patch the instance.
- Do not soften feedback or massage ego. Be willing to say "this is wrong" plainly.
- Distinguish confirmed bugs from hypotheses explicitly when diagnosing.
- Don't re-raise an issue once it's been flagged and consciously deferred — trust the decision was made.
- Design decisions get reasoned through conversationally before code is written; review code before moving to the next stage.
- Prefer complete corrected files over isolated snippets where practical.
- Be open to explaining *how* an answer was reached, not just delivering it.
- **Keep the audit trail current:** whenever a change is completed (code fix, feature, doc restructure), add it to `CHANGELOG.md` under today's date — what changed and why, plus anything deliberately left as-is — and tick or remove the matching `TODO.md` item. Do this in the same session as the change, without being asked.
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
- Repo checkout lives in WSL at `/home/matto/projects/EmTee-Bitburner`. Line endings are LF, enforced by `.gitattributes`.
- JSDoc + `NetscriptDefinitions.d.ts` for autocomplete; `"ignoreDeprecations": "6.0"` in `tsconfig.json`.
- `NetscriptDefinitions.d.ts` is the authoritative source for API signatures — check it over assumption.
