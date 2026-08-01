// import functions required
import { scanNetwork } from "./scanner.js";
import { scanCloud } from "./scanner.js";
import { autoNuke, getRootedServers } from "./lib/util.js";

// IDEA - later this can be turned into a controller which is timed, compares besttarget array and restarts deployer if the top cfg.maxDispatchServers entries changes 

/**
 * One full refresh cycle: rescan the network, root everything rootable, then
 * rebuild every cached data file the rest of the automation reads from.
 *
 * This is the ORCHESTRATOR of the data-file contract. Order matters, because
 * each step's output is the next step's input:
 *   1. scanNetwork(ns, true)  -> writes /data/networks.json
 *   2. read networks.json, run autoNuke on every hostname in it (opens ports and
 *      nukes for root where possible, so hasAdminRights can change here)
 *   3. scanNetwork(ns, true)  -> rewrites /data/networks.json so the freshly
 *      rooted servers show hasAdminRights: true
 *   4. scanCloud(ns, true)    -> writes /data/clouds.json from networks.json
 *   5. getRootedServers(ns)   -> writes /data/rooted.json, merging the rooted
 *      non-purchased servers from networks.json with the keys of clouds.json
 *
 * Cadence: called by daemon.js once per daemon tick (cfg.daemonSleep), but only
 * while scheduler.js is NOT running - the scheduler takes over refresh duty on
 * its own cadence (cfg.refreshInterval) when it is up. daemon.js aborts if
 * cfg.daemonSleep is smaller than cfg.refreshInterval, since that would leave it
 * acting on stale data. init.js performs the equivalent sequence inline at
 * startup rather than calling this.
 *
 * Note it is also runnable directly from the terminal, where "-q" sets quiet.
 * @param {NS} ns - The Netscript API object
 * @param {boolean} [quiet=false] - If true, disables this script's own logging. Note the nested scanNetwork/scanCloud calls are hardcoded quiet regardless
 * @returns {Promise<void>}
 */
// The quiet flag is the only parameter - there is deliberately no target/mode
// arg, this always refreshes everything.
export async function main(ns, quiet = false) {
    quiet = quiet || ns.args.includes("-q");
    if (quiet) {
        ns.disableLog("ALL");
    }

    // First pass: build "/data/networks.json" so we have a hostname list to work from
    scanNetwork(ns, true);

    // read the freshly written file back as an array of full Server objects
    const servers = JSON.parse(ns.read("/data/networks.json"));

    // Try to open ports and gain root on every server we can see.
    // autoNuke is a no-op on servers we already own or can't crack yet, so it is
    // safe to fire at the whole list every cycle.
    for (const targetServer of servers) {
        autoNuke(ns, targetServer.hostname, true);
    }

    // Second pass: rewrite networks.json (root status has changed above), then
    // derive clouds.json from it, then derive rooted.json from both.
    // This ordering is the contract - clouds.json reads networks.json, and
    // getRootedServers reads both, so neither can run before its input is fresh.
    scanNetwork(ns, true);
    scanCloud(ns, true);
    getRootedServers(ns);

    // Print for user
//     ns.ui.clearTerminal();
//     ns.tprint("Refreshed ./data/networks.json");
//     ns.tprint("Executed ./lib/util.autonuke)");
}