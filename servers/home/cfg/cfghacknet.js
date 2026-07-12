import { jsonEdit, promptField, getByPath } from "../lib/util.js";

/**
 * Configures server-specific settings (hacknet autobuy configuration).
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
 */
export async function main(ns) {
    const cfg = JSON.parse(ns.read("/data/cfg.json"));
    const defaults = JSON.parse(ns.read("/data/defaultcfg.json"));
    const useDefaults = ns.args.includes("default");

    const fields = [
        { key: "hacknetBuySleep", label: "Hacknet Buy Sleep (ms)", type: "number" },
        { key: "hacknetPercSpend", label: "Max money spent on hacknet upgrades (%)", type: "number" },
        { key: "autobuyHacknet", label: "Enable autobuy hacknet?", type: "boolean" },
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