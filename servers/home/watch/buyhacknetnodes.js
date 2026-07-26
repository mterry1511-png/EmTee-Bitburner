import * as format from "../lib/format.js";

/** @typedef {"NODE" | "LEVEL" | "RAM" | "CORE"} UpgradeAspect */
/**
 * @typedef {Object} CheapestUpgrade
 * @property {number} nodeIndex
 * @property {UpgradeAspect} aspect
 */


// ============================================================================
// buyhacknetnodes.js — hacknet purchasing.
//
// NO SF4 / SINGULARITY REQUIRED. The entire ns.hacknet.* namespace is available
// without Source-File 4, so nothing in this file is gated or inert. Do not add
// a Singularity capability check here — it would be wrong and would disable
// working code.
// ============================================================================

/**
 * Buy hacknet nodes and upgrades on a loop until nothing further is affordable.
 *
 * Repeatedly calls `buyCheapest`, sleeping `cfg.hacknetBuySleep` ms between
 * purchases, and stops the moment `buyCheapest` returns false. Because the loop
 * condition IS the purchase, a single false return ends the script - it does
 * not sit and wait for money to accumulate.
 *
 * For a one-off purchase, import and call `buyCheapest` directly instead of
 * exec'ing this file.
 *
 * @export
 * @async
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
 */
export async function main(ns) {
    const cfgglobal = JSON.parse(ns.read("/data/cfg.json"));

    while (buyCheapest(ns)) {
        await ns.sleep(cfgglobal.hacknetBuySleep);
    }
}

/**
 * Make a single hacknet purchase — a new node if one is affordable, otherwise
 * the cheapest available level/RAM/core upgrade across all owned nodes.
 *
 * Despite the name this is NOT purely "buy the cheapest thing". It scans every
 * node for the cheapest single upgrade, then the override block below throws
 * that result away and buys a NODE instead whenever a node is affordable at
 * all, ignoring cfg.hacknetPercSpend. Node-first is the deliberate policy (more
 * nodes beats deeper nodes early on); the name and the search loop just do not
 * reflect it.
 *
 * Spending rule differs between the two paths, which is easy to miss:
 *   - new NODE: gated on raw `player.money > nodeCost`, no percentage applied.
 *   - any UPGRADE: gated on `player.money * (hacknetPercSpend / 100) >= cost`.
 * So a LOW hacknetPercSpend makes upgrades harder to afford without making
 * nodes any harder, which biases the script even further toward buying nodes.
 *
 * @export
 * @param {NS} ns - The Netscript API object
 * @returns {boolean} True if a node was purchased or an upgrade applied; false
 *   if nothing was affordable or the purchase call failed.
 */
export function buyCheapest(ns) {
    const cfg = JSON.parse(ns.read("/data/cfg.json"));

    const nodeCount = ns.hacknet.numNodes();
    const newNodeCost = ns.hacknet.getPurchaseNodeCost();   // unused - nodeCost below is the one actually read
    const player = ns.getPlayer();                          // snapshotted once; money is only read, never re-read after a purchase
    let cheapest;                                           // inst below
    let cost;                                           // inst below
    let msg;

    // NODE
    // outside of the loop as this is global -  not specific to each node
    const nodeCost = ns.hacknet.getPurchaseNodeCost();
    cheapest = { nodeIndex: null, aspect: "NODE" };       // Load new node cost as default to start
    cost = nodeCost                                        // and the cost of a new node also

    // Seeding cheapest/cost with the new-node option means the loop below only
    // ever replaces it with something STRICTLY cheaper than a new node.
    // loops for each  to find cheapest possible upgrade
    for (let node = 0; node < nodeCount; node++) {

        const levelCost = ns.hacknet.getLevelUpgradeCost(node, 1);
        const ramCost = ns.hacknet.getRamUpgradeCost(node, 1);
        const coreCost = ns.hacknet.getCoreUpgradeCost(node, 1);


        // These use <= rather than <, so on a COST TIE the later candidate wins:
        // CORE beats RAM beats LEVEL, and the highest node index beats the
        // lowest. That is the exact reverse of the LEVEL -> RAM -> CORE priority
        // stated in the decision-tree comment below. Ties are common because
        // freshly-bought nodes all have identical upgrade costs.
        // LEVEL
        if (levelCost <= cost) { cheapest = { nodeIndex: node, aspect: "LEVEL" }; cost = levelCost }
        // RAM
        if (ramCost <= cost) { cheapest = { nodeIndex: node, aspect: "RAM" }; cost = ramCost }
        // CORE
        if (coreCost <= cost) { cheapest = { nodeIndex: node, aspect: "CORE" }; cost = coreCost }
    }

    //
    //
    // decision tree
    //      NODE overwrite
    // It is likely more beneficial to buy in order NODE-> LEVEL -> RAM -> CORE
    // NODE being most important. This switches to NODE if the player can afford (IGNORES cfg.hacknetPercSpend)
    // which means that the lower that cfg.hacknetPercSpend is - the more often this will trigger
    //      Can player afford?
    // if not - proceed as normal with cheapest if player can afford (applying cfg.hacknetPercSpend)
    //
    // Consequence worth knowing: when a node IS affordable this discards the
    // entire search loop above, so that whole scan was wasted work for this
    // call. Early on, when nodes are cheap, that is nearly every call.
    if (player.money > nodeCost) {
        cheapest = { nodeIndex: null, aspect: "NODE" };       
        cost = nodeCost                                        

    }
    else if ((player.money * (cfg.hacknetPercSpend / 100)) < cost) {
        msg = "\nCannot afford a Hacknet Upgrade. Requires " + format.money(cost);
        // msg = msg + ". The current hacknetPercSpend is " + cfg.hacknetPercSpend + "%."
        ns.print(msg);
        return false;
    }



    // Execute whichever purchase survived the decision tree above.
    // Each case needs its own {} block: `const`/`let` declared bare inside a
    // switch case shares the switch's single block scope and redeclares across
    // cases. (No declarations here today, but the braces keep it safe to add
    // one later.)
    // Every branch returns, so control never falls through to the next case.
    //execute and return
    switch (cheapest.aspect) {
        case "NODE": {
            if (ns.hacknet.purchaseNode()) {
                // NOTE: msg is built but never printed on this path, unlike the
                // three upgrade cases below - buying a node is silent.
                msg = "\nPurchased new Hacknet Node up to " + ns.hacknet.numNodes();
                return true;
            }
            ns.print("Error purchasing a new node");
            return false;
        }

        case "LEVEL": {
            if (ns.hacknet.upgradeLevel(cheapest.nodeIndex, 1)) {
                msg = "\nUpgraded Level on Hacknet node " + cheapest.nodeIndex;
                ns.print(msg);
                return true;
            }
            ns.print("Error purchasing a level on node-" + cheapest.nodeIndex);
            return false;
        }

        case "RAM": {
            if (ns.hacknet.upgradeRam(cheapest.nodeIndex, 1)) {
                msg = "\nUpgraded RAM on Hacknet node " + cheapest.nodeIndex;
                ns.print(msg);
                return true;
            }
            ns.print("Error purchasing RAM on node-" + cheapest.nodeIndex);
            return false;
        }

        case "CORE": {
            if (ns.hacknet.upgradeCore(cheapest.nodeIndex, 1)) {
                msg = "\nUpgraded Core on Hacknet node " + cheapest.nodeIndex;
                ns.print(msg);
                return true;
            }
            ns.print("Error purchasing a core on node-" + cheapest.nodeIndex);
            return false;
        }
    }
}



/**
 * Collect the stats of every owned hacknet node.
 *
 * Pure data retrieval - deliberately does no printing, per the project's
 * separate-retrieval-from-output convention. Pass the result through
 * JSON.stringify(stats, null, 2) at the call site if you want it readable.
 *
 * Returns an ARRAY indexed the same way as the node indices used by the
 * ns.hacknet.upgrade* calls, so `stats[3]` is the node `upgradeRam(3, 1)`
 * would affect. (The @returns tag previously claimed a single object.)
 *
 * @export
 * @param {NS} ns - The Netscript API object
 * @returns {NodeStats[]} One stats object per owned node, in node-index order;
 *   an empty array if no nodes are owned.
 */
export function getNodeStats(ns) {
    const nodeCount = ns.hacknet.numNodes();
    const allStats = [];

    for (let i = 0; i < nodeCount; i++) {
        allStats.push(ns.hacknet.getNodeStats(i));
    }

    return allStats;
}