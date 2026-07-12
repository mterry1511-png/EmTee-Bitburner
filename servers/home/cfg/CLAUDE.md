## cfg.json Restructure (planned)
- Migrating `cfg.json` to fuller nesting for logical separation (e.g. `cfg.stockmarket.*`, `cfg.hgw.*`, etc.).
- New `defaultcfg.json` holding canonical default values, same shape as `cfg.json`.
- Stock market settings (thresholds, budget, reserve cash, volatility cap) will live under `cfg.stockmarket.*` — no separate data file, reusing existing `jsonEdit()`/dot-notation pattern.
- **Built:** `cfg/cfgdefaults.js` — full reset only (no per-key mode was requested), confirms first via `confirmAction`, then writes every key from `data/defaultcfg.json` into `cfg.json`. `lastAugReset` isn't in `defaultcfg.json`, so it survives a reset untouched. Since `cfg.json` isn't readable/writable from VS Code (game-owned), this write has to happen by running the script in-game — there's no equivalent of overwriting the file directly from the editor.
