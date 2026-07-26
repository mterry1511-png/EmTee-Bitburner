import { getTarget } from "./lib/targeting.js";

/**
 * Runs `hack`, `grow`, and `weaken` in sequence to gain experience only.
 * Fills threads to the host's available RAM, respecting `leaveRamFree` from `/data/cfg.json`.
 * Can target a specific server or use targeting logic to select the best target (default).
 * Usage: run hackexp.js [target|best|help]
 *   target - specific server hostname
 *   best   - automatically select best target by money per second (default if no arg)
 *   help   - display usage information
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
 */
export async function main(ns) {
    // Show usage if user requests help
    if (ns.args[0] === "help") {
        printUsage(ns);
        return;
    }

    // Get target from args, defaulting to "best" if not provided
    let target = ns.args[0] ?? "best";

    // If target is "best", use targeting logic to automatically select the best server
    // based on money per second (respects config requirements like minMoney, minServerGrowth)
    if (target === "best") {
        target = getTarget(ns, "best");
        ns.tprint(`Selected target: ${target}`);
    }

    // open tail by default
    ns.ui.openTail();
    ns.ui.setTailMinimized(false); // true: min, false: max
    ns.ui.moveTail(1650, 500);
    ns.ui.resizeTail(250, 350);

    ns.disableLog("disableLog");
    ns.disableLog("getServerMaxRam");
    ns.disableLog("getServerUsedRam");
    ns.disableLog("sleep");

    // Load configuration to get leaveRamFree setting
    const cfg = JSON.parse(ns.read("data/cfg.json"));
    const leaveRamFree = cfg.leaveRamFree || 0;

    // Define script paths for the HGW cycle
    const hack = "./lib/hgw/hack.js";
    const grow = "./lib/hgw/grow.js";
    const weaken = "./lib/hgw/weaken.js";
    let script = hack;

    while (true) {
        // Calculate available RAM on the target server, respecting leaveRamFree threshold
        const availableRam = ns.getServerMaxRam() - ns.getServerUsedRam() - leaveRamFree;

        // Get RAM cost per thread for the current script
        const scriptRam = ns.getScriptRam(script);

        // Calculate how many threads we can spawn with available RAM
        const threads = Math.floor(availableRam / scriptRam);

        // Check if we have minimum RAM to run the script
        if (threads < 1) {
            ns.tprint("Insufficient ram on host. Requires minimum 5.1GB");
            break;
        }

        // Add spacing in the log output for readability
        ns.print("\n");

        // Execute the script and get its PID (Process ID)
        const pid = ns.run(script, threads, target);

        // Wait for the script to complete before moving to the next operation
        // Check every 50ms if the process is still running
        while (ns.isRunning(pid)) {
            await ns.sleep(50);
        }

        // Cycle to the next script in the sequence: hack → grow → weaken → hack
        switch (script) {
            case hack:
                script = grow;
                break;
            case grow:
                script = weaken;
                break;
            case weaken:
                script = hack;
                break;
        }
    }
}

/**
 * Displays usage information and examples for the script.
 * @param {NS} ns - The Netscript API object
 * @returns {void}
 */
function printUsage(ns) {
    ns.tprint("Usage: run hackexp.js <target|best|help>");
    ns.tprint("  <target>  - hostname of the target server to hack for experience");
    ns.tprint("  best      - automatically select best target by money per second");
    ns.tprint("  help      - display this usage information");
    ns.tprint("\nExamples:");
    ns.tprint("  run hackexp.js n00dles     - hack n00dles");
    ns.tprint("  run hackexp.js best        - hack the best available target");
}

/**
 * Provides autocomplete suggestions for server hostnames.
 * @param {AutocompleteData} data - game context with available servers
 * @param {string[]} args - current arguments passed to the script
 * @returns {string[]} array of server hostnames not yet specified in args
 */
export function autocomplete(data, args) {
  const servers = data.servers;
  const serversWithArgsRemoved = servers.filter((server) => !args.includes(server));

  return serversWithArgsRemoved;
}