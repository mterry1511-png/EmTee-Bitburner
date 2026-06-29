import { jsonEdit } from "./lib/util.js";
import { killAll } from "./killall.js";

/**
 * Entry point for the next automation step after initialisation. 
 * WARNING: when this updates the *.json, this will be desynced with the VS code *.json as this is a one way operation only.
 * run after init.js!
 * @param {NS} ns - The Netscript API object
 */
export async function main(ns) {
    const step = Number(ns.args[0]); // define run step- i.e. 1

    // Set  cfgs
    let changes;
    switch (step) {
        case 1:
            changes = {
                "targetRequirements.minDispatchServers": 1,
                "targetRequirements.maxDispatchServers": 6,
                "purchaseConfig.maxPercSpend": 30,
                "purchaseConfig.minCloudRam": 2,
                "purchaseConfig.targetCloudServs": 0
            }
            break;

        case 2:
            changes = {
                "targetRequirements.minDispatchServers": 2,
                "targetRequirements.maxDispatchServers": 10,
                "purchaseConfig.maxPercSpend": 30,
                "purchaseConfig.minCloudRam": 128,
                "purchaseConfig.targetCloudServs": 0
            }
            break;

        case 3:
            changes = {
                "targetRequirements.minDispatchServers": 5,
                "targetRequirements.maxDispatchServers": 25,
                "purchaseConfig.maxPercSpend": 60,
                "purchaseConfig.minCloudRam": 2510,
                "purchaseConfig.targetCloudServs": 2
            }
            break;

        case 4:
            changes = {
                "targetRequirements.minDispatchServers": 10,
                "targetRequirements.maxDispatchServers": 100,
                "purchaseConfig.maxPercSpend": 60,
                "purchaseConfig.minCloudRam": 256000,
                "purchaseConfig.targetCloudServs": 4
            }
            break;

        case 5:
            changes = {
                "targetRequirements.minDispatchServers": 10,
                "targetRequirements.maxDispatchServers": 100,
                "purchaseConfig.maxPercSpend": 60,
                "purchaseConfig.minCloudRam": 524288,
                "purchaseConfig.targetCloudServs": 8
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

    // redefined throughout to be up to date.
    let clouds = JSON.parse(ns.read("/data/clouds.json"));    // load clouds.json
    let cloudNames = Object.keys(clouds);                     // fills array with cloud names

    // behaviour
    switch (step) {
        case 1:
            killAll(ns);
            await ns.sleep(1000);
            ns.exec("daemon.js", "home");
            await ns.sleep(8000);
            clouds = JSON.parse(ns.read("/data/clouds.json"));    // load clouds.json
            cloudNames = Object.keys(clouds);                     // fills array with cloud names
            ns.exec("dispatch.js", "home", 1, "home");
            await ns.sleep(1000);
            break;

        case 2:
            killAll(ns);
            await ns.sleep(1000);
            ns.exec("daemon.js", "home");
            await ns.sleep(8000);
            clouds = JSON.parse(ns.read("/data/clouds.json"));    // load clouds.json
            cloudNames = Object.keys(clouds);                     // fills array with cloud names
            ns.exec("dispatch.js", "home", 1, "home");
            await ns.sleep(1000);
            break;

        case 3:
            killAll(ns);
            await ns.sleep(1000);
            ns.exec("daemon.js", "home");
            await ns.sleep(8000);
            clouds = JSON.parse(ns.read("/data/clouds.json"));    // load clouds.json
            cloudNames = Object.keys(clouds);                     // fills array with cloud names
            ns.exec("dispatch.js", "home", 1, cloudNames[0]);
            ns.exec("buyrep.js", "home", 1, cloudNames[1]);
            await ns.sleep(1000);
            break;

        case 4:
            killAll(ns);
            await ns.sleep(1000);
            ns.exec("daemon.js", "home");
            await ns.sleep(8000);
            clouds = JSON.parse(ns.read("/data/clouds.json"));    // load clouds.json
            cloudNames = Object.keys(clouds);                     // fills array with cloud names
            ns.exec("dispatch.js", "home", 1, cloudNames[0]);
            for (let i = 1; i <= 4; i++) {
                ns.exec("buyrep.js", "home", 1, cloudNames[i]);
            }
            await ns.sleep(1000);
            break;

        case 5:
            killAll(ns);
            await ns.sleep(1000);
            ns.exec("daemon.js", "home");
            await ns.sleep(8000);
            clouds = JSON.parse(ns.read("/data/clouds.json"));    // load clouds.json
            cloudNames = Object.keys(clouds);                     // fills array with cloud names
            ns.exec("dispatch.js", "home", 1, cloudNames[0]);
            for (let i = 1; i <= 8; i++) {
                ns.exec("buyrep.js", "home", 1, cloudNames[i]);
            }
            await ns.sleep(1000);
            break;

        case 6:
            killAll(ns);
            await ns.sleep(1000);
            ns.exec("daemon.js", "home");
            await ns.sleep(8000);
            clouds = JSON.parse(ns.read("/data/clouds.json"));    // load clouds.json
            cloudNames = Object.keys(clouds);                     // fills array with cloud namess
            ns.exec("dispatch.js", "home", 1, cloudNames[0]);
            for (let i = 1; i <= 25; i++) {
                ns.exec("buyrep.js", "home", 1, cloudNames[i]);
            }
            await ns.sleep(1000);
            break;
    }
}