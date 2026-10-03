# TODO

The single working list for this project. Work items live here, not in CLAUDE.md
(which holds conventions and current state) and not in `docs/` (which holds design
and reference docs).

## Now

- [ ] **Commit the line-ending fix:** `git add --renormalize .`, then commit.
- [ ] Work through [docs/review-findings.md](docs/review-findings.md). Hang/crash and
      data-corruption rounds done 2026-10-03. Remaining items are mostly misbehaviour,
      DRY and cosmetic.
- [ ] Once review-findings is worked through: delete it and promote anything durable into CLAUDE.md.
- [ ] Once-over on `data/defaultcfg.json` values. The displayed/reset defaults changed when the
      per-script hardcoded defaults were removed (e.g. `autobuyHacknet` is now `false` everywhere).
      Confirm they're the values you actually want.

## Scheduler (in progress)

Design and implementation checklist: [docs/scheduler-plan.md](docs/scheduler-plan.md).

- [ ] Fix four bugs in the plan *before* writing code from it:
  - [ ] Main-loop step 2 races `nextWrite()` against `ns.sleep()`. Use `ns.asleep()` instead,
        or the next ns call throws a concurrent-call error.
  - [ ] `allocate()`'s eviction loop never updates `totalFree`, so it kills every filler.
  - [ ] Candidate hosts `["home", ...rooted.json]` double-counts home, because `rooted.json`
        already includes it.
  - [ ] `allocate()` doesn't check for `pid === 0` from `ns.exec`.
- [ ] Decide whether `waitCounter` still means anything once fillers occupy all idle RAM
      (nearly every request will then need eviction).
- [ ] Work through the plan's implementation checklist.
- [ ] Normal/non-priority request queue: deferred until priority-only works.
- [ ] Batcher (synced HWGW on top of the scheduler): not yet designed.

## Next

- [ ] Resolve the open `cfgview.js` Singularity-branch question once you've tested both
      variants in-game (see [servers/home/cfg/CLAUDE.md](servers/home/cfg/CLAUDE.md)).
- [ ] Route `removeall.js`'s confirm prompt through `confirmAction` (the last bespoke copy).
- [ ] Make the `"default"` arg on the cfg editors (`cfgall`, `cfgtoggle`, `cfghacknet`) reset the
      whole of `cfg.json` from `defaultcfg.json`, instead of only the fields that editor lists.
      `resetCfgToDefaults(ns)` already does this (and preserves `lastAugReset`).
- [ ] Use all servers in the scheduler, and cloudpush to all of them (conserve server space
      by launching infrequently?).

## Later

- [ ] Stock market: finish `stocks/stockmarket.js`, then retire `stockTrader5.js`.
      Outline: [servers/home/stocks/CLAUDE.md](servers/home/stocks/CLAUDE.md),
      API reference: [docs/stocks-api.md](docs/stocks-api.md).
- [ ] `cfg.json` restructure into fuller nesting (`cfg.stockmarket.*`, `cfg.hgw.*`...);
      see [servers/home/cfg/CLAUDE.md](servers/home/cfg/CLAUDE.md).
- [ ] Dashboard for cloud server status.

## Requires Singularity (SF4)

- [ ] Auto-install augmentations (`ns.singularity.installAugmentations`). Not the gang-member
      ascension in `gang/autoascend.js`, which already runs without SF4.
- [ ] Backdoor everything: make a list of priority servers first
- [ ] Auto-join factions
- [ ] Home RAM upgrades from the cloud watcher

## In-game progress: factions

Done: OmniTek, MegaCorp, BitRunners, The Black Hand, NiteSec, Netburners, CyberSec, Aevum,
Ishima, Sector-12, New Tokyo, Chongqing, The Syndicate, Tetrads, Tian Di Hui, Slum Snakes.

- [ ] ECorp
- [ ] Daedalus
- [ ] Church of the Machine God (Chongqing?)
- [ ] Bladeburners
- [ ] Shadows of Anarchy (requires infiltrations)
- [ ] The Covenant (requires combat skills)
