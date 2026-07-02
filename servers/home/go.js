import { jsonEdit } from "./lib/util.js";
import { killAll } from "./killall.js";                 // keep!
import { ensureRunning } from "./lib/util.js";

/**
 * Entry point for the next automation step after initialisation. 
 * WARNING: when this updates the *.json, this will be desynced with the VS code *.json as this is a one way operation only.
 * run after init.js!
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
 */
export async function main(ns) {
    const step = Number(ns.args[0]); // define run step- i.e. 1

    ns.run("refresh.js");

    // Set  cfgs
    let changes;
    switch (step) {
        case 1:
            changes = {
                "targetRequirements.minDispatchServers": 1,
                "targetRequirements.maxDispatchServers": 6,
                "purchaseConfig.maxPercSpend": 30,
                "purchaseConfig.minCloudRam": 2,
                "purchaseConfig.targetCloudServs": 25
            }
            break;

        case 2:
            changes = {
                "targetRequirements.minDispatchServers": 2,
                "targetRequirements.maxDispatchServers": 10,
                "purchaseConfig.maxPercSpend": 30,
                "purchaseConfig.minCloudRam": 128,
                "purchaseConfig.targetCloudServs": 25
            }
            break;

        case 3:
            changes = {
                "targetRequirements.minDispatchServers": 5,
                "targetRequirements.maxDispatchServers": 25,
                "purchaseConfig.maxPercSpend": 60,
                "purchaseConfig.minCloudRam": 2510,
                "purchaseConfig.targetCloudServs": 25
            }
            break;

        case 4:
            changes = {
                "targetRequirements.minDispatchServers": 10,
                "targetRequirements.maxDispatchServers": 100,
                "purchaseConfig.maxPercSpend": 60,
                "purchaseConfig.minCloudRam": 256000,
                "purchaseConfig.targetCloudServs": 25
            }
            break;

        case 5:
            changes = {
                "targetRequirements.minDispatchServers": 10,
                "targetRequirements.maxDispatchServers": 100,
                "purchaseConfig.maxPercSpend": 60,
                "purchaseConfig.minCloudRam": 524288,
                "purchaseConfig.targetCloudServs": 25
            }
            break;

        case 6:
            changes = {
                "targetRequirements.minDispatchServers": 10,
                "targetRequirements.maxDispatchServers": 150,
                "purchaseConfig.maxPercSpend": 60,
                "purchaseConfig.minCloudRam": 1048576,
                "purchaseConfig.targetCloudServs": 25
            }
            break;

        default:
            ns.tprint(`ERROR: Unknown step: ${step}`);
            return;
    }

    // apply cfg changes
    for (const [key, value] of Object.entries(changes)) {
        jsonEdit(ns, key, value);
    }

    // load config
    const cfg = JSON.parse(ns.read("/data/cfg.json"));


    if (ns.isRunning("daemon.js", "home")) {
        // // restart daemon.js  - DISABLED - NOT REQUIRED
        ns.tprint("cfg updated - starting on daemon.js (5s) - Sit tight!")
        ensureRunning(ns, "daemon.js", "home");
        await ns.sleep(5000);                                 // long ass wait to allow daemon.js to finish buying and upgrading servers
    }
    else {
        ns.tprint("cfg updated - daemon.js detected as running");   
    }

    // redefined throughout to be up to date.
    let clouds = JSON.parse(ns.read("/data/clouds.json"));    // load clouds.json
    let cloudNames = Object.keys(clouds);                     // fills array with cloud names

    // dispatch to home.js or to cloud depending on cfg
    if (cfg.deployToHome === true) {
        ns.exec("dispatch.js", "home", 1, "home");
    }
    else {
        ns.exec("dispatch.js", "home", 1, cloudNames[0]);
    }

    // iterate buyrep.js on all but one cloud servers - leaving one free for whatever
    for (let i = 1; i < cloudNames.length; i++) {
        if (!ns.isRunning("buyrep.js", cloudNames[i])) {
            ns.exec("buyrep.js", "home", 1, cloudNames[i]);
        }
    }

    // update user
    ns.tprint("dispatch.js and buyrep.js started on owned servers.")

    await ns.sleep(1000);
}