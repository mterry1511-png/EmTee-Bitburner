import { main as refresh } from "./refresh.js";

/**
 * @param {NS} ns
 * @param {string} script
 * @param {string} cloudName
 * @param {number|null} pid - If provided, checks by PID instead of script name
 * @returns {boolean} Whether the script is currently running on the target server
 */
// Returns true/false if script is running. default behaviour by scriptname
export function ensureRunning(ns, script, cloudName, pid = null) {
    let running = false;
    switch (pid) {
        case null:
            if (!ns.isRunning(script, cloudName, cloudName)) {
                running = false;
            }
            else {
                running = true;
            }
            break;

        default:
            // placeholder to add alt behaviour pid check code
            break;
    }
    return running;
}

/** @param {NS} ns */
export async function main(ns) {
    while (true) {
        const clouds = JSON.parse(ns.read("./data/clouds.json"));
        for (const cloudName in clouds) {

            if (!ns.isRunning("cloudpush.js", cloudName, cloudName)) {
                ns.scp("cloudpush.js", cloudName, "home");
                ns.exec("cloudpush.js", cloudName, 1, cloudName);
            }
        }
        await refresh(ns, true);
        await ns.sleep(5000);
    }
}

