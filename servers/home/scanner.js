/** @param {NS} ns */
// Pass arg[0] 0 for default or 1 for cloud only
export async function main(ns) {
    if (!args[0]) {
        scanNetwork(ns);
        scanCloud(ns);
    }
    else if (args[0] == 1) {
        scanCloud(ns);
    }
    else {
        scanNetwork(ns);
        scanCloud(ns);
    };
}


// printusage function
/**
 * @param {NS} ns - The Netscript API object
 */
function printusage(ns) {
    ns.tprint("Usage: run scanner.js - use from home only");
    ns.tprint("Pass argument 0 for default or 1 for cloud")
    ns.tprint("(Default) 0: Maps the network out and writes all server information to 'networks.json. Then scan all cloud servers'");
    ns.tprint("1: Scans all cloud servers and writes cloud information to clouds.json")
    ns.tprint("Use -q to run silently'")
}

// Scans the network and writes all server information to networks.json
/**
 * @param {NS} ns - The Netscript API object
 * @param {boolean} [quiet=false] - Whether to suppress output messages
 */
export async function scanNetwork(ns, quiet = false) {
    // set silent if -q specified
    quiet = quiet || ns.args.includes("-q");

    // Disable log output if quiet
    if (quiet) {
        ns.disableLog("ALL");
    }

    // printusage  if "help" is included in args
    if (ns.args.includes("help")) {
        printusage(ns);
        return;
    }
    // Create an array to store all server names
    let allServers = [];
    // BFS traversal - For each server directly connected to this server, scan all of their neighbors. Store every hostname in an array.
    // init visited set and queue for BFS
    const visited = new Set(["home"]);
    const queue = ["home"];
    // While there are still servers to visit in the queue, keep visiting them and adding their neighbors to the queue
    while (queue.length > 0) {
        // Pulls the next server FIFO from the queue and starts working on it as currentServer
        const currentServer = queue.shift();
        // Next loop if we've already visited this server
        if (currentServer === undefined) {
            continue;
        }
        // Mark currentServer as visited
        visited.add(currentServer);
        // Add currentServer to allServers array
        allServers.push(currentServer);
        // Scan the neighbors of currentServer
        const neighbors = ns.scan(currentServer);
        // For each of those neighbors, if we haven't visited them yet, add them to the queue to visit later
        for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
                queue.push(neighbor);
            }
        }
    }
    // Populate networks.json. Trim this to only include properties we care about. Check scanner.readme.txt for which properties are included.
    let networks = [];
    // for each server, append a new object to networks
    for (const server of allServers) {
        networks.push(ns.getServer(server));
        // alternative for pushing specific values
        // const data = ns.getServer(server);
        // networks.push({
        //     hostname: data.hostname,
        //     ip: data.ip,
        //     sshPortOpen: data.sshPortOpen,
        //     ftpPortOpen: data.ftpPortOpen,
        //     smtpPortOpen: data.smtpPortOpen,
        //     httpPortOpen: data.httpPortOpen,
        //     sqlPortOpen: data.sqlPortOpen,
        //     hasAdminRights: data.hasAdminRights,
        //     cpuCores: data.cpuCores,
        //     maxRam: data.maxRam,
        //     organizationName: data.organizationName,
        //     purchasedByPlayer: data.purchasedByPlayer,
        //     backdoorInstalled: data.backdoorInstalled,
        //     baseDifficulty: data.baseDifficulty,
        //     minDifficulty: data.minDifficulty,
        //     moneyMax: data.moneyMax,
        //     numOpenPortsRequired: data.numOpenPortsRequired,
        //     requiredHackingSkill: data.requiredHackingSkill,
        //     serverGrowth: data.serverGrowth,
        //     hackDifficulty: data.hackDifficulty,
        //     minDifficulty: data.minDifficulty,
        //     moneyAvailable: data.moneyAvailable,
        //     serverGrowth: data.serverGrowth
        // });
    }
    // Then write the custom networks array to networks.json // Overwrites the json completely
    ns.write("./data/networks.json", JSON.stringify(networks), "w");

    //print all to log for fun
    if (!quiet) {
        for (const n in networks) {
            ns.print(networks[n], "\n \n");
        }
    }
    // Print success message to terminal - unless silenced
    if (!quiet) {
        ns.tprint("Successfully scanned the network and wrote all server information to networks.json");
    }
}

// Scans all cloud servers and writes cloud information to clouds.json
/**
 * @param {NS} ns - The Netscript API object
 * @param {boolean} [quiet=false] - Whether to suppress output messages
 */
export async function scanCloud(ns, quiet = false) {
    // set silent if -q specified
    quiet = quiet || ns.args.includes("-q");

    // Disable log output if quiet
    if (quiet) {
        ns.disableLog("ALL");
    }

    // printusage  if "help" is included in args
    if (ns.args.includes("help")) {
        printusage(ns);
        return;
    }

    // add server pairs if cloud
    const network = JSON.parse(ns.read("./data/networks.json"));
    let clouds = {};

    // loop to add server pairs if cloud
    for (const server of network) {
        if (server.purchasedByPlayer) {
            if (server.hostname != "home") {
                // add server to clouds array
                clouds[server.hostname] = {
                    maxRam: ns.getServerMaxRam(server.hostname)
                }
            }
        }

    }
    // write updated arr to file
    ns.write("./data/clouds.json", JSON.stringify(clouds), "w");
}































//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2Nhbm5lci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9zY2FubmVyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLHFCQUFxQjtBQUdyQixPQUFPO0FBQ1AsTUFBTSxDQUFDLEtBQUssVUFBVSxJQUFJLENBQUMsRUFBRTtJQUN6QixXQUFXLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDcEIsQ0FBQztBQUVELHVFQUF1RTtBQUN2RSxNQUFNLFVBQVUsV0FBVyxDQUFDLEVBQUU7SUFDMUIsNENBQTRDO0lBQzVDLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLEVBQUU7UUFDMUIsVUFBVSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ2YsT0FBTztLQUNWO0lBRUQsNENBQTRDO0lBQzVDLElBQUksVUFBVSxHQUFHLEVBQUUsQ0FBQztJQUVwQixvSUFBb0k7SUFDcEkscUNBQXFDO0lBQ3JDLE1BQU0sT0FBTyxHQUFHLElBQUksR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztJQUNsQyxNQUFNLEtBQUssR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBRXZCLGtIQUFrSDtJQUNsSCxPQUFPLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO1FBQ3JCLHNGQUFzRjtRQUN0RixNQUFNLGFBQWEsR0FBRyxLQUFLLENBQUMsS0FBSyxFQUFFLENBQUM7UUFFcEMsaURBQWlEO1FBQ2pELElBQUksYUFBYSxLQUFLLFNBQVMsRUFBRTtZQUM3QixTQUFTO1NBQ1o7UUFFRCxnQ0FBZ0M7UUFDaEMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUMzQix3Q0FBd0M7UUFDeEMsVUFBVSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUUvQixzQ0FBc0M7UUFDdEMsTUFBTSxTQUFTLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUN6QyxvR0FBb0c7UUFDcEcsS0FBSyxNQUFNLFFBQVEsSUFBSSxTQUFTLEVBQUU7WUFDOUIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLEVBQUU7Z0JBQ3hCLEtBQUssQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7YUFDeEI7U0FDSjtLQUNKO0lBRUQsMElBQTBJO0lBQzFJLElBQUksUUFBUSxHQUFHLEVBQUUsQ0FBQztJQUVsQixtREFBbUQ7SUFDbkQsS0FBSyxNQUFNLE1BQU0sSUFBSSxVQUFVLEVBQUU7UUFDN0IsTUFBTSxJQUFJLEdBQUcsRUFBRSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNsQyxRQUFRLENBQUMsSUFBSSxDQUFDO1lBQ1YsUUFBUSxFQUFFLElBQUksQ0FBQyxRQUFRO1lBQ3ZCLEVBQUUsRUFBRSxJQUFJLENBQUMsRUFBRTtZQUNYLFdBQVcsRUFBRSxJQUFJLENBQUMsV0FBVztZQUM3QixXQUFXLEVBQUUsSUFBSSxDQUFDLFdBQVc7WUFDN0IsWUFBWSxFQUFFLElBQUksQ0FBQyxZQUFZO1lBQy9CLFlBQVksRUFBRSxJQUFJLENBQUMsWUFBWTtZQUMvQixXQUFXLEVBQUUsSUFBSSxDQUFDLFdBQVc7WUFDN0IsY0FBYyxFQUFFLElBQUksQ0FBQyxjQUFjO1lBQ25DLFFBQVEsRUFBRSxJQUFJLENBQUMsUUFBUTtZQUN2QixNQUFNLEVBQUUsSUFBSSxDQUFDLE1BQU07WUFDbkIsZ0JBQWdCLEVBQUUsSUFBSSxDQUFDLGdCQUFnQjtZQUN2QyxpQkFBaUIsRUFBRSxJQUFJLENBQUMsaUJBQWlCO1lBQ3pDLGlCQUFpQixFQUFFLElBQUksQ0FBQyxpQkFBaUI7WUFDekMsY0FBYyxFQUFFLElBQUksQ0FBQyxjQUFjO1lBQ25DLGFBQWEsRUFBRSxJQUFJLENBQUMsYUFBYTtZQUNqQyxRQUFRLEVBQUUsSUFBSSxDQUFDLFFBQVE7WUFDdkIsb0JBQW9CLEVBQUUsSUFBSSxDQUFDLG9CQUFvQjtZQUMvQyxvQkFBb0IsRUFBRSxJQUFJLENBQUMsb0JBQW9CO1lBQy9DLFlBQVksRUFBRSxJQUFJLENBQUMsWUFBWTtTQUNsQyxDQUFDLENBQUM7S0FDTjtJQUdELDBGQUEwRjtJQUMxRixFQUFFLENBQUMsS0FBSyxDQUFDLGVBQWUsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0lBRXpELDBCQUEwQjtJQUMxQixLQUFLLE1BQU0sQ0FBQyxJQUFJLFFBQVEsRUFBRTtRQUN0QixFQUFFLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsRUFBRSxPQUFPLENBQUMsQ0FBQztLQUNsQztJQUVELG9DQUFvQztJQUNwQyxFQUFFLENBQUMsTUFBTSxDQUFDLG9GQUFvRixDQUFDLENBQUM7QUFDcEcsQ0FBQztBQUVELHNCQUFzQjtBQUN0QixTQUFTLFVBQVUsQ0FBQyxFQUFFO0lBQ2xCLEVBQUUsQ0FBQyxNQUFNLENBQUMsNENBQTRDLENBQUMsQ0FBQztJQUN4RCxFQUFFLENBQUMsTUFBTSxDQUFDLDJFQUEyRSxDQUFDLENBQUM7QUFDM0YsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKiBAcGFyYW0ge05TfSBucyAqL1xyXG5cclxuXHJcbi8vIE1haW5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIG1haW4obnMpIHtcclxuICAgIHNjYW5OZXR3b3JrKG5zKTtcclxufVxyXG5cclxuLy8gU2NhbnMgdGhlIG5ldHdvcmsgYW5kIHdyaXRlcyBhbGwgc2VydmVyIGluZm9ybWF0aW9uIHRvIG5ldHdvcmtzLmpzb25cclxuZXhwb3J0IGZ1bmN0aW9uIHNjYW5OZXR3b3JrKG5zKSB7XHJcbiAgICAvLyBwcmludHVzYWdlICBpZiBcImhlbHBcIiBpcyBpbmNsdWRlZCBpbiBhcmdzXHJcbiAgICBpZiAobnMuYXJncy5pbmNsdWRlcyhcImhlbHBcIikpIHtcclxuICAgICAgICBwcmludHVzYWdlKG5zKTtcclxuICAgICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgLy8gQ3JlYXRlIGFuIGFycmF5IHRvIHN0b3JlIGFsbCBzZXJ2ZXIgbmFtZXNcclxuICAgIGxldCBhbGxTZXJ2ZXJzID0gW107XHJcblxyXG4gICAgLy8gQkZTIHRyYXZlcnNhbCAtIEZvciBlYWNoIHNlcnZlciBkaXJlY3RseSBjb25uZWN0ZWQgdG8gdGhpcyBzZXJ2ZXIsIHNjYW4gYWxsIG9mIHRoZWlyIG5laWdoYm9ycy4gU3RvcmUgZXZlcnkgaG9zdG5hbWUgaW4gYW4gYXJyYXkuXHJcbiAgICAvLyBpbml0IHZpc2l0ZWQgc2V0IGFuZCBxdWV1ZSBmb3IgQkZTXHJcbiAgICBjb25zdCB2aXNpdGVkID0gbmV3IFNldChbXCJob21lXCJdKTtcclxuICAgIGNvbnN0IHF1ZXVlID0gW1wiaG9tZVwiXTtcclxuXHJcbiAgICAvLyBXaGlsZSB0aGVyZSBhcmUgc3RpbGwgc2VydmVycyB0byB2aXNpdCBpbiB0aGUgcXVldWUsIGtlZXAgdmlzaXRpbmcgdGhlbSBhbmQgYWRkaW5nIHRoZWlyIG5laWdoYm9ycyB0byB0aGUgcXVldWVcclxuICAgIHdoaWxlIChxdWV1ZS5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgLy8gUHVsbHMgdGhlIG5leHQgc2VydmVyIEZJRk8gZnJvbSB0aGUgcXVldWUgYW5kIHN0YXJ0cyB3b3JraW5nIG9uIGl0IGFzIGN1cnJlbnRTZXJ2ZXJcclxuICAgICAgICBjb25zdCBjdXJyZW50U2VydmVyID0gcXVldWUuc2hpZnQoKTtcclxuXHJcbiAgICAgICAgLy8gTmV4dCBsb29wIGlmIHdlJ3ZlIGFscmVhZHkgdmlzaXRlZCB0aGlzIHNlcnZlclxyXG4gICAgICAgIGlmIChjdXJyZW50U2VydmVyID09PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBNYXJrIGN1cnJlbnRTZXJ2ZXIgYXMgdmlzaXRlZFxyXG4gICAgICAgIHZpc2l0ZWQuYWRkKGN1cnJlbnRTZXJ2ZXIpO1xyXG4gICAgICAgIC8vIEFkZCBjdXJyZW50U2VydmVyIHRvIGFsbFNlcnZlcnMgYXJyYXlcclxuICAgICAgICBhbGxTZXJ2ZXJzLnB1c2goY3VycmVudFNlcnZlcik7XHJcblxyXG4gICAgICAgIC8vIFNjYW4gdGhlIG5laWdoYm9ycyBvZiBjdXJyZW50U2VydmVyXHJcbiAgICAgICAgY29uc3QgbmVpZ2hib3JzID0gbnMuc2NhbihjdXJyZW50U2VydmVyKTtcclxuICAgICAgICAvLyBGb3IgZWFjaCBvZiB0aG9zZSBuZWlnaGJvcnMsIGlmIHdlIGhhdmVuJ3QgdmlzaXRlZCB0aGVtIHlldCwgYWRkIHRoZW0gdG8gdGhlIHF1ZXVlIHRvIHZpc2l0IGxhdGVyXHJcbiAgICAgICAgZm9yIChjb25zdCBuZWlnaGJvciBvZiBuZWlnaGJvcnMpIHtcclxuICAgICAgICAgICAgaWYgKCF2aXNpdGVkLmhhcyhuZWlnaGJvcikpIHtcclxuICAgICAgICAgICAgICAgIHF1ZXVlLnB1c2gobmVpZ2hib3IpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8vIFBvcHVsYXRlIG5ldHdvcmtzLmpzb24uIFRyaW0gdGhpcyB0byBvbmx5IGluY2x1ZGUgcHJvcGVydGllcyB3ZSBjYXJlIGFib3V0LiBDaGVjayBzY2FubmVyLnJlYWRtZS50eHQgZm9yIHdoaWNoIHByb3BlcnRpZXMgYXJlIGluY2x1ZGVkLlxyXG4gICAgbGV0IG5ldHdvcmtzID0gW107XHJcblxyXG4gICAgLy8gZm9yIGVhY2ggc2VydmVyLCBhcHBlbmQgYSBuZXcgb2JqZWN0IHRvIG5ldHdvcmtzXHJcbiAgICBmb3IgKGNvbnN0IHNlcnZlciBvZiBhbGxTZXJ2ZXJzKSB7XHJcbiAgICAgICAgY29uc3QgZGF0YSA9IG5zLmdldFNlcnZlcihzZXJ2ZXIpO1xyXG4gICAgICAgIG5ldHdvcmtzLnB1c2goe1xyXG4gICAgICAgICAgICBob3N0bmFtZTogZGF0YS5ob3N0bmFtZSxcclxuICAgICAgICAgICAgaXA6IGRhdGEuaXAsXHJcbiAgICAgICAgICAgIHNzaFBvcnRPcGVuOiBkYXRhLnNzaFBvcnRPcGVuLFxyXG4gICAgICAgICAgICBmdHBQb3J0T3BlbjogZGF0YS5mdHBQb3J0T3BlbixcclxuICAgICAgICAgICAgc210cFBvcnRPcGVuOiBkYXRhLnNtdHBQb3J0T3BlbixcclxuICAgICAgICAgICAgaHR0cFBvcnRPcGVuOiBkYXRhLmh0dHBQb3J0T3BlbixcclxuICAgICAgICAgICAgc3FsUG9ydE9wZW46IGRhdGEuc3FsUG9ydE9wZW4sXHJcbiAgICAgICAgICAgIGhhc0FkbWluUmlnaHRzOiBkYXRhLmhhc0FkbWluUmlnaHRzLFxyXG4gICAgICAgICAgICBjcHVDb3JlczogZGF0YS5jcHVDb3JlcyxcclxuICAgICAgICAgICAgbWF4UmFtOiBkYXRhLm1heFJhbSxcclxuICAgICAgICAgICAgb3JnYW5pemF0aW9uTmFtZTogZGF0YS5vcmdhbml6YXRpb25OYW1lLFxyXG4gICAgICAgICAgICBwdXJjaGFzZWRCeVBsYXllcjogZGF0YS5wdXJjaGFzZWRCeVBsYXllcixcclxuICAgICAgICAgICAgYmFja2Rvb3JJbnN0YWxsZWQ6IGRhdGEuYmFja2Rvb3JJbnN0YWxsZWQsXHJcbiAgICAgICAgICAgIGJhc2VEaWZmaWN1bHR5OiBkYXRhLmJhc2VEaWZmaWN1bHR5LFxyXG4gICAgICAgICAgICBtaW5EaWZmaWN1bHR5OiBkYXRhLm1pbkRpZmZpY3VsdHksXHJcbiAgICAgICAgICAgIG1vbmV5TWF4OiBkYXRhLm1vbmV5TWF4LFxyXG4gICAgICAgICAgICBudW1PcGVuUG9ydHNSZXF1aXJlZDogZGF0YS5udW1PcGVuUG9ydHNSZXF1aXJlZCxcclxuICAgICAgICAgICAgcmVxdWlyZWRIYWNraW5nU2tpbGw6IGRhdGEucmVxdWlyZWRIYWNraW5nU2tpbGwsXHJcbiAgICAgICAgICAgIHNlcnZlckdyb3d0aDogZGF0YS5zZXJ2ZXJHcm93dGgsXHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG5cclxuICAgIC8vIFRoZW4gd3JpdGUgdGhlIGN1c3RvbSBuZXR3b3JrcyBhcnJheSB0byBuZXR3b3Jrcy5qc29uIC8vIE92ZXJ3cml0ZXMgdGhlIGpzb24gY29tcGxldGVseVxyXG4gICAgbnMud3JpdGUoXCJuZXR3b3Jrcy5qc29uXCIsIEpTT04uc3RyaW5naWZ5KG5ldHdvcmtzKSwgXCJ3XCIpO1xyXG4gICAgXHJcbiAgICAvL3ByaW50IGFsbCB0byBsb2cgZm9yIGZ1blxyXG4gICAgZm9yIChjb25zdCBuIGluIG5ldHdvcmtzKSB7XHJcbiAgICAgICAgbnMucHJpbnQobmV0d29ya3Nbbl0sIFwiXFxuIFxcblwiKTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBQcmludCBzdWNjZXNzIG1lc3NhZ2UgdG8gdGVybWluYWxcclxuICAgIG5zLnRwcmludChcIlN1Y2Nlc3NmdWxseSBzY2FubmVkIHRoZSBuZXR3b3JrIGFuZCB3cm90ZSBhbGwgc2VydmVyIGluZm9ybWF0aW9uIHRvIG5ldHdvcmtzLmpzb25cIik7XHJcbn1cclxuXHJcbi8vIHByaW50dXNhZ2UgZnVuY3Rpb25cclxuZnVuY3Rpb24gcHJpbnR1c2FnZShucykge1xyXG4gICAgbnMudHByaW50KFwiVXNhZ2U6IHJ1biBzY2FubmVyLmpzIC0gdXNlIGZyb20gaG9tZSBvbmx5XCIpO1xyXG4gICAgbnMudHByaW50KFwiTWFwcyB0aGUgbmV0d29yayBvdXQgYW5kIHdyaXRlcyBhbGwgc2VydmVyIGluZm9ybWF0aW9uIHRvICduZXR3b3Jrcy5qc29uJ1wiKTtcclxufSJdfQ==