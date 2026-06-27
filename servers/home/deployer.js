import * as targeting from "./lib/targeting.js";
import { getAvailableThreads } from "./lib/util.js";

/**
 * @param {NS} ns - The Netscript API object
 */
export async function main(ns) {
    const scriptHost = ns.args[0] ?? "home";
    const targetMode = ns.args[1] ?? "best";
    const target = ns.args[2] ?? null;
    await start(ns, scriptHost, targetMode, target);
}

/**
 * @param {NS} ns - The Netscript API object
 * @param {string} scriptHost - The host server to run hack operations from
 * @param {string} targetMode - The targeting mode (best, ranked, hacklvl, easy)
 * @param {string} [target=null] - Optional target server hostname
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

    // hoisted - pure calculation, doesn't change per iteration
    const weakenPerThread = ns.weakenAnalyze(1);

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
            const script = "./hgw/weaken.js";
            const securityToReduce = currentSec - securityThreshActual;
            const maxWeakenThreads = Math.ceil(securityToReduce / weakenPerThread);
            const neededThreads = maxWeakenThreads - runningThreads(script);
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

        // If money is below threshold, grow it
        else if (currentMoney < moneyThresh) {
            const script = "./hgw/grow.js";
            const safeMoney = Math.max(currentMoney, 1);
            const growMultiplier = (maxMoney * cfg.moneyThresh) / safeMoney;
            const maxGrowThreads = Math.ceil(ns.growthAnalyze(target, growMultiplier));
            const availableThreads = getAvailableThreads(ns, scriptHost, script);
            const neededThreads = maxGrowThreads - runningThreads(script);
            const threads = Math.min(availableThreads, neededThreads);

            const success = await execute(ns, target, threads, script, scriptHost, childArr, state);
            if (success) {
                state.waiting = false;
                growCount++;
            }
            if (!state.waiting) {
                ns.print(`Money too low - ${currentMoney} (current) < ${moneyThresh} (threshold)`);
            }
        }

        // Otherwise, hack it
        else {
            const script = "./hgw/hack.js";
            const targetHackFraction = cfg.targetHackFraction ?? 0.05;
            const maxHackThreads = Math.max(1, Math.floor(targetHackFraction / ns.hackAnalyze(target)));
            const neededThreads = maxHackThreads - runningThreads(script);
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

        // sleep to not overload the server with requests
        await ns.sleep(1000);
    }
}

// Executes the given script on scriptHost targeting target
export async function execute(ns, target, threads, script, scriptHost, childArr, state) {
    ns.disableLog("ALL");

    // Catch error ( divde by 0 threads)
    if (threads < 1) {
        if (!state.waiting) {
            ns.print("\nInsufficient RAM. Waiting...\n");
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

        // after exec, wait for the childen to finish before looping
        // while (childArr.some(pid => ns.isRunning(pid))) {
        //     await ns.sleep(3000);
        // }

        // flags success back to main loop
        return true;
    }
    return false;
}
