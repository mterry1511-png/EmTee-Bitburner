import { scanNetwork } from "../scanner.js";

// Normal usage: Call getTarget directly. See targetingREADME.txt for full usage.
/** @param {NS} ns */
export async function main(ns) {
    const mode = ns.args[0];
    const targetHostname = getTarget(ns, mode);
    return (targetHostname);
}

export function getTarget(ns, mode) {
    // Select mode based on argument passed
    switch (mode) {
        case "best": {
            // Call mode specific function
            const target = getBestMoney(ns);
            // print function
            printTarget(ns, target.hostname, mode, target.moneyPerSec);
            // returns hostname given from mode specific function 
            return target.hostname;
        }

        case "hacklvl": {
            // Call mode specific function
            const target = getBestHackLvlTarget(ns);
            // print function
            printTarget(ns, target.hostname, mode, target.moneyPerSec);
            // returns hostname given from mode specific function 
            return target.hostname;
        }

        case "easy": {
            const target = "n00dles"
            // print function
            printTarget(ns, target, mode);
            // returns hostname given from mode specific function 
            return target;
        }

        default: {
            // Print default message 
            ns.print("Targeting mode not specified. Using default mode: best");
            ns.tprint("Targeting mode not specified. Using default mode: best");

            // Call mode specific function
            const target = getBestMoney(ns);
            // print function
            printTarget(ns, target.hostname, mode, target.moneyPerSec);
            // returns hostname given from mode specific function 
            return target.hostname;
        }
    }

}

// prints to terminal and log depending on target and mode
function printTarget(ns, target, mode, moneyPerSec) {
    switch (mode) {
        case "best": { ns.print(target + " was selected based on the highest money per second at threshold."); break; }
        case "hacklvl": { ns.print(target + " was selected based on the highest hack level possible."); break; }
        case "easy": { ns.print(target + " was selected because it's easy as fuck to hack."); return; }
    }
    // Print result to terminal and the log
    const print = ("\nTarget: " + target + "\n$" + (Math.round(moneyPerSec)) + " expected per minute, per thread.\n");
    ns.tprint(print);
    ns.print(print);
}


// Returns hostname of a server that we have root access to 
// with the highest hackable level.
// DOESNT WORK YET 
function getBestHackLvlTarget(ns) {

    // // Refresh "/data/networks.json" then loads servers []
    scanNetwork(ns, true);
    const servers = JSON.parse(ns.read("data/networks.json"));

    // loads config
    const cfg = JSON.parse(ns.read("data/cfg.json"));

    // declare variable to keep track of best target to be returned at the end of the function
    // hostname, value per second
    let bestTarget = { hostname: "", moneyPerSec: 0, requiredHackingSkill: 0 };

    // We need to change behaviour if we don't have Formulas.exe commands available
    const hasFormulas = ns.fileExists("Formulas.exe", "home");

    // get getPlayer object for calculations
    const player = ns.getPlayer();

    // loop through servers and calculate expected value per second for each, keeping track of the best one
    for (const server of servers) {
        // value per second for current server
        let moneyPerSec = 0;

        // only consider servers that meets requirements from cfg.json
        // must have root access
        if (!(ns.hasRootAccess(server.hostname))) {
            continue;
        }

        // Must reach minimum hack chance threshold if we have Formulas.exe in home server - assuming min security
        // Does nothing if we don't have formulas
        if (hasFormulas) {
            if (ns.formulas.hacking.hackChance(
                { ...server, hackDifficulty: server.minDifficulty }, player) < cfg.targetRequirements.minHackChance) {
                continue;
            }
        }

        // must have moneyMax above threshold
        if (server.moneyMax < cfg.targetRequirements.minMoney) {
            continue;
        }

        // must have server growth above threshold
        if (server.serverGrowth < cfg.targetRequirements.minServerGrowth) {
            continue;
        }

        // must not be in the excludeServers list
        if (cfg.targetRequirements.excludeServers.includes(server.hostname)) {
            continue;
        }

        // If we have Formulas.exe, use the formulas functions for more accurate calculations
        if (hasFormulas) {
            // create a modified copy of the server object for fair comparison between servers
            // with moneyAvailable and hackDifficulty standardised against the current thresholds (.cfg.json) 
            // Treats server state as money at moneyThresh and difficulty at minimum
            const serverAtThresh = {
                ...server,
                moneyAvailable: server.moneyMax * cfg.moneyThresh,
                hackDifficulty: server.minDifficulty
            }

            // consts for calculation - using the modified server object to standardise   
            const hackPercent = ns.formulas.hacking.hackPercent(serverAtThresh, player);
            const hackChance = ns.formulas.hacking.hackChance(serverAtThresh, player);
            const hackTimeMs = ns.formulas.hacking.hackTime(serverAtThresh, player);
            moneyPerSec =
                (server.moneyMax * cfg.moneyThresh * hackPercent * hackChance)
                / (hackTimeMs / 1000);
        }

        // If we don't have Formulas.exe, use a worse calculation that doesn't account for security AT ALL
        else {
            // consts for calculation
            const hackPercent = ns.hackAnalyze(server.hostname);
            const hackChance = ns.hackAnalyzeChance(server.hostname);
            const hackTimeMs = ns.getHackTime(server.hostname);

            // Calculate expected value per second at moneyThresh simplified
            const rewardAtThresh = ((server.moneyMax * cfg.moneyThresh) * hackPercent * hackChance);
            moneyPerSec = (rewardAtThresh / (hackTimeMs / 1000));
        }

        // Replace bestTarget if this server has the highest required hacking skill
        if (server.requiredHackingSkill > bestTarget.requiredHackingSkill) {
            bestTarget = { hostname: server.hostname, moneyPerSec: moneyPerSec, requiredHackingSkill: server.requiredHackingSkill };
        }
    }

    // returns the server hostname with the highest hackable level that meets the requirements from cfg.json
    // returns hostname and money per second for printing later
    return bestTarget;
}


// Returns hostname of a server that we have root access to
// with the highest expected value per second (moneyMax * hackChance / hackTime)
function getBestMoney(ns) {

    // // Refresh "/data/networks.json" then loads servers []
    scanNetwork(ns, true);
    const servers = JSON.parse(ns.read("data/networks.json"));

    // loads config
    const cfg = JSON.parse(ns.read("data/cfg.json"));

    // declare variable to keep track of best target to be returned at the end of the function
    // hostname, value per second
    let bestTarget = { hostname: "", moneyPerSec: 0 };

    // We need to change behaviour if we don't have Formulas.exe commands available
    const hasFormulas = ns.fileExists("Formulas.exe", "home");

    // get getPlayer object for calculations
    const player = ns.getPlayer();

    // loop through servers and calculate expected value per second for each, keeping track of the best one
    for (const server of servers) {
        // value per second for current server
        let moneyPerSec = 0;

        // only consider servers that meets requirements from cfg.json
        // must have root access
        if (!(ns.hasRootAccess(server.hostname))) {
            continue;
        }

        // Must reach minimum hack chance threshold if we have Formulas.exe in home server - assuming min security
        // Does nothing if we don't have formulas
        if (hasFormulas) {
            if (ns.formulas.hacking.hackChance(
                { ...server, hackDifficulty: server.minDifficulty }, player) < cfg.targetRequirements.minHackChance) {
                continue;
            }
        }

        // must have moneyMax above threshold
        if (server.moneyMax < cfg.targetRequirements.minMoney) {
            continue;
        }

        // must have server growth above threshold
        if (server.serverGrowth < cfg.targetRequirements.minServerGrowth) {
            continue;
        }

        // must not be in the excludeServers list
        if (cfg.targetRequirements.excludeServers.includes(server.hostname)) {
            continue;
        }

        // If we have Formulas.exe, use the formulas functions for more accurate calculations
        if (hasFormulas) {
            // create a modified copy of the server object for fair comparison between servers
            // with moneyAvailable and hackDifficulty standardised against the current thresholds (.cfg.json) 
            // Treats server state as money at moneyThresh and difficulty at minimum
            const serverAtThresh = {
                ...server,
                moneyAvailable: server.moneyMax * cfg.moneyThresh,
                hackDifficulty: server.minDifficulty
            }

            // consts for calculation - using the modified server object to standardise   
            const hackPercent = ns.formulas.hacking.hackPercent(serverAtThresh, player);
            const hackChance = ns.formulas.hacking.hackChance(serverAtThresh, player);
            const hackTimeMs = ns.formulas.hacking.hackTime(serverAtThresh, player);

            // Calculate expected value per second at moneyThresh
            const rewardAtThresh = (serverAtThresh.moneyAvailable * hackPercent * hackChance);
            moneyPerSec = (rewardAtThresh / (hackTimeMs / 1000));
        }

        // If we don't have Formulas.exe, use a worse calculation that doesn't account for security AT ALL
        else {
            // consts for calculation
            const hackPercent = ns.hackAnalyze(server.hostname);
            const hackChance = ns.hackAnalyzeChance(server.hostname);
            const hackTimeMs = ns.getHackTime(server.hostname);

            // Calculate expected value per second at moneyThresh simplified
            const rewardAtThresh = ((server.moneyMax * cfg.moneyThresh) * hackPercent * hackChance);
            moneyPerSec = (rewardAtThresh / (hackTimeMs / 1000));
        }

        // Replace bestTarget if this server has a higher expected value per second than the current bestTarget moneyPerSec
        if (moneyPerSec > bestTarget.moneyPerSec) {
            bestTarget = { hostname: server.hostname, moneyPerSec };
        }
    }

    // returns the server hostname with the highest expected value per second that meets the requirements from cfg.json
    // returns hostname and money per second for printing later
    return bestTarget;
}



// Called by deployer for security check
export function getMinDifficulty(ns, hostname) {
    const servers = JSON.parse(ns.read("data/networks.json"));
    const serverData = servers.find(s => s.hostname === hostname);

    // error handling
    if (!serverData) {
        ns.print(`Error: ${hostname} not found in networks.json`);
        return null;
    }

    //return without deployer needing to load up networks.json
    return serverData.minDifficulty;
}