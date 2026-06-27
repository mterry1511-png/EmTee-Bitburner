import { scanNetwork, scanCloud } from "../scanner.js";

/**
 * Deletes all cloud servers
 * WARNING: irreversible - loss occurs
 * @param {NS} ns - The Netscript API object
 */
export async function main(ns) {
    scanNetwork(ns, true);    //update networks
    scanCloud(ns, true);    // update json

    // load clouds.json
    let clouds;
    try {
        clouds = JSON.parse(ns.read("/data/clouds.json"));
    } catch {
        ns.tprint("clouds.json is empty or malformed.");
        return;
    }


    // Check if no clouds and quit if so
    if (Object.keys(clouds).length === 0) {
        ns.tprint("No clouds found. Exiting.");
        return;
    }

    // delete all
    for (const cloud in clouds) {
        ns.cloud.deleteServer(cloud);
        ns.tprint("Deleted " + cloud);
    }

    scanNetwork(ns, true);    //update networks
    scanCloud(ns, true);    // update json
}