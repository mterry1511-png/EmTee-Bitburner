import { killHacks } from "./dispatch.js";
import { getTarget } from "./lib/targeting.js";

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


    // start on clouds - stagger launches so each dispatch.js instance starts deployers sequentially
    // rather than all at once, preventing a RAM avalanche when multiple deployers wake up from their
    // initialization sleep simultaneously

    const rankedTargets = getTarget(ns, "ranked");
    const serversToFill = (cfg.deployToHome ? 1 : 0) + cloudNames.length;

    // check there is sufficient targets for servers available
    if (rankedTargets.length < serversToFill) {
        ns.tprint(`ERROR: Need ${serversToFill} targets, only have ${rankedTargets.length}`);
        return;
    }

    // on home first - so certain augmentation bonuses can apply if bought
    if (cfg.deployToHome === true) {
        ns.exec("dispatch.js", "home", 1, "home", rankedTargets.pop(), true);
    }

    if (cloudNames.length > 0) {
        for (const cloudName of cloudNames) {
            ns.exec("dispatch.js", cloudName, 1, cloudName, rankedTargets.pop(), true);
            await ns.sleep(3500);
        }
    }

}