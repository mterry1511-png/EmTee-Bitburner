import { main as refresh } from "./refresh.js";
import { main as upgradeClouds } from "./cloud/upgradeclouds.js";
import { ensureRunning } from "./lib/util.js";

/**
 * Continuously refreshes the network and relaunches watched scripts on clouds.
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
 */
export async function main(ns) {
    // defined outside the loop to allow ns.atexit culling
    let clouds;
    let watched;

    // close old daemon.js instances, excluding self
    const processes = ns.ps("home");
    for (const proc of processes) {
        if (proc.filename === "daemon.js" && proc.pid !== ns.pid) {
            ns.kill(proc.pid);
        }
    }

    // open tail by default
    ns.ui.openTail();
    ns.ui.setTailMinimized(false); // true: min, false: max
    ns.ui.moveTail(1470, 0);
    ns.ui.resizeTail(250, 350);

    // close all children when killed
    ns.atExit(() => {
        for (const cloudName in clouds) {
            for (const script of watched) {
                ns.kill(script, cloudName, cloudName);
            }
        }
    });

    while (true) {
        // load config
        const cfg = JSON.parse(ns.read("/data/cfg.json"));

        // Clouds list - maintained in .json and by buyserver.js
        clouds = JSON.parse(ns.read("/data/clouds.json"));

        // List of scripts to be watched - maintained in .json
        // WARNING - all added scripts to watched must follow this args format (targethost as arg[0]).
        watched = cfg.watchedScripts;

        // refresh network, autonuke+root, update networks.json
        await refresh(ns, true);

        // upgrade clouds up to mincloudRAM if upgrade costs less than maxPercSpend (both in cfg.json)
        await upgradeClouds(ns);

        // main loop - check watched scripts on cloud servers 
        for (const cloudName in clouds) {
            for (const script of watched) {
                ensureRunning(ns, script, cloudName);
                await ns.sleep(50);
            }
        }

        // hacknet auto buy
        ensureRunning(ns, "buyhacknode.js", "home");

        // set in cfg.json
        await ns.sleep(cfg.daemonSleep);
    }
}

