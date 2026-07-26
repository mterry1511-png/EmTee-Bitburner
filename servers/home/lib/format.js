
/**
 * Do not run this file directly - it exists purely as a library of display
 * formatters, and main() is an intentionally empty stub.
 *
 * Import it namespaced:  import * as format from "../lib/format.js";
 * Then call as i.e. format.num(1234) / format.money(x) / format.duration(ms).
 *
 * The formatting approach here is adapted from the game's own source.
 * @export
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
 */
export async function main(ns) {
    // do not use
}


// Suffix per power of 1000, indexed by how many times we divide by 1000.
// Index 0 is the empty string so sub-1000 values need no special-casing here.
const suffixes = ["", "k", "mil", "bil", "tril", "quad", "quint", "sext", "sept", "oct"];

/**
 * Format a number with thousands separators below 1000, and suffixed
 * form (k, mil, bil, ...) at 3 significant figures above that.
 *
 * @export
 * @param {number} number - The number to format
 * @returns {string} The formatted string, e.g. "999.99", "1.23mil", "-4.56bil"
 */
export function num(number) {
    if (Number.isNaN(number)) return "NaN";

    // Pull the sign off up front so all the maths below works on a positive
    // magnitude, then glue the "-" back on at each return.
    let sign;
    if (number < 0) {
        sign = "-";
    } else {
        sign = "";
    }

    const nAbs = Math.abs(number);

    if (nAbs === Infinity) return sign + "∞";

    // Small values keep full comma-separated form rather than getting a suffix.
    if (nAbs < 1000) {
        return sign + nAbs.toLocaleString("en-US", { maximumFractionDigits: 2 });
    }

    // log10 / 3 gives which power-of-1000 bucket we're in (1 = k, 2 = mil, ...).
    let suffixIndex = Math.floor(Math.log10(nAbs) / 3);
    // Clamp so absurdly large numbers fall back to the largest suffix we have
    // instead of indexing off the end of the array and printing "undefined".
    suffixIndex = Math.min(suffixIndex, suffixes.length - 1);

    // Divide down into that bucket, so scaled is normally in the range 1-999.
    const scaled = nAbs / 1000 ** suffixIndex;

    // 3 significant figures: shrink decimals as the integer part grows.
    // 1 int digit -> 2 decimals, 2 -> 1, 3 -> 0. Max(0, ...) guards the clamped
    // case above, where scaled can exceed 999 and intDigits go past 3.
    const intDigits = Math.floor(Math.log10(scaled)) + 1;
    const decimals = Math.max(0, 3 - intDigits);

    return sign + scaled.toFixed(decimals) + suffixes[suffixIndex];
}

/**
 * Format a number as money - a "$" prefix in front of num().
 *
 * @export
 * @param {number} number - The amount to format
 * @returns {string} The formatted amount, e.g. "$1.23mil"
 */
export function money(number) {
    return "$" + num(number);
}



/**
 * Format a millisecond duration as seconds below one minute, otherwise
 * minutes and seconds (e.g. "45s", "3m 12s").
 *
 * Note there is no hours bucket - a two hour duration formats as "120m 0s".
 *
 * @export
 * @param {number} ms - The duration in milliseconds
 * @returns {string} The formatted duration, e.g. "45s" or "3m 12s"
 */
export function duration(ms) {
    // Netscript timings come back in ms; round to whole seconds first so the
    // minute/second split below is done on integers.
    const totalSec = Math.round(ms / 1000);

    if (totalSec < 60) return totalSec + "s";

    // Whole minutes, then the leftover seconds via modulo
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;

    return min + "m " + sec + "s";
}