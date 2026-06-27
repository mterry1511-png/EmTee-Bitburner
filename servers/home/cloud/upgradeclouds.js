import { scanNetwork, scanCloud } from "../scanner.js";
import { minBuy } from "./buycloud.js";

/**
 * Buys servers up to the targetCloudServs
 * Upgrades all cloud servers to at least the minimum RAM defined in cfg.json,
 * provided the upgrade cost is within the configured spending threshold.
 * Updates clouds.json on successful upgrade.
 * @param {NS} ns - The Netscript API object
 */
export async function main(ns) {
    const cfg = JSON.parse(ns.read("/data/cfg.json"));
    
    // load clouds.json
    let clouds;
    try {
        clouds = JSON.parse(ns.read("/data/clouds.json"));
    } catch {
        ns.tprint("clouds.json is empty or malformed. Run scanner first.");
        return;
    }
    // round minCloudRam up to nearest power of 2, capped at max purchasable
    const targetRam = Math.min(Math.pow(2, Math.floor(Math.log2(cfg.purchaseConfig.minCloudRam))), 1048576);

    // preset names list in cfg.json
    const cloudNames = cfg.purchaseConfig.cloudNamePresets;

    // buy behaviour
    while (Object.keys(clouds).length < cfg.purchaseConfig.targetCloudServs) {
        const randomName = cloudNames[Math.floor(Math.random() * cloudNames.length)];
        if (clouds[randomName]) {
            continue;
        }

        // execute buy
        await minBuy(ns, randomName);
        clouds = JSON.parse(ns.read("/data/clouds.json")); // re-read after each buy
        await ns.sleep(1000);
    }

    // refresh json and clouds var before upgrading 
    scanNetwork(ns, true);    //update networks
    scanCloud(ns, true);    // update json
    clouds = JSON.parse(ns.read("/data/clouds.json"));

    // upgrade behaviour
    for (const cloud in clouds) {
        const currentRam = clouds[cloud].maxRam;
        const player = ns.getPlayer();

        if (currentRam < targetRam) {
            const cost = ns.cloud.getServerUpgradeCost(cloud, targetRam);

            if ((player.money * (cfg.purchaseConfig.maxPercSpend / 100)) > cost) {
                if (ns.cloud.upgradeServer(cloud, targetRam)) {
                    ns.print("Upgraded " + cloud + " to " + targetRam + "GB");

                    // update json
                    clouds[cloud].maxRam = targetRam;
                    ns.write("/data/clouds.json", JSON.stringify(clouds), "w");
                }
            }
            else {
                ns.print("Could not afford " + targetRam + "GB upgrade on " + cloud + ". Requires $" + cost);
            }
        }
    }
}