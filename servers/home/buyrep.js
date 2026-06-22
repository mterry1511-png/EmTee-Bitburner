import { getAvailableThreads } from "./lib/util.js";

/** @param {NS} ns */
// pass host as arg[0]
export async function main(ns) { 
    const host = ns.args[0] ?? ns.getServer();

    // load config
    const cfg = JSON.parse(ns.read("./data/cfg.json"));

    let threads = 1;

    while (true){
        // threads to fill hostserver determined 
        threads = getAvailableThreads(ns, host, "./lib/share.js");

        if (threads < 1) {
            await ns.sleep(100);
            continue;
        }

        // exec
            ns.exec("./lib/share.js", host, threads)
            await ns.sleep(10000);
            }
}