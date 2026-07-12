import { jsonEdit, promptField, getByPath } from "../lib/util.js";

/**
 * Configures boolean toggle settings.
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
 */
export async function main(ns) {
    const cfg = JSON.parse(ns.read("/data/cfg.json"));
    const defaults = JSON.parse(ns.read("/data/defaultcfg.json"));
    const useDefaults = ns.args.includes("default");

    const fields = [
        { key: "autobuyClouds", label: "Autobuy cloud servers?", type: "boolean" },
        { key: "autobuyHacknet", label: "Autobuy hacknet?", type: "boolean" },
        { key: "autoStocks", label: "Run Stock Market Tool?", type: "boolean" }
    ];

    if (useDefaults) {
        for (const field of fields) {
            jsonEdit(ns, field.key, getByPath(defaults, field.key));
        }
        ns.tprint("Config reset to defaults.");
        return;
    }

    for (const field of fields) {
        const current = getByPath(cfg, field.key);
        const defaultValue = getByPath(defaults, field.key);

        const value = await promptField(ns, field, current, defaultValue);
        if (value === undefined) continue;

        jsonEdit(ns, field.key, value);
    }

    ns.tprint("Config updated.");
}
