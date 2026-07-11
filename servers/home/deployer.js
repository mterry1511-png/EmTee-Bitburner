import * as targeting from "./lib/targeting.js";
import { getAvailableThreads } from "./lib/util.js";
import * as format from "./lib/format.js";

/**
 * Entry point that starts a deployer against the requested host and mode.
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
 */
export async function main(ns) {
    const scriptHost = ns.args[0] ?? "home";
    const targetMode = ns.args[1] ?? "best";
    const target = ns.args[2] ?? null;
    await start(ns, scriptHost, targetMode, target);
}

/**
 * Runs the main loop that weakens, grows, or hacks a target as needed.
 * @param {NS} ns - The Netscript API object
 * @param {string} scriptHost - The host server to run hack operations from
 * @param {string} targetMode - The targeting mode (best, ranked, hacklvl, easy)
 * @param {string} [target=null] - Optional target server hostname
 * @returns {Promise<void>}
 */
export async function start(ns, scriptHost, targetMode, target = null) {
    // handle args
    target = target ?? targeting.getTarget(ns, targetMode);

    // load config
    const cfg = JSON.parse(ns.read("/data/cfg.json"));
    const maxMoney = ns.getServerMaxMoney(target);
    const moneyThresh = cfg.moneyThresh * maxMoney;

    // minDifficulty called from targeting to reduce accessing networks.json here
    const minDifficulty = targeting.getMinDifficulty(ns, target);
    if (minDifficulty === null) return;
    const securityThreshActual = minDifficulty + cfg.securityThresh;

    // hoisted - pure calculations, don't change per iteration
    const weakenPerThread = ns.weakenAnalyze(1);
    const growSecPerThread = ns.growthAnalyzeSecurity(1);

    // state as obj
    const state = { waiting: false };

    // we only want our ns.prints
    ns.disableLog("ALL");

    // loop vars
    let currentSec;
    let currentMoney;

    // Jobs currently running from this deployer, used to avoid over-queuing stale work.
    let childArr = [];

    // Counters
    let weakCount = 0;
    let growCount = 0;
    let hackCount = 0;

    // Cleanup - kill child processes and print report
    ns.atExit(() => {
        for (const child of childArr) {
            ns.kill(child.pid);
        }
        ns.print(" ");
        ns.print("* Hack on " + target + " terminated");
        ns.print("* Run Counts *");
        ns.print(`weaken.js: ${weakCount}`);
        ns.print(`grow.js: ${growCount}`);
        ns.print(`hack.js: ${hackCount}`);
        ns.print(" ");
    });

    // main loop - calls weaken, grow or hack as per simple HGW logic
    while (true) {
        // update server details
        currentSec = ns.getServerSecurityLevel(target);
        currentMoney = ns.getServerMoneyAvailable(target);

        // prune finished child processes from array
        childArr = childArr.filter(child => ns.isRunning(child.pid));

        const runningThreads = (script) =>
            childArr
                .filter(child => child.script === script)
                .reduce((sum, child) => sum + child.threads, 0);

        // If security is above threshold, weaken it
        if (currentSec > securityThreshActual) {
            const script = "./lib/hgw/weaken.js";
            const securityToReduce = currentSec - securityThreshActual;
            const maxWeakenThreads = Math.ceil(securityToReduce / weakenPerThread);
            const neededThreads = maxWeakenThreads - runningThreads(script);

            // Already have enough weaken queued - not a RAM problem, nothing to do this tick
            if (neededThreads <= 0) {
                state.waiting = false;
            } else {
                const threads = Math.min(getAvailableThreads(ns, scriptHost, script), neededThreads);

                const success = await execute(ns, target, threads, script, scriptHost, childArr, state);
                if (success) {
                    state.waiting = false;
                    weakCount++;
                }
                if (!state.waiting) {
                    ns.print(`Security too high - ${currentSec} (current) > ${securityThreshActual} (threshold)`);
                }
            }
        }

        // If money is below threshold, grow it
        else if (currentMoney < moneyThresh) {
            const script = "./lib/hgw/grow.js";
            const safeMoney = Math.max(currentMoney, 1);

            // Target full money, not just moneyThresh - the true ceiling for grow's usefulness
            const growMultiplier = maxMoney / safeMoney;
            const moneyCapThreads = Math.ceil(ns.growthAnalyze(target, growMultiplier));

            // Cap grow threads so they don't add more security than a full weaken pass
            // (using RAM currently available for weaken) could undo next cycle.
            const weakenCapacityThreads = getAvailableThreads(ns, scriptHost, "./lib/hgw/weaken.js");
            const securityCapThreads = Math.floor((weakenCapacityThreads * weakenPerThread) / growSecPerThread);

            const maxGrowThreads = Math.max(1, Math.min(moneyCapThreads, securityCapThreads));
            const neededThreads = maxGrowThreads - runningThreads(script);

            // Already have enough grow queued - not a RAM problem, nothing to do this tick
            if (neededThreads <= 0) {
                state.waiting = false;
            } else {
                const availableThreads = getAvailableThreads(ns, scriptHost, script);
                const threads = Math.min(availableThreads, neededThreads);

                const success = await execute(ns, target, threads, script, scriptHost, childArr, state);
                if (success) {
                    state.waiting = false;
                    growCount++;
                }
                if (!state.waiting) {
                    ns.print("Money too low - " + format.money(currentMoney) + "(current) < " + format.money(moneyThresh) + "(threshold)");
                }
            }
        }

        // Otherwise, hack it
        else {
            const script = "./lib/hgw/hack.js";
            const targetHackFraction = cfg.targetHackFraction ?? 0.05;
            const maxHackThreads = Math.max(1, Math.floor(targetHackFraction / ns.hackAnalyze(target)));
            const neededThreads = maxHackThreads - runningThreads(script);

            // Already have enough hack queued - not a RAM problem, nothing to do this tick
            if (neededThreads <= 0) {
                state.waiting = false;
            } else {
                const threads = Math.min(getAvailableThreads(ns, scriptHost, script), neededThreads);

                const success = await execute(ns, target, threads, script, scriptHost, childArr, state);
                if (success) {
                    state.waiting = false;
                    hackCount++;
                }
                if (!state.waiting) {
                    ns.print(`Optimal hack conditions met`);
                }
            }
        }

        // sleep to not overload the server with requests
        await ns.sleep(50);
    }
}

// Executes the given script on scriptHost targeting target
/**
 * Launches a single worker script on the chosen host and tracks its PID.
 * @param {NS} ns - The Netscript API object
 * @param {string} target - The hostname of the target server
 * @param {number} threads - The number of worker threads to launch
 * @param {string} script - The worker script path to execute
 * @param {string} scriptHost - The server to run the worker on
 * @param {Array<object>} childArr - The currently running child process records
 * @param {object} state - Shared execution state for waiting and control flow
 */
export async function execute(ns, target, threads, script, scriptHost, childArr, state) {
    ns.disableLog("ALL");

    // Catch error (genuine RAM scarcity - threads < 1 here now only ever means "not enough free RAM")
    if (threads < 1) {
        if (!state.waiting) {
            const maxRam = ns.getServerMaxRam(scriptHost);
            const usedRam = ns.getServerUsedRam(scriptHost);
            ns.print(`\nInsufficient RAM. maxRam=${maxRam} usedRam=${usedRam} leaveRamFree=${JSON.parse(ns.read("/data/cfg.json")).leaveRamFree} scriptRam=${ns.getScriptRam(script, scriptHost)} threadsNeeded=${threads}\n`);
            state.waiting = true;
        }
        await ns.sleep(3000);
        return false;
    }

    // hold pid of executed scripts
    const pid = ns.exec(script, scriptHost, threads, target);
    if (pid !== 0) {
        childArr.push({ pid, script, threads });
        ns.print(`Ran ${script} [${pid}] with ${threads} threads on ${scriptHost} targeting ${target}`);
        return true;
    }
    return false;
}