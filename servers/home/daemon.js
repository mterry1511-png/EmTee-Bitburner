import { main as refresh } from "./refresh.js";
import { main as upgradeClouds } from "./cloud/upgradeclouds.js";
import { ensureRunning } from "./lib/util.js";
import * as buyHacknetNodes from "./watch/buyhacknetnodes.js";

/**
 * Continuously refreshes the network and relaunches watched scripts on clouds.
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
 */
export async function main(ns) {
    // defined outside the loop to allow ns.atexit culling
    let clouds;
    let watched;
    let firstLoop = true;        // allows different behaviour on first loop

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
    ns.ui.moveTail(1450, 0);
    ns.ui.resizeTail(250, 350);

    ns.disableLog("disableLog");
    ns.disableLog("sleep");

    // close all children when killed
    ns.atExit(() => {
        for (const cloudName in clouds) {
            for (const script of watched) {
                ns.kill(script, cloudName, cloudName);
            }
        }
    });

    ns.print("\n\nDaemon started...\n\n");

    while (true) {
        // load config
        const cfg = JSON.parse(ns.read("/data/cfg.json"));

        // Clouds list - maintained in .json and by buyserver.js
        clouds = JSON.parse(ns.read("/data/clouds.json"));

        // List of scripts to be watched - maintained in .json
        // WARNING - all added scripts to watched must follow this args format (targethost as arg[0]).
        watched = cfg.watchedScripts;

        // print timestamp if there have been new entries only
        const time = new Date().toLocaleTimeString();
        ns.print(`\n [${time}]`);

        //// MAIN EXECUTION BLOCK
        // refresh network, autonuke+root, update networks.json
        // relinquishes control of refresh.js to scheduler. 
        if (!ns.isRunning("scheduler.js", "home")) {
            await refresh(ns, true);
        }

        // print ERROR if cfg.daemonSleep is smaller than cfg.refreshInterval. This will cause stale data in this script
        if (cfg.daemonSleep < cfg.refreshInterval) {
            ns.tprint("ERROR: cfg.daemonSleep is smaller than cfg.refreshInterval. Exiting daemon.js");
            return;
        }

        // upgrade clouds up to mincloudRAM if upgrade costs less than maxPercSpend (both in cfg.json)
        if (cfg.autobuyClouds === true) {
            await upgradeClouds(ns);
        }

        // check watched scripts are running on cloud servers 
        for (const cloudName in clouds) {
            for (const script of watched) {
                ensureRunning(ns, script, cloudName);
                await ns.sleep(50);
            }
        }

        //hacknet autobuy
        if (cfg.autobuyHacknet == true) {
            if (firstLoop) {
                // buys up to max affordable
                await buyHacknetNodes.main(ns);
            }
            else {
                await buyHacknetNodes.main(ns);             // buys up to max affordable
                // buyHacknetNodes.buyCheapest(ns);         //  Option for single upgrade per daemon tick only
            }
        }

        // TOR router and programs auto buy (requires singularity)

        // Stock market
        // if (ns.stock.hasWseAccount & ns.stock.hasTixApiAccess & ns.stock.has4SDataTixApi) {
        //     ensureRunning(ns, "/stocks/stockmarket.js");
        // }

        // set in cfg.json
        await ns.sleep(cfg.daemonSleep);
        firstLoop = false;
    }
}

