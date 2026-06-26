import * as targeting from "./lib/targeting.js";

/**
 * @param {NS} ns - The Netscript API object
 */
export async function main(ns) {
    // handle args
    const scriptHost = ns.args[0] ?? "home";
    const targetMode = ns.args[1] ?? "ranked";

    // pass for help
    if (ns.args.includes("help")) {
        printUsage(ns);
        return;
    }

    // Load config
    const cfg = JSON.parse(ns.read("./data/cfg.json"));

    // Load config - max servers
    const maxServers = cfg.targetRequirements.maxDispatchServers;
    if (!maxServers || maxServers < 1) {
        ns.tprint("Error: maxDispatchServers not set or invalid in cfg.json. Exiting.");
        return;
    }

    // Load config - min servers
    const minServers = cfg.targetRequirements.minDispatchServers ?? 1;
    const allTargets = targeting.getTarget(ns, "ranked");

    //Trim targets arr if required
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


        // launch a deployer for each target
        for (const target of targets) {
            // wait for RAM if we haven't hit minimum yet
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

            // Dispatch then wait for loop
            ns.exec("deployer.js", scriptHost, 1, scriptHost, "best", target);
            launched++;
            await ns.sleep(500);
        }

        // report success
        const success = `Launched ${launched} of ${targets.length} deployers.\n          dispatch.js finished.`;
        ns.tprint(success);
        ns.print(success);
    }
    else {
        // single target behaviour
        ns.exec("deployer.js", scriptHost, 1, scriptHost, targetMode);
    }
}


/**
 * @param {NS} ns - The Netscript API object
 */
function printUsage(ns) {
    ns.tprint("=== dispatch.js ===");
    ns.tprint("Launches deployer instances to hack targets based on targeting mode.");
    ns.tprint("");
    ns.tprint("Usage: run dispatch.js [scriptHost] [targetMode]");
    ns.tprint("");
    ns.tprint("Recommended Usage: run dispatch.js       // This runs defaults]");
    ns.tprint("");
    ns.tprint("Arguments:");
    ns.tprint("  scriptHost  - Server to run deployer and hack scripts from. Default: home");
    ns.tprint("  targetMode  - Targeting mode. Default: ranked");
    ns.tprint("");
    ns.tprint("Modes:");
    ns.tprint("  ranked  - Launches one deployer per hackable server, ordered by $/sec");
    ns.tprint("  best    - Launches a single deployer against the highest value target");
    ns.tprint("  easy    - Launches a single deployer against n00dles");
    ns.tprint("");
    ns.tprint("Examples:");
    ns.tprint("  run dispatch.js home ranked");
    ns.tprint("  run dispatch.js cloud best")
}