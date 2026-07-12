import { jsonEdit, promptField, getByPath } from "../lib/util.js";

/**
 * Configures target requirements (min/max dispatch servers).
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
 */
export async function main(ns) {
    const cfg = JSON.parse(ns.read("/data/cfg.json"));
    const defaults = JSON.parse(ns.read("/data/defaultcfg.json"));

    const fields = [
        { key: "targetRequirements.maxDispatchServers", label: "Max Dispatch Servers", type: "number" },
        { key: "targetRequirements.minDispatchServers", label: "Min Dispatch Servers", type: "number" },
    ];

    for (const field of fields) {
        const current = getByPath(cfg, field.key);
        const defaultValue = getByPath(defaults, field.key);

        const value = await promptField(ns, field, current, defaultValue);
        if (value === undefined) continue;

        jsonEdit(ns, field.key, value);
    }

    ns.tprint("Config updated.");
}