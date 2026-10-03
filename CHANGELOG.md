# Changelog

Audit trail of completed changes, newest first. One entry per session's work, grouped by date.
Open work lives in [TODO.md](TODO.md); per-finding detail for review-findings fixes stays in
[docs/review-findings.md](docs/review-findings.md) until that file is deleted.

## 2026-10-03

### Bug fixes: hangs and crashes
- `cfg.js`: cancelling the category prompt (or passing an unknown category) no longer crashes
  with `ns.run(undefined)`. The switch gained a `default:` case that returns, printing the valid
  categories for an unknown argument. The category list is now one module-level `categories`
  const shared by `autocomplete`, the prompt and the error message (partly resolves finding #9).
- `lib/targeting.js`: `"hacklvl"` mode no longer throws. It indexed `getBestHackLvlTarget`'s
  single-object return as an array (`targets[0]`).
- `corp/boostmaterials.js`: `warehouse.sizedAt` (not a real property, so every value was `NaN`)
  is now `warehouse.size - warehouse.sizeUsed`.

### Bug fixes: silent data corruption
- `cloud/renamecloud.js`: checks `renameServer`'s return value and bails before touching
  `clouds.json`. A failed rename used to leave a phantom entry or silently drop the real one.
  `killAll` is now awaited; `==` → `===`.
- `cloud/nukeclouds.js`: each cloud is `ns.killall`'d immediately before `deleteServer`, and the
  return value is checked. It used to print "Deleted" for servers with surviving scripts that
  the game refused to delete.

### Checked and deliberately left as-is
- `cloud/upgradeclouds.js` name-pool infinite loop: unreachable (93 names vs. the 25-server cap).
- `lib/targeting.js` empty-result crash, `stocks/stockmarket.js` stub, `lib/util.js` shadowed
  `getAvailableThreads`, `killall.js` no-confirm/no-try-catch, rename without rescan: not worth
  fixing for a single-user tool (rationale noted per item in review-findings).
- `stocks/stockTrader5.js`: confirmed broken on the current build (`ns.nFormat` no longer
  exists). Left dead on purpose; it's a community example, not project code.

### Documentation restructure
- New `TODO.md`: the single working list. Merges the old `README.txt` lists, `docs/checklist.txt`,
  CLAUDE.md's Priority/On the Horizon sections, the four scheduler-plan bugs and faction progress.
- `CLAUDE.md` rewritten as conventions and current state only: no to-dos, no changelog. Added a
  "Where things live" map and the daemon watched-script conventions (from
  `docs/!readme/daemonREADME.txt`). Fixed stale facts: `go.js` description, `promptField`'s
  boolean UI, the Windows MCP path, the `"default"` arg rule. New key learnings: dismissed
  boolean prompts resolve to `false`, `purchaseServer` returns `""` on failure, `ns.asleep` for
  promise races, `ns.exec` returns `0` on failure.
- New `README.md` (project intro + ASCII art) replaces `README.txt`.
- `docs/stocksfunctions.md` → `docs/stocks-api.md` (pasted chat line removed), linked from
  `servers/home/stocks/CLAUDE.md`.
- New `docs/git-cheatsheet.md` from `docs/!readme/git status README.txt` (`main` → `master`).
- `docs/scheduler-plan.md`: header no longer cites the old notes rule; circular reference
  removed; the done `refreshSleep` → `refreshInterval` rename ticked.
- `docs/review-findings.md` statuses refreshed: header corrected, the `cfg/` section re-verified
  against current code, fixed items marked RESOLVED.
- Deleted: `README.txt`, `docs/checklist.txt`, the `checklist-tick` skill, and `docs/!readme/`
  (contents moved to CLAUDE.md, TODO.md and the git cheat sheet, or already covered by JSDoc).

### Audit trail
- New `CHANGELOG.md` (this file), with history recovered from the notes removed from CLAUDE.md.
- CLAUDE.md: new Working Style rule to log completed changes here in the same session.
- New Stop hook (`.claude/settings.json` → `.claude/hooks/changelog-check.sh`): when Claude
  finishes a turn and files under `servers/`, `docs/`, or the root docs are newer than
  `CHANGELOG.md`, it blocks the stop once and asks for a changelog entry. Guarded by
  `stop_hook_active` so it can't loop.

### Repo
- Added `.gitattributes` (`* text=auto eol=lf`) to stop CRLF/LF churn. The 24 files showing as
  modified were line-ending-only changes.

## Earlier (recovered from notes removed from CLAUDE.md)

### 2026-08-07
- Verification pass over `docs/review-findings.md`: 78 CONFIRMED, 4 STALE, 0 false positives,
  3 AMBIGUOUS.

### 2026-08-04
- `init.js` now resets `cfg.json` via the new `resetCfgToDefaults(ns)` (shared with
  `cfg/cfgdefaults.js`). The old `cfgall.js "default"` call only reset a subset of keys, so
  values like `autobuyClouds` survived an aug reset.
- `cloud/buycloud.js`: `minBuy()`/`buy()` check `purchaseServer`'s `""` failure return instead of
  crashing in `getServerMaxRam("")`. `cloud/upgradeclouds.js` breaks its buy loop on that failure.
- `buyrep.js`: hostname bug, orphaned `share.js` threads (now killed by `atExit`), busy-loop retry.

### 2026-08-01
- `deployer.js`: WEAKEN phase recomputes its queue every tick, so it can finish.
- `init.js`: writes `lastAugReset` back, so the bootstrap no longer re-fires every run.
- `scanner.js`: BFS marks `visited` on enqueue, so `networks.json` has no duplicates.
- `lib/util.js`: `promptField` renders booleans as Yes/No/Skip, so backing out of `cfgtoggle`
  no longer turns every switch off.
