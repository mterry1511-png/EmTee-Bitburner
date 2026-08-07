import { jsonEdit, promptField, getByPath } from "../lib/util.js";

/**
 * Prompts for the cloud-server purchasing settings and writes them to /data/cfg.json.
 * Covers the purchaseConfig.* budget/sizing keys plus the top-level autobuyClouds
 * switch that decides whether the cloud watcher acts on them at all.
 * Current values come from the live cfg.json; the displayed defaults are looked up
 * from /data/defaultcfg.json by each field's dotted key, never hardcoded here.
 * Unlike cfgall/cfghacknet/cfgtoggle, this editor has no "default" argument shortcut.
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
 */
export async function main(ns) {
    const cfg = JSON.parse(ns.read("/data/cfg.json"));
    const defaults = JSON.parse(ns.read("/data/defaultcfg.json"));

    // Cloud server RAM must be a power of 2, so offer every valid value up to
    // the game's current cap as a dropdown instead of a free-typed number field.
    const ramChoices = [];
    for (let ram = 2; ram <= ns.cloud.getRamLimit(); ram *= 2) {
        ramChoices.push(ram);
    }

    /**
     * The cloud-purchase settings offered by this editor, in prompt order.
     * @type {{key: string, label: string, type: "text"|"number"|"boolean"|"array"|"select", choices?: number[]}[]}
     * @property {string} key - Dotted path into cfg.json / defaultcfg.json, and the key passed to jsonEdit.
     * @property {string} label - Human-readable question shown in the ns.prompt dialog.
     * @property {string} type - Drives both the dialog UI and the parsing done by promptField.
     * @property {number[]} [choices] - For type "select", the offered dropdown values.
     */
    const fields = [
        { key: "purchaseConfig.maxPercSpend", label: "Max % Spend", type: "number" },
        { key: "purchaseConfig.minCloudRam", label: "Min Cloud RAM", type: "select", choices: ramChoices },
        { key: "purchaseConfig.targetCloudServs", label: "Target Cloud Servers", type: "number" },
        // The only boolean here, so the only one promptField renders as a Yes/No dialog
        { key: "autobuyClouds", label: "Autobuy cloud servers?", type: "boolean" },
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