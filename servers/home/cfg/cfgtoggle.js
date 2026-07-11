import { jsonEdit } from "../lib/util.js";

/**
 * Configures boolean toggle settings.
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
 */
export async function main(ns) {
    const cfg = JSON.parse(ns.read("/data/cfg.json"));
    const useDefaults = ns.args.includes("default");

    const fields = [
        { key: "autobuyClouds", label: "Autobuy cloud servers?", default: false, type: "boolean" },
        { key: "autobuyHacknet", label: "Autobuy hacknet?", default: true, type: "boolean" },
    ];

    if (useDefaults) {
        for (const field of fields) {
            jsonEdit(ns, field.key, field.default);
        }
        ns.tprint("Config reset to defaults.");
        return;
    }

    for (const field of fields) {
        const current = field.key.split(".").reduce((obj, k) => obj[k], cfg);

        const input = await ns.prompt(
            `${field.label}\nCurrent: ${current} | Default: ${field.default}`,
            { type: "text" }
        );

        if (input === "" || input === false) continue;

        const value = input.trim().toLowerCase() === "true";
        jsonEdit(ns, field.key, value);
    }

    ns.tprint("Config updated.");
}
