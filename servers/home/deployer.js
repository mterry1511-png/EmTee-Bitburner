import * as targeting from "./lib/targeting.js";
import { getAvailableThreads } from "./lib/util.js";
import * as format from "./lib/format.js";

// Script paths for the three HGW phases. These strings are used for THREE separate
// purposes and must stay identical across all of them:
//   1. the `phase` value (so `phase` IS the script path - no lookup table needed to exec it),
//   2. the keys of TIME_FN and `counts` below,
//   3. the exact path handed to ns.exec / ns.getScriptRam.
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

/**
 * Terminal/exec entry point for a single deployer instance.
 * Parses args, positions its tail window, then hands off to start() which never returns.
 * One deployer owns exactly ONE target; dispatch.js launches one instance per ranked target.
 *
 * The 1000ms startup sleep is deliberate: dispatch.js staggers its ns.exec calls so
 * deployers don't all wake and start reserving RAM in the same instant (the RAM-spike
 * problem the staggering commit addressed). This sleep is the deployer's half of that
 * handshake - it gives the launching dispatch.js time to finish and release its own RAM.
 * @param {NS} ns - The Netscript API object
 * @param {string} [ns.args[0]="home"] - scriptHost: the server the HGW threads run ON
 * @param {string} [ns.args[1]="best"] - targetMode: a targeting.knownModes value, or a raw hostname
 * @param {string|null} [ns.args[2]=null] - target: explicit hostname, bypassing targetMode resolution
 * @returns {Promise<void>} Never resolves in practice - start() loops forever
 */
export async function main(ns) {
    const scriptHost = ns.args[0] ?? "home";
    const targetMode = ns.args[1] ?? "best";
    const target = ns.args[2] ?? null;

    ns.disableLog("disableLog");
    ns.disableLog("sleep");

    // open tail by default
    // ns.ui.openTail();               // if tail wants opening
    ns.ui.setTailMinimized(true);   // true: min, false: max
    ns.ui.moveTail(1420, 450);

    await ns.sleep(100);               // allows dispatch to end and frees up RAM
    await start(ns, scriptHost, targetMode, target);
}

/**
 * Runs the sequential HGW control loop against a single target, forever.
 *
 * This is a *sequential* (non-batched) HGW driver, not a batcher: exactly one of
 * WEAKEN/GROW/HACK is in flight at a time, and the phase is not re-assessed until the
 * current phase's running threads and backlog both reach zero. That ordering guarantee
 * is the whole point - it costs idle time between phases but means effects always land
 * in the intended order. The planned batcher (see CLAUDE.md) is the eventual replacement.
 *
 * Each tick (1s) the loop:
 *   1. reaps finished child PIDs and sums the threads still running,
 *   2. reads live security/money once (shared by every step below),
 *   3. picks a phase if - and only if - the previous phase is fully clear,
 *   4. recomputes the GROW/HACK backlog from that live state,
 *   5. launches as much of the backlog as free RAM currently allows.
 *
 * NOTE: step 5 is a check-RAM-then-exec race - getAvailableThreads() reads free RAM and
 * ns.exec() consumes it a moment later, with nothing stopping another deployer from taking
 * that RAM in between. Every deployer instance races every other one. Eliminating this is
 * the reason the centralised scheduler exists (see CLAUDE.md "Scheduler").
 *
 * @param {NS} ns - The Netscript API object
 * @param {string} scriptHost - The server the weaken/grow/hack threads are exec'd on
 * @param {string} targetMode - A targeting.knownModes value ("best"/"ranked"/"easy"/"hacklvl"), or a raw hostname used verbatim
 * @param {string|null} [target=null] - Explicit target hostname; when null, resolved from targetMode
 * @returns {Promise<void>} Never resolves - loops until the script is killed
 */
export async function start(ns, scriptHost, targetMode, target = null) {
    // Resolve which server we're attacking. An explicit `target` arg always wins; otherwise
    // targetMode is interpreted as a targeting mode if it's a known one, else taken literally
    // as a hostname. "ranked" returns an ARRAY of hostnames, so collapse it to the top entry -
    // a deployer only ever drives one target.
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

    // Config is read ONCE here, not per tick - so cfg.json edits made while a deployer is
    // running won't be picked up until it's restarted (dispatch.js kills and relaunches).
    const cfg = JSON.parse(ns.read("/data/cfg.json"));
    const maxMoney = ns.getServerMaxMoney(target);
    // cfg.moneyThresh is a FRACTION of max money (e.g. 0.75), not an absolute amount.
    const moneyThresh = cfg.moneyThresh * maxMoney;

    // cfg.securityThresh is an allowance ABOVE the server's floor, not an absolute level -
    // so the real threshold has to be computed per target from its own minimum difficulty.
    const minDifficulty = targeting.getMinDifficulty(ns, target);
    if (minDifficulty === null) return;     // target absent from networks.json - nothing to do
    const securityThreshActual = minDifficulty + cfg.securityThresh;

    // Security reduction from one weaken thread. Flat and target-independent, but the WEAKEN
    // backlog is still recomputed every tick (like grow/hack - see below), so it self-corrects
    // if something else raises security mid-phase instead of trusting a phase-entry estimate.
    const weakenPerThread = ns.weakenAnalyze(1);

    ns.disableLog("ALL");

    let childArr = [];   // {pid, script, threads} for the CURRENTLY ACTIVE phase only
    // Backlog of threads owed to the target but not yet launched due to RAM scarcity.
    // Recomputed every tick from live server state for all three phases (see below) rather
    // than fixed at phase entry, since each phase's own batches move the state its thread-count
    // formula depends on as they land mid-phase.
    let queue = 0;
    // Only one of WEAKEN/GROW/HACK may be in flight at a time - phase is not
    // reassessed until the current phase's running threads and queue both hit zero.
    // This guarantees HGW effects land in the order intended, at the cost of
    // some idle time between phases (acceptable for this basic version).
    let phase = null;
    // Lifetime launch tally per phase, reported by the atExit handler below.
    const counts = { [WEAKEN]: 0, [GROW]: 0, [HACK]: 0 };

    // Kill this deployer's own children when it dies, so a restart doesn't leave orphaned
    // hgw threads squatting on scriptHost's RAM. Only the CURRENTLY ACTIVE phase's PIDs are
    // in childArr, which is safe here precisely because phases never overlap.
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
        // Reap: drop any child whose PID has exited. This is the ONLY thing that lowers
        // runningThreads, and therefore the only thing that lets a phase ever go clear.
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
                // NOTE: queue is deliberately NOT set here - like GROW/HACK below, the recompute
                // block derives it from live state later in this same tick, which is what lets
                // WEAKEN's queue reach zero once security actually hits the floor.
                statusLine = `\nSecurity too high - ${currentSec.toFixed(2)} (current) > ${securityThreshActual.toFixed(2)} (threshold)`;
            } else if (currentMoney < moneyThresh) {
                phase = GROW;
                // NOTE: queue is deliberately NOT set here. The recompute block below runs
                // later in this same tick and derives it from live state, so setting it here
                // would be immediately overwritten. Same for the WEAKEN and HACK branches.
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

        // --- Recompute the active phase's remaining thread requirement from live state, every tick ---
        // All three phases move server state their own thread-count formula depends on
        // (weaken/grow lower security and raise money respectively, hack lowers money and
        // raises security as a side effect, which feeds back into hack's steal-fraction-per-
        // thread). A queue number fixed at phase entry goes stale as batches land mid-phase -
        // causing WEAKEN to never clear once its phase-entry estimate is met, GROW to overshoot
        // (dispatching threads after the goal is already met), and HACK to slightly undershoot.
        // Recomputing "total still needed" from current state each tick and subtracting what's
        // already running keeps the backlog honest against reality instead of a stale estimate.
        if (phase === WEAKEN) {
            const securityToReduce = Math.max(0, currentSec - securityThreshActual);
            const stillNeeded = Math.ceil(securityToReduce / weakenPerThread);
            queue = Math.max(0, stillNeeded - runningThreads);
        } else if (phase === GROW) {
            const safeMoney = Math.max(currentMoney, 1);
            let growMultiplier = (maxMoney * cfg.moneyThresh) / safeMoney;
            if (growMultiplier <= 1) {growMultiplier = 1}       //growthanalyze needs min 1
            const stillNeeded = Math.ceil(ns.growthAnalyze(target, growMultiplier));
            queue = Math.max(0, stillNeeded - runningThreads);
        } else if (phase === HACK) {
            const targetHackFraction = cfg.targetHackFraction ?? 0.05;
            const stillNeeded = Math.max(1, Math.floor(targetHackFraction / ns.hackAnalyze(target)));
            queue = Math.max(0, stillNeeded - runningThreads);
        }

        // --- Drain backlog for the active phase only, using whatever RAM is free right now ---
        // getAvailableThreads() already subtracts cfg.leaveRamFree, so the headroom the user
        // reserved for manual work is respected without doing the arithmetic here.
        //
        // RACE: the free-RAM reading below and the ns.exec that spends it are not atomic.
        // Any other deployer (or anything else on scriptHost) can take that RAM in between,
        // in which case ns.exec returns 0 and the launch is silently skipped for this tick.
        // The pid !== 0 guard is what stops a failed launch being recorded as a real one.
        //
        // `queue` IS decremented here by the threads just launched. Not load-bearing for
        // correctness - the recompute block above rebuilds `queue` from live state every tick
        // regardless - but it keeps the "still queued" figure in the log line below accurate
        // for the remainder of THIS tick, rather than showing the pre-launch count.
        let launchedThisTick = false;
        if (queue > 0) {
            const available = getAvailableThreads(ns, scriptHost, phase);
            if (available >= 1) { // else: no room at all, backlog stays put and is retried next tick
                const threads = Math.min(available, queue);
                const pid = ns.exec(phase, scriptHost, threads, target);
                if (pid !== 0) {
                    childArr.push({ pid, script: phase, threads });
                    counts[phase]++;
                    queue -= threads;
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