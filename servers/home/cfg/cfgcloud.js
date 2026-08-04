import { jsonEdit, promptField, getByPath } from "../lib/util.js";

/**
 * Prompts for the cloud-server purchasing settings and writes them to /data/cfg.json.
 * Covers only the purchaseConfig.* budget/sizing keys - the autobuyClouds on/off
 * switch lives in cfgtoggle.js, the sole home for boolean toggles.
 * Current values come from the live cfg.json; the displayed defaults are looked up
 * from /data/defaultcfg.json by each field's dotted key, never hardcoded here.
 * Unlike cfgall/cfghacknet/cfgtoggle, this editor has no "default" argument shortcut.
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
 */
export async function main(ns) {
    const cfg = JSON.parse(ns.read("/data/cfg.json"));
    const defaults = JSON.parse(ns.read("/data/defaultcfg.json"));

    /**
     * The cloud-purchase settings offered by this editor, in prompt order.
     * @type {{key: string, label: string, type: "text"|"number"|"boolean"|"array"}[]}
     * @property {string} key - Dotted path into cfg.json / defaultcfg.json, and the key passed to jsonEdit.
     * @property {string} label - Human-readable question shown in the ns.prompt dialog.
     * @property {string} type - Drives both the dialog UI and the parsing done by promptField.
     */
    const fields = [
        { key: "purchaseConfig.maxPercSpend", label: "Max % Spend", type: "number" },
        { key: "purchaseConfig.minCloudRam", label: "Min Cloud RAM", type: "number" },
        { key: "purchaseConfig.targetCloudServs", label: "Target Cloud Servers", type: "number" },
    ];

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