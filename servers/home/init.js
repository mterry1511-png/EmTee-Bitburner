// import functions required
import { scanNetwork } from "./scanner.js";
import { autoNuke } from "./lib/util.js";

/** @param {NS} ns */
export async function main(ns) {

    // Disable logging for ns functions
    ns.disableLog("disableLog");
    ns.disableLog("scan");
    ns.disableLog("getServerRequiredHackingLevel");
    ns.disableLog("getServerSecurityLevel");
    ns.disableLog("getServerMoneyAvailable");
    ns.disableLog("getServerMaxMoney");
    ns.disableLog("getServerMinSecurityLevel");
    ns.disableLog("getHostname");

    // import config file
    const cfg = JSON.parse(ns.read("./data/cfg.json"));

    // run scanner to build "/data/networks.json"
    scanNetwork(ns, true);

    // write full server information to servers
    const servers = JSON.parse(ns.read("./data/networks.json"));

    // exec autoNuke on all servers
    for (const targetServer of servers) {
        autoNuke(ns, targetServer.hostname, true);
    }

    // Refresh "/data/networks.json"
    scanNetwork(ns, true);

    // exec servWatch - refreshes ./data/networks.json regularly

    // exec buyRAM

    // exec buyHacknet

    // exec joinFactions

    // exec buyAugments

    //exec buyTor and programs (SINGULARITY)

    //printResults(ns, results);

    function printResults(ns, results) {
        // check results and print accordingly (NEED TO DEFINE)
        // Consider putting all watch into a single watch.js?
        ns.ui.clearTerminal();
        ns.tprint("\n\nInitialisation:\n");
        ns.tprint("  Network mapped and stored in ./data/networks.json\n");
        ns.tprint("  AutoNuked all servers\n");
        // ns.tprint("  Executed servWatch for automated nuking\n");
        // ns.tprint("  Executed ramWatch for automated RAM purchasing\n");
        // ns.tprint("  Executed hacknetWatch for automated hacknet purchasing \n");
        // ns.tprint("  Executed augWatch for automated augmentation purchasing \n");
        // ns.tprint("  Executed programWatch for automated TOR router and augmentation purchasing \n");
        ns.tprint("\n\n");
    }

}

