import { jsonEdit, promptField, getByPath } from "../lib/util.js";

/**
 * Prompts for every top-level on/off switch in cfg.json and writes the answers.
 * All fields here are booleans, so promptField renders each as a real Yes/No
 * dialog rather than a text box. Current values come from the live cfg.json; the
 * displayed defaults are looked up from /data/defaultcfg.json by key, not
 * hardcoded - which is why e.g. autobuyHacknet now shows false as its default.
 * Passing the "default" argument skips the prompts and resets these four keys.
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
 */
export async function main(ns) {
    const cfg = JSON.parse(ns.read("/data/cfg.json"));
    const defaults = JSON.parse(ns.read("/data/defaultcfg.json"));
    const useDefaults = ns.args.includes("default");

    /**
     * The boolean switches offered by this editor, in prompt order.
     * @type {{key: string, label: string, type: "text"|"number"|"boolean"|"array"}[]}
     * @property {string} key - Top-level key in cfg.json / defaultcfg.json, and the key passed to jsonEdit.
     * @property {string} label - Human-readable question shown in the ns.prompt dialog.
     * @property {string} type - Always "boolean" here, which is what gets promptField to use the Yes/No UI.
     */
    const fields = [
        { key: "autobuyClouds", label: "Autobuy cloud servers?", type: "boolean" },
        { key: "autobuyHacknet", label: "Autobuy hacknet?", type: "boolean" },
        { key: "autoStocks", label: "Run Stock Market Tool?", type: "boolean" },
        { key: "deployToHome", label: "Deploy to home? Bool", type: "boolean" }
    ];

    // Non-interactive path: reset the four switches above to their defaultcfg.json values
    if (useDefaults) {
        for (const field of fields) {
            jsonEdit(ns, field.key, getByPath(defaults, field.key));
        }
        ns.tprint("Config reset to defaults.");
        return;
    }

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
