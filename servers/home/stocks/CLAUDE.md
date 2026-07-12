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
