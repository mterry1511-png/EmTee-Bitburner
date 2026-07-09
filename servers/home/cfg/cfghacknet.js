import { jsonEdit } from "../lib/util.js";

/**
 * Configures server-specific settings (hacknet autobuy configuration).
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
 */
export async function main(ns) {
    const cfg = JSON.parse(ns.read("/data/cfg.json"));
        const useDefaults = ns.args.includes("default");
    
    const fields = [
        { key: "hacknetPercSpend", label: "Max money spent on hacknet upgrades (%)", default: 80, type: "number" },
        { key: "autobuyHacknet", label: "Enable autobuy hacknet?", default: true, type: "boolean" },
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
        const currentDisplay = Array.isArray(current) ? current.join(", ") : current;

        const input = await ns.prompt(
            `${field.label}\nCurrent: ${currentDisplay} | Default: ${Array.isArray(field.default) ? field.default.join(", ") : field.default
            }`,
            { type: "text" }
        );

        if (input === "" || input === false) continue;

        let value;
        switch (field.type) {
            case "number":
                value = Number(input);
                if (Number.isNaN(value)) {
                    ns.tprint(`WARN: "${input}" is not a valid number for ${field.label}, skipping.`);
                    continue;
                }
                break;
            case "boolean":
                value = input.trim().toLowerCase() === "true";
                break;
            case "array":
                value = input.split(",").map(s => s.trim()).filter(s => s.length > 0);
                break;
            default:
                value = input;
        }

        jsonEdit(ns, field.key, value);
    }

    ns.tprint("Config updated.");
}