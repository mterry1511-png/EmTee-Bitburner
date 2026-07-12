import { jsonEdit, promptField, getByPath } from "../lib/util.js";

/**
 * Interactively configures all daemon settings via prompts.
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
 */
export async function main(ns) {
    const cfg = JSON.parse(ns.read("/data/cfg.json"));
    const defaults = JSON.parse(ns.read("/data/defaultcfg.json"));
    const useDefaults = ns.args.includes("default");

    const fields = [
        { key: "daemonSleep", label: "Daemon Sleep (ms)", type: "number" },
        { key: "cloudPushSleep", label: "Cloud Push Sleep (ms)", type: "number" },
        { key: "hacknetBuySleep", label: "Hacknet Buy Sleep (ms)", type: "number" },
        { key: "hacknetPercSpend", label: "Hacknet Percent Spend", type: "number" },
        { key: "autobuyHacknet", label: "Autobuy Hacknet? Bool", type: "boolean" },
        { key: "securityThresh", label: "Security Threshold", type: "number" },
        { key: "moneyThresh", label: "Money Threshold", type: "number" },
        { key: "targetHackFraction", label: "Target Hack Fraction", type: "number" },
        { key: "leaveRamFree", label: "Leave RAM Free (GB)", type: "number" },
        { key: "deployToHome", label: "Deploy to home? Bool", type: "boolean" },

        { key: "targetRequirements.minHackChance", label: "Min Hack Chance", type: "number" },
        { key: "targetRequirements.minMoney", label: "Min Money", type: "number" },
        { key: "targetRequirements.minServerGrowth", label: "Min Server Growth", type: "number" },
        { key: "targetRequirements.minDispatchServers", label: "Min Dispatch Servers", type: "number" },
        { key: "targetRequirements.maxDispatchServers", label: "Max Dispatch Servers", type: "number" },
        // targetRequirements.excludeServers intentionally excluded

        { key: "purchaseConfig.maxPercSpend", label: "Max Percent Spend", type: "number" },
        { key: "purchaseConfig.minCloudRam", label: "Min Cloud RAM (GB)", type: "number" },
        { key: "purchaseConfig.targetCloudServs", label: "Target Cloud Servers", type: "number" },
        // purchaseConfig.cloudNamePresets intentionally excluded
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