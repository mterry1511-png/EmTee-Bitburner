// import functions required
import { scanNetwork } from "./scanner.js";
import { scanCloud } from "./scanner.js";
import { autoNuke } from "./lib/util.js";



// IDEA - later this can be turned into a controller which is timed, compares besttarget array and restarts deployer if the top cfg.maxDispatchServers entries changes 

/**
 * Refreshes the network map, re-runs auto-nuke, and updates the cloud inventory.
 * @param {NS} ns - The Netscript API object
 */
//doesn't take args by design
export async function main(ns, quiet = false) {
    quiet = quiet || ns.args.includes("-q");
    if (quiet) {
        ns.disableLog("ALL");
    }

    // run scanner to build "/data/networks.json"
    scanNetwork(ns, true);

    // write full server information to servers
    const servers = JSON.parse(ns.read("/data/networks.json"));

    // exec autoNuke on all servers
    for (const targetServer of servers) {
        autoNuke(ns, targetServer.hostname, true);
    }

    // Refresh "/data/networks.json and clouds.json"
    scanNetwork(ns, true);
    scanCloud(ns, true);

    // Print for user
//     ns.ui.clearTerminal();
//     ns.tprint("Refreshed ./data/networks.json");
//     ns.tprint("Executed ./lib/util.autonuke)");
}