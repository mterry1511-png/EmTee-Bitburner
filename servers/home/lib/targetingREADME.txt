Usage:
// Normal usage: Import targeting.js and call getTarget() directly. Returns server.hostname
// pass mode to define the behaviour as arg[0] 
// i.e:
// "best" - Returns hostname of a server that we have root access to with the highest expected value per second (moneyMax * hackChance / hackTime)
// "hacklvl" - Returns hostname of a server that we have root access to with the highest hackable level. 

        i.e.
            import * as targeting from "./lib/targeting.js"; 

            const targetHostname = targeting.getTarget(ns, "best");
            await ns.hack(target);


function getBestHackLvlTarget(ns)
    Refreshes networks.json with a fresh scan
    Loads servers and config
    For each server, skips it if any of these apply: no root access, hack chance below threshold (Formulas only), moneyMax below minimum, serverGrowth below minimum, on the exclude list
    Calculates moneyPerSec — either via Formulas (standardised at minDifficulty and moneyThresh) or via raw NS functions
    Tracks whichever server has the highest requiredHackingSkill
    Returns that server's hostname, moneyPerSec, and requiredHackingSkill



function getBestMoney(ns)
    Refreshes networks.json with a fresh scan
    Loads servers and config
    For each server, skips it if any of these apply: no root access, hack chance below threshold at min security (Formulas only), moneyMax below minimum, serverGrowth below minimum, on the exclude list
    Calculates moneyPerSec — via Formulas standardised at minDifficulty and moneyThresh, or via raw NS functions at current server state
    Tracks whichever server yields the highest moneyPerSec
    Returns that server's hostname and moneyPerSec