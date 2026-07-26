**What symbols are**

`ns.stock.getSymbols()` returns an array of ticker strings — one per tradable company on the WSE (33 of them, e.g. `"FSIG"`, `"ECP"`, `"OMTK"`). Each one is a stable identifier for a stock, and several of them correspond to an actual hackable server in the game world (e.g. hacking `foodnstuff` nudges the `FNS` stock's second-order forecast) — though that link doesn't matter for a threshold-trading script, only for the hack-to-influence-stocks trick, which is out of scope here. Every other `ns.stock` function takes one of these symbols as its first argument.

**`ns.stock` functions you'll need**

*Access checks (used once at startup, or by the daemon-side unlock logic):*
- `hasWseAccount(): boolean`
- `hasTixApiAccess(): boolean`
- `has4SData(): boolean` — UI-only forecast display
- `has4SDataTixApi(): boolean` — the one that actually unlocks `getForecast()`/`getVolatility()` for scripts

*Per-tick data gathering:*
- `getSymbols(): string[]` — all tickers
- `getPosition(sym): [longShares, longAvgPrice, shortShares, shortAvgPrice]` — returns a 4-tuple, not an object
- `getForecast(sym): number` — 0–1, probability of price increase next tick
- `getVolatility(sym): number` — 0–1
- `getAskPrice(sym): number` — price you pay entering a long / exiting a short
- `getBidPrice(sym): number` — price you get exiting a long / entering a short
- `getMaxShares(sym): number` — share cap for that stock

*Decision support (fold spread + commission in for you):*
- `getPurchaseCost(sym, shares, posType): number` — `posType` is `"Long"` or `"Short"`
- `getSaleGain(sym, shares, posType): number` — singular "Gain," not "Gains" — worth double-checking since it's an easy typo to carry forward from memory

*Execution:*
- `buyStock(sym, shares): number` — returns actual price paid per share, or 0 on failure
- `sellStock(sym, shares): number` — returns actual price received, or 0 on failure
- `buyShort(sym, shares): number`
- `sellShort(sym, shares): number`

*Timing (alternative to `ns.sleep`):*
- `nextUpdate(): Promise<number>` — resolves when the next tick actually happens, rather than sleeping a fixed guessed interval. Worth considering over a flat `ns.sleep(6000)` since it stays correctly synced even during bonus/offline time where ticks can come faster.

*Not in the stock namespace, but needed:*
- `ns.getPlayer().money` — current cash, for sizing and reserve-floor checks

**Functions you'll be writing yourself (in `lib/stocks.js`, per the split we discussed)**

| Function | Description |
|---|---|
| `rankByEdge(symbols, snapshotData): string[]` | Sort symbols by `\|forecast - 0.5\|` descending |
| `shouldSellLong(position, forecast, cfg): boolean` | True if forecast has fallen below sell-long threshold |
| `shouldSellShort(position, forecast, cfg): boolean` | True if forecast has risen above sell-short threshold |
| `shouldBuyLong(forecast, volatility, cfg): boolean` | True if forecast above buy-long threshold and volatility under ceiling |
| `shouldBuyShort(forecast, volatility, cfg): boolean` | Mirror of above for shorts |
| `sizePosition(sym, availableCash, price, maxShares, cfg): number` | Returns share count to buy given sizing mode and remaining budget |

That's the full surface. Want to sketch the actual tick loop next, or lock down the `cfg.stockmarket` shape (thresholds, reserve cash, sizing mode) first since several of those lib functions take `cfg` directly?