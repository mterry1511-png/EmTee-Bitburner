import { scanNetwork, scanCloud } from "../scanner.js";

/**
 * Deletes all cloud servers and restarts the daemon afterward.
 * WARNING: irreversible - loss occurs
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
 */
export async function main(ns) {
    //confirmation
    input = await ns.prompt("WARNING: Delete all cloud servers?", { type: "boolean" });

    switch (input) {
        case true:
            // kill daemon if running - interferes with clouds.json write
            const daemonScript = ns.getRunningScript("/daemon.js", "home");
            if (daemonScript) {
                ns.kill(daemonScript.pid);
                ns.tprint("Killed daemon.js");
                await ns.sleep(1000); // let atExit and any pending writes finish
            }
            scanNetwork(ns, true);    //update networks
            scanCloud(ns, true);    // update json

            // load clouds.json
            let clouds;
            try {
                clouds = JSON.parse(ns.read("/data/clouds.json"));
            } catch {
                ns.tprint("clouds.json is empty or malformed.");
                ns.tprint("Restarting daemon.js");
                ns.run("/daemon.js");
                return;
            }


            // Check if no clouds and quit if so
            if (Object.keys(clouds).length === 0) {
                ns.tprint("No clouds found. Exiting.");
                ns.tprint("Restarting daemon.js");
                ns.run("/daemon.js");
                return;
            }

            // delete all
            for (const cloud in clouds) {
                ns.cloud.deleteServer(cloud);
                ns.tprint("Deleted " + cloud);
            }

            scanNetwork(ns, true);    //update networks
            scanCloud(ns, true);    // update json

            ns.tprint("Restarting daemon.js");
            ns.run("/daemon.js");
            return;

        case false:
            ns.tprint("Cancelling")
            return;

        default:
            ns.tprint("Cancelling")
            return;

    }


}