import { getTarget } from "./lib/targeting.js";

/**
 * Grinds hacking experience by cycling hack -> grow -> weaken forever against one target.
 *
 * This is an XP filler, NOT a money strategy: it makes no attempt to keep the target at
 * optimal money/security like deployer.js does. It simply saturates the host's free RAM with
 * whichever operation is next in the cycle, waits for it to finish, then moves on. That makes
 * it the natural candidate for the scheduler's pre-emptible backfill work (see CLAUDE.md).
 *
 * Runs ON the host whose RAM it fills (go.js task 2 execs it onto each cloud), which is why
 * ns.getServerMaxRam()/getServerUsedRam() are called with no hostname - they default to the
 * current server. Threads are launched with ns.run, again targeting the current server.
 *
 * Usage: run hackexp.js [target|best|help]
 *   target - specific server hostname
 *   best   - automatically select best target by money per second (default if no arg)
 *   help   - display usage information
 * @param {NS} ns - The Netscript API object
 * @param {string} [ns.args[0]="best"] - Target hostname, "best", or "help"
 * @returns {Promise<void>} Never resolves unless the host lacks RAM for a single thread
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

    // Load configuration to get leaveRamFree setting.
    // NOTE: path is written without a leading slash here, unlike everywhere else in the
    // project ("/data/cfg.json"). See findings.
    const cfg = JSON.parse(ns.read("data/cfg.json"));
    const leaveRamFree = cfg.leaveRamFree || 0;

    // Define script paths for the HGW cycle
    const hack = "./lib/hgw/hack.js";
    const grow = "./lib/hgw/grow.js";
    const weaken = "./lib/hgw/weaken.js";
    let script = hack;      // cycle always starts on hack

    let currentPid = null;

    // Kill child script when hackexp terminates
    ns.atExit(() => {
        if (currentPid && ns.isRunning(currentPid)) {
            ns.kill(currentPid);
        }
    });

    while (true) {
        // Free RAM on THIS host (no hostname arg = current server), minus the reserve.
        // Recomputed every cycle so the thread count adapts as other scripts come and go.
        const availableRam = ns.getServerMaxRam() - ns.getServerUsedRam() - leaveRamFree;

        // Get RAM cost per thread for the current script
        const scriptRam = ns.getScriptRam(script);

        // Calculate how many threads we can spawn with available RAM
        const threads = Math.floor(availableRam / scriptRam);

        // No room for even one thread - give up entirely rather than retry.
        // (The 5.1GB figure in the message is a hardcoded approximation, not derived from
        // scriptRam above, so it can drift from the real requirement. See findings.)
        if (threads < 1) {
            ns.tprint("Insufficient ram on host. Requires minimum 5.1GB");
            break;
        }

        // Add spacing in the log output for readability
        ns.print("\n");

        // Execute the script and get its PID (Process ID).
        // ns.run targets the CURRENT server - that's the point: hackexp fills its own host.
        currentPid = ns.run(script, threads, target);

        // ns.run() returns a PID synchronously and does NOT block, so waiting for the batch
        // to land means polling ns.isRunning() on that PID. Blocking here is what makes the
        // hack/grow/weaken cycle strictly sequential - only one operation is ever in flight.
        while (ns.isRunning(currentPid)) {
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
 * Provides terminal tab-completion for the target argument.
 * Called by the game (not by this script), which is why it is a plain sync export taking
 * AutocompleteData rather than ns. Already-typed servers are filtered out of the suggestions.
 * @param {AutocompleteData} data - Game context, including data.servers
 * @param {string[]} args - Current arguments already typed on the command line
 * @returns {string[]} Server hostnames not yet present in args
 */
export function autocomplete(data, args) {
  const servers = data.servers;
  const serversWithArgsRemoved = servers.filter((server) => !args.includes(server));

  return serversWithArgsRemoved;
}