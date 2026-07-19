import * as targeting from "./lib/targeting.js";
import { getAvailableThreads } from "./lib/util.js";
import * as format from "./lib/format.js";

const WEAKEN = "./lib/hgw/weaken.js";
const GROW = "./lib/hgw/grow.js";
const HACK = "./lib/hgw/hack.js";

// Maps each phase's script path to the ns function that reports its duration for a given target.
// Duration depends only on target/security, NOT thread count - thread count scales magnitude, not time.
const TIME_FN = {
    [WEAKEN]: (ns, target) => ns.getWeakenTime(target),
    [GROW]: (ns, target) => ns.getGrowTime(target),
    [HACK]: (ns, target) => ns.getHackTime(target),
};

export async function main(ns) {
    const scriptHost = ns.args[0] ?? "home";
    const targetMode = ns.args[1] ?? "best";
    const target = ns.args[2] ?? null;

    ns.disableLog("disableLog");
    ns.disableLog("sleep");

    // open tail by default
    ns.ui.openTail();
    ns.ui.setTailMinimized(true); // true: min, false: max
    ns.ui.moveTail(1420, 450);

    await ns.sleep(1500);               // allows dispatch to end and frees up RAM
    await start(ns, scriptHost, targetMode, target);
}

export async function start(ns, scriptHost, targetMode, target = null) {
    if (target === null) {
        if (targeting.knownModes.includes(targetMode)) {
            target = targeting.getTarget(ns, targetMode);
            if (Array.isArray(target)) {
                target = target[0];
            }
        } else {
            target = targetMode;
        }
    }

    const cfg = JSON.parse(ns.read("/data/cfg.json"));
    const maxMoney = ns.getServerMaxMoney(target);
    const moneyThresh = cfg.moneyThresh * maxMoney;

    const minDifficulty = targeting.getMinDifficulty(ns, target);
    if (minDifficulty === null) return;
    const securityThreshActual = minDifficulty + cfg.securityThresh;

    const weakenPerThread = ns.weakenAnalyze(1);

    ns.disableLog("ALL");

    let childArr = [];   // {pid, script, threads} for the CURRENTLY ACTIVE phase only
    // Backlog of threads owed to the target but not yet launched due to RAM scarcity.
    // For GROW/HACK this is recomputed every tick from live server state (see below) rather
    // than fixed at phase entry, since grow/hack both move the server state that determines
    // how many threads are still actually needed as their own batches land mid-phase.
    // WEAKEN's queue is NOT recomputed - its per-thread effect is flat and state-independent,
    // so the phase-entry estimate stays accurate for the whole phase.
    let queue = 0;
    // Only one of WEAKEN/GROW/HACK may be in flight at a time - phase is not
    // reassessed until the current phase's running threads and queue both hit zero.
    // This guarantees HGW effects land in the order intended, at the cost of
    // some idle time between phases (acceptable for this basic version).
    let phase = null;
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

    let lastStatus = null;          // STOPS REPEATED OUTPUTS (phase-selection lines)
    let lastWaitLine = null;        // STOPS REPEATED OUTPUTS (waiting/stalled lines - tracked separately
    // since these two message types shouldn't dedupe against each other)
    let waitTickCount = 0;          // ticks without launching; print "Waiting" only after threshold

    while (true) {
        childArr = childArr.filter(child => ns.isRunning(child.pid));
        const runningThreads = childArr.reduce((s, c) => s + c.threads, 0);

        // Read live state once per tick - shared by phase selection below AND by the
        // GROW/HACK recompute step, so we don't pay for duplicate ns.* calls.
        const currentSec = ns.getServerSecurityLevel(target);
        const currentMoney = ns.getServerMoneyAvailable(target);

        // Current phase is only considered clear once nothing is running AND
        // nothing is left queued - this is what enforces the wait-before-switch behaviour.
        const phaseClear = phase === null || (runningThreads === 0 && queue === 0);

        // --- Work out the next phase, only once the previous phase has fully resolved ---
        if (phaseClear) {
            let statusLine;
            if (currentSec > securityThreshActual) {
                phase = WEAKEN;
                const securityToReduce = currentSec - securityThreshActual;
                queue = Math.ceil(securityToReduce / weakenPerThread);
                statusLine = `\nSecurity too high - ${currentSec.toFixed(2)} (current) > ${securityThreshActual.toFixed(2)} (threshold)`;
            } else if (currentMoney < moneyThresh) {
                phase = GROW;
                // queue is set here for the FIRST tick of the phase; every tick after
                // (including this one, redundantly but harmlessly) it's overwritten by
                // the recompute block below using freshly-read state.
                statusLine = "\nMoney too low - " + format.money(currentMoney) + " (current) < " + format.money(moneyThresh) + " (threshold)";
            } else {
                phase = HACK;
                statusLine = "\nOptimal hack conditions met";
            }

            if (statusLine !== lastStatus) {
                ns.print(statusLine);
                lastStatus = statusLine;
            }
        }

        // --- Recompute GROW/HACK's remaining thread requirement from live state, every tick ---
        // Grow and hack both move the server state their own thread-count formula depends on
        // (grow raises money toward maxMoney, hack lowers it; both raise security as a side
        // effect which feeds back into hack's steal-fraction-per-thread). A queue number fixed
        // at phase entry goes stale as batches land mid-phase, causing GROW to overshoot
        // (dispatching threads after the goal is already met) and HACK to slightly undershoot.
        // Recomputing "total still needed" from current state each tick and subtracting what's
        // already running keeps the backlog honest against reality instead of a stale estimate.
        if (phase === GROW) {
            const safeMoney = Math.max(currentMoney, 1);
            const growMultiplier = (maxMoney * cfg.moneyThresh) / safeMoney;
            const stillNeeded = Math.ceil(ns.growthAnalyze(target, growMultiplier));
            queue = Math.max(0, stillNeeded - runningThreads);
        } else if (phase === HACK) {
            const targetHackFraction = cfg.targetHackFraction ?? 0.05;
            const stillNeeded = Math.max(1, Math.floor(targetHackFraction / ns.hackAnalyze(target)));
            queue = Math.max(0, stillNeeded - runningThreads);
        }

        // --- Drain backlog for the active phase only, using whatever RAM is free right now ---
        let launchedThisTick = false;
        if (queue > 0) {
            const available = getAvailableThreads(ns, scriptHost, phase);
            if (available >= 1) { // still no room, stays queued, retried next tick
                const threads = Math.min(available, queue);
                const pid = ns.exec(phase, scriptHost, threads, target);
                if (pid !== 0) {
                    childArr.push({ pid, script: phase, threads });
                    counts[phase]++;
                    launchedThisTick = true;
                    waitTickCount = 0;
                    const returnsIn = format.duration(TIME_FN[phase](ns, target));
                    ns.print(`\nRan ${phase} [${pid}] with ${threads} threads on ${scriptHost} targeting ${target}, returns in ${returnsIn} (${queue} still queued)`);
                }
            }
        }

        // Only print a "waiting" line after several ticks without launching - suppresses noise
        // from fleeting stalls between launches. Once we've stalled for 3+ ticks, report it.
        if (!launchedThisTick && phase !== null) {
            waitTickCount++;
            if (waitTickCount >= 3) {
                const waitLine = `\nWaiting for ${phase} to finish - ${runningThreads} running, ${queue} queued`;
                if (waitLine !== lastWaitLine) {
                    ns.print(waitLine);
                    lastWaitLine = waitLine;
                }
            }
        }

        await ns.sleep(1000);
    }
}