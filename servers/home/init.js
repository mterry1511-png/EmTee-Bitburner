/** @param {NS} ns */



// import functions required
import { scanNetwork } from "./scanner.js";
import { autoNuke } from "./lib/util.js";


export async function main(ns) {
    // import config file
    const cfg = JSON.parse(ns.read("data/cfg.json"));

    const servers = JSON.parse(ns.read("data/networks.json"));

    // run scanner to build "/data/networks.json"
    scanNetwork(ns);


    // exec autoNuke on all servers
    for (const targetServer of servers) {
        autoNuke(ns, targetServer.hostname);
    }

    // open "/data/networks.json" for user reference
    

    // update and overwrite "/data/networks.json"
    scanNetwork(ns);

    
    // exec buyRAM

    // exec buyHacknet

    // exec buyAugments

    // exec joinFactions

    //exec buyTor and programs (SINGULARITY)


}


// }  {
//     "hostname": "home",
//     "ip": "69.1.3.7",
//     "sshPortOpen": true,
//     "ftpPortOpen": true,
//     "smtpPortOpen": true,
//     "httpPortOpen": false,
//     "sqlPortOpen": false,
//     "hasAdminRights": true,
//     "cpuCores": 2,
//     "maxRam": 4096,
//     "organizationName": "Home PC",
//     "purchasedByPlayer": true,
//     "backdoorInstalled": false,
//     "baseDifficulty": 1,
//     "minDifficulty": 1,
//     "moneyMax": 0,
//     "numOpenPortsRequired": 5,
//     "requiredHackingSkill": 1,
//     "serverGrowth": 1
//   }