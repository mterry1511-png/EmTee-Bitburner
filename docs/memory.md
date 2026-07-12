# Project Memory: Bitburner Automation (Matthew)

## Purpose
Matthew is building a modular Bitburner game automation system in JavaScript, using it as a vehicle for learning JS fundamentals alongside game progression. This is a learning project as much as a functional one — explanations of *why* matter as much as the fix itself.

## Architecture / Core Files
- `daemon.js`, `init.js`, `dispatch.js`, `deployer.js`, `go.js`
- `lib/util.js`, `lib/targeting.js`, `lib/hgw/{weaken,grow,hack}.js`
- `cfg.js`, `cfgall.js`, `cfg/cfgall.js`
- Data: `/data/cfg.json`, `/data/clouds.json`
- Build: esbuild + `bb-external-editor` (shyguy1412 template) for bidirectional Remote File API sync over WebSocket, port 12525.

## Current State
- Post-aug-reset detection in `init.js`: compares `ns.getResetInfo().lastAugReset` against a stored value in `cfg.json`; uses PID-polling (`while (ns.isRunning(pid)) await ns.sleep(200)`) since `ns.run()` doesn't block.
- `buyhacknetnodes.js` has a working `buyCheapest(ns)`.
- HGW automation confirmed working with two config profiles (RAM-limited steps 1–3, RAM-abundant steps 4–6), using named profile objects + spread syntax in `go.js` to avoid duplication.
- **Resolved:** `cfgall.js` is updated manually (code changes) whenever new keys are added to `cfg.json` — no auto-detecting/prompting for new keys at runtime. Bypassing the interactive flow via a `"default"` arg is still NOT wanted.

## On the Horizon
- Resolve the `cfgall.js` reset UX question above.
- Extract the confirm-then-act prompt pattern from `nukeclouds.js` and the file-removal script into a shared `util.js` utility.
- Dispatch v2: kill all existing deployers, sort cloud servers by available RAM, assign ranked targets by index zipping.
- Add home RAM upgrade support to cloud watcher once Singularity (SF4) is unlocked.

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

## Working Style / Preferences (apply these without being asked)
- **Correct inaccurate terminology, nonconventional usage, and convention violations directly and without hedging.** Explain the reasoning so it generalizes — don't just patch the instance.
- Do not soften feedback or massage ego. Be willing to say "this is wrong" plainly.
- Distinguish confirmed bugs from hypotheses explicitly when diagnosing.
- Don't re-raise an issue once it's been flagged and consciously deferred — trust the decision was made.
- Design decisions get reasoned through conversationally before code is written; review code before moving to the next stage.
- Prefer complete corrected files over isolated snippets where practical.
- Be open to explaining *how* an answer was reached, not just delivering it.

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

## cfg.json Restructure (planned)
- Migrating `cfg.json` to fuller nesting for logical separation (e.g. `cfg.stockmarket.*`, `cfg.hgw.*`, etc.).
- New `defaultcfg.json` holding canonical default values, same shape as `cfg.json`.
- `cfgall.js`/`cfgedit.js` to gain a "reset to defaults" function: reads `defaultcfg.json`, writes it over `cfg.json` (or per-key reset via dot-notation), re-syncs in-memory config after.
- Stock market settings (thresholds, budget, reserve cash, volatility cap) will live under `cfg.stockmarket.*` — no separate data file, reusing existing `jsonEdit()`/dot-notation pattern.

## stockmarket.js — Full Logic Outline (planned)
Assuming full access (WSE, TIX, 4S TIX API) and shorting unlocked:

**Startup, once:**
- Disable default logging; `ns.tail()` if a live view is wanted.
- Load `cfg.stockmarket` (thresholds, reserve cash, per-stock cap, volatility ceiling, sizing mode).

**Each tick, in order — the ordering matters:**
1. **Snapshot** — pull `getSymbols()`, and for each symbol gather forecast, volatility, position (long shares + avg price, short shares + avg price), bid/ask. Do this once per tick and pass the snapshot around rather than re-querying `ns.stock` repeatedly per symbol — cheaper and guarantees consistency within the tick.
2. **Sell pass first, buy pass second.** This is deliberate: selling first frees cash that the same tick's buy pass can then use. Buying before selling (like a naive per-symbol approach) lets the best-ranked buy candidate lock up cash that a sell earlier in the list would have freed — a concentration issue. Doing all sells across every symbol before any buys fixes that.
   - For each symbol with an open long position: if forecast has fallen below the sell-long threshold, sell the full long position.
   - For each symbol with an open short position: if forecast has risen above the sell-short threshold, sell the full short position.
3. **Rank remaining candidates for buying** — symbols with no open position (or room left under the per-stock share cap), filtered by volatility ceiling, sorted by edge (`|forecast - 0.5|`) descending.
4. **Buy pass** — walk the ranked list; for each candidate decide direction (long if forecast above buy-long threshold, short if below buy-short threshold), compute allocation (fixed-per-stock or proportional-capped, whichever sizing mode is chosen), check `getPurchaseCost()` against available cash before committing, execute, then deduct from available cash tracked locally so the next candidate in the same pass sees an accurate remaining budget (don't re-query `getPlayer().money` every iteration — track it locally, re-sync only at the top of the next tick).
5. **Report** — print portfolio value, net worth, per-symbol positions if useful. Optional, doesn't affect trading logic.
6. **Sleep** until next tick.