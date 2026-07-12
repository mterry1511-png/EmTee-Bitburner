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

## On the Horizon
- Extract the confirm-then-act prompt pattern from the file-removal script into `confirmAction` as well (already done for `nukeclouds.js`).
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

Planned work on the cfg.json restructure lives in [servers/home/cfg/CLAUDE.md](servers/home/cfg/CLAUDE.md); the stockmarket.js logic outline lives in [servers/home/stocks/CLAUDE.md](servers/home/stocks/CLAUDE.md).
