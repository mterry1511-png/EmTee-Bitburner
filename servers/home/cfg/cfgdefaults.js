import { confirmAction, resetCfgToDefaults } from "../lib/util.js";

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

    resetCfgToDefaults(ns);

    ns.tprint("Config reset to defaults.");
}
