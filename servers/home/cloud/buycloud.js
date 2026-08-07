import * as format from "../lib/format.js"

/**
 * Terminal entry point. Reads the desired server name and the min-buy flag from
 * ns.args and dispatches to either buy() (largest affordable server) or
 * minBuy() (smallest possible server, waits for money).
 *
 * Both paths append the new server to /data/clouds.json themselves rather than
 * re-running scanCloud, so the registry is up to date the instant the purchase
 * lands.
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
 */
export async function main(ns) {
    // handle args
    const newCloudName = ns.args[0];
    const minBuyFlag = ns.args[1];              // pass 1 to buy the smallest (2GB) server instead

    //calls help
    const help = ns.args.includes("help");
    if (help) {
        printusage(ns);
        return;
    }
    

    //core functionalitys
    if (minBuyFlag == 1) {
        await minBuy(ns, newCloudName);
    }
    else {
        await buy(ns, newCloudName);
    }
}

/**
 * Prints usage instructions for the cloud server purchasing script.
 * NOTE: the text below is out of date on two counts - there is no
 * "targetserver" argument any more (cloud purchases need no source server), and
 * the min-buy flag buys a 2GB server, not 32GB. Flagged in the findings notes;
 * left as-is because these are string literals, i.e. code.
 * @param {NS} ns - The Netscript API object
 * @returns {void}
 */
function printusage(ns) {
    ns.tprint("This script will buy the most expensive server you can afford from targetserver, with the name specified by newCloudName.");
    ns.tprint("Run this script on home server");
    ns.tprint("Usage: run buyserver.js [newCloudName]");
    ns.tprint("Example: run buyserver.js my-new-server");
    ns.tprint("minBuy: To force 32GB server only - use '1' as arg[1] - Example: run buyserver.js my-new-server 1");
    return;
}

/**
 * Buy the largest cloud server the player can currently afford and append it to
 * /data/clouds.json.
 *
 * Sizing works by doubling: start at the 2GB minimum and keep doubling while the
 * NEXT size up is still affordable, then buy the last size that was. Cloud
 * server RAM must be a power of 2, which is why doubling rather than a
 * cost-per-GB calculation is used.
 *
 * Not exported - only reachable via main(). The always-buy-small sibling
 * minBuy() below is the one other scripts import.
 * @param {NS} ns - The Netscript API object
 * @param {string} newCloudName - The requested name for the new cloud server. Falls back to "cloud" if falsy
 * @returns {Promise<void>}
 */
async function buy(ns, newCloudName) {
    // we will use this variable to track the last known affordable RAM amount, starting at 2GB, and double it until we find the most expensive server we can afford
    let affordableram = 2;
    if (!(newCloudName)) {
        newCloudName = "cloud";
    }

    while (true) {
        // if we can't afford a server with double the RAM of last tested, buy it and end program
        if (ns.cloud.getServerCost(affordableram * 2) > ns.getPlayer().money) {
            // can't afford double, so buy current amount.
            // Reassigning from the return value matters: the game appends "-0", "-1"
            // etc. when the requested hostname is already taken, so the name we
            // asked for is not necessarily the name we got. Everything below must
            // use the returned name, not the requested one.
            newCloudName = ns.cloud.purchaseServer(newCloudName.toString(), affordableram);

            // purchaseServer returns "" on failure (invalid hostname/RAM, insufficient
            // money at the moment of purchase, or the max-cloud-servers cap already hit) -
            // bail out instead of feeding "" to getServerMaxRam below.
            if (!newCloudName) {
                ns.tprint("ERROR: purchaseServer failed - invalid name/RAM, insufficient money, or the max cloud server count has been reached.");
                return;
            }

            // print results to terminals
            ns.tprint("Bought server " + newCloudName + " with " + affordableram + "GB of RAM for " + format.money(ns.cloud.getServerCost(affordableram)) + ". Remaining money: " + format.money(ns.getPlayer().money));
            ns.print("Bought server " + newCloudName + " with " + affordableram + "GB of RAM for " + format.money(ns.cloud.getServerCost(affordableram)) + ". Remaining money: " + format.money(ns.getPlayer().money));

            // add cloud server to JSON
            const servs = JSON.parse(ns.read("/data/clouds.json"));           // read clouds.json into an obj

            // add newly purchased server, matching the { hostname: { maxRam } }
            // shape that scanCloud writes
            servs[newCloudName] = {
                maxRam: ns.getServerMaxRam(newCloudName)
            };

            // write the registry back - read-modify-write, so existing entries survive
            ns.write("/data/clouds.json", JSON.stringify(servs), "w");
            
            // Dead code: cloudpush is now started by daemon.js via ensureRunning,
            // so this script no longer needs to kick one off itself.
            // ns.exec("cloudpush.js", "home", 1, newCloudName);
            // await ns.sleep(100);
            return;
        }
        else {
            affordableram *= 2;
        }
    }
}

/**
 * Buy the smallest possible cloud server (2GB) and append it to
 * /data/clouds.json, blocking until the player can afford it.
 *
 * This is the "get a slot on the board cheaply, upgrade it later" path, and is
 * the function upgradeclouds.js imports: it fills the fleet up to
 * cfg.purchaseConfig.targetCloudServs with minimum-size servers first, then
 * upgrades them in a separate pass. Buying small then upgrading costs the same
 * as buying large outright, so this is strictly better than waiting.
 *
 * Blocking behaviour: it sleeps in 5s increments until the 2GB cost is
 * affordable, so a caller awaiting this can be parked indefinitely if the player
 * has no money.
 * @param {NS} ns - The Netscript API object
 * @param {string} newCloudName - The requested name for the new cloud server. Falls back to "cloud" if falsy
 * @returns {Promise<string|null>} The hostname actually purchased, or null if the purchase failed
 *   (invalid name/RAM, or the max cloud server count has already been reached - the money
 *   check above already handles the "can't afford" case by waiting instead of failing)
 */
export async function minBuy(ns, newCloudName) {
    // always buys 2gb (small) server
    if (!(newCloudName)) {
        newCloudName = "cloud";
    }

    // block until the 2GB cost is affordable
    while (ns.cloud.getServerCost(2) > ns.getPlayer().money) {
        // wait (should be fast!)
        await ns.sleep(5000);
        ns.print("\nCan't afford server - waiting for player money...")
    }

    // purchase 2gb - reassigning from the return value because the game appends
    // "-0", "-1" etc. if the requested hostname is already in use
    newCloudName = ns.cloud.purchaseServer(newCloudName.toString(), 2);

    // purchaseServer returns "" on failure. The money check above already guarantees
    // affordability, so a "" here means invalid name/RAM or the max-server cap is hit -
    // report it and bail rather than feeding "" to getServerMaxRam below.
    if (!newCloudName) {
        ns.print("\nERROR: purchaseServer failed - invalid name/RAM, or the max cloud server count has been reached.");
        return null;
    }

    // print results to the tail log (this runs under daemon.js, hence print not tprint)
    ns.print("\nBought server " + newCloudName + " with 2GB of RAM");

    // add cloud server to JSON
    const servs = JSON.parse(ns.read("/data/clouds.json"));           // read clouds.json into an obj

    // add newly purchased server, matching the { hostname: { maxRam } }
    // shape that scanCloud writes
    servs[newCloudName] = {
        maxRam: ns.getServerMaxRam(newCloudName)
    };

    // write the registry back - read-modify-write, so existing entries survive
    ns.write("/data/clouds.json", JSON.stringify(servs), "w");

    // Dead code: cloudpush is now started by daemon.js via ensureRunning,
    // so this script no longer needs to kick one off itself.
    // ns.exec("cloudpush.js", "home", 1, newCloudName);
    // await ns.sleep(100);
    return newCloudName;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnV5c2VydmVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL2J1eXNlcnZlci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxxQkFBcUI7QUFFckIsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLFdBQVcsQ0FBQztBQUV0QyxNQUFNLENBQUMsS0FBSyxVQUFVLElBQUksQ0FBQyxFQUFFLEVBQUUsWUFBWSxFQUFFLFlBQVk7SUFDekQsTUFBTSxJQUFJLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDcEMsSUFBSSxJQUFJLEVBQUU7UUFDUixVQUFVLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDZixPQUFPO0tBQ1I7SUFFSCxTQUFTLFVBQVUsQ0FBQyxFQUFFO1FBQ2xCLEVBQUUsQ0FBQyxNQUFNLENBQUMsMkhBQTJILENBQUMsQ0FBQztRQUN2SSxFQUFFLENBQUMsTUFBTSxDQUFDLGdDQUFnQyxDQUFDLENBQUM7UUFBQSxFQUFFLENBQUMsTUFBTSxDQUFDLHVEQUF1RCxDQUFDLENBQUM7UUFDL0csRUFBRSxDQUFDLE1BQU0sQ0FBQyxpRUFBaUUsQ0FBQyxDQUFDO1FBQzdFLE9BQU87SUFDWCxDQUFDO0lBRUQsR0FBRyxDQUFDLEVBQUUsRUFBRSxZQUFZLEVBQUUsWUFBWSxDQUFDLENBQUM7QUFDcEMsQ0FBQztBQUVELEtBQUssVUFBVSxHQUFHLENBQUMsRUFBRSxFQUFFLFlBQVksRUFBRSxZQUFZO0lBQzdDLGdLQUFnSztJQUNoSyxJQUFJLGFBQWEsR0FBRyxDQUFDLENBQUM7SUFFdEIsSUFBSSxDQUFDLENBQUMsWUFBWSxDQUFDLEVBQUU7UUFDbkIsWUFBWSxHQUFHLE9BQU8sQ0FBQTtLQUN2QjtJQUdELDZEQUE2RDtJQUM3RCxTQUFTLENBQUMsRUFBRSxFQUFFLFlBQVksQ0FBQyxDQUFDO0lBRTlCLE9BQU8sSUFBSSxFQUFFO1FBQ1gsMEZBQTBGO1FBQzFGLElBQUksRUFBRSxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsYUFBYSxHQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxLQUFLLEVBQUU7WUFDaEUsUUFBUTtZQUNSLEVBQUUsQ0FBQyxLQUFLLENBQUMsY0FBYyxDQUFDLFlBQVksQ0FBQyxRQUFRLEVBQUUsRUFBRSxhQUFhLENBQUMsQ0FBQztZQUVoRSwyQkFBMkI7WUFDM0IsRUFBRSxDQUFDLE1BQU0sQ0FBQyxnQkFBZ0IsR0FBRyxZQUFZLEdBQUcsUUFBUSxHQUFHLGFBQWEsR0FBRyxpQkFBaUIsR0FBRyxFQUFFLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxhQUFhLENBQUMsR0FBRyxzQkFBc0IsR0FBRyxDQUFDLEVBQUUsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxLQUFLLEdBQUcsRUFBRSxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzVOLE9BQU87U0FDVjthQUNJO1lBQ0QsYUFBYSxJQUFJLENBQUMsQ0FBQztTQUN0QjtLQUNKO0FBQ0QsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKiBAcGFyYW0ge05TfSBucyAqL1xyXG5cclxuaW1wb3J0IHsgb3BlblBvcnRzIH0gZnJvbSBcIi4vdXRpbC5qc1wiO1xyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIG1haW4obnMsIG5ld2Nsb3VkbmFtZSwgdGFyZ2V0c2VydmVyKSB7XHJcbmNvbnN0IGhlbHAgPSBucy5hcmdzLmluY2x1ZGVzKFwiaGVscFwiKTtcclxuICBpZiAoaGVscCkge1xyXG4gICAgcHJpbnR1c2FnZShucyk7XHJcbiAgICByZXR1cm47XHJcbiAgfVxyXG5cclxuZnVuY3Rpb24gcHJpbnR1c2FnZShucykge1xyXG4gICAgbnMudHByaW50KFwiVGhpcyBzY3JpcHQgd2lsbCBidXkgdGhlIG1vc3QgZXhwZW5zaXZlIHNlcnZlciB5b3UgY2FuIGFmZm9yZCBmcm9tIHRhcmdldHNlcnZlciwgd2l0aCB0aGUgbmFtZSBzcGVjaWZpZWQgYnkgbmV3Y2xvdWRuYW1lLlwiKTsgIFxyXG4gICAgbnMudHByaW50KFwiUnVuIHRoaXMgc2NyaXB0IG9uIGhvbWUgc2VydmVyXCIpO25zLnRwcmludChcIlVzYWdlOiBydW4gYnV5c2VydmVyLmpzIFtuZXdjbG91ZG5hbWVdIFt0YXJnZXRzZXJ2ZXJdXCIpO1xyXG4gICAgbnMudHByaW50KFwiRXhhbXBsZTogcnVuIGJ1eXNlcnZlci5qcyBteS1uZXctc2VydmVyIHNlcnZlci10by1wdXJjaGFzZS1mcm9tXCIpO1xyXG4gICAgcmV0dXJuOyAgICBcclxufSBcclxuXHJcbmJ1eShucywgbmV3Y2xvdWRuYW1lLCB0YXJnZXRzZXJ2ZXIpO1xyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBidXkobnMsIG5ld2Nsb3VkbmFtZSwgdGFyZ2V0c2VydmVyKSB7XHJcbiAgICAvLyB3ZSB3aWxsIHVzZSB0aGlzIHZhcmlhYmxlIHRvIHRyYWNrIHRoZSBsYXN0IGtub3duIGFmZm9yZGFibGUgUkFNIGFtb3VudCwgc3RhcnRpbmcgYXQgMkdCLCBhbmQgZG91YmxlIGl0IHVudGlsIHdlIGZpbmQgdGhlIG1vc3QgZXhwZW5zaXZlIHNlcnZlciB3ZSBjYW4gYWZmb3JkXHJcbiAgICBsZXQgYWZmb3JkYWJsZXJhbSA9IDI7XHJcblxyXG4gICAgaWYgKCEobmV3Y2xvdWRuYW1lKSkge1xyXG4gICAgICBuZXdjbG91ZG5hbWUgPSBcImNsb3VkXCJcclxuICAgIH1cclxuXHJcblxyXG4gICAgLy8gT3BlbnBvcnRzIG9uIHRhcmdldHNlcnZlciwgcm9vdCBuZWVkZWQgZm9yIHNlcnZlciBwdXJjaGFzZVxyXG4gICAgb3BlblBvcnRzKG5zLCB0YXJnZXRzZXJ2ZXIpO1xyXG4gICAgXHJcbiAgd2hpbGUgKHRydWUpIHtcclxuICAgIC8vIGlmIHdlIGNhbid0IGFmZm9yZCBhIHNlcnZlciB3aXRoIGRvdWJsZSB0aGUgUkFNIG9mIGxhc3QgdGVzdGVkLCBidXkgaXQgYW5kIGVuZCBwcm9ncmFtIFxyXG4gICAgaWYgKG5zLmNsb3VkLmdldFNlcnZlckNvc3QoYWZmb3JkYWJsZXJhbSoyKSA+IG5zLmdldFBsYXllcigpLm1vbmV5KSB7XHJcbiAgICAgICAgLy9idXkgaXRcclxuICAgICAgICBucy5jbG91ZC5wdXJjaGFzZVNlcnZlcihuZXdjbG91ZG5hbWUudG9TdHJpbmcoKSwgYWZmb3JkYWJsZXJhbSk7XHJcblxyXG4gICAgICAgIC8vcHJpbnQgcmVzdWx0cyB0byB0ZXJtaW5hbFxyXG4gICAgICAgIG5zLnRwcmludChcIkJvdWdodCBzZXJ2ZXIgXCIgKyBuZXdjbG91ZG5hbWUgKyBcIiB3aXRoIFwiICsgYWZmb3JkYWJsZXJhbSArIFwiR0Igb2YgUkFNIGZvciAkXCIgKyBucy5jbG91ZC5nZXRTZXJ2ZXJDb3N0KGFmZm9yZGFibGVyYW0pICsgXCIuIFJlbWFpbmluZyBtb25leTogJFwiICsgKG5zLmdldFBsYXllcigpLm1vbmV5IC0gbnMuY2xvdWQuZ2V0U2VydmVyQ29zdChhZmZvcmRhYmxlcmFtKSkpO1xyXG4gICAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIGVsc2Uge1xyXG4gICAgICAgIGFmZm9yZGFibGVyYW0gKj0gMjtcclxuICAgIH1cclxufVxyXG59XHJcbiJdfQ==