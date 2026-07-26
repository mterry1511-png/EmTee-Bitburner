import { jsonEdit, promptField, getByPath } from "../lib/util.js";

/**
 * Prompts for the hacknet autobuy settings and writes them to /data/cfg.json.
 * Covers the buy loop's cadence and spend cap, plus the switch that enables the
 * autobuyer at all. Current values come from the live cfg.json; the displayed
 * defaults are looked up from /data/defaultcfg.json by dotted key, not hardcoded.
 * Passing the "default" argument skips the prompts and resets these three keys.
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
 */
export async function main(ns) {
    const cfg = JSON.parse(ns.read("/data/cfg.json"));
    const defaults = JSON.parse(ns.read("/data/defaultcfg.json"));
    const useDefaults = ns.args.includes("default");

    /**
     * The hacknet settings offered by this editor, in prompt order.
     * @type {{key: string, label: string, type: "text"|"number"|"boolean"|"array"}[]}
     * @property {string} key - Dotted path into cfg.json / defaultcfg.json, and the key passed to jsonEdit.
     * @property {string} label - Human-readable question shown in the ns.prompt dialog.
     * @property {string} type - Drives both the dialog UI and the parsing done by promptField.
     */
    const fields = [
        { key: "hacknetBuySleep", label: "Hacknet Buy Sleep (ms)", type: "number" },
        { key: "hacknetPercSpend", label: "Max money spent on hacknet upgrades (%)", type: "number" },
        // Boolean, so promptField renders a real Yes/No dialog rather than a text box
        { key: "autobuyHacknet", label: "Enable autobuy hacknet?", type: "boolean" },
    ];


    // Non-interactive path: reset the three keys above to their defaultcfg.json values
    if (useDefaults) {
        for (const field of fields) {
            jsonEdit(ns, field.key, getByPath(defaults, field.key));
        }
        ns.tprint("Config reset to defaults.");
        return;
    }

    for (const field of fields) {
        // Same dotted key read twice: once from the live config, once from the defaults file
        const current = getByPath(cfg, field.key);
        const defaultValue = getByPath(defaults, field.key);

        // undefined means "leave unchanged" - cancelled, empty, or an unparseable number
        const value = await promptField(ns, field, current, defaultValue);
        if (value === undefined) continue;

        // Write per field so a mid-run quit still keeps the answers already given
        jsonEdit(ns, field.key, value);
    }

    ns.tprint("Config updated.");
}