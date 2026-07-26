import { jsonEdit, promptField, getByPath } from "../lib/util.js";

/**
 * Walks the user through every numeric daemon/target/purchase setting in turn,
 * writing each answer straight to /data/cfg.json.
 * Two sources are read up front: the live config (for the "Current:" value shown
 * in each prompt) and /data/defaultcfg.json (for the "Default:" value). Neither
 * default is hardcoded here — every one is looked up by the field's own dotted
 * key path via getByPath, so defaultcfg.json is the single source of truth.
 * Passing the "default" argument skips the prompts entirely and resets each
 * listed field to its defaultcfg.json value.
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
 */
export async function main(ns) {
    const cfg = JSON.parse(ns.read("/data/cfg.json"));
    const defaults = JSON.parse(ns.read("/data/defaultcfg.json"));
    const useDefaults = ns.args.includes("default");

    /**
     * The settings this editor offers, in prompt order.
     * @type {{key: string, label: string, type: "text"|"number"|"boolean"|"array"}[]}
     * @property {string} key - Dotted path into cfg.json / defaultcfg.json, e.g. "purchaseConfig.maxPercSpend".
     *                          Also the exact key handed to jsonEdit, so a typo here silently shows
     *                          "undefined" as the default and writes to the wrong place.
     * @property {string} label - Human-readable question shown in the ns.prompt dialog.
     * @property {string} type - Drives both the dialog UI and the parsing done by promptField.
     */
    const fields = [
        { key: "daemonSleep", label: "Daemon Sleep (ms)", type: "number" },
        { key: "cloudPushSleep", label: "Cloud Push Sleep (ms)", type: "number" },
        { key: "hacknetBuySleep", label: "Hacknet Buy Sleep (ms)", type: "number" },
        { key: "hacknetPercSpend", label: "Hacknet Percent Spend", type: "number" },
        { key: "securityThresh", label: "Security Threshold", type: "number" },
        { key: "moneyThresh", label: "Money Threshold", type: "number" },
        { key: "targetHackFraction", label: "Target Hack Fraction", type: "number" },
        { key: "leaveRamFree", label: "Leave RAM Free (GB)", type: "number" },

        { key: "targetRequirements.minHackChance", label: "Min Hack Chance", type: "number" },
        { key: "targetRequirements.minMoney", label: "Min Money", type: "number" },
        { key: "targetRequirements.minServerGrowth", label: "Min Server Growth", type: "number" },
        { key: "targetRequirements.minDispatchServers", label: "Min Dispatch Servers", type: "number" },
        { key: "targetRequirements.maxDispatchServers", label: "Max Dispatch Servers", type: "number" },
        // targetRequirements.excludeServers intentionally excluded - it is an array of
        // hostnames, and is easier to edit as JSON than through a comma-separated prompt

        { key: "purchaseConfig.maxPercSpend", label: "Max Percent Spend", type: "number" },
        { key: "purchaseConfig.minCloudRam", label: "Min Cloud RAM (GB)", type: "number" },
        { key: "purchaseConfig.targetCloudServs", label: "Target Cloud Servers", type: "number" },
        // purchaseConfig.cloudNamePresets intentionally excluded - a ~90 entry name pool,
        // not something to retype into a prompt
    ];
    // Non-interactive path: reset every field above to its defaultcfg.json value and bail out
    if (useDefaults) {
        for (const field of fields) {
            jsonEdit(ns, field.key, getByPath(defaults, field.key));
        }
        ns.tprint("Config reset to defaults.");
        return;
    }

    for (const field of fields) {
        // Both lookups use the same dotted key, one against the live config and
        // one against the defaults file - they are only ever shown to the user
        const current = getByPath(cfg, field.key);
        const defaultValue = getByPath(defaults, field.key);

        // undefined means "leave this one alone" - the user cancelled, submitted an
        // empty box, or typed something unparseable for a number field
        const value = await promptField(ns, field, current, defaultValue);
        if (value === undefined) continue;

        // Written one field at a time, so quitting midway still keeps earlier answers.
        // Note this makes the in-memory `cfg` above stale as soon as the first write lands
        jsonEdit(ns, field.key, value);
    }

    ns.tprint("Config updated.");
}