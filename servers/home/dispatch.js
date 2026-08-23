import * as targeting from "./lib/targeting.js";
import { scanCloud } from "./scanner.js";

/**
 * Kills every dispatch.js and deployer.js process on the given host, excluding self.
 *
 * Deliberately PID-based (ns.ps + ns.kill(pid)) rather than ns.kill(filename, host, ...args):
 * a filename kill only matches when the launch args match exactly, and deployers are launched
 * with per-target args that the caller here does not know. Enumerating PIDs sidesteps that.
 * The `proc.pid !== ns.pid` guard is the self-kill guard - without it, dispatch.js would kill
 * itself the moment it tried to clear the host it is running on.
 *
 * Also exported for and used by dispatchall.js.
 * @param {NS} ns - The Netscript API object
 * @param {string} host - The host to clear of dispatch/deployer processes
 * @returns {void}
 */
export function killHacks(ns, host) {
    for (const proc of ns.ps(host)) {
        if ((proc.filename === "dispatch.js" || proc.filename === "deployer.js") && proc.pid !== ns.pid) {
            ns.kill(proc.pid);
        }
    }
}

/**
 * Launches deployer.js instances against hack targets, one deployer per target.
 *
 * Two modes:
 *   - "ranked" (default): pulls the $/sec-ordered target list from targeting.getTarget, trims
 *     it to cfg.targetRequirements.maxDispatchServers, and launches one deployer per target,
 *     staggered, on scriptHost. Aborts early if fewer than minDispatchServers targets exist.
 *   - anything else: treated as a single target/mode and forwarded verbatim to one deployer.
 *
 * Unless `dupe` is set, it first clears scriptHost of existing dispatch/deployer processes so
 * repeated runs replace rather than stack.
 *
 * NOTE: the ranked loop reads free RAM and then ns.exec's a deployer - the check-then-exec
 * race. Nothing prevents another process consuming that RAM in between, in which case the
 * exec silently fails and `launched` is still incremented. This is the specific problem the
 * planned scheduler replaces dispatch.js to solve (see CLAUDE.md "Scheduler").
 *
 * @param {NS} ns - The Netscript API object
 * @param {string} [ns.args[0]="home"] - scriptHost: server the deployers (and their hgw threads) run on
 * @param {string} [ns.args[1]="ranked"] - targetMode: "ranked", another targeting mode, or a raw hostname
 * @param {string} [ns.args[2]="false"] - dupe: "true" skips killing existing dispatch/deployer instances
 * @returns {Promise<void>}
 */
export async function main(ns) {
    // handle args
    const scriptHost = ns.args[0] ?? "home";
    const targetMode = ns.args[1] ?? "ranked";
    // Terminal args always arrive as STRINGS, so "false" would be truthy under a bare
    // truthiness check. Stringify-lowercase-compare is the correct form.
    const dupe = String(ns.args[2] ?? false).toLowerCase() === "true";

    // pass for help
    if (ns.args.includes("help")) {
        printUsage(ns);
        return;
    }
    // Refresh clouds.json so scriptHost is definitely known if it's a newly-purchased cloud.
    scanCloud(ns, true);
    const clouds = JSON.parse(ns.read("/data/clouds.json"));    // unused below - see findings

    // Stops dispatch.js and deployer.js instances on scriptHost only, unless flagged for dupe
    // (ns.args[2]). The 2s sleep lets the game actually reclaim the killed processes' RAM
    // before the availability checks below read it - kills are not instantaneous.
    if (!dupe) {
        killHacks(ns, scriptHost);
        await ns.sleep(2000);
    }



    // Load config
    const cfg = JSON.parse(ns.read("/data/cfg.json"));

    // Load config - max servers
    const maxServers = cfg.targetRequirements.maxDispatchServers;
    // ns.tprint(maxServers);
    if (!maxServers || maxServers < 1) {
        ns.tprint("Error: maxDispatchServers not set or invalid in cfg.json. Exiting.");
        return;
    }

    // Load config - min servers. Floor below which dispatching isn't worth doing at all;
    // also the point at which the RAM-wait loop below gives up rather than blocking forever.
    const minServers = cfg.targetRequirements.minDispatchServers ?? 1;
    // Always fetched in "ranked" mode regardless of targetMode - the single-target branch at
    // the bottom doesn't use this list at all.
    const allTargets = targeting.getTarget(ns, "ranked");

    // Trim to the max we're willing to run; allTargets is kept intact for the "N of M" print.
    const targets = allTargets.slice(0, maxServers);
    // Catch error
    if (allTargets.length < minServers) {
        ns.tprint(`Error: Only ${allTargets.length} valid targets found, minimum is ${minServers}. Exiting.`);
        return;
    }

    // get target based on targetMode  - needed as array is returned in case of "ranked"
    if (targetMode === "ranked") {
        // get ranked list of hostnames - slice depending on maxServers
        // but keep allTargets for reference in print

        if (!targets || targets.length === 0) {
            ns.tprint("No valid targets found. Exiting.");
            return;
        }

        ns.tprint(`Launching deployers for ${targets.length} of ${allTargets.length} available targets on ${scriptHost}`);
        ns.tprint('Adjust min/max in ./data/cfg\n')

        // track the copies of deployers.js dispatched for ensuring cfg.minDispatchServers servers is met
        let launched = 0;


        // Launch a deployer for each target, in rank order (highest $/sec first).
        for (const target of targets) {
            // Block until there's room for one more deployer - but only while we're still
            // short of minDispatchServers. Past the minimum, a RAM shortage means "good
            // enough, stop here" rather than "wait indefinitely", so the loop returns instead.
            while (true) {
                const availableRam = ns.getServerMaxRam(scriptHost) - ns.getServerUsedRam(scriptHost) - cfg.leaveRamFree;
                const deployerRam = ns.getScriptRam("deployer.js", scriptHost);

                if (availableRam >= deployerRam) break;

                if (launched >= minServers) {
                    ns.tprint(`RAM limit reached - launched ${launched} of ${targets.length} deployers.\n`);
                    return;
                }

                ns.tprint(`Waiting for ${scriptHost} RAM to launch deployers. ${minServers - launched} left to minimum:`);;
                await ns.sleep(5000);
            }

            // Dispatch then wait - stagger launches so deployers don't all wake up and start
            // reserving RAM simultaneously.
            //
            // Args: (script, host, threads, scriptHost, targetMode, target). "best" is passed
            // as targetMode but is IGNORED by the deployer, because an explicit `target` is
            // also supplied and an explicit target always wins over mode resolution.
            ns.exec("deployer.js", scriptHost, 1, scriptHost, "best", target);
            launched++;
            await ns.sleep(500);
        }

        // report success
        const success = `Launched ${launched} of ${targets.length} deployers.\ndispatch.js finished.`;
        ns.tprint(success);
        ns.print(success);
    }
    else {
        // Single-target behaviour: forward targetMode straight through as the deployer's
        // targetMode arg with no explicit target, so the deployer resolves it itself -
        // whether it's a known mode ("best"/"easy"/"hacklvl") or a raw hostname.
        ns.exec("deployer.js", scriptHost, 1, scriptHost, targetMode);
        ns.print("Deployed on target '" + targetMode + ".");
    }
}


/**
 * Prints the dispatch script usage and supported targeting modes.
 * @param {NS} ns - The Netscript API object
 * @returns {void}
 */
function printUsage(ns) {
    ns.tprint("=== dispatch.js ===");
    ns.tprint("Launches deployer instances to hack targets based on targeting mode.");
    ns.tprint("");
    ns.tprint("Usage: run dispatch.js [scriptHost] [targetMode|targetHost] [dupe]");
    ns.tprint("");
    ns.tprint("Recommended Usage: run dispatch.js       // This runs defaults");
    ns.tprint("");
    ns.tprint("Arguments:");
    ns.tprint("  scriptHost  - Server to run deployer and hack scripts from. Default: home");
    ns.tprint("  targetMode  - Targeting mode or raw hostname. Default: ranked");
    ns.tprint("  dupe        - Skip killing existing dispatch.js/deployer.js instances. Default: false");
    ns.tprint("");
    ns.tprint("Modes:");
    ns.tprint("  ranked  - Launches one deployer per hackable server, ordered by $/sec");
    ns.tprint("  best    - Launches a single deployer against the highest value target");
    ns.tprint("  easy    - Launches a single deployer against n00dles");
    ns.tprint("  <hostname> - Uses the hostname directly as the target");
    ns.tprint("");
    ns.tprint("Examples:");
    ns.tprint("  run dispatch.js home ranked");
    ns.tprint("  run dispatch.js cloud best true")
}