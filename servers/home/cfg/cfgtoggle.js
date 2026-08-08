import { jsonEdit, promptField, getByPath } from "../lib/util.js";

/**
 * Prompts for every on/off switch in cfg.json and writes the answers - top-level
 * booleans plus gangCfg.autoAscend, the sole nested one.
 * All fields here are booleans, so promptField renders each as a real Yes/No
 * dialog rather than a text box. Current values come from the live cfg.json; the
 * displayed defaults are looked up from defaultcfg.json, not
 * hardcoded - which is why e.g. autobuyHacknet now shows false as its default.
 * Passing the "default" argument (case-insensitive) skips the prompts and resets
 * these seven keys. Passing one of the field keys instead (also case-insensitive,
 * e.g. "autobuyclouds") skips the prompt loop and quick-toggles just that field.
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
 */
export async function main(ns) {
    const cfg = JSON.parse(ns.read("/data/cfg.json"));
    const defaults = JSON.parse(ns.read("/data/defaultcfg.json"));
    const useDefaults = ns.args.some(arg => String(arg).toLowerCase() === "default");               // makes case non-sensitive but keeps camelCase for later

    /**
     * The boolean switches offered by this editor, in prompt order.
     * Only booleans supported here due to quickToggleKey
     * @type {{key: string, label: string, type: "text"|"number"|"boolean"|"array"}[]}
     * @property {string} key - Top-level key in cfg.json / defaultcfg.json, and the key passed to jsonEdit.
     * @property {string} label - Human-readable question shown in the ns.prompt dialog.
     * @property {string} type - Always "boolean" here, which is what gets promptField to use the Yes/No UI.
     */
    const fields = [
        { key: "autobuyClouds", label: "Autobuy cloud servers?", type: "boolean" },
        { key: "autobuyHacknet", label: "Autobuy hacknet?", type: "boolean" },
        { key: "autobuyPrograms", label: "Autobuy darkweb programs?", type: "boolean" },
        { key: "autobuyHomeUpgrades", label: "Autobuy home RAM upgrades?", type: "boolean" },
        { key: "autoStocks", label: "Run Stock Market Tool?", type: "boolean" },
        { key: "deployToHome", label: "Deploy to home? Bool", type: "boolean" },
        { key: "gangCfg.autoAscend", label: "Auto-ascend gang members?", type: "boolean" }
    ];

    // Can use specific args to quick toggle
    let quickToggleKey;
    const keysArray = fields.map(field => field.key);
    for (const key of keysArray) {
        if (ns.args.some(arg => String(arg).toLowerCase() === key.toLowerCase())) {
            quickToggleKey = key;
            break;
        }
    }

    // Non-interactive path: reset the four switches above to their defaultcfg.json values
    if (useDefaults) {
        for (const field of fields) {
            jsonEdit(ns, field.key, getByPath(defaults, field.key));
        }
        ns.tprint("Config reset to defaults.");
        return;
    }

    if (!quickToggleKey) {
        // prompt for each field
        for (const field of fields) {
            // Same key read twice: once from the live config, once from the defaults file
            const current = getByPath(cfg, field.key);
            const defaultValue = getByPath(defaults, field.key);

            // undefined means "leave unchanged" - including a dismissed boolean dialog,
            // which promptField now distinguishes from a genuine "No" via a select prompt.
            const value = await promptField(ns, field, current, defaultValue);
            if (value === undefined) continue;

            // Write per field so a mid-run quit still keeps the answers already given
            jsonEdit(ns, field.key, value);
        }
        ns.tprint("Config updated.");
    }
    else {
        // quick toggle specified field
        const current = getByPath(cfg, quickToggleKey);
        const toggled = !current;                             // Switch reverse it.
        jsonEdit(ns, quickToggleKey, toggled);         // and write to json to toggle

        let state;
        if (toggled) { state = "on" ;} else { state = "off" ;};
        ns.tprint(quickToggleKey + " toggled " + state);
    }
}
