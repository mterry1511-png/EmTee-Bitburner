// ============================================================================
// stockTrader5.js — THIRD-PARTY / COMMUNITY SCRIPT. Not written to this
// project's conventions and deliberately left as found. NOT WORKING
//
// RELATIONSHIP TO stockmarket.js: this is the script that actually trades
// today. stocks/stockmarket.js is the purpose-built replacement being written
// against the design in stocks/CLAUDE.md, and is currently a non-working stub.
// When stockmarket.js is finished, THIS FILE SHOULD BE DELETED (or moved to
// old/ alongside goold.js). Until then it is the only working trader.
//
// Style warning before you edit: everything lives inside main(), it uses `let`
// throughout where `const` would do, mixes snake_case with camelCase
// (stockBuyOver_Long), and contains several confirmed bugs documented inline
// below. It also depends on ns.nFormat, which has been REMOVED from current
// Bitburner builds in favour of ns.formatNumber - lib/format.js in this project
// already provides equivalents.
//
// Requires: WSE account + TIX API + 4S Market Data TIX API (getForecast and
// getVolatility are 4S-only). Shorting is behind its own unlock, hence the
// shortUnlock flag below.
// ============================================================================

/**
 * Run the stock trading loop: for each symbol, sell out-of-threshold positions
 * then buy into favourable ones, forever.
 *
 * Ranks symbols each tick by "edge" - distance of the 4S forecast from 0.50 -
 * so the most confidently-directional stocks are considered first, then walks
 * that list doing a sell check and a buy check per symbol.
 *
 * Note the sell and buy passes are INTERLEAVED per symbol rather than run as
 * two separate full passes. That is the concentration problem stocks/CLAUDE.md
 * calls out: the first-ranked symbol's buy can consume cash that a later
 * symbol's sell would have freed, so the portfolio piles into whatever happened
 * to sort first. Fixing it properly is the job of stockmarket.js, not this file.
 *
 * All helper functions are nested inside main() so they close over the
 * threshold constants rather than taking them as parameters.
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>} Never resolves - the main loop has no exit condition
 */
export async function main(ns) {
    // Logging
    ns.disableLog('ALL');
    ns.tail();

    // Globals
    const scriptTimer = 2000; // Time script waits
    const moneyKeep = 1000000000; // Failsafe Money - never spend below this cash floor
    //const moneyKeep = 1000000;
    const stockBuyOver_Long = 0.60; // Buy stocks when forecast is over this %
    const stockBuyUnder_Short = 0.40; // Buy shorts when forecast is under this %
    const stockVolatility = 0.05; // Stocks must be under this volatility
    // MISLEADING NAMES - neither of these is a percent:
    // minSharePercent is a SHARE COUNT (5 shares), used only as the probe
    // quantity handed to getPurchaseCost() to test affordability.
    const minSharePercent = 5;
    // maxSharePercent is a FRACTION (1.00 = 100% of max shares), the ceiling on
    // how much of a symbol's total float this script will hold.
    const maxSharePercent = 1.00;
    const sellThreshold_Long = 0.55; // Sell Long when chance of increasing is under this
    const sellThreshold_Short = 0.40; // Sell Short when chance of increasing is under this
    const shortUnlock = false;  // Set true when short stocks are available to player

    // NOT actually a debug switch: it is a const initialised true and never
    // reassigned, so `while (runScript)` below is just `while (true)`.
    const runScript = true;           // For debug purposes
    const toastDuration = 15000;   // Toast message duration

    const extraFormats = [1e15, 1e18, 1e21, 1e24, 1e27, 1e30];
    const extraNotations = ["q", "Q", "s", "S", "o", "n"];
    const decimalPlaces = 3;


    // Functions
    /**
     * Format a number as money via ns.nFormat, with NaN and near-zero guards.
     *
     * Collapses anything within 1e-6 of zero to exactly 0 so tiny floating
     * point residue does not render as "$0.000" with a misleading sign, and
     * falls back to plain string coercion when nFormat gives up and returns
     * the literal string "NaN".
     *
     * TWO PROBLEMS worth knowing before reusing this:
     * 1. It takes ONE parameter, but formatReallyBigNumber below calls it with
     *    two. The second (format-string) argument is silently discarded, so the
     *    hardcoded '$0.000a' is applied to EVERY value and the decimalPlaces
     *    constant has no effect at all.
     * 2. ns.nFormat has been removed from current Bitburner builds. lib/format.js
     *    provides format.money()/format.num() as replacements.
     * @param {number} number - The value to format
     * @returns {string} The formatted string, or the raw number stringified on failure
     */
    function format(number) {
        if (Math.abs(number) < 1e-6) {
            number = 0;
        }

        const answer = ns.nFormat(number, '$0.000a');;

        if (answer === "NaN") {
            return `${number}`;
        }

        return answer;
    }

    /**
     * Format very large numbers that ns.nFormat's underlying numeral.js cannot
     * handle, by scaling them down and appending a custom suffix.
     *
     * numeral.js runs out of suffixes above 't' (trillion), so anything from
     * quadrillion up is divided down into the matching bucket from
     * extraFormats and given the corresponding letter from extraNotations
     * (q/Q/s/S/o/n) by hand.
     *
     * DEAD ARGUMENTS: every internal call passes a format string as a second
     * argument, but `format` accepts only one parameter, so all of those - and
     * the `decimalPlaces` constant that builds them - do nothing. The "0.000e+0"
     * scientific-notation fallback on the NaN path is unreachable for the same
     * reason: format() ignores the format string and can only return either its
     * own '$0.000a' output or a plain stringified number.
     *
     * Also note the recursive call prefixes a '$' mid-string, so scaled values
     * come out looking like "$1.234q".
     * @param {number} number - The value to format
     * @returns {string} A human-readable representation, or "∞" for Infinity
     */
    // numeral.js doesn't properly format numbers that are too big or too small
    // So, we will supply our own function for values over 't'
    function formatReallyBigNumber(number) {
        if (number === Infinity) return "∞";

        // Format numbers q+ properly
        for (let i = 0; i < extraFormats.length; i++) {
            if (extraFormats[i] < number && number <= extraFormats[i] * 1000) {
                return format(number / extraFormats[i], "0." + "0".repeat(decimalPlaces)) + extraNotations[i];
            }
        }

        // Use nFormat for numbers it can format
        if (Math.abs(number) < 1000) {
            return format(number, "0." + "0".repeat(decimalPlaces));
        }

        const str = format(number, "0." + "0".repeat(decimalPlaces) + "a");

        if (str === "NaN") return format(number, "0." + " ".repeat(decimalPlaces) + "e+0");

        return str;
    }

    /**
     * Open a long and/or short position in one symbol if its forecast and
     * volatility clear the configured thresholds.
     *
     * Buys long when the forecast is bullish enough, and short when it is
     * bearish enough - but only ever when volatility is BELOW the ceiling. The
     * volatility filter is the risk control: a wild stock can blow through your
     * sell threshold between two ticks, so it is skipped regardless of how
     * favourable its forecast looks.
     *
     * Position sizing spends everything above the moneyKeep cash floor, minus a
     * further 100000 headroom for the transaction commission, capped by the
     * remaining room under the maxSharePercent share ceiling.
     *
     * The short half is wrapped in `if (shortUnlock)` because ns.stock.buyShort
     * throws outright until shorting is unlocked, so the guard is load-bearing
     * rather than merely a preference.
     *
     * ns.stock.getPosition returns a 4-tuple: [longShares, longAvgPrice,
     * shortShares, shortAvgPrice]. The bare index reads throughout this file all
     * refer to that layout.
     * @param {string} stock - The stock symbol to consider
     * @returns {void}
     */
    function buyPositions(stock) {
        let position = ns.stock.getPosition(stock);
        let maxShares = (ns.stock.getMaxShares(stock) * maxSharePercent) - position[0];
        let maxSharesShort = (ns.stock.getMaxShares(stock) * maxSharePercent) - position[2];
        let askPrice = ns.stock.getAskPrice(stock);
        let forecast = ns.stock.getForecast(stock);
        let volatilityPercent = ns.stock.getVolatility(stock);
        let playerMoney = ns.getPlayer().money;


        // Look for Long Stocks to buy
        if (forecast >= stockBuyOver_Long && volatilityPercent <= stockVolatility) {
            if (playerMoney - moneyKeep > ns.stock.getPurchaseCost(stock, minSharePercent, "Long")) {
                let shares = Math.min((playerMoney - moneyKeep - 100000) / askPrice, maxShares);
                let boughtFor = ns.stock.buyStock(stock, shares);

                if (boughtFor > 0) {
                    let message = 'Bought ' + Math.round(shares) + ' Long shares of ' + stock + ' for ' + formatReallyBigNumber(boughtFor);

                    ns.toast(message, 'success', toastDuration);
                }
            }
        }

        // Look for Short Stocks to buy
        if (shortUnlock) {
            if (forecast <= stockBuyUnder_Short && volatilityPercent <= stockVolatility) {
                if (playerMoney - moneyKeep > ns.stock.getPurchaseCost(stock, minSharePercent, "Short")) {
                    let shares = Math.min((playerMoney - moneyKeep - 100000) / askPrice, maxSharesShort);
                    let boughtFor = ns.stock.buyShort(stock, shares);

                    if (boughtFor > 0) {
                        let message = 'Bought ' + Math.round(shares) + ' Short shares of ' + stock + ' for ' + formatReallyBigNumber(boughtFor);

                        ns.toast(message, 'success', toastDuration);
                    }
                }
            }
        }
    }

    /**
     * Close a symbol's long and/or short position if its forecast has crossed
     * the corresponding sell threshold, and print the position while doing so.
     *
     * Sells the FULL position rather than trimming - there is no partial exit.
     * Longs are dumped when the forecast falls below sellThreshold_Long; shorts
     * are covered when it rises above sellThreshold_Short.
     *
     * (Name has a typo in the source - "Threshdold". Left as-is; renaming is a
     * code change.)
     *
     * The printing and the selling are tangled together in one function, which
     * is why it prints nothing for a symbol you hold no position in.
     * @param {string} stock - The stock symbol to consider
     * @returns {void}
     */
    function sellIfOutsideThreshdold(stock) {
        let position = ns.stock.getPosition(stock);
        let forecast = ns.stock.getForecast(stock);

        if (position[0] > 0) {
            // Builds a crude +++/--- bar showing forecast strength: forecast is
            // 0..1, so *10 and -4 maps 0.50 to roughly 1 symbol and 0.90 to 5.
            let symbolRepeat = Math.floor(Math.abs(forecast * 10)) - 4;
            // BUG (confirmed, two of them on these two lines):
            // The ternary condition is the literal `true`, so the false branch
            // is dead. Worse, plusOrMinus is then a NUMBER (50 + symbolRepeat)
            // used in a boolean position - only falsy if symbolRepeat is exactly
            // -50, which cannot happen. So the bar always renders "+", even for
            // a bearish stock, and never "-".
            let plusOrMinus = true ? 50 + symbolRepeat : 50 - symbolRepeat;
            let forcastDisplay = (plusOrMinus ? "+" : "-").repeat(Math.abs(symbolRepeat));
            // Display-only profit estimate: shares * (bid - avgCost), less a
            // hardcoded 200000 for the round-trip commission. Does not gate the
            // sell decision, which is forecast-driven only.
            let profit = position[0] * (ns.stock.getBidPrice(stock) - position[1]) - (200000);

            // Output stock info & forecast
            ns.print(stock + ' 4S Forecast -> ' + (Math.round(forecast * 100) + '%   ' + forcastDisplay));
            ns.print('      Position -> ' + ns.nFormat(position[0], '0.00a'));
            ns.print('      Profit -> ' + ns.nFormat(profit, '$0.000a'));

            // Check if we need to sell Long stocks
            if (forecast < sellThreshold_Long) {
                let soldFor = ns.stock.sellStock(stock, position[0]);
                let message = 'Sold ' + position[0] + ' Long shares of ' + stock + ' for ' + ns.nFormat(soldFor, '$0.000a');

                ns.toast(message, 'success', toastDuration);
            }
        }

        if (shortUnlock) {
            if (position[2] > 0) {
                ns.print(stock + ' 4S Forecast -> ' + forecast.toFixed(2));

                // Check if we need to sell Short stocks
                if (forecast > sellThreshold_Short) {
                    let soldFor = ns.stock.sellShort(stock, position[2]);
                    let message = 'Sold ' + stock + ' Short shares of ' + stock + ' for ' + ns.nFormat(soldFor, '$0.000a');

                    ns.toast(message, 'success', toastDuration);
                }
            }
        }
    }


    // Main Loop
    // runScript is a const true, so this is an unconditional infinite loop.
    while (runScript) {
        // Get stocks in order of favorable forecast.
        // Sorts by |0.5 - forecast| DESCENDING - i.e. by how far the forecast is
        // from a coin flip in either direction, so the most confidently bullish
        // AND most confidently bearish symbols both sort to the front.
        let orderedStocks = ns.stock.getSymbols().sort(function (a, b) { return Math.abs(0.5 - ns.stock.getForecast(b)) - Math.abs(0.5 - ns.stock.getForecast(a)); })
        let currentWorth = 0;

        ns.print("---------------------------------------");

        for (const stock of orderedStocks) {
            const position = ns.stock.getPosition(stock);

            if (position[0] > 0 || position[2] > 0) {

                // Check if we need to sell
                sellIfOutsideThreshdold(stock);
            }

            // Check if we should buy
            buyPositions(stock);

            // Track our current profit over time.
            // NOTE: `position` was captured BEFORE the sell/buy calls above, so
            // this accounting reflects the pre-trade holdings, not the post-trade
            // ones. It is display-only, so the staleness is cosmetic.
            if (position[0] > 0 || position[2] > 0) {
                let longShares = position[0];
                let longPrice = position[1];
                let shortShares = position[2];
                let shortPrice = position[3];
                let bidPrice = ns.stock.getBidPrice(stock);

                // Calculate profit minus commision fees
                let profit = longShares * (bidPrice - longPrice) - (2 * 100000);
                let profitShort = shortShares * Math.abs(bidPrice - shortPrice) - (2 * 100000);

                // Calculate net worth
                currentWorth += profitShort + profit + (longShares * longPrice) + (shortShares * shortPrice);
            }
        }

        // Output Script Status
        ns.print("---------------------------------------");
        ns.print('Current Stock Worth: ' + formatReallyBigNumber(currentWorth));
        ns.print('Current Net Worth: ' + formatReallyBigNumber(currentWorth + ns.getPlayer().money));
        ns.print(new Date().toLocaleTimeString() + ' - Running ...');
        ns.print("---------------------------------------");

        await ns.sleep(scriptTimer);

        // Clearing log makes the display more static
        // If you need the stock history, save it to a file
        ns.clearLog()
    }
}
