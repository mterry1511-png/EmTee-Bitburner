/**
 * Handles CLI arguments and dispatches the appropriate cloud server purchase workflow.
 * @param {NS} ns - The Netscript API object
 */
export async function main(ns) {
    // handle args
    const newCloudName = ns.args[0];
    const minBuyFlag = ns.args[1];              // pass 1 to buy 32gb server instead

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
 * @param {NS} ns - The Netscript API object
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
 * Purchases the largest affordable cloud server and records it in the cloud registry.
 * @param {NS} ns - The Netscript API object
 * @param {string} newCloudName - The name for the new cloud server
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
            // can't afford double, so buy current amount
            newCloudName = ns.cloud.purchaseServer(newCloudName.toString(), affordableram);
            // print results to terminals
            ns.tprint("Bought server " + newCloudName + " with " + affordableram + "GB of RAM for $" + ns.cloud.getServerCost(affordableram) + ". Remaining money: $" + ns.getPlayer().money);
            ns.print("Bought server " + newCloudName + " with " + affordableram + "GB of RAM for $" + ns.cloud.getServerCost(affordableram) + ". Remaining money: $" + ns.getPlayer().money);

            // add cloud server to JSON
            const servs = JSON.parse(ns.read("/data/clouds.json"));           // write clouds/json to an obj

            // add newly purchased server
            servs[newCloudName] = {
                maxRam: ns.getServerMaxRam(newCloudName)
            };

            // write updated file
            ns.write("/data/clouds.json", JSON.stringify(servs), "w");
            
            // cloudpush.js
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
 * Purchases a fixed-size cloud server and records it in the cloud registry.
 * @param {NS} ns - The Netscript API object
 * @param {string} newCloudName - The name for the new cloud server
 */
export async function minBuy(ns, newCloudName) {
    // always buys 2gb (small) server
    if (!(newCloudName)) {
        newCloudName = "cloud";
    }
        
    // if we can't afford 
    while (ns.cloud.getServerCost(2) > ns.getPlayer().money) {
        // wait (should be fast!)
        await ns.sleep(5000);
        ns.print("Can't afford server - waiting for player money...")
    }

    // purchase 2gb
    newCloudName = ns.cloud.purchaseServer(newCloudName.toString(), 2);

    // print results to terminals
    ns.print("Bought server " + newCloudName + " with 2GB of RAM");

    // add cloud server to JSON
    const servs = JSON.parse(ns.read("/data/clouds.json"));           // write clouds/json to an obj

    // add newly purchased server
    servs[newCloudName] = {
        maxRam: ns.getServerMaxRam(newCloudName)
    };

    // write updated file
    ns.write("/data/clouds.json", JSON.stringify(servs), "w");

    // cloudpush.js
    // ns.exec("cloudpush.js", "home", 1, newCloudName);
    // await ns.sleep(100);
    return;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnV5c2VydmVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL2J1eXNlcnZlci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxxQkFBcUI7QUFFckIsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLFdBQVcsQ0FBQztBQUV0QyxNQUFNLENBQUMsS0FBSyxVQUFVLElBQUksQ0FBQyxFQUFFLEVBQUUsWUFBWSxFQUFFLFlBQVk7SUFDekQsTUFBTSxJQUFJLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDcEMsSUFBSSxJQUFJLEVBQUU7UUFDUixVQUFVLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDZixPQUFPO0tBQ1I7SUFFSCxTQUFTLFVBQVUsQ0FBQyxFQUFFO1FBQ2xCLEVBQUUsQ0FBQyxNQUFNLENBQUMsMkhBQTJILENBQUMsQ0FBQztRQUN2SSxFQUFFLENBQUMsTUFBTSxDQUFDLGdDQUFnQyxDQUFDLENBQUM7UUFBQSxFQUFFLENBQUMsTUFBTSxDQUFDLHVEQUF1RCxDQUFDLENBQUM7UUFDL0csRUFBRSxDQUFDLE1BQU0sQ0FBQyxpRUFBaUUsQ0FBQyxDQUFDO1FBQzdFLE9BQU87SUFDWCxDQUFDO0lBRUQsR0FBRyxDQUFDLEVBQUUsRUFBRSxZQUFZLEVBQUUsWUFBWSxDQUFDLENBQUM7QUFDcEMsQ0FBQztBQUVELEtBQUssVUFBVSxHQUFHLENBQUMsRUFBRSxFQUFFLFlBQVksRUFBRSxZQUFZO0lBQzdDLGdLQUFnSztJQUNoSyxJQUFJLGFBQWEsR0FBRyxDQUFDLENBQUM7SUFFdEIsSUFBSSxDQUFDLENBQUMsWUFBWSxDQUFDLEVBQUU7UUFDbkIsWUFBWSxHQUFHLE9BQU8sQ0FBQTtLQUN2QjtJQUdELDZEQUE2RDtJQUM3RCxTQUFTLENBQUMsRUFBRSxFQUFFLFlBQVksQ0FBQyxDQUFDO0lBRTlCLE9BQU8sSUFBSSxFQUFFO1FBQ1gsMEZBQTBGO1FBQzFGLElBQUksRUFBRSxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsYUFBYSxHQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxLQUFLLEVBQUU7WUFDaEUsUUFBUTtZQUNSLEVBQUUsQ0FBQyxLQUFLLENBQUMsY0FBYyxDQUFDLFlBQVksQ0FBQyxRQUFRLEVBQUUsRUFBRSxhQUFhLENBQUMsQ0FBQztZQUVoRSwyQkFBMkI7WUFDM0IsRUFBRSxDQUFDLE1BQU0sQ0FBQyxnQkFBZ0IsR0FBRyxZQUFZLEdBQUcsUUFBUSxHQUFHLGFBQWEsR0FBRyxpQkFBaUIsR0FBRyxFQUFFLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxhQUFhLENBQUMsR0FBRyxzQkFBc0IsR0FBRyxDQUFDLEVBQUUsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxLQUFLLEdBQUcsRUFBRSxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzVOLE9BQU87U0FDVjthQUNJO1lBQ0QsYUFBYSxJQUFJLENBQUMsQ0FBQztTQUN0QjtLQUNKO0FBQ0QsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKiBAcGFyYW0ge05TfSBucyAqL1xyXG5cclxuaW1wb3J0IHsgb3BlblBvcnRzIH0gZnJvbSBcIi4vdXRpbC5qc1wiO1xyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIG1haW4obnMsIG5ld2Nsb3VkbmFtZSwgdGFyZ2V0c2VydmVyKSB7XHJcbmNvbnN0IGhlbHAgPSBucy5hcmdzLmluY2x1ZGVzKFwiaGVscFwiKTtcclxuICBpZiAoaGVscCkge1xyXG4gICAgcHJpbnR1c2FnZShucyk7XHJcbiAgICByZXR1cm47XHJcbiAgfVxyXG5cclxuZnVuY3Rpb24gcHJpbnR1c2FnZShucykge1xyXG4gICAgbnMudHByaW50KFwiVGhpcyBzY3JpcHQgd2lsbCBidXkgdGhlIG1vc3QgZXhwZW5zaXZlIHNlcnZlciB5b3UgY2FuIGFmZm9yZCBmcm9tIHRhcmdldHNlcnZlciwgd2l0aCB0aGUgbmFtZSBzcGVjaWZpZWQgYnkgbmV3Y2xvdWRuYW1lLlwiKTsgIFxyXG4gICAgbnMudHByaW50KFwiUnVuIHRoaXMgc2NyaXB0IG9uIGhvbWUgc2VydmVyXCIpO25zLnRwcmludChcIlVzYWdlOiBydW4gYnV5c2VydmVyLmpzIFtuZXdjbG91ZG5hbWVdIFt0YXJnZXRzZXJ2ZXJdXCIpO1xyXG4gICAgbnMudHByaW50KFwiRXhhbXBsZTogcnVuIGJ1eXNlcnZlci5qcyBteS1uZXctc2VydmVyIHNlcnZlci10by1wdXJjaGFzZS1mcm9tXCIpO1xyXG4gICAgcmV0dXJuOyAgICBcclxufSBcclxuXHJcbmJ1eShucywgbmV3Y2xvdWRuYW1lLCB0YXJnZXRzZXJ2ZXIpO1xyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBidXkobnMsIG5ld2Nsb3VkbmFtZSwgdGFyZ2V0c2VydmVyKSB7XHJcbiAgICAvLyB3ZSB3aWxsIHVzZSB0aGlzIHZhcmlhYmxlIHRvIHRyYWNrIHRoZSBsYXN0IGtub3duIGFmZm9yZGFibGUgUkFNIGFtb3VudCwgc3RhcnRpbmcgYXQgMkdCLCBhbmQgZG91YmxlIGl0IHVudGlsIHdlIGZpbmQgdGhlIG1vc3QgZXhwZW5zaXZlIHNlcnZlciB3ZSBjYW4gYWZmb3JkXHJcbiAgICBsZXQgYWZmb3JkYWJsZXJhbSA9IDI7XHJcblxyXG4gICAgaWYgKCEobmV3Y2xvdWRuYW1lKSkge1xyXG4gICAgICBuZXdjbG91ZG5hbWUgPSBcImNsb3VkXCJcclxuICAgIH1cclxuXHJcblxyXG4gICAgLy8gT3BlbnBvcnRzIG9uIHRhcmdldHNlcnZlciwgcm9vdCBuZWVkZWQgZm9yIHNlcnZlciBwdXJjaGFzZVxyXG4gICAgb3BlblBvcnRzKG5zLCB0YXJnZXRzZXJ2ZXIpO1xyXG4gICAgXHJcbiAgd2hpbGUgKHRydWUpIHtcclxuICAgIC8vIGlmIHdlIGNhbid0IGFmZm9yZCBhIHNlcnZlciB3aXRoIGRvdWJsZSB0aGUgUkFNIG9mIGxhc3QgdGVzdGVkLCBidXkgaXQgYW5kIGVuZCBwcm9ncmFtIFxyXG4gICAgaWYgKG5zLmNsb3VkLmdldFNlcnZlckNvc3QoYWZmb3JkYWJsZXJhbSoyKSA+IG5zLmdldFBsYXllcigpLm1vbmV5KSB7XHJcbiAgICAgICAgLy9idXkgaXRcclxuICAgICAgICBucy5jbG91ZC5wdXJjaGFzZVNlcnZlcihuZXdjbG91ZG5hbWUudG9TdHJpbmcoKSwgYWZmb3JkYWJsZXJhbSk7XHJcblxyXG4gICAgICAgIC8vcHJpbnQgcmVzdWx0cyB0byB0ZXJtaW5hbFxyXG4gICAgICAgIG5zLnRwcmludChcIkJvdWdodCBzZXJ2ZXIgXCIgKyBuZXdjbG91ZG5hbWUgKyBcIiB3aXRoIFwiICsgYWZmb3JkYWJsZXJhbSArIFwiR0Igb2YgUkFNIGZvciAkXCIgKyBucy5jbG91ZC5nZXRTZXJ2ZXJDb3N0KGFmZm9yZGFibGVyYW0pICsgXCIuIFJlbWFpbmluZyBtb25leTogJFwiICsgKG5zLmdldFBsYXllcigpLm1vbmV5IC0gbnMuY2xvdWQuZ2V0U2VydmVyQ29zdChhZmZvcmRhYmxlcmFtKSkpO1xyXG4gICAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIGVsc2Uge1xyXG4gICAgICAgIGFmZm9yZGFibGVyYW0gKj0gMjtcclxuICAgIH1cclxufVxyXG59XHJcbiJdfQ==