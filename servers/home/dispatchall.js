import { killHacks } from "./dispatch.js";

/**
 * Runs dispatch.js in ranked mode on every known cloud server.
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
 */
export async function main(ns) {
    const cfg = JSON.parse(ns.read("/data/cfg.json"));
    let clouds = JSON.parse(ns.read("/data/clouds.json"));    // load clouds.json
    let cloudNames = Object.keys(clouds);                     // fills array with cloud names

    // kill existing dispatches
    for (const cloud of cloudNames) {
        killHacks(ns, cloud);
    }
    // and on home
    killHacks(ns, "home");
    await ns.sleep(2000);


    // start on clouds
    if (cloudNames.length > 0) {
        for (const cloudName of cloudNames) {
            ns.exec("dispatch.js", cloudName, 1, cloudName, "ranked", true);
        }
    }
    // and on home
    if (cfg.deployToHome === true) {
        ns.exec("dispatch.js", "home", 1, "home", "ranked", true);
    }
}