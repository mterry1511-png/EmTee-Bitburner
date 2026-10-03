import { scanNetwork, scanCloud } from "../scanner.js";
import { confirmAction } from "../lib/util.js";

/**
 * Delete every cloud server the player owns, then restart daemon.js.
 *
 * WARNING: irreversible - the money spent on those servers is gone, and every
 * script running on them dies with them.
 *
 * Sequence, and why each step is in that order:
 *   1. Confirm with the user (shared confirmAction helper - all destructive
 *      prompts route through it rather than a bespoke ns.prompt).
 *   2. Kill daemon.js first. The daemon rewrites /data/clouds.json on every tick
 *      and would race this script's registry updates otherwise. Its atExit hook
 *      also needs a moment to kill the watched scripts it spawned on the clouds.
 *   3. Rescan so clouds.json reflects reality before we iterate it.
 *   4. Delete each server.
 *   5. Rescan again so clouds.json (and networks.json) end up empty of clouds.
 *   6. Relaunch daemon.js.
 *
 * ns.cloud.deleteServer refuses to delete a server that still has scripts running
 * on it (returning false, not throwing), and killing daemon.js doesn't stop every
 * script on the clouds - only the watched ones its atExit hook knows about. So each
 * server is killall'd immediately before its delete. There's no await between the
 * two calls, so nothing else can run and relaunch a script onto it in between.
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
 */
export async function main(ns) {
    if (!await confirmAction(ns, "WARNING: Delete all cloud servers?")) {
        ns.tprint("Cancelling");
        return;
    }

    // kill daemon if running - it rewrites clouds.json every tick and would
    // race the registry updates below
    const daemonScript = ns.getRunningScript("/daemon.js", "home");
    if (daemonScript) {
        // PID-based kill - ns.kill(filename, host, ...args) silently no-ops unless
        // the args match exactly, so resolving to a PID first is the reliable route
        ns.kill(daemonScript.pid);
        ns.tprint("Killed daemon.js");
        await ns.sleep(1000); // let atExit and any pending writes finish
    }
    scanNetwork(ns, true);    //update networks.json
    scanCloud(ns, true);    // rebuild clouds.json from it

    // load clouds.json - the registry we are about to iterate and empty
    let clouds;
    try {
        clouds = JSON.parse(ns.read("/data/clouds.json"));
    } catch {
        ns.tprint("clouds.json is empty or malformed.");
        ns.tprint("Restarting daemon.js");
        ns.run("/daemon.js");
        return;
    }

    // Nothing to delete - restart the daemon and bail out early.
    // (An empty registry is written as "{}", which parses fine, so this check is
    // separate from the malformed-JSON catch above.)
    if (Object.keys(clouds).length === 0) {
        ns.tprint("No clouds found. Exiting.");
        ns.tprint("Restarting daemon.js");
        ns.run("/daemon.js");
        return;
    }

    // delete all - for...in over the registry object gives us the hostnames (keys)
    for (const cloud in clouds) {
        ns.killall(cloud);
        if (ns.cloud.deleteServer(cloud)) {
            ns.tprint("Deleted " + cloud);
        } else {
            ns.tprint("ERROR: could not delete " + cloud);
        }
    }

    // rescan so both data files stop listing the servers we just destroyed
    scanNetwork(ns, true);    //update networks.json
    scanCloud(ns, true);    // rebuild clouds.json from it - should now be "{}"

    ns.tprint("Restarting daemon.js");
    ns.run("/daemon.js");
}