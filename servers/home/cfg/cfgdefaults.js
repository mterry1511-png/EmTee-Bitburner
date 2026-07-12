import { jsonEdit, confirmAction } from "../lib/util.js";

/**
 * Resets every key found in defaultcfg.json back to its canonical default.
 * Keys not present in defaultcfg.json (e.g. lastAugReset, which is runtime
 * state rather than user config) are left untouched.
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
 */
export async function main(ns) {
    if (!await confirmAction(ns, "WARNING: Reset ALL config values to their defaults? This cannot be undone.")) {
        ns.tprint("Cancelling");
        return;
    }

    const defaults = JSON.parse(ns.read("/data/defaultcfg.json"));

    for (const { key, value } of flattenKeys(defaults)) {
        jsonEdit(ns, key, value);
    }

    ns.tprint("Config reset to defaults.");
}

/**
 * Flattens a nested object into dot-notation key/value pairs matching jsonEdit's
 * key format (e.g. "purchaseConfig.maxPercSpend"). Arrays are treated as leaf
 * values, not recursed into.
 * @param {object} obj - The object to flatten
 * @param {string} [prefix=""] - The dot-notation prefix accumulated so far
 * @returns {{key: string, value: *}[]}
 */
function flattenKeys(obj, prefix = "") {
    const entries = [];
    for (const key in obj) {
        const value = obj[key];
        const fullKey = prefix ? `${prefix}.${key}` : key;

        if (value !== null && typeof value === "object" && !Array.isArray(value)) {
            entries.push(...flattenKeys(value, fullKey));
        } else {
            entries.push({ key: fullKey, value });
        }
    }
    return entries;
}
