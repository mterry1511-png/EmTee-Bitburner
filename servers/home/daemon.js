import { main as refresh } from "./refresh.js";
import { main as upgradeClouds } from "./cloud/upgradeclouds.js";

/**
 * @param {NS} ns
 * @param {string} script
 * @param {string} cloudName
 * @param {number|null} pid - If provided, checks by PID instead of script name
 * @returns {boolean} Whether the script is currently running on the target server
 */
export function ensureRunning(ns, script, cloudName, pid = null) {
    let running = false;
    switch (pid) {
        case null:
            if (!ns.isRunning(script, cloudName, cloudName)) {
                running = false;
                if (script == "cloudpush.js"){
                    ns.scp(script, cloudName, "home");
                }
                ns.exec(script, cloudName, 1, cloudName);
            }
            else {
                running = true;
            }
            break;

        default:
            // placeholder to add alt behaviour pid check code
            //
            //
            //
            break;
    }
    return running;
}

/** @param {NS} ns */
export async function main(ns) {
    // defined outside the loop to allow ns.atexit culling
    let clouds;
    let watched;


    // open tail by default
    ns.ui.openTail();
    ns.ui.setTailMinimized(false); // true: min, false: max
    ns.ui.moveTail(1390,0);
    ns.ui.resizeTail(300, 450);

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
        watched = cfg.watchedScripts;

        // refresh network, autonuke+root, update networks.json
        await refresh(ns, true);

        // upgrade clouds up to mincloudRAM if upgrade costs less than maxPercSpend (both in cfg.json)
        await upgradeClouds(ns);

        // main loop
        for (const cloudName in clouds) {
            for (const script of watched) {
                ensureRunning(ns, script, cloudName);
                await ns.sleep(50);
            }
        }

        // set in cfg.json
        await ns.sleep(cfg.daemonSleep);
    }
}

