import { scanNetwork, scanCloud } from "../scanner.js";
import { minBuy } from "./buycloud.js";
import * as format from "../lib/format.js";

/**
 * Buys servers up to the targetCloudServs, then upgrades all cloud servers to minimum RAM defined in cfg.json.
 * Updates clouds.json on successful upgrade.
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
 */
export async function main(ns) {
    let cfg = JSON.parse(ns.read("/data/cfg.json"));

    // load clouds.json
    let clouds;
    try {
        clouds = JSON.parse(ns.read("/data/clouds.json"));
    } catch {
        ns.tprint("clouds.json is empty or malformed. Run scanner first.");
        return;
    }
    // round minCloudRam up to nearest power of 2, clamped between the smallest and largest purchasable sizes
    const configuredRam = cfg.purchaseConfig.minCloudRam;
    const minPurchasableRam = 2;
    const maxPurchasableRam = 1048576;

    if (!Number.isFinite(Number(configuredRam)) || Number(configuredRam) < minPurchasableRam) {
        ns.print("\nminCloudRam (" + configuredRam + ") is not a usable number - falling back to " + minPurchasableRam + "GB.");
    }
    const requestedRam = Math.max(Number(configuredRam) || minPurchasableRam, minPurchasableRam);
    const targetRam = Math.min(Math.pow(2, Math.ceil(Math.log2(requestedRam))), maxPurchasableRam);

    if (targetRam !== requestedRam) {
        ns.print("\nminCloudRam (" + requestedRam + "GB) is not a valid power-of-2 server size - rounded up to " + targetRam + "GB.");
    }

    // preset names list in cfg.json
    const cloudNames = cfg.purchaseConfig.cloudNamePresets;

    // buy behaviour - buy up to min servers - breaking if autobuyclouds is false at any point
    while (Object.keys(clouds).length < cfg.purchaseConfig.targetCloudServs && cfg.autobuyClouds) {
        const randomName = cloudNames[Math.floor(Math.random() * cloudNames.length)];
        if (clouds[randomName]) {
            continue;
        }

        // execute buy
        await minBuy(ns, randomName);
        clouds = JSON.parse(ns.read("/data/clouds.json"));      // re-read after each buy
        cfg = JSON.parse(ns.read("/data/cfg.json"));            // re-read after each buy
        await ns.sleep(100);
    }

    // refresh json and clouds var before upgrading 
    scanNetwork(ns, true);    //update networks
    scanCloud(ns, true);    // update json
    clouds = JSON.parse(ns.read("/data/clouds.json"));

    // upgrade behaviour
    for (const cloud in clouds) {
        cfg = JSON.parse(ns.read("/data/cfg.json"));
        if (!cfg.autobuyClouds) break;                  // breaks if autobuyclouds is false at any point

        const currentRam = clouds[cloud].maxRam;
        const player = ns.getPlayer();

        if (currentRam < targetRam) {
            const cost = ns.cloud.getServerUpgradeCost(cloud, targetRam);

            if ((player.money * (cfg.purchaseConfig.maxPercSpend / 100)) > cost) {
                if (ns.cloud.upgradeServer(cloud, targetRam)) {
                    ns.print("\nUpgraded " + cloud + " to " + targetRam + "GB");

                    // update json
                    clouds[cloud].maxRam = targetRam;
                    ns.write("/data/clouds.json", JSON.stringify(clouds), "w");
                }
            }
            else {
                ns.print("\nCould not afford " + targetRam + "GB upgrade on " + cloud + ". Requires " + format.money(cost));
            }
        }
    }
}