import { scanNetwork } from "../scanner.js";

/**
 * Dispatches utility actions based on command-line flags.
 * @param {NS} ns - The Netscript API object
 */
export async function main(ns) {
    //Determine function
    const argmap = ns.args.map(a => a.toLowerCase());
    const openports = argmap.includes("--openports");
    const getAvailableThreads = argmap.includes("--getAvailableThreads");
    const help = argmap.includes("help");
    const targetServer = ns.args[0] ?? ns.getHostname();
    ns.print(targetServer);
    //Determine function based on args
    if (openports) {
        autoNuke(ns, targetServer);
    }
    else if (getAvailableThreads) {
        const threads = getAvailableThreads(ns, targetServer);
        ns.tprint("Available threads on " + targetServer + ": " + threads);
    }
    else if (help) {
        printusage(ns);
    }
}

// Printusage function
/**
 * Prints supported utility command usage.
 * @param {NS} ns - The Netscript API object
 */
function printusage(ns) {
    ns.tprint("Usage: run util.js [targetServer] [FUNCTION]");
    ns.tprint("Example: run util.js n00dles --openports");
    ns.tprint("FUNCTIONS:");
    ns.tprint("  '--openports': Open all available ports on the target server");
    ns.tprint("  '--getAvailableThreads': Get the number of threads available on the target server based on its RAM and the RAM required for a single thread of a specified script. Usage example: run util.js n00dles --getAvailableThreads");
    ns.tprint("  'help': Print this usage message");
}


// Auto nuke function
/**
 * Attempts to open ports and gain root access on the target server.
 * @param {NS} ns - The Netscript API object
 * @param {string} targetServer - The hostname of the server to nuke
 * @param {boolean} quiet - Whether to suppress verbose logging
 */
export function autoNuke(ns, targetServer, quiet = false) {
    // set silent if -q specified
    quiet = quiet || ns.args.includes("-q");

    // Silence all logs if quiet
    if (quiet) {
        ns.disableLog("ALL");
    }

    //* Opens ports then grants root
    let runExes = [
        "BruteSSH.exe",
        "FTPCrack.exe",
        "relaySMTP.exe",
        "SQLInject.exe",
        "HTTPWorm.exe"
    ];
    //* Open ports *//
    for (const exe of runExes) {
        switch (exe) {
            case "BruteSSH.exe":
                // If we have the BruteSSH.exe program, use it to open the SSH Port on the targetServer
                if (ns.fileExists("BruteSSH.exe", "home")) {
                    ns.brutessh(targetServer);
                }
                break;
            case "FTPCrack.exe":
                // If we have the FTPCrack.exe program, use it to open the FTP Port on the targetServer
                if (ns.fileExists("FTPCrack.exe", "home")) {
                    ns.ftpcrack(targetServer);
                }
                break;
            case "relaySMTP.exe":
                // If we have the relaySMTP.exe program, use it to open the SMTP Port on the targetServer
                if (ns.fileExists("relaySMTP.exe", "home")) {
                    ns.relaysmtp(targetServer);
                }
                break;
            case "SQLInject.exe":
                // If we have the SQLInject.exe program, use it to open the SQL Port on the targetServer
                if (ns.fileExists("SQLInject.exe", "home")) {
                    ns.sqlinject(targetServer);
                }
                break;
            case "HTTPWorm.exe":
                // If we have the HTTPWorm.exe program, use it to open the HTTP Port on the targetServer
                if (ns.fileExists("HTTPWorm.exe", "home")) {
                    ns.httpworm(targetServer);
                }
                break;
        }
    }

    // Get root access to targetServer server if no root access
    if (!ns.hasRootAccess(targetServer)) {
        ns.nuke(targetServer);
        if (!quiet) {
            ns.print("Successfully Nuked for root");
        }
        else {
            if (!quiet) {
                ns.print("Already had root");
            }
        }

        // Print backdoor status of targetServer
        if (ns.getServer(targetServer).backdoorInstalled) {
            if (!quiet) {
                ns.print("Backdoor Status = OPEN \n \n");
            }
        }
        else {
            if (!quiet) {
                ns.print("Backdoor Status = CLOSED \n \n");
            }
        }
    }
}

// Get available threads function 
// Returns the number of threads available on the target server, based on its RAM and the RAM required for a single thread of the specified script
// Example usage: getAvailableThreads(ns, home, "hack.js");
// Example gets the script RAM for hack.js, then calculates how many threads of hack.js could run on home based on its available RAM
// Also use on cloud servers
/**
 * Calculates how many threads of a script can run on a host.
 * @param {NS} ns - The Netscript API object
 * @param {string} scriptHost - The host server to check available threads on
 * @param {string} script - The script name to calculate threads for
 * @returns {number} The number of available threads
 */
export function getAvailableThreads(ns, scriptHost, script) {
    const availableRam = (ns.getServerMaxRam(scriptHost) - JSON.parse(ns.read("/data/cfg.json")).leaveRamFree - ns.getServerUsedRam(scriptHost));       // always leaves space free - set in cfg.json
    const scriptRam = ns.getScriptRam(script, scriptHost)
    return Math.floor(availableRam / scriptRam);
}

/**
 * Updates a nested value in a JSON file on disk.
 * WARNING: when this updates the *.json, this will be desynced with the VS code *.json as this is a one way operation only.
 * @param {NS} ns - The Netscript API object
 * @param {string} key - The dotted path to the property to update
 * @param {*} value - The value to write to the target key
 * @param {string} [filepath="/data/cfg.json"] - The JSON file to edit
 */
export function jsonEdit(ns, key, value, filepath = "/data/cfg.json") {
    // load json and catch synerrors
    let jsonObj;
    try {
        jsonObj = JSON.parse(ns.read(filepath));
    } catch (e) {
        ns.print(`ERROR: Failed to parse ${filepath}: ${e.message}`);
        return;
    }

    // split passed arg into array for dot functionality - 
    // allows accessing nested keyvalue pairs. i.e. "purchaseConfig.maxPercSpend"
    const keys = key.split(".");
    let current = jsonObj;

    // "walks" deeper into the json depending on how many "." are passed in key arg
    for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]]; //
    }

    // change value passed from arg
    current[keys.at(-1)] = value;

    // write edited json back
    ns.write(filepath, JSON.stringify(jsonObj), "w");
}



   

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy91dGlsLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLHFCQUFxQjtBQUNyQixNQUFNLENBQUMsS0FBSyxVQUFVLElBQUksQ0FBQyxFQUFFO0lBQzNCLG9CQUFvQjtJQUNwQixNQUFNLE1BQU0sR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDO0lBRWpELE1BQU0sU0FBUyxHQUFHLE1BQU0sQ0FBQyxRQUFRLENBQUMsYUFBYSxDQUFDLENBQUM7SUFDakQsTUFBTSxtQkFBbUIsR0FBRyxNQUFNLENBQUMsUUFBUSxDQUFDLHVCQUF1QixDQUFDLENBQUM7SUFDckUsTUFBTSxJQUFJLEdBQUcsTUFBTSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUNyQyxNQUFNLFlBQVksR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxXQUFXLEVBQUUsQ0FBQztJQUVwRCxFQUFFLENBQUMsS0FBSyxDQUFDLFlBQVksQ0FBQyxDQUFDO0lBQ3ZCLGtDQUFrQztJQUNoQyxJQUFJLFNBQVMsRUFBQztRQUNWLE1BQU0sU0FBUyxDQUFDLEVBQUUsRUFBRSxZQUFZLENBQUMsQ0FBQztLQUNyQztTQUVJLElBQUksbUJBQW1CLEVBQUM7UUFDekIsTUFBTSxPQUFPLEdBQUcsbUJBQW1CLENBQUMsRUFBRSxFQUFFLFlBQVksQ0FBQyxDQUFDO1FBQ3RELEVBQUUsQ0FBQyxNQUFNLENBQUMsdUJBQXVCLEdBQUcsWUFBWSxHQUFHLElBQUksR0FBRyxPQUFPLENBQUMsQ0FBQztLQUN0RTtTQUVJLElBQUksSUFBSSxFQUFDO1FBQ1YsVUFBVSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0tBQ2xCO0FBQ0wsQ0FBQztBQUVELHNCQUFzQjtBQUN0QixTQUFTLFVBQVUsQ0FB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WSxHQUFHLEVBQUUsQ0FBQyxlQUFlLENBQUMsWUFBWSxDQUFDLEdBQUcsRUFBRSxDQUFDLGdCQUFnQixDQUFDLFlBQVksQ0FBQyxDQUFDO0lBQzFGLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxZQUFZLEdBQUcsU0FBUyxDQUFDLENBQUM7QUFDOUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKiBAcGFyYW0ge05TfSBucyAqL1xyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gbWFpbihucykge1xyXG4gIC8vRGV0ZXJtaW5lIGZ1bmN0aW9uXHJcbiAgY29uc3QgYXJnbWFwID0gbnMuYXJncy5tYXAoYSA9PiBhLnRvTG93ZXJDYXNlKCkpO1xyXG5cclxuICBjb25zdCBvcGVucG9ydHMgPSBhcmdtYXAuaW5jbHVkZXMoXCItLW9wZW5wb3J0c1wiKTtcclxuICBjb25zdCBnZXRBdmFpbGFibGVUaHJlYWRzID0gYXJnbWFwLmluY2x1ZGVzKFwiLS1nZXRBdmFpbGFibGVUaHJlYWRzXCIpO1xyXG4gIGNvbnN0IGhlbHAgPSBhcmdtYXAuaW5jbHVkZXMoXCJoZWxwXCIpO1xyXG4gIGNvbnN0IHRhcmdldFNlcnZlciA9IG5zLmFyZ3NbMF0gPz8gbnMuZ2V0SG9zdG5hbWUoKTtcclxuXHJcbiAgbnMucHJpbnQodGFyZ2V0U2VydmVyKTtcclxuICAvL0RldGVybWluZSBmdW5jdGlvbiBiYXNlZCBvbiBhcmdzXHJcbiAgICBpZiAob3BlbnBvcnRzKXtcclxuICAgICAgICBhd2FpdCBvcGVuUG9ydHMobnMsIHRhcmdldFNlcnZlcik7XHJcbiAgICB9XHJcblxyXG4gICAgZWxzZSBpZiAoZ2V0QXZhaWxhYmxlVGhyZWFkcyl7XHJcbiAgICAgICAgY29uc3QgdGhyZWFkcyA9IGdldEF2YWlsYWJsZVRocmVhZHMobnMsIHRhcmdldFNlcnZlcik7XHJcbiAgICAgICAgbnMudHByaW50KFwiQXZhaWxhYmxlIHRocmVhZHMgb24gXCIgKyB0YXJnZXRTZXJ2ZXIgKyBcIjogXCIgKyB0aHJlYWRzKTtcclxuICAgIH1cclxuXHJcbiAgICBlbHNlIGlmIChoZWxwKXtcclxuICAgICAgICBwcmludHVzYWdlKG5zKTtcclxuICAgIH1cclxufVxyXG5cclxuLy8gUHJpbnR1c2FnZSBmdW5jdGlvblxyXG5mdW5jdGlvbiBwcmludHVzYWdlKG5zKSB7XHJcbm5zLnRwcmludChcIlVzYWdlOiBydW4gdXRpbC5qcyBbdGFyZ2V0U2VydmVyXSBbRlVOQ1RJT05dXCIpO1xyXG5ucy50cHJpbnQoXCJFeGFtcGxlOiBydW4gdXRpbC5qcyBuMDBkbGVzIC0tb3BlbnBvcnRzXCIpXHJcbm5zLnRwcmludChcIkZVTkNUSU9OUzpcIik7XHJcbm5zLnRwcmludChcIiAgJy0tb3BlbnBvcnRzJzogT3BlbiBhbGwgYXZhaWxhYmxlIHBvcnRzIG9uIHRoZSB0YXJnZXQgc2VydmVyXCIpO1xyXG5ucy50cHJpbnQoXCIgICctLWdldEF2YWlsYWJsZVRocmVhZHMnOiBHZXQgdGhlIG51bWJlciBvZiB0aHJlYWRzIGF2YWlsYWJsZSBvbiB0aGUgdGFyZ2V0IHNlcnZlciBiYXNlZCBvbiBpdHMgUkFNIGFuZCB0aGUgUkFNIHJlcXVpcmVkIGZvciBhIHNpbmdsZSB0aHJlYWQgb2YgYSBzcGVjaWZpZWQgc2NyaXB0LiBVc2FnZSBleGFtcGxlOiBydW4gdXRpbC5qcyBuMDBkbGVzIC0tZ2V0QXZhaWxhYmxlVGhyZWFkc1wiKTtcclxubnMudHByaW50KFwiICAnaGVscCc6IFByaW50IHRoaXMgdXNhZ2UgbWVzc2FnZVwiKTsgIFxyXG59XHJcblxyXG4vLyBPcGVuIHBvcnRzIGZ1bmN0aW9uXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBvcGVuUG9ydHMobnMsIHRhcmdldFNlcnZlcikge1xyXG4gIC8vKiBPcGVucyBwb3J0cyB0aGVuIGdyYW50cyByb290XHJcbiAgbGV0IHJ1bkV4ZXMgPSBbXHJcbiAgICBcIkJydXRlU1NILmV4ZVwiLFxyXG4gICAgXCJGVFBDcmFjay5leGVcIixcclxuICAgIFwicmVsYXlTTVRQLmV4ZVwiLFxyXG4gICAgXCJTUUxJbmplY3QuZXhlXCIsXHJcbiAgICBcIkhUVFBXb3JtLmV4ZVwiXHJcbiAgXVxyXG5cclxuICBucy5wcmludCh0YXJnZXRTZXJ2ZXIpO1xyXG4gIFxyXG4gIC8vKiBPcGVuIHBvcnRzICovL1xyXG4gIGZvciAoY29uc3QgZXhlIG9mIHJ1bkV4ZXMpIHtcclxuICAgIFxyXG4gICAgc3dpdGNoIChleGUpIHtcclxuICAgICAgY2FzZSBcIkJydXRlU1NILmV4ZVwiOlxyXG4gICAgICAgIC8vIElmIHdlIGhhdmUgdGhlIEJydXRlU1NILmV4ZSBwcm9ncmFtLCB1c2UgaXQgdG8gb3BlbiB0aGUgU1NIIFBvcnQgb24gdGhlIHRhcmdldFNlcnZlclxyXG4gICAgICAgIGlmIChucy5maWxlRXhpc3RzKFwiQnJ1dGVTU0guZXhlXCIsIFwiaG9tZVwiKSkge1xyXG4gICAgICAgICAgbnMuYnJ1dGVzc2godGFyZ2V0U2VydmVyKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgYnJlYWs7XHJcblxyXG4gICAgICBjYXNlIFwiRlRQQ3JhY2suZXhlXCI6XHJcbiAgICAgICAgLy8gSWYgd2UgaGF2ZSB0aGUgRlRQQ3JhY2suZXhlIHByb2dyYW0sIHVzZSBpdCB0byBvcGVuIHRoZSBGVFAgUG9ydCBvbiB0aGUgdGFyZ2V0U2VydmVyXHJcbiAgICAgICAgaWYgKG5zLmZpbGVFeGlzdHMoXCJGVFBDcmFjay5leGVcIiwgXCJob21lXCIpKSB7XHJcbiAgICAgICAgICBucy5mdHBjcmFjayh0YXJnZXRTZXJ2ZXIpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBicmVhaztcclxuXHJcbiAgICAgIGNhc2UgXCJyZWxheVNNVFAuZXhlXCI6XHJcbiAgICAgICAgLy8gSWYgd2UgaGF2ZSB0aGUgcmVsYXlTTVRQLmV4ZSBwcm9ncmFtLCB1c2UgaXQgdG8gb3BlbiB0aGUgU01UUCBQb3J0IG9uIHRoZSB0YXJnZXRTZXJ2ZXJcclxuICAgICAgICBpZiAobnMuZmlsZUV4aXN0cyhcInJlbGF5U01UUC5leGVcIiwgXCJob21lXCIpKSB7XHJcbiAgICAgICAgICBucy5yZWxheXNtdHAodGFyZ2V0U2VydmVyKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgYnJlYWs7XHJcblxyXG4gICAgICBjYXNlIFwiU1FMSW5qZWN0LmV4ZVwiOlxyXG4gICAgICAgIC8vIElmIHdlIGhhdmUgdGhlIFNRTEluamVjdC5leGUgcHJvZ3JhbSwgdXNlIGl0IHRvIG9wZW4gdGhlIFNRTCBQb3J0IG9uIHRoZSB0YXJnZXRTZXJ2ZXJcclxuICAgICAgICBpZiAobnMuZmlsZUV4aXN0cyhcIlNRTEluamVjdC5leGVcIiwgXCJob21lXCIpKSB7XHJcbiAgICAgICAgICBucy5zcWxpbmplY3QodGFyZ2V0U2VydmVyKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgYnJlYWs7XHJcblxyXG4gICAgICBjYXNlIFwiSFRUUFdvcm0uZXhlXCI6XHJcbiAgICAgICAgLy8gSWYgd2UgaGF2ZSB0aGUgSFRUUFdvcm0uZXhlIHByb2dyYW0sIHVzZSBpdCB0byBvcGVuIHRoZSBIVFRQIFBvcnQgb24gdGhlIHRhcmdldFNlcnZlclxyXG4gICAgICAgIGlmIChucy5maWxlRXhpc3RzKFwiSFRUUFdvcm0uZXhlXCIsIFwiaG9tZVwiKSkge1xyXG4gICAgICAgICAgbnMuaHR0cHdvcm0odGFyZ2V0U2VydmVyKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICB9XHJcbiAgfVxyXG4gIC8vIEdldCByb290IGFjY2VzcyB0byB0YXJnZXRTZXJ2ZXIgc2VydmVyIGlmIG5vIHJvb3QgYWNjZXNzXHJcbiAgaWYgKCFucy5oYXNSb290QWNjZXNzKHRhcmdldFNlcnZlcikpIHtcclxuICAgIG5zLm51a2UodGFyZ2V0U2VydmVyKTtcclxuICAgIG5zLnByaW50KFwiU3VjY2Vzc2Z1bGx5IE51a2VkIGZvciByb290XCIpXHJcbiAgfVxyXG4gIGVsc2Uge1xyXG4gICAgbnMucHJpbnQoXCJBbHJlYWR5IGhhZCByb290XCIpO1xyXG4gIH1cclxuXHJcbiAgLy8gUHJpbnQgYmFja2Rvb3Igc3RhdHVzIG9mIHRhcmdldFNlcnZlclxyXG4gIGlmIChucy5nZXRTZXJ2ZXIodGFyZ2V0U2VydmVyKS5iYWNrZG9vckluc3RhbGxlZCkge1xyXG4gICAgbnMucHJpbnQoXCJCYWNrZG9vciBTdGF0dXMgPSBPUEVOXCIpO1xyXG4gIH1cclxuICBlbHNlIHtcclxuICAgIG5zLnByaW50KFwiQmFja2Rvb3IgU3RhdHVzID0gQ0xPU0VEXCIpO1xyXG4gIH1cclxufVxyXG5cclxuLy8gR2V0IGF2YWlsYWJsZSB0aHJlYWRzIGZ1bmN0aW9uIFxyXG4vLyBZb3UgcGFzcyBpbiAoZXhhbXBsZSkgbnMuZ2V0U2NyaXB0UmFtKFwid2Vha2VuLmpzXCIpIGFzIGFuIGFyZyByYXRoZXIgLiBLZWVwcyB0aGUgdXRpbCBmdW5jdGlvbiBwdXJlIGFuZCByZXVzYWJsZS5cclxuLy8gUmV0dXJucyB0aGUgbnVtYmVyIG9mIHRocmVhZHMgYXZhaWxhYmxlIG9uIHRoZSB0YXJnZXQgc2VydmVyLCBiYXNlZCBvbiBpdHMgUkFNIGFuZCB0aGUgUkFNIHJlcXVpcmVkIGZvciBhIHNpbmdsZSB0aHJlYWQgb2YgdGhlIHNwZWNpZmllZCBzY3JpcHRcclxuLy8gRXhhbXBsZSB1c2FnZTogZ2V0QXZhaWxhYmxlVGhyZWFkcyhucywgbjAwZGxlcywgbnMuZ2V0U2NyaXB0UmFtKFwid2Vha2VuLmpzXCIpKTtcclxuLy8gRXhhbXBsZSBnZXRzIHRoZSBzY3JpcHQgUkFNIGZvciB3ZWFrZW4uanMsIHRoZW4gY2FsY3VsYXRlcyBob3cgbWFueSB0aHJlYWRzIG9mIHdlYWtlbi5qcyBjb3VsZCBydW4gb24gbjAwZGxlcyBiYXNlZCBvbiBpdHMgYXZhaWxhYmxlIFJBTVxyXG5leHBvcnQgZnVuY3Rpb24gZ2V0QXZhaWxhYmxlVGhyZWFkcyhucywgdGFyZ2V0U2VydmVyLCBzY3JpcHRSYW0pIHtcclxuICBjb25zdCBhdmFpbGFibGVSYW0gPSBucy5nZXRTZXJ2ZXJNYXhSYW0odGFyZ2V0U2VydmVyKSAtIG5zLmdldFNlcnZlclVzZWRSYW0odGFyZ2V0U2VydmVyKTtcclxuICByZXR1cm4gTWF0aC5mbG9vcihhdmFpbGFibGVSYW0gLyBzY3JpcHRSYW0pO1xyXG59XHJcbiAgIl19e