import { scanNetwork } from "../scanner.js";

/**
 * Terminal entry point for this library - dispatches a utility action based on
 * the command-line flags passed in.
 *
 * This file is primarily a library (autoNuke, getAvailableThreads, jsonEdit, ...
 * are all imported elsewhere); main() only exists so the handful of utilities
 * can also be poked at manually from the terminal.
 *
 * NOTE: the --getAvailableThreads branch is currently broken - see the comments
 * on the flag consts below.
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
 */
export async function main(ns) {
    //Determine function
    // Lowercase every arg first so flag matching isn't case-sensitive for the user.
    const argmap = ns.args.map(a => a.toLowerCase());
    const openports = argmap.includes("--openports");
    // BUG: argmap holds lowercased args, but this compares against a
    // mixed-case literal, so this flag can never match and the branch below is
    // unreachable. It also shadows the exported getAvailableThreads() function
    // declared further down this file with a boolean.
    const getAvailableThreads = argmap.includes("--getAvailableThreads");
    const help = argmap.includes("help");
    // No hostname arg -> operate on whichever server this script is running on.
    const targetServer = ns.args[0] ?? ns.getHostname();
    ns.print(targetServer);
    //Determine function based on args
    if (openports) {
        autoNuke(ns, targetServer);
    }
    else if (getAvailableThreads) {
        // Dead branch (see above). Even if the flag matched, `getAvailableThreads`
        // here refers to the boolean const, not the function, so calling it
        // would throw a TypeError - and it passes 2 args to a 3-arg function.
        const threads = getAvailableThreads(ns, targetServer);
        ns.tprint("Available threads on " + targetServer + ": " + threads);
    }
    else if (help) {
        printusage(ns);
    }
}

// Printusage function
/**
 * Print the supported terminal usage for this script to the terminal.
 * Called from main() when "help" is passed as an argument.
 * @param {NS} ns - The Netscript API object
 * @returns {void}
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
 * Run every port-opening program we own against a server, then nuke it for
 * root access if we don't already have it.
 *
 * Each program is only used if the corresponding .exe actually exists on home -
 * calling e.g. ns.brutessh() without owning BruteSSH.exe throws, so the
 * fileExists() guards are load-bearing, not just tidiness.
 *
 * Safe to call on servers we already own: the nuke is skipped when
 * hasRootAccess() is already true.
 * @param {NS} ns - The Netscript API object
 * @param {string} targetServer - The hostname of the server to nuke
 * @param {boolean} [quiet=false] - Whether to suppress verbose logging
 * @returns {void}
 */
export function autoNuke(ns, targetServer, quiet = false) {
    // set silent if -q specified
    // NOTE: ns.args belongs to whichever script is *running*, so when autoNuke is
    // imported and called as a library this also picks up a "-q" passed to the
    // caller, not just to util.js.
    quiet = quiet || ns.args.includes("-q");

    // Silence all logs if quiet
    if (quiet) {
        ns.disableLog("ALL");
    }

    //* The port openers, in the order we'll try them. Each entry is both the
    //* filename we check for on home and the switch key below.
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
    // NOTE: everything below (including the backdoor status report) lives inside
    // this if, so nothing is logged at all for servers we already had root on.
    if (!ns.hasRootAccess(targetServer)) {
        ns.nuke(targetServer);
        if (!quiet) {
            ns.print("Successfully Nuked for root");
        }
        else {
            // Unreachable: this else only runs when quiet === true, and the
            // inner guard then requires !quiet. The "Already had root" message
            // never prints.
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
// Returns how many threads of `script` will fit in the free RAM of `scriptHost`.
// Example usage: getAvailableThreads(ns, "home", "hack.js");
// That looks up the per-thread RAM cost of hack.js, then divides home's free RAM by it.
// Works the same for cloud servers - just pass the cloud hostname as scriptHost.
/**
 * Calculate how many threads of a script will fit in a host's free RAM.
 * Subtracts cfg.json's `leaveRamFree` headroom from the host's *max* RAM
 * before subtracting used RAM, so the reserve is honoured on every host - not
 * just home - and the result can go negative-then-floor if the host is small.
 * @param {NS} ns - The Netscript API object
 * @param {string} scriptHost - The host server whose free RAM we're measuring
 * @param {string} script - The script filename whose per-thread RAM cost we divide by
 * @returns {number} The number of whole threads that fit
 */
export function getAvailableThreads(ns, scriptHost, script) {
    const availableRam = (ns.getServerMaxRam(scriptHost) - JSON.parse(ns.read("/data/cfg.json")).leaveRamFree - ns.getServerUsedRam(scriptHost));       // always leaves space free - set in cfg.json
    // Per-thread RAM cost of the script, as measured on that host.
    const scriptRam = ns.getScriptRam(script, scriptHost)
    return Math.floor(availableRam / scriptRam);
}

/**
 * Update a single (possibly nested) value in a JSON file on disk.
 * Reads the file, walks to the key via its dotted path, overwrites the value,
 * and writes the whole object back.
 * WARNING: when this updates the *.json, this will be desynced with the VS code *.json as this is a one way operation only.
 * Also note: intermediate objects are NOT created - every segment of the path
 * except the last must already exist in the file, or this throws.
 * @param {NS} ns - The Netscript API object
 * @param {string} key - The dotted path to the property to update, e.g. "purchaseConfig.maxPercSpend"
 * @param {*} value - The value to write to the target key
 * @param {string} [filepath="/data/cfg.json"] - The JSON file to edit
 * @returns {void}
 */
export function jsonEdit(ns, key, value, filepath = "/data/cfg.json") {
    // load json and catch syntax errors - a malformed file should abort the
    // edit rather than let us write garbage back over it
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

    // "walks" deeper into the json depending on how many "." are passed in key arg.
    // Stops one short of the end (length - 1) so `current` ends up holding the
    // object that *contains* the final key, which is what we need to assign into.
    for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
    }

    // change value passed from arg - .at(-1) is the last path segment.
    // `current` is a reference into jsonObj, so mutating it mutates jsonObj.
    current[keys.at(-1)] = value;

    // write edited json back ("w" = overwrite, not append)
    ns.write(filepath, JSON.stringify(jsonObj), "w");
}

/**
 * Read a nested value out of an object via a dotted key path.
 * The read-only counterpart to jsonEdit's path walking - used by the cfg/*.js
 * editors to pull a field's live value out of cfg.json and its canonical
 * default out of defaultcfg.json without re-writing the walk in each script.
 * The `?.` in the reducer means a missing segment short-circuits to undefined
 * instead of throwing.
 * @param {object} obj - The object to read from
 * @param {string} key - The dotted path to the property, e.g. "purchaseConfig.maxPercSpend"
 * @returns {*} The value at that path, or undefined if any segment is missing
 */
export function getByPath(obj, key) {
    return key.split(".").reduce((current, k) => current?.[k], obj);
}

/**
 * Prompt a yes/no confirmation dialog before a destructive/irreversible action.
 * The `=== true` is deliberate: a "text" prompt resolves to a string and a
 * cancelled prompt resolves to false, so this normalises anything that isn't a
 * genuine Yes into a hard false.
 * @param {NS} ns - The Netscript API object
 * @param {string} message - The confirmation question to show the user
 * @returns {Promise<boolean>} Whether the user confirmed
 */
export async function confirmAction(ns, message) {
    const confirmed = await ns.prompt(message, { type: "boolean" });
    return confirmed === true;
}

/**
 * Prompt for a single config field, using the field's declared type to pick the
 * right ns.prompt UI (boolean -> real yes/no dialog, everything else -> text
 * box), then parse the result into that type.
 *
 * Shared by all five interactive cfg/*.js editors. Returns undefined to mean
 * "leave this field alone" - cancelled, submitted empty, or an unparseable
 * number - so callers can skip the write rather than clobbering a good value.
 * @param {NS} ns - The Netscript API object
 * @param {{label: string, type?: "text"|"number"|"boolean"|"array"}} field - The field descriptor: its prompt label and how to parse the answer (defaults to "text")
 * @param {*} current - The field's current value, shown in the prompt message
 * @param {*} defaultValue - The field's canonical default (from defaultcfg.json), shown in the prompt message
 * @returns {Promise<*|undefined>} The parsed new value, or undefined to leave the field unchanged
 */
export async function promptField(ns, field, current, defaultValue) {
    const type = field.type ?? "text";
    // Arrays print as "a, b, c" rather than the raw JS array form
    const currentDisplay = Array.isArray(current) ? current.join(", ") : current;
    const defaultDisplay = Array.isArray(defaultValue) ? defaultValue.join(", ") : defaultValue;
    const message = `${field.label}\nCurrent: ${currentDisplay} | Default: ${defaultDisplay}`;

    // Booleans can't use the plain "boolean" dialog: ns.prompt resolves a cancelled
    // boolean prompt to false, which is indistinguishable from a genuine "No" click -
    // that's what made backing out of cfgtoggle partway turn every remaining switch off.
    // A "select" dialog gives cancel its own distinct default ("") separate from either
    // real answer, so skipping is actually possible.
    if (type === "boolean") {
        const choice = await ns.prompt(message, { type: "select", choices: ["Yes", "No", "Skip (leave unchanged)"] });
        if (choice === "Yes") return true;
        if (choice === "No") return false;
        return undefined;
    }

    const input = await ns.prompt(message, { type: "text" });
    // "" = submitted blank, false = cancelled the dialog. Both mean "no change".
    if (input === "" || input === false) return undefined;

    // Everything past here is a string from the text box - coerce it per type
    switch (type) {
        case "number": {
            const value = Number(input);
            if (Number.isNaN(value)) {
                ns.tprint(`WARN: "${input}" is not a valid number for ${field.label}, skipping.`);
                return undefined;
            }
            return value;
        }
        case "array":
            // "a, b , ,c" -> ["a","b","c"]: split on commas, trim whitespace,
            // then drop empties so a trailing comma doesn't add a blank entry
            return input.split(",").map(s => s.trim()).filter(s => s.length > 0);
        default:
            // "text" - hand the raw string back untouched
            return input;
    }
}

/**
 * Ensure the requested script is running on the target server, launching it if
 * it isn't. Used by the watcher loops so a script that died (or was never
 * started) gets picked back up on the next pass.
 *
 * The script is identified by name + host + its single argument, which is the
 * host itself - see the exec below for why that arg convention is mandatory.
 *
 * NOTE: the `pid` parameter is not implemented yet. Passing anything other than
 * null falls through to an empty default case and returns undefined without
 * checking or launching anything.
 * @param {NS} ns - The Netscript API object
 * @param {string} script - The script name to ensure is running
 * @param {string} host - The target server hostname
 * @param {number|null} [pid=null] - Placeholder for a future check-by-PID mode; currently a no-op branch
 * @returns {boolean|undefined} True if this call launched the script, false if it was already running, undefined if a non-null pid was passed
 */
export function ensureRunning(ns, script, host, pid = null) {
    let ran;
    switch (pid) {
        case null:
            // Third arg is the script's arg[0]. ns.isRunning matches on args
            // exactly, so this only finds the process if it was launched with
            // the same single host argument the exec below uses.
            if (!ns.isRunning(script, host, host)) {
                // Specific behaviour for cloudpush.js as it does not transfer itself.
                // all other scripts will be scp pushed by the cloudpush script.
                if (script == "cloudpush.js") {
                    if (host !== "home") {
                        ns.scp(script, host, "home");
                    }
                }

                // Fire off script if not running
                // WARNING - all added scripts to watched must follow this args format (targethost as arg[0])
                ns.exec(script, host, 1, host);

                ran = true;
            }
            else {
                ran = false;
            }
            break;

        default:
            // placeholder to add alt behaviour pid check code
            // Currently does nothing - `ran` stays undefined and is returned as-is.
            break;
    }
    return ran;
}

// Computes rooted servers and caches result to /data/rooted.json
/**
 * Compute the hostnames of every server we have root access on, combining the
 * scanned network with our purchased cloud servers, and cache the result to
 * /data/rooted.json so consumers (the scheduler, deployers) can read the list
 * instead of recomputing this merge.
 *
 * Called by refresh.js each cycle after scanNetwork/scanCloud, so the cache
 * tracks the live scan cadence.
 *
 * The `!purchasedByPlayer` filter is what stops clouds being counted twice:
 * they appear in networks.json as owned servers *and* as keys in clouds.json,
 * so they're excluded from the scan half and added back from the clouds half.
 * NOTE: home is in networks.json with hasAdminRights true and purchasedByPlayer
 * false, so home ends up in this list too.
 * @param {NS} ns - The Netscript API object
 * @returns {string[]} Array of rooted server hostnames
 */
export function getRootedServers(ns) {
    const networks = JSON.parse(ns.read("/data/networks.json"));
    const clouds = JSON.parse(ns.read("/data/clouds.json"));

    // Rooted servers from the network scan, minus anything we bought ourselves
    const rootedFromScan = networks
        .filter((server) => server.hasAdminRights && !server.purchasedByPlayer)
        .map((server) => server.hostname);

    // clouds.json is keyed by hostname, so its keys are the cloud server names
    const rooted = [...rootedFromScan, ...Object.keys(clouds)];
    ns.write("/data/rooted.json", JSON.stringify(rooted), "w");
    return rooted;
}


   

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy91dGlsLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLHFCQUFxQjtBQUNyQixNQUFNLENBQUMsS0FBSyxVQUFVLElBQUksQ0FBQyxFQUFFO0lBQzNCLG9CQUFvQjtJQUNwQixNQUFNLE1BQU0sR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDO0lBRWpELE1BQU0sU0FBUyxHQUFHLE1BQU0sQ0FBQyxRQUFRLENBQUMsYUFBYSxDQUFDLENBQUM7SUFDakQsTUFBTSxtQkFBbUIsR0FBRyxNQUFNLENBQUMsUUFBUSxDQUFDLHVCQUF1QixDQUFDLENBQUM7SUFDckUsTUFBTSxJQUFJLEdBQUcsTUFBTSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUNyQyxNQUFNLFlBQVksR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxXQUFXLEVBQUUsQ0FBQztJQUVwRCxFQUFFLENBQUMsS0FBSyxDQUFDLFlBQVksQ0FBQyxDQUFDO0lBQ3ZCLGtDQUFrQztJQUNoQyxJQUFJLFNBQVMsRUFBQztRQUNWLE1BQU0sU0FBUyxDQUFDLEVBQUUsRUFBRSxZQUFZLENBQUMsQ0FBQztLQUNyQztTQUVJLElBQUksbUJBQW1CLEVBQUM7UUFDekIsTUFBTSxPQUFPLEdBQUcsbUJBQW1CLENBQUMsRUFBRSxFQUFFLFlBQVksQ0FBQyxDQUFDO1FBQ3RELEVBQUUsQ0FBQyxNQUFNLENBQUMsdUJBQXVCLEdBQUcsWUFBWSxHQUFHLElBQUksR0FBRyxPQUFPLENBQUMsQ0FBQztLQUN0RTtTQUVJLElBQUksSUFBSSxFQUFDO1FBQ1YsVUFBVSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0tBQ2xCO0FBQ0wsQ0FBQztBQUVELHNCQUFzQjtBQUN0QixTQUFTLFVBQVUsQ0FBQyxFQUFFO0lBQ3RCLEVBQUUsQ0FBQyxNQUFNLENBQUMsOENBQThDLENBQUMsQ0FBQztJQUMxRCxFQUFFLENBQUMsTUFBTSxDQUFDLDBDQUEwQyxDQUFDLENBQUE7SUFDckQsRUFBRSxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQUMsQ0FBQztJQUN4QixFQUFFLENBQUMsTUFBTSxDQUFDLGdFQUFnRSxDQUFDLENBQUM7SUFDNUUsRUFBRSxDQUFDLE1BQU0sQ0FBQywrTkFBK04sQ0FBQyxDQUFDO0lBQzNPLEVBQUUsQ0FBQyxNQUFNLENBQUMsb0NBQW9DLENBQUMsQ0FBQztBQUNoRCxDQUFDO0FBRUQsc0JBQXNCO0FBQ3RCLE1BQU0sQ0FBQyxLQUFLLFVBQVUsU0FBUyxDQUFDLEVBQUUsRUFBRSxZQUFZO0lBQzlDLGdDQUFnQztJQUNoQyxJQUFJLE9BQU8sR0FBRztRQUNaLGNBQWM7UUFDZCxjQUFjO1FBQ2QsZUFBZTtRQUNmLGVBQWU7UUFDZixjQUFjO0tBQ2YsQ0FBQTtJQUVELEVBQUUsQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDLENBQUM7SUFFdkIsa0JBQWtCO0lBQ2xCLEtBQUssTUFBTSxHQUFHLElBQUksT0FBTyxFQUFFO1FBRXpCLFFBQVEsR0FBRyxFQUFFO1lBQ1gsS0FBSyxjQUFjO2dCQUNqQix1RkFBdUY7Z0JBQ3ZGLElBQUksRUFBRSxDQUFDLFVBQVUsQ0FBQyxjQUFjLEVBQUUsTUFBTSxDQUFDLEVBQUU7b0JBQ3pDLEVBQUUsQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDLENBQUM7aUJBQzNCO2dCQUNELE1BQU07WUFFUixLQUFLLGNBQWM7Z0JBQ2pCLHVGQUF1RjtnQkFDdkYsSUFBSSxFQUFFLENBQUMsVUFBVSxDQUFDLGNBQWMsRUFBRSxNQUFNLENBQUMsRUFBRTtvQkFDekMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxZQUFZLENBQUMsQ0FBQztpQkFDM0I7Z0JBQ0QsTUFBTTtZQUVSLEtBQUssZUFBZTtnQkFDbEIseUZBQXlGO2dCQUN6RixJQUFJLEVBQUUsQ0FBQyxVQUFVLENBQUMsZUFBZSxFQUFFLE1BQU0sQ0FBQyxFQUFFO29CQUMxQyxFQUFFLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxDQUFDO2lCQUM1QjtnQkFDRCxNQUFNO1lBRVIsS0FBSyxlQUFlO2dCQUNsQix3RkFBd0Y7Z0JBQ3hGLElBQUksRUFBRSxDQUFDLFVBQVUsQ0FBQyxlQUFlLEVBQUUsTUFBTSxDQUFDLEVBQUU7b0JBQzFDLEVBQUUsQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLENBQUM7aUJBQzVCO2dCQUNELE1BQU07WUFFUixLQUFLLGNBQWM7Z0JBQ2pCLHdGQUF3RjtnQkFDeEYsSUFBSSxFQUFFLENBQUMsVUFBVSxDQUFDLGNBQWMsRUFBRSxNQUFNLENBQUMsRUFBRTtvQkFDekMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxZQUFZLENBQUMsQ0FBQztpQkFDM0I7Z0JBQ0QsTUFBTTtTQUNUO0tBQ0Y7SUFDRCwyREFBMkQ7SUFDM0QsSUFBSSxDQUFDLEVBQUUsQ0FBQyxhQUFhLENBQUMsWUFBWSxDQUFDLEVBQUU7UUFDbkMsRUFBRSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUN0QixFQUFFLENBQUMsS0FBSyxDQUFDLDZCQUE2QixDQUFDLENBQUE7S0FDeEM7U0FDSTtRQUNILEVBQUUsQ0FBQyxLQUFLLENBQUMsa0JBQWtCLENBQUMsQ0FBQztLQUM5QjtJQUVELHdDQUF3QztJQUN4QyxJQUFJLEVBQUUsQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLENBQUMsaUJBQWlCLEVBQUU7UUFDaEQsRUFBRSxDQUFDLEtBQUssQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDO0tBQ3BDO1NBQ0k7UUFDSCxFQUFFLENBQUMsS0FBSyxDQUFDLDBCQUEwQixDQUFDLENBQUM7S0FDdEM7QUFDSCxDQUFDO0FBRUQsa0NBQWtDO0FBQ2xDLG1IQUFtSDtBQUNuSCxrSkFBa0o7QUFDbEosaUZBQWlGO0FBQ2pGLDJJQUEySTtBQUMzSSxNQUFNLFVBQVUsbUJBQW1CLENBQUMsRUFBRSxFQUFFLFlBQVksRUFBRSxTQUFTO0lBQzdELE1BQU0sWUFBWSxHQUFHLEVBQUUsQ0FBQyxlQUFlLENBQUMsWUFBWSxDQUFDLEdBQUcsRUFBRSxDQUFDLGdCQUFnQixDQUFDLFlBQVksQ0FBQyxDQUFDO0lBQzFGLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxZQUFZLEdBQUcsU0FBUyxDQUFDLENBQUM7QUFDOUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKiBAcGFyYW0ge05TfSBucyAqL1xyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gbWFpbihucykge1xyXG4gIC8vRGV0ZXJtaW5lIGZ1bmN0aW9uXHJcbiAgY29uc3QgYXJnbWFwID0gbnMuYXJncy5tYXAoYSA9PiBhLnRvTG93ZXJDYXNlKCkpO1xyXG5cclxuICBjb25zdCBvcGVucG9ydHMgPSBhcmdtYXAuaW5jbHVkZXMoXCItLW9wZW5wb3J0c1wiKTtcclxuICBjb25zdCBnZXRBdmFpbGFibGVUaHJlYWRzID0gYXJnbWFwLmluY2x1ZGVzKFwiLS1nZXRBdmFpbGFibGVUaHJlYWRzXCIpO1xyXG4gIGNvbnN0IGhlbHAgPSBhcmdtYXAuaW5jbHVkZXMoXCJoZWxwXCIpO1xyXG4gIGNvbnN0IHRhcmdldFNlcnZlciA9IG5zLmFyZ3NbMF0gPz8gbnMuZ2V0SG9zdG5hbWUoKTtcclxuXHJcbiAgbnMucHJpbnQodGFyZ2V0U2VydmVyKTtcclxuICAvL0RldGVybWluZSBmdW5jdGlvbiBiYXNlZCBvbiBhcmdzXHJcbiAgICBpZiAob3BlbnBvcnRzKXtcclxuICAgICAgICBhd2FpdCBvcGVuUG9ydHMobnMsIHRhcmdldFNlcnZlcik7XHJcbiAgICB9XHJcblxyXG4gICAgZWxzZSBpZiAoZ2V0QXZhaWxhYmxlVGhyZWFkcyl7XHJcbiAgICAgICAgY29uc3QgdGhyZWFkcyA9IGdldEF2YWlsYWJsZVRocmVhZHMobnMsIHRhcmdldFNlcnZlcik7XHJcbiAgICAgICAgbnMudHByaW50KFwiQXZhaWxhYmxlIHRocmVhZHMgb24gXCIgKyB0YXJnZXRTZXJ2ZXIgKyBcIjogXCIgKyB0aHJlYWRzKTtcclxuICAgIH1cclxuXHJcbiAgICBlbHNlIGlmIChoZWxwKXtcclxuICAgICAgICBwcmludHVzYWdlKG5zKTtcclxuICAgIH1cclxufVxyXG5cclxuLy8gUHJpbnR1c2FnZSBmdW5jdGlvblxyXG5mdW5jdGlvbiBwcmludHVzYWdlKG5zKSB7XHJcbm5zLnRwcmludChcIlVzYWdlOiBydW4gdXRpbC5qcyBbdGFyZ2V0U2VydmVyXSBbRlVOQ1RJT05dXCIpO1xyXG5ucy50cHJpbnQoXCJFeGFtcGxlOiBydW4gdXRpbC5qcyBuMDBkbGVzIC0tb3BlbnBvcnRzXCIpXHJcbm5zLnRwcmludChcIkZVTkNUSU9OUzpcIik7XHJcbm5zLnRwcmludChcIiAgJy0tb3BlbnBvcnRzJzogT3BlbiBhbGwgYXZhaWxhYmxlIHBvcnRzIG9uIHRoZSB0YXJnZXQgc2VydmVyXCIpO1xyXG5ucy50cHJpbnQoXCIgICctLWdldEF2YWlsYWJsZVRocmVhZHMnOiBHZXQgdGhlIG51bWJlciBvZiB0aHJlYWRzIGF2YWlsYWJsZSBvbiB0aGUgdGFyZ2V0IHNlcnZlciBiYXNlZCBvbiBpdHMgUkFNIGFuZCB0aGUgUkFNIHJlcXVpcmVkIGZvciBhIHNpbmdsZSB0aHJlYWQgb2YgYSBzcGVjaWZpZWQgc2NyaXB0LiBVc2FnZSBleGFtcGxlOiBydW4gdXRpbC5qcyBuMDBkbGVzIC0tZ2V0QXZhaWxhYmxlVGhyZWFkc1wiKTtcclxubnMudHByaW50KFwiICAnaGVscCc6IFByaW50IHRoaXMgdXNhZ2UgbWVzc2FnZVwiKTsgIFxyXG59XHJcblxyXG4vLyBPcGVuIHBvcnRzIGZ1bmN0aW9uXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBvcGVuUG9ydHMobnMsIHRhcmdldFNlcnZlcikge1xyXG4gIC8vKiBPcGVucyBwb3J0cyB0aGVuIGdyYW50cyByb290XHJcbiAgbGV0IHJ1bkV4ZXMgPSBbXHJcbiAgICBcIkJydXRlU1NILmV4ZVwiLFxyXG4gICAgXCJGVFBDcmFjay5leGVcIixcclxuICAgIFwicmVsYXlTTVRQLmV4ZVwiLFxyXG4gICAgXCJTUUxJbmplY3QuZXhlXCIsXHJcbiAgICBcIkhUVFBXb3JtLmV4ZVwiXHJcbiAgXVxyXG5cclxuICBucy5wcmludCh0YXJnZXRTZXJ2ZXIpO1xyXG4gIFxyXG4gIC8vKiBPcGVuIHBvcnRzICovL1xyXG4gIGZvciAoY29uc3QgZXhlIG9mIHJ1bkV4ZXMpIHtcclxuICAgIFxyXG4gICAgc3dpdGNoIChleGUpIHtcclxuICAgICAgY2FzZSBcIkJydXRlU1NILmV4ZVwiOlxyXG4gICAgICAgIC8vIElmIHdlIGhhdmUgdGhlIEJydXRlU1NILmV4ZSBwcm9ncmFtLCB1c2UgaXQgdG8gb3BlbiB0aGUgU1NIIFBvcnQgb24gdGhlIHRhcmdldFNlcnZlclxyXG4gICAgICAgIGlmIChucy5maWxlRXhpc3RzKFwiQnJ1dGVTU0guZXhlXCIsIFwiaG9tZVwiKSkge1xyXG4gICAgICAgICAgbnMuYnJ1dGVzc2godGFyZ2V0U2VydmVyKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgYnJlYWs7XHJcblxyXG4gICAgICBjYXNlIFwiRlRQQ3JhY2suZXhlXCI6XHJcbiAgICAgICAgLy8gSWYgd2UgaGF2ZSB0aGUgRlRQQ3JhY2suZXhlIHByb2dyYW0sIHVzZSBpdCB0byBvcGVuIHRoZSBGVFAgUG9ydCBvbiB0aGUgdGFyZ2V0U2VydmVyXHJcbiAgICAgICAgaWYgKG5zLmZpbGVFeGlzdHMoXCJGVFBDcmFjay5leGVcIiwgXCJob21lXCIpKSB7XHJcbiAgICAgICAgICBucy5mdHBjcmFjayh0YXJnZXRTZXJ2ZXIpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBicmVhaztcclxuXHJcbiAgICAgIGNhc2UgXCJyZWxheVNNVFAuZXhlXCI6XHJcbiAgICAgICAgLy8gSWYgd2UgaGF2ZSB0aGUgcmVsYXlTTVRQLmV4ZSBwcm9ncmFtLCB1c2UgaXQgdG8gb3BlbiB0aGUgU01UUCBQb3J0IG9uIHRoZSB0YXJnZXRTZXJ2ZXJcclxuICAgICAgICBpZiAobnMuZmlsZUV4aXN0cyhcInJlbGF5U01UUC5leGVcIiwgXCJob21lXCIpKSB7XHJcbiAgICAgICAgICBucy5yZWxheXNtdHAodGFyZ2V0U2VydmVyKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgYnJlYWs7XHJcblxyXG4gICAgICBjYXNlIFwiU1FMSW5qZWN0LmV4ZVwiOlxyXG4gICAgICAgIC8vIElmIHdlIGhhdmUgdGhlIFNRTEluamVjdC5leGUgcHJvZ3JhbSwgdXNlIGl0IHRvIG9wZW4gdGhlIFNRTCBQb3J0IG9uIHRoZSB0YXJnZXRTZXJ2ZXJcclxuICAgICAgICBpZiAobnMuZmlsZUV4aXN0cyhcIlNRTEluamVjdC5leGVcIiwgXCJob21lXCIpKSB7XHJcbiAgICAgICAgICBucy5zcWxpbmplY3QodGFyZ2V0U2VydmVyKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgYnJlYWs7XHJcblxyXG4gICAgICBjYXNlIFwiSFRUUFdvcm0uZXhlXCI6XHJcbiAgICAgICAgLy8gSWYgd2UgaGF2ZSB0aGUgSFRUUFdvcm0uZXhlIHByb2dyYW0sIHVzZSBpdCB0byBvcGVuIHRoZSBIVFRQIFBvcnQgb24gdGhlIHRhcmdldFNlcnZlclxyXG4gICAgICAgIGlmIChucy5maWxlRXhpc3RzKFwiSFRUUFdvcm0uZXhlXCIsIFwiaG9tZVwiKSkge1xyXG4gICAgICAgICAgbnMuaHR0cHdvcm0odGFyZ2V0U2VydmVyKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICB9XHJcbiAgfVxyXG4gIC8vIEdldCByb290IGFjY2VzcyB0byB0YXJnZXRTZXJ2ZXIgc2VydmVyIGlmIG5vIHJvb3QgYWNjZXNzXHJcbiAgaWYgKCFucy5oYXNSb290QWNjZXNzKHRhcmdldFNlcnZlcikpIHtcclxuICAgIG5zLm51a2UodGFyZ2V0U2VydmVyKTtcclxuICAgIG5zLnByaW50KFwiU3VjY2Vzc2Z1bGx5IE51a2VkIGZvciByb290XCIpXHJcbiAgfVxyXG4gIGVsc2Uge1xyXG4gICAgbnMucHJpbnQoXCJBbHJlYWR5IGhhZCByb290XCIpO1xyXG4gIH1cclxuXHJcbiAgLy8gUHJpbnQgYmFja2Rvb3Igc3RhdHVzIG9mIHRhcmdldFNlcnZlclxyXG4gIGlmIChucy5nZXRTZXJ2ZXIodGFyZ2V0U2VydmVyKS5iYWNrZG9vckluc3RhbGxlZCkge1xyXG4gICAgbnMucHJpbnQoXCJCYWNrZG9vciBTdGF0dXMgPSBPUEVOXCIpO1xyXG4gIH1cclxuICBlbHNlIHtcclxuICAgIG5zLnByaW50KFwiQmFja2Rvb3IgU3RhdHVzID0gQ0xPU0VEXCIpO1xyXG4gIH1cclxufVxyXG5cclxuLy8gR2V0IGF2YWlsYWJsZSB0aHJlYWRzIGZ1bmN0aW9uIFxyXG4vLyBZb3UgcGFzcyBpbiAoZXhhbXBsZSkgbnMuZ2V0U2NyaXB0UmFtKFwid2Vha2VuLmpzXCIpIGFzIGFuIGFyZyByYXRoZXIgLiBLZWVwcyB0aGUgdXRpbCBmdW5jdGlvbiBwdXJlIGFuZCByZXVzYWJsZS5cclxuLy8gUmV0dXJucyB0aGUgbnVtYmVyIG9mIHRocmVhZHMgYXZhaWxhYmxlIG9uIHRoZSB0YXJnZXQgc2VydmVyLCBiYXNlZCBvbiBpdHMgUkFNIGFuZCB0aGUgUkFNIHJlcXVpcmVkIGZvciBhIHNpbmdsZSB0aHJlYWQgb2YgdGhlIHNwZWNpZmllZCBzY3JpcHRcclxuLy8gRXhhbXBsZSB1c2FnZTogZ2V0QXZhaWxhYmxlVGhyZWFkcyhucywgbjAwZGxlcywgbnMuZ2V0U2NyaXB0UmFtKFwid2Vha2VuLmpzXCIpKTtcclxuLy8gRXhhbXBsZSBnZXRzIHRoZSBzY3JpcHQgUkFNIGZvciB3ZWFrZW4uanMsIHRoZW4gY2FsY3VsYXRlcyBob3cgbWFueSB0aHJlYWRzIG9mIHdlYWtlbi5qcyBjb3VsZCBydW4gb24gbjAwZGxlcyBiYXNlZCBvbiBpdHMgYXZhaWxhYmxlIFJBTVxyXG5leHBvcnQgZnVuY3Rpb24gZ2V0QXZhaWxhYmxlVGhyZWFkcyhucywgdGFyZ2V0U2VydmVyLCBzY3JpcHRSYW0pIHtcclxuICBjb25zdCBhdmFpbGFibGVSYW0gPSBucy5nZXRTZXJ2ZXJNYXhSYW0odGFyZ2V0U2VydmVyKSAtIG5zLmdldFNlcnZlclVzZWRSYW0odGFyZ2V0U2VydmVyKTtcclxuICByZXR1cm4gTWF0aC5mbG9vcihhdmFpbGFibGVSYW0gLyBzY3JpcHRSYW0pO1xyXG59XHJcbiAgIl19e