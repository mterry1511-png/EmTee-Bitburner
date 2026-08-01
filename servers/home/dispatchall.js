import { killHacks } from "./dispatch.js";
import { getTarget } from "./lib/targeting.js";

/**
 * Fleet-wide dispatch: gives each cloud server (and optionally home) its own dedicated target.
 *
 * Where dispatch.js spreads many targets across ONE host, this spreads one target per HOST.
 * It pulls the $/sec-ranked target list once, then hands each host a distinct target by
 * popping off the end of that array, so no two hosts attack the same server. Note that
 * `pop()` takes from the END, i.e. the LOWEST-ranked targets first - and home, launched first
 * for augmentation-bonus reasons, therefore receives the worst target of the set. See findings.
 *
 * Every dispatch.js is launched with dupe=true, because this script has already cleared the
 * fleet up front - letting each child kill again would tear down its siblings.
 *
 * Despite forwarding a concrete hostname, each child still runs dispatch.js (not deployer.js
 * directly), so dispatch.js's single-target branch handles it.
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
 */
export async function main(ns) {
    const cfg = JSON.parse(ns.read("/data/cfg.json"));
    let clouds = JSON.parse(ns.read("/data/clouds.json"));    // load clouds.json
    let cloudNames = Object.keys(clouds);                     // fills array with cloud names

    // Clear the whole fleet first so this is a clean restart rather than a pile-on.
    // killHacks is PID-based, so it catches deployers regardless of their per-target args.
    for (const cloud of cloudNames) {
        killHacks(ns, cloud);
    }
    // and on home
    killHacks(ns, "home");
    await ns.sleep(2000);   // let the game actually reclaim the killed processes' RAM


    // Ranked target list, consumed by pop() below - one distinct target handed to each host.
    const rankedTargets = getTarget(ns, "ranked");
    // How many hosts need a target: every cloud, plus home if cfg.deployToHome is on.
    const serversToFill = (cfg.deployToHome ? 1 : 0) + cloudNames.length;

    // Bail before launching anything if we can't give every host its own target - a partial
    // launch would leave some hosts popping `undefined` off an exhausted array.
    if (rankedTargets.length < serversToFill) {
        ns.tprint(`ERROR: Need ${serversToFill} targets, only have ${rankedTargets.length}`);
        return;
    }

    // On home first - so certain augmentation bonuses can apply if bought.
    // Args: (script, host, threads, scriptHost, targetMode, dupe). targetMode here is a raw
    // hostname, which routes dispatch.js into its single-target branch; dupe=true stops it
    // re-running killHacks and killing the siblings launched below.
    if (cfg.deployToHome === true) {
        ns.exec("dispatch.js", "home", 1, "home", rankedTargets.pop(), true);
    }

    // Stagger the cloud launches - each dispatch.js immediately execs a deployer, and
    // deployer.js sleeps 1000ms before it starts allocating RAM, so 3500ms gives each one
    // time to settle before the next competes for RAM. Prevents the RAM spike that came from
    // every deployer waking out of its startup sleep at the same moment.
    if (cloudNames.length > 0) {
        for (const cloudName of cloudNames) {
            ns.exec("dispatch.js", cloudName, 1, cloudName, rankedTargets.pop(), true);
            await ns.sleep(3500);
        }
    }


}