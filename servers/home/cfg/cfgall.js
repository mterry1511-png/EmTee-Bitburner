import { jsonEdit } from "../lib/util.js";

/**
 * Interactively configures all daemon settings via prompts.
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
 */
export async function main(ns) {
    const cfg = JSON.parse(ns.read("/data/cfg.json"));
    const useDefaults = ns.args.includes("default");

    const fields = [
        { key: "daemonSleep", label: "Daemon Sleep (ms)", default: 10000, type: "number" },
        { key: "cloudPushSleep", label: "Cloud Push Sleep (ms)", default: 5000, type: "number" },
        { key: "hacknetBuySleep", label: "Hacknet Buy Sleep (ms)", default: 20, type: "number" },
        { key: "hacknetPercSpend", label: "Hacknet Percent Spend", default: 80, type: "number" },
        { key: "autobuyHacknet", label: "Autobuy Hacknet? Bool", default: false, type: "boolean" },
        { key: "securityThresh", label: "Security Threshold", default: 2, type: "number" },
        { key: "moneyThresh", label: "Money Threshold", default: 0.88, type: "number" },
        { key: "targetHackFraction", label: "Target Hack Fraction", default: 0.1, type: "number" },
        { key: "leaveRamFree", label: "Leave RAM Free (GB)", default: 15, type: "number" },
        { key: "deployToHome", label: "Deploy to home? Bool", default: true, type: "boolean" },

        { key: "targetRequirements.minHackChance", label: "Min Hack Chance", default: 0.5, type: "number" },
        { key: "targetRequirements.minMoney", label: "Min Money", default: 10000, type: "number" },
        { key: "targetRequirements.minServerGrowth", label: "Min Server Growth", default: 1, type: "number" },
        { key: "targetRequirements.minDispatchServers", label: "Min Dispatch Servers", default: 1, type: "number" },
        { key: "targetRequirements.maxDispatchServers", label: "Max Dispatch Servers", default: 6, type: "number" },
        // targetRequirements.excludeServers intentionally excluded

        { key: "purchaseConfig.maxPercSpend", label: "Max Percent Spend", default: 80, type: "number" },
        { key: "purchaseConfig.minCloudRam", label: "Min Cloud RAM (GB)", default: 7688, type: "number" },
        { key: "purchaseConfig.targetCloudServs", label: "Target Cloud Servers", default: 3, type: "number" },
        // purchaseConfig.cloudNamePresets intentionally excluded
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