/**
 * Entry point for singularity wrapper that dispatches various operations based on command.
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
 */
export async function main(ns) {
    const script = ns.getScriptName();
    const command = String(ns.args[0] ?? "help").toLowerCase();
    const args = ns.args.slice(1);

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
 * First-run setup: scans the network, auto-nukes what it can, and prints next steps.
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

async function scanNetwork(ns, quiet = false) {
    if (quiet) ns.disableLog("ALL");

    const seen = new Set(["home"]);
    const queue = ["home"];
    const hosts = [];

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

async function deployer(ns, script, scriptHost, targetMode, target = null) {
    target = target ?? getTarget(ns, targetMode);
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
    if (pid === 0) return false;
    children.push({ pid, mode, threads });
    state.waiting = false;
    ns.print(`Ran ${mode} [${pid}] with ${threads} threads on ${host} targeting ${target}`);
    return true;
}

function getTarget(ns, mode = "ranked") {
    if (mode === "easy") return "n00dles";

    const ranked = getRankedTargets(ns);
    if (mode === "ranked") return ranked.map(t => t.hostname);
    if (mode === "hacklvl") return ranked.sort((a, b) => b.requiredHackingSkill - a.requiredHackingSkill)[0]?.hostname;
    return ranked[0]?.hostname;
}

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

function readServers(ns) {
    try {
        const parsed = JSON.parse(ns.read("./data/networks.json") || "[]");
        if (parsed.length > 0) return parsed;
    }
    catch { }

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

function printTargets(ns, mode) {
    const targets = mode === "ranked" ? getRankedTargets(ns) : [{ hostname: getTarget(ns, mode), moneyPerSec: 0 }];
    for (const [i, target] of targets.entries()) {
        ns.tprint(`${String(i + 1).padStart(2)}. ${target.hostname} - $${Math.round(target.moneyPerSec)}/sec/thread`);
    }
}

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

function openedPorts(ns) {
    return ["BruteSSH.exe", "FTPCrack.exe", "relaySMTP.exe", "SQLInject.exe", "HTTPWorm.exe"]
        .filter(exe => ns.fileExists(exe, "home")).length;
}

function availableRam(ns, host) {
    return ns.getServerMaxRam(host) - ns.getServerUsedRam(host) - (cfg(ns).leaveRamFree ?? 0);
}

function workerThreads(ns, host, script) {
    return Math.floor(availableRam(ns, host) / ns.getScriptRam(script, host));
}

async function buyBestServer(ns, name) {
    const api = cloudApi(ns);
    let ram = 2;
    while (api.cost(ram * 2) <= ns.getPlayer().money) ram *= 2;
    const bought = api.buy(String(name), ram);
    ns.tprint(`Bought server ${bought || name} with ${ram}GB RAM for $${Math.round(api.cost(ram))}.`);
}

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

function util(ns, args) {
    const host = args[0] ?? ns.getHostname();
    const flags = args.map(arg => String(arg).toLowerCase());
    if (flags.includes("--openports")) return autoNuke(ns, host);
    if (flags.includes("--getavailablethreads")) {
        ns.tprint(`Available single-file worker threads on ${host}: ${workerThreads(ns, host, ns.getScriptName())}`);
    }
}

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
