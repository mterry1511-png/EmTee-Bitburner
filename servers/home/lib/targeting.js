import { scanNetwork } from "../scanner.js";
import * as format from "../lib/format.js";

/**
 * @typedef {"best"|"ranked"|"easy"|"hacklvl"} TargetMode
 */

/**
 * Known targeting modes accepted by targeting logic.
 * Exported so callers (and autocomplete handlers) can validate a mode string
 * against the same list this module switches on.
 * @type {TargetMode[]}
 */
export const knownModes = ["best", "ranked", "easy", "hacklvl"];

// Normal usage: import and call getTarget directly. See docs/!readme/targetingREADME.txt for full usage.
/**
 * Terminal entry point - resolve a target for the mode given as arg[0] and
 * let getTarget's own printing report it.
 *
 * Running this from the terminal is really only useful for eyeballing what the
 * targeting logic currently picks: a value returned from main() is discarded by
 * the game, so the return below reaches nobody. Other scripts should import
 * getTarget instead of running this file.
 *
 * Usage: run lib/targeting.js [mode]
 *   mode: "best" (default), "ranked", "easy", or "hacklvl"
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<string|string[]>} Single hostname for "best"/"easy"/"hacklvl", array of hostnames for "ranked" - discarded by the game
 */
export async function main(ns) {
    const mode = ns.args[0];
    const targetHostname = getTarget(ns, mode);
    return targetHostname;
}

/**
 * Choose a target hostname (or a ranked list of them) according to the
 * requested mode. This is the public entry point for the whole module - every
 * other function here is a private helper feeding this switch.
 *
 * Each single-target mode does the same three steps: pick, print, warn if the
 * pick isn't rooted. The pick itself is what varies:
 *   "best"    - highest expected money/sec (getBestMoney, first element)
 *   "ranked"  - the whole money/sec ordering as an array of hostnames
 *   "hacklvl" - highest requiredHackingSkill that still passes the cfg filters
 *   "easy"    - hardcoded n00dles, no analysis at all
 * An unrecognised or missing mode falls through to the default case, which is
 * a duplicate of "best" (see the DRY note there).
 * @param {NS} ns - The Netscript API object
 * @param {TargetMode|undefined} mode - Targeting mode: "best", "ranked", "easy", "hacklvl", or undefined (defaults to "best")
 * @returns {string|string[]} Single hostname for "best"/"easy"/"hacklvl", array of hostnames for "ranked"
 */
export function getTarget(ns, mode) {
    // Select mode based on argument passed
    switch (mode) {
        case "best": {
            // Call mode specific function
            // Shares getBestMoney with "ranked" case, but takes only the top entry
            const targets = getBestMoney(ns);
            // NOTE: getBestMoney returns [] when nothing passes the cfg filters,
            // so target is undefined here and the .hostname reads below throw.
            const target = targets[0];
            // print function
            printTarget(ns, target.hostname, mode, target.moneyPerSec);
            // Warn (but don't stop) if the chosen target isn't rooted yet
            validateTargetRooted(ns, target.hostname);
            // returns hostname given from mode specific function
            return target.hostname;
        }

        case "ranked": {
            // Call mode specific function
            // Same analysis as "best", but hands back every qualifying server in
            // descending money/sec order instead of just the winner.
            const targets = getBestMoney(ns);
            //print function
            ns.print("Hackable servers ranked in array, n=" + targets.length);
            // Strip the moneyPerSec field - callers only want the hostnames
            return targets.map(t => t.hostname);
        }

        case "hacklvl": {
            // Call mode specific function
            // Unlike getBestMoney, this returns a single object, not an array.
            const target = getBestHackLvlTarget(ns);
            // print function
            printTarget(ns, target.hostname, mode, target.moneyPerSec);
            // Warn (but don't stop) if the chosen target isn't rooted yet
            validateTargetRooted(ns, target.hostname);
            // returns hostname given from mode specific function
            return target.hostname;
        }

        case "easy": {
            // n00dles is the game's starter server - always available, trivial
            // to hack, so no analysis is needed. Useful for XP grinding.
            const target = "n00dles"
            // print function
            printTarget(ns, target, mode);
            // Validate that n00dles is rooted before returning
            validateTargetRooted(ns, target);
            // returns hostname given from mode specific function
            return target;
        }

        default: {
            // Unknown or omitted mode - say so on both the log and the terminal,
            // then behave exactly like "best".
            ns.print("Targeting mode not specified. Using default mode: best");
            ns.tprint("Targeting mode not specified. Using default mode: best");

            // Call mode specific function
            // DRY: this block is a copy of the "best" case above - the only
            // difference is the hardcoded "best" passed to printTarget, since
            // `mode` here is whatever unrecognised value came in.
            const targets = getBestMoney(ns);
            const target = targets[0];
            // print function
            printTarget(ns, target.hostname, "best", target.moneyPerSec);
            // Warn (but don't stop) if the chosen target isn't rooted yet
            validateTargetRooted(ns, target.hostname);
            // returns hostname given from mode specific function
            return target.hostname;
        }
    }
}

/**
 * Check that a chosen target has been rooted, warning loudly if it hasn't.
 * This is advisory only - it returns the result but never throws or blocks, and
 * every caller in getTarget ignores the return value and hands the hostname
 * back regardless. The point is to surface a misconfiguration, not prevent it.
 * @param {NS} ns - The Netscript API object
 * @param {string} hostname - The hostname of the target server
 * @returns {boolean} True if rooted, false otherwise
 */
function validateTargetRooted(ns, hostname) {
    const isRooted = ns.hasRootAccess(hostname);
    if (!isRooted) {
        ns.print(`WARNING: Target ${hostname} does not have root access!`);
        ns.tprint(`WARNING: Target ${hostname} does not have root access!`);
    }
    return isRooted;
}

// Logs why a target was chosen, then echoes it to the terminal
/**
 * Report a targeting result: a mode-specific "why this one" line to the script
 * log, followed by the target itself on both the terminal and the log.
 *
 * The "easy" case returns early, so it only ever writes the reason line to the
 * log and never touches the terminal. Any mode not listed in the switch (e.g.
 * "ranked", though it doesn't call this) falls straight through to the shared
 * terminal print with no reason line.
 *
 * The moneyPerSec parameter is accepted but never used - callers pass it, this
 * function ignores it.
 * @param {NS} ns - The Netscript API object
 * @param {string} target - The hostname of the target server
 * @param {TargetMode} mode - The targeting mode (best, hacklvl, easy)
 * @param {number} [moneyPerSec] - The money per second for this target - currently unused
 * @returns {void}
 */
function printTarget(ns, target, mode, moneyPerSec) {
    // Mode-specific explanation line, log only
    switch (mode) {
        case "best": { ns.print(target + " was selected based on the highest money per second at threshold."); break; }
        case "hacklvl": { ns.print(target + " was selected based on the highest hack level possible."); break; }
        case "easy": { ns.print(target + " was selected because it's easy as fuck to hack."); return; }
    } 
}


// Returns the server we have root access to with the highest required hacking
// level, among those that pass the cfg.json target requirements.
/**
 * Find the highest-hacking-level target that satisfies the configured thresholds.
 *
 * Structurally near-identical to getBestMoney below - same rescan, same cfg
 * filters, same money/sec maths - the only real difference is the final
 * comparison, which ranks on requiredHackingSkill rather than moneyPerSec, and
 * that it keeps a single running best instead of building a sorted array.
 * The moneyPerSec it computes is carried along only so the caller can print it.
 * @param {NS} ns - The Netscript API object
 * @returns {{hostname: string, moneyPerSec: number, requiredHackingSkill: number}} The winning server; hostname is "" if nothing qualified
 */
function getBestHackLvlTarget(ns) {

    // Refresh "/data/networks.json" then load the servers array back out of it.
    // NOTE: scanNetwork is async and is not awaited here, so the read below can
    // race the rescan and see the previous cycle's data.
    scanNetwork(ns, true);
    const servers = JSON.parse(ns.read("data/networks.json"));

    // loads config
    const cfg = JSON.parse(ns.read("data/cfg.json"));

    // declare variable to keep track of best target to be returned at the end of the function
    // hostname, value per second, and the hack level we're actually ranking on.
    // Seeded with requiredHackingSkill 0 so the first qualifying server wins.
    let bestTarget = { hostname: "", moneyPerSec: 0, requiredHackingSkill: 0 };

    // ns.formulas.* is gated behind owning Formulas.exe, so check once up front
    // and branch on it rather than trying/catching per server
    const hasFormulas = ns.fileExists("Formulas.exe", "home");

    // Player object (hacking skill, multipliers) - required input for every
    // formulas call, and constant across the loop, so fetch it once
    const player = ns.getPlayer();

    // Loop every server, discard the ones failing the cfg thresholds, and keep
    // whichever survivor has the highest required hacking level
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
            // hackPercent: fraction of the server's money one thread steals
            // hackChance:  probability the hack succeeds at all
            // hackTimeMs:  how long a single hack takes
            const hackPercent = ns.formulas.hacking.hackPercent(serverAtThresh, player);
            const hackChance = ns.formulas.hacking.hackChance(serverAtThresh, player);
            const hackTimeMs = ns.formulas.hacking.hackTime(serverAtThresh, player);
            // Expected money per second = (money on hand at threshold * fraction
            // stolen * success odds) / hack time in seconds.
            // Written inline here; getBestMoney splits the numerator out into a
            // rewardAtThresh const but computes the same thing.
            moneyPerSec =
                (server.moneyMax * cfg.moneyThresh * hackPercent * hackChance)
                / (hackTimeMs / 1000);
        }

        // If we don't have Formulas.exe, use a worse calculation that doesn't account for security AT ALL.
        // These ns.* analysis calls read the server's *live* state, so a server
        // sitting at high security scores worse than it eventually would once
        // weakened - unlike the formulas branch, which standardises everything.
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
        // so far. Note moneyPerSec is computed for every server above but plays
        // no part in this comparison - it's carried purely for display.
        if (server.requiredHackingSkill > bestTarget.requiredHackingSkill) {
            bestTarget = { hostname: server.hostname, moneyPerSec: moneyPerSec, requiredHackingSkill: server.requiredHackingSkill };
        }
    }

    // returns the server with the highest hackable level that meets the requirements from cfg.json
    // as a single object - hostname, money per second (for printing), and the level it won on.
    // If nothing qualified this is still the seed object with hostname "".
    return bestTarget;
}


// Ranks every rooted server that passes the cfg.json thresholds by expected
// money per second (money at threshold * hackPercent * hackChance / hackTime).
// Backs both the "best" mode (take element 0) and the "ranked" mode (take all).
/**
 * Rank every accessible, qualifying server by expected money-per-second, best first.
 *
 * "Expected" here means probability-weighted: the reward is scaled by hackChance
 * so a fat but unreliable target doesn't beat a leaner certain one. Every server
 * is evaluated at the *same* standardised state - money at cfg.moneyThresh and
 * security at minimum - so the comparison is fair regardless of what state each
 * server happens to be in right now.
 * @param {NS} ns - The Netscript API object
 * @returns {{hostname: string, moneyPerSec: number}[]} Targets sorted by money per second descending; empty array if nothing qualified
 */
function getBestMoney(ns) {

    // Refresh "/data/networks.json" then load the servers array back out of it.
    // NOTE: scanNetwork is async and is not awaited here, so the read below can
    // race the rescan and see the previous cycle's data.
    scanNetwork(ns, true);
    const servers = JSON.parse(ns.read("data/networks.json"));

    // loads config
    const cfg = JSON.parse(ns.read("data/cfg.json"));

    // declare arr to collect qualifying targets - filled unsorted, then sorted
    // into descending money/sec at the end of the function.
    // each slot is { hostname, moneyPerSec }
    const rankedTargets = [];

    // ns.formulas.* is gated behind owning Formulas.exe, so check once up front
    // and branch on it rather than trying/catching per server
    const hasFormulas = ns.fileExists("Formulas.exe", "home");

    // Player object (hacking skill, multipliers) - required input for every
    // formulas call, and constant across the loop, so fetch it once
    const player = ns.getPlayer();

    // Loop every server, discard the ones failing the cfg thresholds, and push
    // each survivor with its expected money per second
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
            // hackPercent: fraction of the server's money one thread steals
            // hackChance:  probability the hack succeeds at all
            // hackTimeMs:  how long a single hack takes
            const hackPercent = ns.formulas.hacking.hackPercent(serverAtThresh, player);
            const hackChance = ns.formulas.hacking.hackChance(serverAtThresh, player);
            const hackTimeMs = ns.formulas.hacking.hackTime(serverAtThresh, player);

            // Calculate expected value per second at moneyThresh:
            // probability-weighted take, divided by the hack time in seconds
            const rewardAtThresh = (serverAtThresh.moneyAvailable * hackPercent * hackChance);
            moneyPerSec = (rewardAtThresh / (hackTimeMs / 1000));
        }

        // If we don't have Formulas.exe, use a worse calculation that doesn't account for security AT ALL.
        // These ns.* analysis calls read the server's *live* state, so a server
        // sitting at high security scores worse than it eventually would once
        // weakened - unlike the formulas branch, which standardises everything.
        else {
            // consts for calculation
            const hackPercent = ns.hackAnalyze(server.hostname);
            const hackChance = ns.hackAnalyzeChance(server.hostname);
            const hackTimeMs = ns.getHackTime(server.hostname);

            // Calculate expected value per second at moneyThresh simplified
            const rewardAtThresh = ((server.moneyMax * cfg.moneyThresh) * hackPercent * hackChance);
            moneyPerSec = (rewardAtThresh / (hackTimeMs / 1000));
        }

        // Add hackable servers to an arr (UNSORTED) - shorthand property syntax,
        // so { moneyPerSec } is { moneyPerSec: moneyPerSec }
        rankedTargets.push({ hostname: server.hostname, moneyPerSec });
    }

    // Sorts array by highest expected value per second.
    // b - a gives descending order, so index 0 is the best target.
    rankedTargets.sort((a, b) => b.moneyPerSec - a.moneyPerSec);

    // Nothing passed the filters - warn on the log and hand back an empty array.
    // Callers taking [0] from this will get undefined; see getTarget's "best" case.
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
 * Look up a server's minimum security level from the cached network scan.
 *
 * Reads the already-written networks.json rather than calling ns.getServer, so
 * the deployer can ask "how low can this server's security go?" without loading
 * and parsing networks.json itself. Note this does NOT rescan - it reflects
 * whatever the last scanNetwork wrote.
 * @param {NS} ns - The Netscript API object
 * @param {string} hostname - The hostname of the target server
 * @returns {number|null} The minimum difficulty of the server, or null if not found in networks.json
 */
export function getMinDifficulty(ns, hostname) {
    const servers = JSON.parse(ns.read("data/networks.json"));
    const serverData = servers.find(s => s.hostname === hostname);

    // error handling - unknown hostname, or networks.json is stale and predates
    // this server being discovered
    if (!serverData) {
        ns.print(`Error: ${hostname} not found in networks.json`);
        return null;
    }

    //return without deployer needing to load up networks.json
    return serverData.minDifficulty;
}