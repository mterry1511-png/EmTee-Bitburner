// ============================================================================
// singularity.js — WORK IN PROGRESS / ORPHAN. Read this before touching it.
//
// THE NAME IS WRONG. Despite the filename, this file does not make a single
// `ns.singularity.*` call and has NO SF4 dependency whatsoever. It is fully
// runnable today. The actual SF4 placeholder in this project is
// `watch/buyprograms.js`.
//
// What this file really is: a single-file, self-contained re-implementation of
// most of the toolkit. Network scanning, auto-nuking, target ranking, deployer
// dispatch, HGW worker management, server purchasing and a cloud push loop are
// all folded into one script, selected by `ns.args[0]` acting as a sub-command.
// Think of it as the "drop one file on a fresh BitNode and bootstrap from
// nothing" build rather than as part of the modular system.
//
// The self-exec trick that makes that possible: `main()` captures
// `ns.getScriptName()` and passes it down as `script`. When a sub-command needs
// a hack/grow/weaken worker it re-execs THIS SAME FILE with "hack"/"grow"/
// "weaken" as args[0], and the three early-return lines at the top of `main()`
// catch that and run the bare Netscript call. One file is therefore both the
// controller and the worker, with no scp of helper scripts required.
//
// MATURITY: orphaned. Nothing in the repo imports or execs it, and it
// duplicates `scanner.js`, `lib/util.js`'s `autoNuke`/`getAvailableThreads`,
// and the whole deployer stack — with behaviour that has already drifted from
// those (see the notes on `autoNuke` and `availableRam` below). Running it
// alongside the live toolkit would have both fighting for RAM and targets.
// ============================================================================

/**
 * Dispatch a sub-command from the terminal, or act as an HGW worker.
 *
 * Two distinct roles in one entry point. If args[0] is "hack", "grow" or
 * "weaken" this is a worker thread and it returns the bare Netscript call
 * immediately (the returned promise is awaited by the async function contract,
 * so the thread blocks for the full action duration as intended). Otherwise
 * args[0] selects one of the controller sub-commands from the switch below.
 *
 * `script` is this file's own name and is threaded through to every sub-command
 * that needs to launch a worker, because this file IS the worker - see the
 * header note on the self-exec trick.
 *
 * Unrecognised commands fall through to `printHelp` rather than erroring.
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void|number>} Void for controller commands; the money/security
 *   delta returned by ns.hack/grow/weaken when acting as a worker.
 */
export async function main(ns) {
    const script = ns.getScriptName();
    const command = String(ns.args[0] ?? "help").toLowerCase();
    const args = ns.args.slice(1);

    // Worker modes. These are what the deployer re-execs this file as.
    if (command === "hack") return ns.hack(args[0]);
    if (command === "grow") return ns.grow(args[0]);
    if (command === "weaken") return ns.weaken(args[0]);

    switch (command) {
        case "init":
            return init(ns);
        case "refresh":
            return refresh(ns);
        case "scan":
            return scanNetwork(ns, false);
        case "dispatch":
            return dispatch(ns, script, args);
        case "deployer":
            return deployer(ns, script, args[0] ?? "home", args[1] ?? "best", args[2] ?? null);
        case "target":
            return printTargets(ns, args[0] ?? "ranked");
        case "buy":
            return buyBestServer(ns, args[0] ?? "cloud");
        case "push":
            return pushLoop(ns, args[0] ?? "cloud");
        case "util":
            return util(ns, args);
        case "help":
        default:
            return printHelp(ns, script);
    }
}

/**
 * Fallback configuration, used whole when no cfg.json can be read and merged
 * under a successfully-read cfg.json otherwise.
 *
 * NOTE: this is a THIRD copy of the config schema, alongside
 * `data/defaultcfg.json` (the canonical one) and `data/examplecfg.json` (the
 * structural reference). Its values have already drifted from defaultcfg.json.
 * Because `cfg()` below never actually finds a file, these are in practice the
 * values this whole script runs on.
 * @type {{cloudPushSleep: number, securityThresh: number, moneyThresh: number,
 *   targetHackFraction: number, targetRequirements: {minHackChance: number,
 *   minMoney: number, minServerGrowth: number, excludeServers: string[]},
 *   leaveRamFree: number, minDispatchServers: number, maxDispatchServers: number}}
 */
const DEFAULT_CFG = {
    cloudPushSleep: 5000,
    securityThresh: 2,
    moneyThresh: 0.88,
    targetHackFraction: 0.1,
    targetRequirements: {
        minHackChance: 0.75,
        minMoney: 1000000,
        minServerGrowth: 10,
        excludeServers: ["home", "cloud"],
    },
    leaveRamFree: 20,
    minDispatchServers: 8,
    maxDispatchServers: 8,
};

/**
 * Read the config file and merge it over DEFAULT_CFG, falling back to
 * DEFAULT_CFG alone if it cannot be read or parsed.
 *
 * WARNING - currently always returns DEFAULT_CFG in practice. Both paths tried
 * here are relative ("./data/cfg.json", "data/cfg.json"); the rest of the
 * project writes and reads the absolute "/data/cfg.json". `ns.read` returns an
 * empty string for a missing file rather than throwing, so the empty string
 * reaches `JSON.parse`, that throws, the catch fires, and DEFAULT_CFG comes
 * back - silently, every single call. Nothing you set in cfg.json reaches this
 * script.
 *
 * Also note the merge is SHALLOW: a cfg.json containing a partial
 * `targetRequirements` object would replace the default one wholesale rather
 * than filling in the missing keys. Callers work around this by re-defaulting
 * nested reads individually (see `getRankedTargets`).
 *
 * Called per-use rather than cached, so it re-reads on every RAM check.
 * @param {NS} ns - The Netscript API object
 * @returns {typeof DEFAULT_CFG} The merged config object
 */
function cfg(ns) {
    try {
        const text = ns.read("./data/cfg.json") || ns.read("data/cfg.json");
        return { ...DEFAULT_CFG, ...JSON.parse(text) };
    }
    catch {
        return DEFAULT_CFG;
    }
}

/**
 * Run first-run setup: scan the network, auto-nuke everything reachable, and
 * print the suggested next command.
 *
 * Delegates the actual work to `refresh(ns, true)` - the `true` suppresses
 * refresh's own output so this function owns the whole terminal report.
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
 */
async function init(ns) {
    await refresh(ns, true);
    ns.tprint("\nInitialisation:");
    ns.tprint("  Network scanned and stored in ./data/networks.json");
    ns.tprint("  AutoNuked all reachable servers where programs allow it");
    ns.tprint("Run: run " + ns.getScriptName() + " dispatch");
}

/**
 * Rescan the network, auto-nuke every reachable server, then rescan again.
 *
 * The second scan is not redundant: the first one produces the host list to
 * iterate, and nuking changes each server's `hasRootAccess`/`backdoorInstalled`
 * state. Re-scanning afterwards means the networks.json left on disk reflects
 * post-nuke reality rather than the state before this run touched anything.
 *
 * Both internal scans are forced quiet regardless of the `quiet` argument; the
 * flag only controls this function's own summary output.
 * @param {NS} ns - The Netscript API object
 * @param {boolean} [quiet=false] - Suppress the terminal-clear and summary lines
 * @returns {Promise<void>}
 */
async function refresh(ns, quiet = false) {
    const servers = await scanNetwork(ns, true);
    for (const server of servers) autoNuke(ns, server.hostname, true);
    await scanNetwork(ns, true);
    if (!quiet) {
        ns.ui.clearTerminal();
        ns.tprint("Refreshed ./data/networks.json");
        ns.tprint("Auto-nuked every reachable server possible.");
    }
}

/**
 * Walk the entire server network breadth-first from home and write every
 * server object to ./data/networks.json.
 *
 * Duplicates `scanner.js`'s job. The `seen` Set is what stops the walk looping
 * forever - ns.scan() is bidirectional, so every neighbour lists you back as
 * one of its own neighbours.
 *
 * Declared async but contains no await; it is awaited by callers purely for
 * consistency with the rest of the sub-command dispatch.
 * @param {NS} ns - The Netscript API object
 * @param {boolean} [quiet=false] - Disable logging and suppress the summary line
 * @returns {Promise<Server[]>} Every server object on the network, home first
 */
async function scanNetwork(ns, quiet = false) {
    if (quiet) ns.disableLog("ALL");

    // seen = "already queued", hosts = "already visited, in discovery order".
    const seen = new Set(["home"]);
    const queue = ["home"];
    const hosts = [];

    // Breadth-first flood fill outward from home.
    while (queue.length > 0) {
        const host = queue.shift();
        hosts.push(host);
        for (const neighbor of ns.scan(host)) {
            if (!seen.has(neighbor)) {
                seen.add(neighbor);
                queue.push(neighbor);
            }
        }
    }

    const servers = hosts.map(host => ns.getServer(host));
    ns.write("./data/networks.json", JSON.stringify(servers), "w");

    if (!quiet) ns.tprint(`Scanned ${servers.length} servers into ./data/networks.json`);
    return servers;
}

/**
 * Launch one deployer per ranked target, throttled by available RAM on the
 * host that will run them.
 *
 * In "ranked" mode this ranks every valid target, takes the top
 * `maxDispatchServers`, and execs a `deployer` sub-command of this same file
 * for each one. It refuses to start at all if fewer than `minDispatchServers`
 * valid targets exist - the reasoning being that a half-populated dispatch is
 * usually a sign the network scan or the target filters are wrong, not that
 * you are genuinely short of targets.
 *
 * In any other mode it execs a single deployer and hands the mode straight
 * through, letting the deployer pick its own target.
 *
 * The RAM wait loop has an asymmetric escape: once `minDispatchServers`
 * deployers are already up it gives up and returns rather than blocking, but
 * BELOW that minimum it will wait indefinitely in 5s increments for RAM that
 * may never appear. The 500ms sleep between successful launches is there to
 * stop a burst of simultaneous execs spiking RAM faster than the loop can
 * measure it.
 * @param {NS} ns - The Netscript API object
 * @param {string} script - This file's own name, re-exec'd as the deployer
 * @param {(string|number)[]} args - [scriptHost, targetMode] from the terminal
 * @returns {Promise<void>}
 */
async function dispatch(ns, script, args) {
    const scriptHost = args[0] ?? "home";
    const targetMode = args[1] ?? "ranked";
    const c = cfg(ns);
    const minServers = c.minDispatchServers ?? 1;
    const maxServers = c.maxDispatchServers ?? 1;

    if (targetMode !== "ranked") {
        ns.exec(script, scriptHost, 1, "deployer", scriptHost, targetMode);
        return;
    }

    const allTargets = getTarget(ns, "ranked");
    const targets = allTargets.slice(0, maxServers);
    if (allTargets.length < minServers) {
        ns.tprint(`Error: only ${allTargets.length} valid targets found, minimum is ${minServers}.`);
        return;
    }

    ns.tprint(`Launching deployers for ${targets.length} of ${allTargets.length} targets on ${scriptHost}`);
    let launched = 0;
    for (const target of targets) {
        while (availableRam(ns, scriptHost) < ns.getScriptRam(script, scriptHost)) {
            if (launched >= minServers) {
                ns.tprint(`RAM limit reached - launched ${launched} of ${targets.length} deployers.`);
                return;
            }
            ns.tprint(`Waiting for ${scriptHost} RAM to launch deployers. ${minServers - launched} left to minimum.`);
            await ns.sleep(5000);
        }

        ns.exec(script, scriptHost, 1, "deployer", scriptHost, "best", target);
        launched++;
        await ns.sleep(500);
    }

    ns.tprint(`Launched ${launched} of ${targets.length} deployers.`);
}

/**
 * Run the HGW control loop against a single target, forever.
 *
 * The classic weaken-then-grow-then-hack priority ladder: security above
 * threshold takes precedence over money below threshold, which takes
 * precedence over hacking. Only ONE of the three fires per tick.
 *
 * The interesting part is `runningThreads(mode)`. Each tick prunes dead
 * children out of `children`, then subtracts the threads already in flight for
 * a given mode from the newly-computed requirement. Without that subtraction
 * the loop would re-launch a full weaken every second while the first weaken
 * was still running, because security does not actually drop until the action
 * completes. This is what keeps it from thread-flooding itself.
 *
 * `state` is passed by reference into `runWorker` as a mutable box so the
 * "Insufficient RAM. Waiting..." message prints once on entering the starved
 * state rather than every second while it persists.
 *
 * `ns.atExit` (not try/finally - a finally block does NOT run when a Bitburner
 * script is killed) tears down every child worker, so killing the deployer
 * cascades to its whole worker tree.
 *
 * Never returns under normal operation. weakCount/growCount/hackCount count
 * successful LAUNCHES, not threads or completions.
 * @param {NS} ns - The Netscript API object
 * @param {string} script - This file's own name, re-exec'd as the HGW worker
 * @param {string} scriptHost - Host the worker threads run on
 * @param {string} targetMode - Target selection mode, used only if `target` is null
 * @param {string|null} [target=null] - Explicit target hostname; overrides targetMode
 * @returns {Promise<void>} Never resolves in practice
 */
async function deployer(ns, script, scriptHost, targetMode, target = null) {
    target = target ?? getTarget(ns, targetMode);
    // getTarget returns an ARRAY in "ranked" mode and a bare hostname string in
    // every other mode, so collapse an array down to its best entry here.
    if (Array.isArray(target)) target = target[0];
    if (!target) {
        ns.tprint("No valid target found.");
        return;
    }

    const c = cfg(ns);
    const maxMoney = ns.getServerMaxMoney(target);
    const moneyThresh = c.moneyThresh * maxMoney;
    const securityThresh = ns.getServerMinSecurityLevel(target) + c.securityThresh;
    const weakenPerThread = ns.weakenAnalyze(1);
    const state = { waiting: false };
    let children = [];
    let weakCount = 0;
    let growCount = 0;
    let hackCount = 0;

    ns.disableLog("ALL");
    ns.atExit(() => {
        for (const child of children) ns.kill(child.pid);
        ns.print(`Stopped ${target}: weaken=${weakCount}, grow=${growCount}, hack=${hackCount}`);
    });

    while (true) {
        children = children.filter(child => ns.isRunning(child.pid));
        const runningThreads = mode => children
            .filter(child => child.mode === mode)
            .reduce((sum, child) => sum + child.threads, 0);

        const sec = ns.getServerSecurityLevel(target);
        const money = ns.getServerMoneyAvailable(target);

        if (sec > securityThresh) {
            const needed = Math.ceil((sec - securityThresh) / weakenPerThread) - runningThreads("weaken");
            if (await runWorker(ns, script, scriptHost, "weaken", target, needed, children, state)) weakCount++;
            if (!state.waiting) ns.print(`Security too high: ${sec} > ${securityThresh}`);
        }
        else if (money < moneyThresh) {
            const multiplier = (maxMoney * c.moneyThresh) / Math.max(money, 1);
            const needed = Math.ceil(ns.growthAnalyze(target, multiplier)) - runningThreads("grow");
            if (await runWorker(ns, script, scriptHost, "grow", target, needed, children, state)) growCount++;
            if (!state.waiting) ns.print(`Money too low: ${money} < ${moneyThresh}`);
        }
        else {
            const fraction = c.targetHackFraction ?? 0.05;
            const needed = Math.max(1, Math.floor(fraction / ns.hackAnalyze(target))) - runningThreads("hack");
            if (await runWorker(ns, script, scriptHost, "hack", target, needed, children, state)) hackCount++;
            if (!state.waiting) ns.print("Optimal hack conditions met.");
        }

        await ns.sleep(1000);
    }
}

/**
 * Launch one batch of HGW worker threads, clamped to whatever RAM is actually
 * free, and record it in the caller's children list.
 *
 * `needed` may legitimately arrive negative or zero (the caller subtracts
 * already-running threads from the requirement), and `workerThreads` may
 * return zero when RAM is exhausted - both collapse into the `threads < 1`
 * branch, which sleeps 3s and reports failure without launching anything.
 * That means "nothing to do" and "no room to do it" are handled identically
 * and both print the RAM warning.
 *
 * MUTATES both `children` (push on success) and `state.waiting` - it is the
 * single owner of the once-only "waiting for RAM" message latch.
 * @param {NS} ns - The Netscript API object
 * @param {string} script - This file's own name, re-exec'd as the worker
 * @param {string} host - Host to run the threads on
 * @param {"hack"|"grow"|"weaken"} mode - Worker mode, passed as the worker's args[0]
 * @param {string} target - Hostname the worker acts against
 * @param {number} needed - Threads still required after subtracting those in flight
 * @param {{pid: number, mode: string, threads: number}[]} children - Live child list, mutated on success
 * @param {{waiting: boolean}} state - Mutable latch for the once-only RAM warning
 * @returns {Promise<boolean>} Whether a worker was actually launched
 */
async function runWorker(ns, script, host, mode, target, needed, children, state) {
    const threads = Math.min(workerThreads(ns, host, script), needed);
    if (threads < 1) {
        if (!state.waiting) {
            ns.print("\nInsufficient RAM. Waiting...\n");
            state.waiting = true;
        }
        await ns.sleep(3000);
        return false;
    }

    const pid = ns.exec(script, host, threads, mode, target);
    // ns.exec returns 0 (not an exception) when the launch fails - usually a
    // RAM race between the check above and this line.
    if (pid === 0) return false;
    children.push({ pid, mode, threads });
    state.waiting = false;
    ns.print(`Ran ${mode} [${pid}] with ${threads} threads on ${host} targeting ${target}`);
    return true;
}

/**
 * Pick a hack target, or targets, according to a selection mode.
 *
 * CAUTION - the return type varies with the mode. "ranked" returns a string
 * ARRAY of every valid target best-first; every other mode returns a single
 * hostname STRING. Callers must handle both (see the Array.isArray guard in
 * `deployer`).
 *
 * Modes:
 *   "easy"    - hardcoded n00dles, skipping ranking entirely. Bootstrap mode.
 *   "ranked"  - all valid targets, sorted by money-per-second descending.
 *   "hacklvl" - the single target with the HIGHEST hacking-level requirement
 *               among those that pass the filters, i.e. the hardest thing you
 *               currently qualify for.
 *   anything else - the single best money-per-second target.
 *
 * Note "hacklvl" re-sorts `ranked` in place, which is harmless only because
 * the array is discarded immediately afterwards.
 * @param {NS} ns - The Netscript API object
 * @param {"ranked"|"easy"|"hacklvl"|"best"} [mode="ranked"] - Selection mode
 * @returns {string|string[]} An array of hostnames for "ranked", a single hostname otherwise
 */
function getTarget(ns, mode = "ranked") {
    if (mode === "easy") return "n00dles";

    const ranked = getRankedTargets(ns);
    if (mode === "ranked") return ranked.map(t => t.hostname);
    if (mode === "hacklvl") return ranked.sort((a, b) => b.requiredHackingSkill - a.requiredHackingSkill)[0]?.hostname;
    return ranked[0]?.hostname;
}

/**
 * Score every rooted server by expected money per second per thread and return
 * them sorted best-first.
 *
 * Filters first (root access, minimum max-money, minimum growth rate, explicit
 * exclusions), then scores. Two scoring paths:
 *
 *   With Formulas.exe: builds a HYPOTHETICAL server object - the real server
 *   with its money forced to `moneyMax * moneyThresh` and its security forced
 *   to `minDifficulty`. That is the state a well-prepped target will actually
 *   be in when you hack it, so scoring against it ranks targets by their
 *   steady-state yield rather than by whatever random state they happen to be
 *   in right now. This path also applies the minHackChance filter, which the
 *   non-Formulas path silently does not.
 *
 *   Without Formulas.exe: falls back to ns.hackAnalyze/hackAnalyzeChance/
 *   getHackTime against the server's CURRENT state, which will under-rank any
 *   target that is presently drained or over-secured.
 *
 * The `?? DEFAULT_CFG.targetRequirements` re-default exists because `cfg()`
 * merges shallowly and would otherwise hand back a partial nested object.
 * @param {NS} ns - The Netscript API object
 * @returns {{hostname: string, moneyPerSec: number, requiredHackingSkill: number}[]}
 *   Valid targets sorted by moneyPerSec descending
 */
function getRankedTargets(ns) {
    const servers = readServers(ns);
    const c = cfg(ns);
    const req = c.targetRequirements ?? DEFAULT_CFG.targetRequirements;
    const hasFormulas = ns.fileExists("Formulas.exe", "home");
    const player = ns.getPlayer();
    const ranked = [];

    for (const server of servers) {
        if (!ns.hasRootAccess(server.hostname)) continue;
        if (server.moneyMax < req.minMoney) continue;
        if (server.serverGrowth < req.minServerGrowth) continue;
        if ((req.excludeServers ?? []).includes(server.hostname)) continue;

        let moneyPerSec;
        if (hasFormulas) {
            const s = { ...server, moneyAvailable: server.moneyMax * c.moneyThresh, hackDifficulty: server.minDifficulty };
            const chance = ns.formulas.hacking.hackChance(s, player);
            if (chance < req.minHackChance) continue;
            moneyPerSec = (s.moneyAvailable * ns.formulas.hacking.hackPercent(s, player) * chance) /
                (ns.formulas.hacking.hackTime(s, player) / 1000);
        }
        else {
            moneyPerSec = (server.moneyMax * c.moneyThresh * ns.hackAnalyze(server.hostname) * ns.hackAnalyzeChance(server.hostname)) /
                (ns.getHackTime(server.hostname) / 1000);
        }

        ranked.push({ hostname: server.hostname, moneyPerSec, requiredHackingSkill: server.requiredHackingSkill });
    }

    return ranked.sort((a, b) => b.moneyPerSec - a.moneyPerSec);
}

/**
 * Load the cached server list from disk, falling back to a live network walk.
 *
 * The cache read is best-effort: a missing file, unparseable JSON or an empty
 * array all silently drop through to the live scan. Note the empty `catch { }`
 * means a CORRUPT networks.json is indistinguishable from a missing one - the
 * script just gets slower, with no warning.
 *
 * The fallback walk is a duplicate of `scanNetwork`'s breadth-first flood fill,
 * minus the disk write.
 * @param {NS} ns - The Netscript API object
 * @returns {Server[]} Every server object on the network
 */
function readServers(ns) {
    try {
        const parsed = JSON.parse(ns.read("./data/networks.json") || "[]");
        if (parsed.length > 0) return parsed;
    }
    catch { }

    // Cache miss or unreadable - walk the network live instead.
    const seen = new Set(["home"]);
    const queue = ["home"];
    const servers = [];
    while (queue.length > 0) {
        const host = queue.shift();
        servers.push(ns.getServer(host));
        for (const next of ns.scan(host)) {
            if (!seen.has(next)) {
                seen.add(next);
                queue.push(next);
            }
        }
    }
    return servers;
}

/**
 * Print the selected target or targets to the terminal, numbered and with
 * their money-per-second score.
 *
 * Only "ranked" mode produces real scores. Any other mode wraps `getTarget`'s
 * single hostname in a one-element list with a placeholder moneyPerSec of 0,
 * so the printed "$0/sec/thread" for non-ranked modes is a formatting artefact,
 * not a real measurement.
 * @param {NS} ns - The Netscript API object
 * @param {"ranked"|"easy"|"hacklvl"|"best"} mode - Selection mode passed to getTarget
 * @returns {void}
 */
function printTargets(ns, mode) {
    const targets = mode === "ranked" ? getRankedTargets(ns) : [{ hostname: getTarget(ns, mode), moneyPerSec: 0 }];
    for (const [i, target] of targets.entries()) {
        ns.tprint(`${String(i + 1).padStart(2)}. ${target.hostname} - $${Math.round(target.moneyPerSec)}/sec/thread`);
    }
}

/**
 * Run every port-opening program we own against a host, then nuke it for root
 * access if we own enough openers to satisfy its port requirement.
 *
 * Differs from `lib/util.js`'s autoNuke, which is otherwise the same function:
 * this version checks `getServerNumPortsRequired(host) <= openedPorts(ns)`
 * before calling ns.nuke, so it skips servers it cannot possibly crack instead
 * of relying on the try/catch. That guard is the better behaviour of the two
 * and is worth porting back to the library version.
 *
 * The `fileExists` check on each opener is load-bearing, not tidiness - calling
 * e.g. ns.brutessh() without owning BruteSSH.exe throws.
 *
 * The array-of-[filename, thunk] pairs replaces the switch statement the
 * library version uses; the thunk defers the call so the filename can be tested
 * first.
 * @param {NS} ns - The Netscript API object
 * @param {string} host - Hostname to open ports on and nuke
 * @param {boolean} [quiet=false] - Suppress the failure message on a failed nuke
 * @returns {void}
 */
function autoNuke(ns, host, quiet = false) {
    const openers = [
        ["BruteSSH.exe", () => ns.brutessh(host)],
        ["FTPCrack.exe", () => ns.ftpcrack(host)],
        ["relaySMTP.exe", () => ns.relaysmtp(host)],
        ["SQLInject.exe", () => ns.sqlinject(host)],
        ["HTTPWorm.exe", () => ns.httpworm(host)],
    ];

    for (const [exe, fn] of openers) {
        if (ns.fileExists(exe, "home")) fn();
    }

    try {
        if (!ns.hasRootAccess(host) && ns.getServerNumPortsRequired(host) <= openedPorts(ns)) ns.nuke(host);
    }
    catch (error) {
        if (!quiet) ns.print(`Could not nuke ${host}: ${error}`);
    }
}

/**
 * Count how many port-opening programs we currently own on home.
 *
 * This is the number of ports we are CAPABLE of opening, not the number open
 * on any particular server - it is compared against a target's
 * `getServerNumPortsRequired` to decide whether nuking it can succeed.
 *
 * The .exe list is duplicated from `autoNuke` above; the two must stay in sync.
 * @param {NS} ns - The Netscript API object
 * @returns {number} How many of the five port openers exist on home (0-5)
 */
function openedPorts(ns) {
    return ["BruteSSH.exe", "FTPCrack.exe", "relaySMTP.exe", "SQLInject.exe", "HTTPWorm.exe"]
        .filter(exe => ns.fileExists(exe, "home")).length;
}

/**
 * Report how much RAM on a host is free for this script to use, after the
 * configured reserve.
 *
 * NOTE - `leaveRamFree` is subtracted from EVERY host, not just home. The
 * scheduler design in the root CLAUDE.md is explicit that the reserve exists so
 * you can still launch things manually on home, and that cloud servers should
 * get no reserve at all. On a fleet of small cloud servers this quietly throws
 * away the reserve amount per host.
 *
 * Can return a negative number when used RAM plus the reserve exceeds max RAM;
 * `workerThreads` relies on Math.floor of a negative producing a value < 1.
 * @param {NS} ns - The Netscript API object
 * @param {string} host - Hostname to measure
 * @returns {number} Free RAM in GB after the reserve, possibly negative
 */
function availableRam(ns, host) {
    return ns.getServerMaxRam(host) - ns.getServerUsedRam(host) - (cfg(ns).leaveRamFree ?? 0);
}

/**
 * Calculate how many threads of a script will fit in a host's free RAM.
 *
 * Because this file is its own worker, `script` is normally this file's name -
 * which means each worker thread pays the RAM cost of EVERY Netscript API used
 * anywhere in this file, not just hack/grow/weaken. That is a large per-thread
 * tax compared to a dedicated single-purpose worker script.
 *
 * Duplicates `lib/util.js`'s `getAvailableThreads`.
 * @param {NS} ns - The Netscript API object
 * @param {string} host - Host the threads would run on
 * @param {string} script - Script whose per-thread RAM cost to divide by
 * @returns {number} Thread capacity, floored; zero or negative when RAM-starved
 */
function workerThreads(ns, host, script) {
    return Math.floor(availableRam(ns, host) / ns.getScriptRam(script, host));
}

/**
 * Buy the largest server the player can currently afford.
 *
 * Server RAM must be a power of two, so this starts at 2GB and keeps doubling
 * for as long as the NEXT size up is still affordable - the loop condition
 * tests `ram * 2`, not `ram`, so it exits holding the largest size that still
 * fits the budget rather than the first one that does not.
 *
 * There is no upper bound in the loop itself; it terminates because cost grows
 * super-linearly with RAM and the game caps purchasable RAM.
 *
 * Declared async but contains no await.
 * @param {NS} ns - The Netscript API object
 * @param {string} name - Hostname to give the new server
 * @returns {Promise<void>}
 */
async function buyBestServer(ns, name) {
    const api = cloudApi(ns);
    let ram = 2;
    while (api.cost(ram * 2) <= ns.getPlayer().money) ram *= 2;
    const bought = api.buy(String(name), ram);
    ns.tprint(`Bought server ${bought || name} with ${ram}GB RAM for $${Math.round(api.cost(ram))}.`);
}

/**
 * Return a small shim over whichever server-purchasing API this game build
 * exposes.
 *
 * Newer builds provide the `ns.cloud.*` namespace; older ones only have the
 * top-level `ns.getPurchasedServerCost`/`ns.purchaseServer`. Probing for
 * `ns.cloud` once here means `buyBestServer` never has to care which it is.
 * This portability shim is the most reusable idea in the file and is worth
 * lifting into lib/ regardless of what happens to the rest of it.
 * @param {NS} ns - The Netscript API object
 * @returns {{cost: (ram: number) => number, buy: (name: string, ram: number) => string}}
 *   Cost lookup and purchase functions bound to the available API
 */
function cloudApi(ns) {
    if (ns.cloud) {
        return {
            cost: ram => ns.cloud.getServerCost(ram),
            buy: (name, ram) => ns.cloud.purchaseServer(name, ram),
        };
    }
    return {
        cost: ram => ns.getPurchasedServerCost(ram),
        buy: (name, ram) => ns.purchaseServer(name, ram),
    };
}

/**
 * Keep this file continuously re-copied onto a remote server so edits made on
 * home propagate without a manual scp.
 *
 * Two-phase, and which phase runs depends on where the script is executing:
 *
 *   Running on home - this is the LAUNCHER. It scp's itself to the target,
 *   execs a copy of itself there in "push" mode, and returns immediately.
 *
 *   Running anywhere else - this is the WORKER. It loops forever pulling a
 *   fresh copy of the file from home every `cloudPushSleep` ms.
 *
 * The `while (target === ns.getHostname())` condition is the loop's only exit:
 * it holds as long as the script is running on the server it was told to push
 * to, which for the launched copy is always. Passing a different hostname makes
 * the loop body never execute at all.
 *
 * Guards against `pushLoop(ns, "help")` because "push" and "help" are easy to
 * confuse at the terminal.
 * @param {NS} ns - The Netscript API object
 * @param {string} target - Hostname to keep synced
 * @returns {Promise<void>} Never resolves once running as the worker
 */
async function pushLoop(ns, target) {
    const script = ns.getScriptName();
    if (target === "help") return printHelp(ns, script);

    if (ns.getHostname() === "home") {
        await ns.scp(script, target, "home");
        ns.exec(script, target, 1, "push", target);
        return;
    }

    ns.disableLog("scp");
    while (target === ns.getHostname()) {
        await ns.scp(script, target, "home");
        ns.print(`Pushed ${script} to ${target}`);
        await ns.sleep(cfg(ns).cloudPushSleep ?? 5000);
    }
}

/**
 * Handle the "util" sub-command - a small grab bag of one-shot diagnostics.
 *
 * Mirrors `lib/util.js`'s terminal entry point, but correctly: the flags are
 * lowercased before comparison AND compared against lowercase literals, so
 * unlike the library version's `--getAvailableThreads` branch these actually
 * match. `printHelp` still advertises the mixed-case spelling, which works only
 * because of the lowercasing here.
 *
 * The thread count reported is for THIS file (`ns.getScriptName()`), which as
 * the header notes is a much heavier per-thread cost than a dedicated worker.
 *
 * Silently does nothing if neither flag is present.
 * @param {NS} ns - The Netscript API object
 * @param {(string|number)[]} args - [host, ...flags] from the terminal
 * @returns {void}
 */
function util(ns, args) {
    const host = args[0] ?? ns.getHostname();
    const flags = args.map(arg => String(arg).toLowerCase());
    if (flags.includes("--openports")) return autoNuke(ns, host);
    if (flags.includes("--getavailablethreads")) {
        ns.tprint(`Available single-file worker threads on ${host}: ${workerThreads(ns, host, ns.getScriptName())}`);
    }
}

/**
 * Print the sub-command reference to the terminal.
 *
 * Also the default branch of the dispatch switch, so any unrecognised command
 * lands here rather than erroring.
 *
 * `script` is passed in rather than read from `ns.getScriptName()` so the usage
 * line always names the file the user actually invoked, even after a rename.
 * @param {NS} ns - The Netscript API object
 * @param {string} script - This file's own name, for the usage line
 * @returns {void}
 */
function printHelp(ns, script) {
    ns.tprint(`Usage: run ${script} <command> [args]`);
    ns.tprint("Commands:");
    ns.tprint("  init                 scan, auto-nuke, and print next steps");
    ns.tprint("  refresh              rescan and auto-nuke");
    ns.tprint("  scan                 write ./data/networks.json");
    ns.tprint("  dispatch [host]      launch ranked deployers");
    ns.tprint("  deployer [host] [mode] [target]");
    ns.tprint("  target [ranked|best|hacklvl|easy]");
    ns.tprint("  buy [name]           buy biggest affordable server");
    ns.tprint("  push [server]        keep this file synced to a server");
    ns.tprint("  util <host> --openports|--getAvailableThreads");
}
