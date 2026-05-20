import * as targeting from "./lib/targeting.js";
import { getAvailableThreads } from "./lib/util.js";

/** @param {NS} ns */
export async function start(ns, scriptHost, targetMode) {
    // handle args
    const target = targeting.getTarget(ns, targetMode);

    // load config
    const cfg = JSON.parse(ns.read("./data/cfg.json"));
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

    // array that holds PID of child scripts - to cull on exit
    let childArr = [];

    // Counters
    let weakCount = 0;
    let growCount = 0;
    let hackCount = 0;

    // Cleanup - kill child processes and print report
    ns.atExit(() => {
        for (const p of childArr) {
            ns.kill(p);
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

        await ns.sleep(2000);

        // prune finished child processes from array
        childArr = childArr.filter(pid => ns.isRunning(pid));

        // If security is above threshold, weaken it
        if (currentSec > securityThreshActual) {
            const script = "weaken.js";
            const securityToReduce = currentSec - securityThreshActual;
            const maxWeakenThreads = Math.ceil(securityToReduce / weakenPerThread);
            const threads = Math.min(getAvailableThreads(ns, scriptHost, script), maxWeakenThreads);

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
            const script = "grow.js";
            const safeMoney = Math.max(currentMoney, 1);
            const growMultiplier = (maxMoney * cfg.moneyThresh) / safeMoney;
            const maxGrowThreads = Math.ceil(ns.growthAnalyze(target, growMultiplier));
            const availableThreads = getAvailableThreads(ns, scriptHost, script);
            const threads = Math.min(availableThreads, maxGrowThreads);

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
            const script = "hack.js";
            const maxHackThreads = Math.floor(1 / ns.hackAnalyze(target));
            const threads = Math.min(getAvailableThreads(ns, scriptHost, script), maxHackThreads);

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
}

// Executes the given script on scriptHost targeting target
export async function execute(ns, target, threads, script, scriptHost, childArr, state) {
    ns.disableLog("ALL");

    if (threads < 1) {
        if (!state.waiting) {
            ns.print("\nInsufficient RAM. Waiting...\n");
            state.waiting = true;
        }
        await ns.sleep(3000);
        return false;
    }

    const pid = ns.exec(script, scriptHost, threads, target);
    if (pid !== 0) {
        childArr.push(pid);
        ns.print(`Ran ${script} [${pid}] with ${threads} threads on ${scriptHost} targeting ${target}`);
        return true;
    }
    return false;
}