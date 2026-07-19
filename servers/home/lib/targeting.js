import { scanNetwork } from "../scanner.js";
import * as format from "../lib/format.js";

/**
 * @typedef {"best"|"ranked"|"easy"|"hacklvl"} TargetMode
 */

/**
 * Known targeting modes accepted by targeting logic.
 * @type {TargetMode[]}
 */
export const knownModes = ["best", "ranked", "easy", "hacklvl"];

// Normal usage: Call getTarget directly. See targetingREADME.txt for full usage.
/**
 * Selects a target based on the requested targeting mode.
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<string>}
 */
export async function main(ns) {
    const mode = ns.args[0];
    const targetHostname = getTarget(ns, mode);
    return (targetHostname);
}

/**
 * Chooses a target hostname or ranked list according to the requested mode.
 * @param {NS} ns - The Netscript API object
 * @param {TargetMode|string|undefined} mode - The targeting mode or raw hostname
 * @returns {string|array} The target hostname or array of hostnames based on mode
 */
export function getTarget(ns, mode) {
    // Select mode based on argument passed
    switch (mode) {
        case "best": {
            // Call mode specific function
            // Shares getBestMoney with "rank" case but returns only a single server hostname
            const targets = getBestMoney(ns);
            const target = targets[0];
            // print function
            printTarget(ns, target.hostname, mode, target.moneyPerSec);
            // returns hostname given from mode specific function 
            ns.print(target. hostname);
            return target.hostname;
        }

        case "ranked": {
            // Call mode specific function
            // Shares getBestMoney with "best" case but returns an array of hostnames
            const targets = getBestMoney(ns);
            //print function
            ns.print("Hackable servers ranked in array, n=" + targets.length);
            return targets.map(t => t.hostname);
        }

        case "hacklvl": {
            // Call mode specific function
            const targets = getBestHackLvlTarget(ns);
            const target = targets[0];
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
            ns.print("Targeting mode not specified. Using default mode: ranked");
            ns.tprint("Targeting mode not specified. Using default mode: ranked");

            // Call mode specific function
            // Shares getBestMoney with "best" case but returns an array of hostnames
            const targets = getBestMoney(ns);
            //print function
            ns.print("Hackable servers ranked, n=" + targets.length);
            return targets.map(t => t.hostname);
        }
    }
}

// prints to terminal and log depending on target and mode
/**
 * Prints a human-readable targeting result to the terminal.
 * @param {NS} ns - The Netscript API object
 * @param {string} target - The hostname of the target server
 * @param {TargetMode} mode - The targeting mode (best, hacklvl, easy)
 * @param {number} [moneyPerSec] - The money per second for this target
 * @returns {void}
 */
function printTarget(ns, target, mode, moneyPerSec) {
    switch (mode) {
        case "best": { ns.print(target + " was selected based on the highest money per second at threshold."); break; }
        case "hacklvl": { ns.print(target + " was selected based on the highest hack level possible."); break; }
        case "easy": { ns.print(target + " was selected because it's easy as fuck to hack."); return; }
    }
    // Print result to terminal and the log
    const print = ("\nTarget: " + target + "\n" + format.money(moneyPerSec) + " expected per minute, per thread.\n");
    ns.tprint(print);
    ns.print(print);
}


// Returns hostname of a server that we have root access to 
// with the highest hackable level.
// DOESNT WORK YET 
/**
 * Finds the highest-level hackable target that satisfies the configured thresholds.
 * @param {NS} ns - The Netscript API object
 * @returns {object} Object with hostname, moneyPerSec, and requiredHackingSkill
 */
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
/**
 * Ranks accessible servers by expected money-per-second.
 * @param {NS} ns - The Netscript API object
 * @returns {array} Array of target objects ranked by money per second
 */
function getBestMoney(ns) {

    // // Refresh "/data/networks.json" then loads servers []
    scanNetwork(ns, true);
    const servers = JSON.parse(ns.read("data/networks.json"));

    // loads config
    const cfg = JSON.parse(ns.read("data/cfg.json"));

    // declare arr to keep track of best targets in desc order to be returned at the end of the function
    // each slot has [hostname, value per second]
    const rankedTargets = [];

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

        // Add hackable servers to an arr (UNSORTED)
        rankedTargets.push({ hostname: server.hostname, moneyPerSec });
    }

    // Sorts array by highest expected value per second
    rankedTargets.sort((a, b) => b.moneyPerSec - a.moneyPerSec);

    // Catch error if empty
    if (rankedTargets.length === 0) {
        ns.print("Error: No valid targets found. Check requirements in cfg.json.");
        return [];
    }

    // then returns array of servers that meets the requirements from cfg.json
    // each slot has hostname and money per second for each server for the purpose of printing later
    return rankedTargets;
}

// Called by deployer for security check
/**
 * Retrieves the minimum security level for a known target server.
 * @param {NS} ns - The Netscript API object
 * @param {string} hostname - The hostname of the target server
 * @returns {number|null} The minimum difficulty of the server, or null if not found
 */
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