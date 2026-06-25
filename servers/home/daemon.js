import { main as refresh } from "./refresh.js";

/** @param {NS} ns */
export async function main(ns) {

    // define pid for watched processes


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