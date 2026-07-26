import { jsonEdit, promptField, getByPath } from "../lib/util.js";

/**
 * Prompts for the dispatch-server bounds under targetRequirements and writes
 * them to /data/cfg.json.
 * Reached from cfg.js as the "hacking" category. Only the min/max dispatch
 * counts are editable here - the other targetRequirements.* keys (hack chance,
 * money, growth floors) are only exposed via cfgall.js.
 * Current values come from the live cfg.json; the displayed defaults are looked
 * up from /data/defaultcfg.json by dotted key, not hardcoded.
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
 */
export async function main(ns) {
    const cfg = JSON.parse(ns.read("/data/cfg.json"));
    const defaults = JSON.parse(ns.read("/data/defaultcfg.json"));

    /**
     * The targeting settings offered by this editor, in prompt order (max before min).
     * @type {{key: string, label: string, type: "text"|"number"|"boolean"|"array"}[]}
     * @property {string} key - Dotted path into cfg.json / defaultcfg.json, and the key passed to jsonEdit.
     * @property {string} label - Human-readable question shown in the ns.prompt dialog.
     * @property {string} type - Drives both the dialog UI and the parsing done by promptField.
     */
    const fields = [
        { key: "targetRequirements.maxDispatchServers", label: "Max Dispatch Servers", type: "number" },
        { key: "targetRequirements.minDispatchServers", label: "Min Dispatch Servers", type: "number" },
    ];

    for (const field of fields) {
        // Same dotted key read twice: once from the live config, once from the defaults file
        const current = getByPath(cfg, field.key);
        const defaultValue = getByPath(defaults, field.key);

        // undefined means "leave unchanged" - cancelled, empty, or an unparseable number.
        // Note nothing here checks min <= max; the two prompts are independent
        const value = await promptField(ns, field, current, defaultValue);
        if (value === undefined) continue;

        // Write per field so a mid-run quit still keeps the answers already given
        jsonEdit(ns, field.key, value);
    }

    ns.tprint("Config updated.");
}