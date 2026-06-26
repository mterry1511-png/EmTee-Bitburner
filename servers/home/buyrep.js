import { getAvailableThreads } from "./lib/util.js";

function printusage(ns) {
    ns.tprint("Run from home server only");
    ns.tprint("Specify cloud server to run on - fills ram but observes freeRam parameter in cfg.json");
    ns.tprint("Example usage: 'run buyrep.js cloud-0'");
    ns.tprint("Requires host to be specified")
    return;
}
 
/** @param {NS} ns */
// pass host as arg[0] (non-optional)
// run from home only - returns error if not
export async function main(ns) {
    // printusage check 
    const help = ns.args.includes("help");
    if (help) {
        printusage(ns);
        return;
    }

    // store host name
    const host = ns.args[0] ?? ns.getServer();

    // if host is home, return error
    if (host == "home") {
        ns.tprint("ERROR: buyrep must be ran on a cloud server\n");
        printusage(ns);
        return;
    }

    // if script is running on desired host, move to loop
    const currentServer = ns.getServer();
    if (currentServer.hostname == host) {
        await buyrep(ns, host);
        return;
    }

    // if valid server, exec on that host
    const clouds = JSON.parse(ns.read("./data/clouds.json"));
    if (Object.hasOwn(clouds, host)) {
        ns.exec("buyrep.js", host, 1, host);
        ns.tprint("Executed buyrep on " + host);
    }


    else {
        ns.tprint("ERROR: Invalid host target - terminated");
        printusage(ns);
        return;
    }
}

// runs on cloud server 

async function buyrep(ns, host) {
    // load config
    const cfg = JSON.parse(ns.read("./data/cfg.json"));

    // default for error catching later
    let threads = 1;
    
    while (true) {
        // threads to fill hostserver determined 
        threads = getAvailableThreads(ns, host, "./lib/share.js");

        // debug ns.tprint("\nthreads: " + threads + "\nhost: " + host);

        if (threads < 1) {
            await ns.sleep(100);
            ns.print("insufficient RAM to start share.js");
            continue;
        }

        // exec
        await ns.exec("./lib/share.js", host, threads);
        await ns.sleep(10000);
    }
}