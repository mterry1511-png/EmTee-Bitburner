import { scanNetwork, scanCloud } from "../scanner.js";
import { minBuy } from "./buycloud.js";
import * as format from "../lib/format.js";

/**
 * Grow the cloud fleet in two passes: first buy cheap 2GB servers until the
 * fleet reaches cfg.purchaseConfig.targetCloudServs, then walk every server and
 * upgrade it as close to cfg.purchaseConfig.minCloudRam as the spending cap
 * allows.
 *
 * Called by daemon.js once per tick when cfg.autobuyClouds is true, so it is
 * incremental by design - each tick nudges the fleet a bit closer to target
 * rather than trying to finish in one run.
 *
 * cfg.json keys consumed:
 *   - autobuyClouds                     master on/off, re-read constantly so
 *                                       flipping it off mid-run stops the work
 *   - purchaseConfig.targetCloudServs   how many cloud servers to own
 *   - purchaseConfig.minCloudRam        RAM to upgrade each server toward
 *   - purchaseConfig.maxPercSpend       max % of current money one upgrade may cost
 *   - purchaseConfig.cloudNamePresets   pool of names to pick from when buying
 *
 * Writes /data/clouds.json on every successful upgrade (updating that server's
 * maxRam), and indirectly via minBuy on every purchase. Also calls
 * scanNetwork/scanCloud between the buy and upgrade passes so the upgrade pass
 * sees the servers the buy pass just created.
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
 */
export async function main(ns) {
    let cfg = JSON.parse(ns.read("/data/cfg.json"));

    // load clouds.json - the fleet registry, keyed by hostname -> { maxRam }
    let clouds;
    try {
        clouds = JSON.parse(ns.read("/data/clouds.json"));
    } catch {
        ns.tprint("clouds.json is empty or malformed. Run scanner first.");
        return;
    }
    // Sanitise minCloudRam into something the game will actually accept.
    // Cloud server RAM must be a power of 2 between 2GB and 1048576GB (2^20), so a
    // hand-typed cfg value has to be rounded up to the next power of 2 and clamped.
    const configuredRam = cfg.purchaseConfig.minCloudRam;
    const minPurchasableRam = 2;
    const maxPurchasableRam = 1048576;

    if (!Number.isFinite(Number(configuredRam)) || Number(configuredRam) < minPurchasableRam) {
        ns.print("\nminCloudRam (" + configuredRam + ") is not a usable number - falling back to " + minPurchasableRam + "GB.");
    }
    // floor at 2GB (the "|| minPurchasableRam" also catches NaN and 0)
    const requestedRam = Math.max(Number(configuredRam) || minPurchasableRam, minPurchasableRam);
    // ceil(log2(x)) then 2^that = round up to the next power of 2; then clamp to the 2^20 cap
    const targetRamBase = Math.min(Math.pow(2, Math.ceil(Math.log2(requestedRam))), maxPurchasableRam);

    // fires both when the value wasn't a power of 2 and when it was above the cap
    if (targetRamBase !== requestedRam) {
        ns.print("\nminCloudRam (" + requestedRam + "GB) is not a valid power-of-2 server size - rounded up to " + targetRamBase + "GB.");
    }

    // preset names list in cfg.json - the pool this script draws hostnames from
    const cloudNames = cfg.purchaseConfig.cloudNamePresets;

    // PASS 1 - buy behaviour.
    // Keep buying minimum-size servers until the fleet hits targetCloudServs.
    // Both loop conditions are re-evaluated every iteration against freshly read
    // files, so flipping autobuyClouds off in-game stops this mid-run.
    while (Object.keys(clouds).length < cfg.purchaseConfig.targetCloudServs && cfg.autobuyClouds) {
        // pick a random preset name; skip and re-roll if that name is already in use
        const randomName = cloudNames[Math.floor(Math.random() * cloudNames.length)];
        if (clouds[randomName]) {
            continue;
        }

        // execute buy - minBuy blocks until the 2GB cost is affordable, then returns null
        // if the purchase itself failed (e.g. the max cloud server cap is already hit).
        // That failure won't resolve by retrying, so stop this tick's buy pass rather than
        // hot-looping purchaseServer calls that can only ever fail the same way.
        const bought = await minBuy(ns, randomName);
        if (bought === null) {
            ns.print("\nStopping cloud purchase pass - see the error above.");
            break;
        }
        clouds = JSON.parse(ns.read("/data/clouds.json"));      // re-read after each buy - minBuy wrote to it
        cfg = JSON.parse(ns.read("/data/cfg.json"));            // re-read after each buy - picks up live config edits
        await ns.sleep(100);
    }

    // Rebuild both data files before the upgrade pass so it sees the servers pass 1
    // just bought, with their real maxRam values.
    scanNetwork(ns, true);    //update networks.json
    scanCloud(ns, true);    // rebuild clouds.json from it
    clouds = JSON.parse(ns.read("/data/clouds.json"));

    // PASS 2 - upgrade behaviour. One server at a time, best size it can afford.
    for (const cloud in clouds) {
        cfg = JSON.parse(ns.read("/data/cfg.json"));    // re-read per server so live config edits apply mid-pass
        if (!cfg.autobuyClouds) break;                  // breaks if autobuyClouds is turned off at any point

        const currentRam = clouds[cloud].maxRam;
        const player = ns.getPlayer();
        let targetRam = targetRamBase;
        // NOTE: despite the name this does not track "first iteration of the loop".
        // It is only ever cleared in the can't-afford branch, so what it actually
        // means is "the can't-afford warning for this server has not been printed
        // yet" - it suppresses repeat warnings as the loop halves downward.
        // Flagged in the findings notes.
        let isFirstLoop = true;

        // Walk sizes downward from the configured target, halving each time, and
        // buy the first one we can afford. Stops once the candidate size drops to
        // or below what the server already has - there is no point "upgrading"
        // to a size it already meets or exceeds.
        for (; targetRam >= currentRam; targetRam = targetRam / 2) {
            const cost = ns.cloud.getServerUpgradeCost(cloud, targetRam);

            // spending cap: an upgrade may cost at most maxPercSpend% of current money
            if ((player.money * (cfg.purchaseConfig.maxPercSpend / 100)) > cost) {
                if (ns.cloud.upgradeServer(cloud, targetRam)) {
                    if (isFirstLoop) { ns.print("\n") }               // formatting for tail window
                    ns.print("Upgraded " + cloud + " to " + targetRam + "GB");

                    // update json - patch this server's maxRam and rewrite the whole
                    // registry, so it stays correct without waiting for a rescan
                    clouds[cloud].maxRam = targetRam;
                    ns.write("/data/clouds.json", JSON.stringify(clouds), "w");
                    break;
                }
            }
            else {
                // print the shortfall once per server, not once per size tried
                if (isFirstLoop) {
                    ns.print("\nCould not afford " + targetRam + "GB upgrade on " + cloud + ". Requires " + format.money(cost));
                    isFirstLoop = false;
                }

                // break if not going to attempt another loop iteration
                if ((targetRam / 2) <= currentRam) {
                    break;
                }
                else {
                    ns.print(". Attempting " + (targetRam / 2) + "GB.")
                }
            }
        }
    }
}