import { jsonEdit, confirmAction } from "../lib/util.js";

/**
 * Resets every key found in defaultcfg.json back to its canonical default.
 * Full reset only - there is deliberately no per-key mode; use the individual
 * cfg/* editors for that. Keys not present in defaultcfg.json (e.g. lastAugReset,
 * which is runtime state written by init.js rather than user config) are left
 * untouched, since this only ever writes keys it found in the defaults file.
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
 */
export async function main(ns) {
    // Destructive and irreversible, so it routes through the shared confirm helper
    // rather than a bespoke ns.prompt call
    if (!await confirmAction(ns, "WARNING: Reset ALL config values to their defaults? This cannot be undone.")) {
        ns.tprint("Cancelling");
        return;
    }

    const defaults = JSON.parse(ns.read("/data/defaultcfg.json"));

    // jsonEdit only understands one dotted key at a time, so the nested defaults
    // object gets flattened into a list of dotted key/value pairs first
    for (const { key, value } of flattenKeys(defaults)) {
        jsonEdit(ns, key, value);
    }

    ns.tprint("Config reset to defaults.");
}

/**
 * Flattens a nested object into dot-notation key/value pairs matching jsonEdit's
 * key format (e.g. "purchaseConfig.maxPercSpend"). Arrays are treated as leaf
 * values, not recursed into - an array is a config value in its own right
 * (e.g. cloudNamePresets), not a branch with numeric keys to walk.
 * @param {object} obj - The object to flatten
 * @param {string} [prefix=""] - The dot-notation prefix accumulated so far
 * @returns {{key: string, value: *}[]} Flat list of dotted keys and their leaf values
 */
function flattenKeys(obj, prefix = "") {
    const entries = [];
    // for...in walks the object's keys (for...of would try to iterate values, which
    // a plain object has no iterator for)
    for (const key in obj) {
        const value = obj[key];
        // Top level keys have no prefix; anything deeper gets "parent.child"
        const fullKey = prefix ? `${prefix}.${key}` : key;

        // Plain object => a branch, so recurse and splice its results in.
        // The null check is needed because typeof null === "object" in JS
        if (value !== null && typeof value === "object" && !Array.isArray(value)) {
            entries.push(...flattenKeys(value, fullKey));
        } else {
            // Leaf: a primitive or an array, recorded as-is
            entries.push({ key: fullKey, value });
        }
    }
    return entries;
}
