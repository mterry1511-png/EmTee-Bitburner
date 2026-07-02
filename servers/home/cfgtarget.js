import { jsonEdit } from "./lib/util.js";

/**
 * Configures target requirements (min/max dispatch servers).
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
 */
export async function main(ns) {
    const cfg = JSON.parse(ns.read("/data/cfg.json"));

    const fields = [
        { key: "targetRequirements.maxDispatchServers", label: "Max Dispatch Servers", default: 6 },
        { key: "targetRequirements.minDispatchServers", label: "Min Dispatch Servers", default: 1 },
    ];

    for (const field of fields) {
        const current = field.key.split(".").reduce((obj, k) => obj[k], cfg);
        const input = await ns.prompt(
            `${field.label}\nCurrent: ${current} | Default: ${field.default}`,
            { type: "text" }
        );
        if (input !== "") jsonEdit(ns, field.key, Number(input));
    }

    ns.tprint("Config updated.");
}