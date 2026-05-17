// import functions required
import { scanNetwork } from "./scanner.js";
import { autoNuke } from "./lib/util.js";

/** @param {NS} ns */
export async function main(ns) {
    // import config file
    const cfg = JSON.parse(ns.read("data/cfg.json"));

    const servers = JSON.parse(ns.read("data/networks.json"));

    // run scanner to build "/data/networks.json"
    scanNetwork(ns, true);

    // exec autoNuke on all servers
    for (const targetServer of servers) {
        autoNuke(ns, targetServer.hostname);
    }

    // open "/data/networks.json" for user reference
    

    // Refresh "/data/networks.json"
    scanNetwork(ns);

        // exec buyRAM

    // exec buyHacknet

    // exec buyAugments

    // exec joinFactions

    //exec buyTor and programs (SINGULARITY)


}

