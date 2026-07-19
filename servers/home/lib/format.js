
/**
 * main - unused. Import -  import * as format from "../lib/format.js";
 * Then use as i.e. format.number()
 * This is stolen from the game source 
 * @export
 * @param {NS} ns
 * @returns {Promise<void>} 
 */
export async function main(ns) {
    // do not use
}


const suffixes = ["", "k", "mil", "bil", "tril", "quad", "quint", "sext", "sept", "oct"];

/**
 * Format a number with thousands separators below 1000, and suffixed
 * form (k, mil, bil, ...) at 3 significant figures above that.
 *
 * @export
 * @param {number} number
 * @returns {string}
 */
export function num(number) {
    if (Number.isNaN(number)) return "NaN";

    let sign;
    if (number < 0) {
        sign = "-";
    } else {
        sign = "";
    }

    const nAbs = Math.abs(number);

    if (nAbs === Infinity) return sign + "∞";

    if (nAbs < 1000) {
        return sign + nAbs.toLocaleString("en-US", { maximumFractionDigits: 2 });
    }

    let suffixIndex = Math.floor(Math.log10(nAbs) / 3);
    suffixIndex = Math.min(suffixIndex, suffixes.length - 1);

    const scaled = nAbs / 1000 ** suffixIndex;

    // 3 significant figures: shrink decimals as the integer part grows.
    const intDigits = Math.floor(Math.log10(scaled)) + 1;
    const decimals = Math.max(0, 3 - intDigits);

    return sign + scaled.toFixed(decimals) + suffixes[suffixIndex];
}

/**
 * Format a number as money: $ prefix + formatNumber.
 *
 * @export
 * @param {number} number
 * @returns {string}
 */
export function money(number) {
    return "$" + num(number);
}



/**
 * Format a millisecond duration as seconds below one minute, otherwise
 * minutes and seconds (e.g. "45s", "3m 12s").
 *
 * @export
 * @param {number} ms
 * @returns {string}
 */
export function duration(ms) {
    const totalSec = Math.round(ms / 1000);

    if (totalSec < 60) return totalSec + "s";

    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;

    return min + "m " + sec + "s";
}