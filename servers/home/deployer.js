import * as targeting from "./lib/targeting.js";
import { getAvailableThreads } from "./lib/util.js";
import * as format from "./lib/format.js";

const WEAKEN = "./lib/hgw/weaken.js";
const GROW = "./lib/hgw/grow.js";
const HACK = "./lib/hgw/hack.js";

export async function main(ns) {
    const scriptHost = ns.args[0] ?? "home";
    const targetMode = ns.args[1] ?? "best";
    const target = ns.args[2] ?? null;
    await start(ns, scriptHost, targetMode, target);
}

export async function start(ns, scriptHost, targetMode, target = null) {
    target = target ?? targeting.getTarget(ns, targetMode);

    const cfg = JSON.parse(ns.read("/data/cfg.json"));
    const maxMoney = ns.getServerMaxMoney(target);
    const moneyThresh = cfg.moneyThresh * maxMoney;

    const minDifficulty = targeting.getMinDifficulty(ns, target);
    if (minDifficulty === null) return;
    const securityThreshActual = minDifficulty + cfg.securityThresh;

    const weakenPerThread = ns.weakenAnalyze(1);

    ns.disableLog("ALL");

    let childArr = [];
    // Backlog of threads owed to the target but not yet launched due to RAM scarcity.
    // Persists across ticks instead of being silently recomputed away.
    const queue = { [WEAKEN]: 0, [GROW]: 0, [HACK]: 0 };
    const counts = { [WEAKEN]: 0, [GROW]: 0, [HACK]: 0 };

    ns.atExit(() => {
        for (const child of childArr) ns.kill(child.pid);
        ns.print(" ");
        ns.print("* Hack on " + target + " terminated");
        ns.print("* Run Counts *");
        ns.print(`weaken.js: ${counts[WEAKEN]}`);
        ns.print(`grow.js: ${counts[GROW]}`);
        ns.print(`hack.js: ${counts[HACK]}`);
        ns.print(" ");
    });

    let lastStatus = null;          // STOPS REPEATED OUTPUTS

    while (true) {
        const currentSec = ns.getServerSecurityLevel(target);
        const currentMoney = ns.getServerMoneyAvailable(target);

        childArr = childArr.filter(child => ns.isRunning(child.pid));
        const runningThreads = (script) =>
            childArr.filter(c => c.script === script).reduce((s, c) => s + c.threads, 0);

        // --- Work out this tick's desired total for the active phase, top up the backlog if the deficit grew ---
        let statusLine;

        if (currentSec > securityThreshActual) {
            const securityToReduce = currentSec - securityThreshActual;
            const desired = Math.ceil(securityToReduce / weakenPerThread);
            const owed = desired - runningThreads(WEAKEN) - queue[WEAKEN];
            if (owed > 0) queue[WEAKEN] += owed;
            statusLine = `Security too high - ${currentSec} (current) > ${securityThreshActual} (threshold)`;
        } else if (currentMoney < moneyThresh) {
            const safeMoney = Math.max(currentMoney, 1);
            const growMultiplier = (maxMoney * cfg.moneyThresh) / safeMoney;
            const desired = Math.ceil(ns.growthAnalyze(target, growMultiplier));
            const owed = desired - runningThreads(GROW) - queue[GROW];
            if (owed > 0) queue[GROW] += owed;
            statusLine = "Money too low - " + format.money(currentMoney) + " (current) < " + format.money(moneyThresh) + " (threshold)";
        } else {
            const targetHackFraction = cfg.targetHackFraction ?? 0.05;
            const desired = Math.max(1, Math.floor(targetHackFraction / ns.hackAnalyze(target)));
            const owed = desired - runningThreads(HACK) - queue[HACK];
            if (owed > 0) queue[HACK] += owed;
            statusLine = "Optimal hack conditions met";
        }

        // --- Drain backlog in priority order using whatever RAM is free right now ---
        for (const script of [WEAKEN, GROW, HACK]) {
            if (queue[script] <= 0) continue;

            const available = getAvailableThreads(ns, scriptHost, script);
            if (available < 1) continue; // still no room, stays queued, retried next tick

            const threads = Math.min(available, queue[script]);
            const pid = ns.exec(script, scriptHost, threads, target);
            if (pid !== 0) {
                childArr.push({ pid, script, threads });
                queue[script] -= threads;
                counts[script]++;
                ns.print(`Ran ${script} [${pid}] with ${threads} threads on ${scriptHost} targeting ${target} (${queue[script]} still queued)`);
            }
        }

        // ...
        if (statusLine !== lastStatus) {
            ns.print(statusLine);
            lastStatus = statusLine;
        }
        await ns.sleep(1000);
    }
}