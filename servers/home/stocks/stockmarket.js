


// ============================================================================
// stockmarket.js — WORK IN PROGRESS. The intended replacement for
// stocks/stockTrader5.js.
//
// RELATIONSHIP TO stockTrader5.js: stockTrader5.js is a working, imported
// third-party script that trades today. THIS file is the purpose-built
// replacement for it, designed to the outline in stocks/CLAUDE.md. Neither has
// superseded the other yet — the working one is undocumented and the documented
// one does not work. When this file is finished, stockTrader5.js should be
// deleted or moved to old/.
//
// daemon.js:102 already has the ensureRunning() call for this file written and
// commented out, waiting on it.
//
// MATURITY: stub. The loop body is empty, there is no sell/buy logic, no
// sleep, and the trailing getSymbols() line is unreachable dead code. See
// stocks/CLAUDE.md for the full tick order this is meant to implement:
// snapshot -> sell pass (ALL symbols) -> rank -> buy pass -> report -> sleep.
// The sell-before-buy ordering across all symbols is the whole point of the
// rewrite; per-symbol interleaving is the concentration bug stockTrader5.js has.
// ============================================================================

/**
 * Run the automated stock trading loop.
 *
 * NOT IMPLEMENTED - currently a stub. Two distinct faults make it unsafe to run:
 *
 * 1. The while body contains no `await`. With `autoStocks` true this is a tight
 *    infinite loop with no yield, which will starve the game.
 * 2. The `symbols = ...` line after the loop is unreachable when `autoStocks` is
 *    true, and when it is false the loop is skipped and that line executes as an
 *    assignment to an UNDECLARED variable - which throws a ReferenceError under
 *    module strict mode. So both branches are broken, in different ways.
 *
 * The cfg re-read at the bottom of the loop is the intended kill switch: it
 * re-checks the toggle from disk each tick so flipping `autoStocks` off in the
 * config stops the script without needing to kill it. That part is correct, and
 * is necessary because any in-memory cfg goes stale as soon as a cfg/*.js editor
 * rewrites the file.
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
 */
export async function main(ns) {
    // define
    let cfg = JSON.parse(ns.read("/data/cfg.json"));

    while (cfg.autoStocks == true) {


        // update cfg to ensure the toggle is still on
        cfg = JSON.parse(ns.read("/data/cfg.json"));
    }

        symbols = ns.stock.getSymbols();


}