import { jsonEdit } from "../lib/util.js";

/**
 * Configures server-specific settings (purchase configuration).
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
 */
export async function main(ns) {
    const cfg = JSON.parse(ns.read("/data/cfg.json"));

    const fields = [
        { key: "purchaseConfig.maxPercSpend", label: "Max % Spend", default: 30 },
        { key: "purchaseConfig.minCloudRam", label: "Min Cloud RAM", default: 2 },
        { key: "purchaseConfig.targetCloudServs", label: "Target Cloud Servers", default: 0 },
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