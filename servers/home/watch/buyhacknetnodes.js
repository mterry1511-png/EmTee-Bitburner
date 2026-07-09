/** @typedef {"NODE" | "LEVEL" | "RAM" | "CORE"} UpgradeAspect */
/**
 * @typedef {Object} CheapestUpgrade
 * @property {number} nodeIndex
 * @property {UpgradeAspect} aspect
 */


/**
 * buy hacknet nodes and upgrades - whatever the player can afford first. import buyCheapest and use in line for a single upgrade
 * or ns.exec buyhacknetnods.js to upgrade until the player can't afford
 *
 * @export
 * @async
 * @param {NS} ns 
 * @returns {Promise<void} 
 */
export async function main(ns) {
    const cfgglobal = JSON.parse(ns.read("/data/cfg.json"));

    while (buyCheapest(ns)) {
        await ns.sleep(cfgglobal.hacknetBuySleep);
    }
}

/**
 * Buys hacknet nodes and upgrades — whichever the player can afford first.
 * @export
 * @param {NS} ns
 * @returns {boolean} Whether a node was purchased or upgraded.
 */
export function buyCheapest(ns) {
    const cfg = JSON.parse(ns.read("/data/cfg.json"));

    const nodeCount = ns.hacknet.numNodes();
    const newNodeCost = ns.hacknet.getPurchaseNodeCost();
    const player = ns.getPlayer();
    let cheapest = { nodeIndex: null, aspect: "NODE" };       // Declared using new node cost to start
    let cost = ns.hacknet.getPurchaseNodeCost();              // and it's cost
    let msg;
    

    // loops for each  to find cheapest possible upgrade
    for (let node = 0; node < nodeCount; node++) {
        const levelCost = ns.hacknet.getLevelUpgradeCost(node, 1);
        const ramCost = ns.hacknet.getRamUpgradeCost(node, 1);
        const coreCost = ns.hacknet.getCoreUpgradeCost(node, 1);

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

    // can player afford?
    if ((player.money * (cfg.hacknetPercSpend / 100)) < cost) {
        msg = "\nCannot afford a Hacknet Upgrade. Requires $" + cost;
        // msg = msg + ". The current hacknetPercSpend is " + cfg.hacknetPercSpend + "%."
        ns.print(msg);
        return false;
    }

    //execute and return
    switch (cheapest.aspect) {
        case "NODE": {
            if (ns.hacknet.purchaseNode()) {
                msg = "\nPurchased new Hacknet Node up to " + ns.hacknet.numNodes();
                return true;
            }
            ns.print("Error");
            return false;
        }

        case "LEVEL": {
            if (ns.hacknet.upgradeLevel(cheapest.nodeIndex, 1)) {
                msg = "\nUpgraded Level on Hacknet node " + cheapest.nodeIndex;
                ns.print(msg);
                return true;
            }
            ns.print("Error");
            return false;
        }

        case "RAM": {
            if (ns.hacknet.upgradeRam(cheapest.nodeIndex, 1)) {
                msg = "\nUpgraded RAM on Hacknet node " + cheapest.nodeIndex;
                ns.print(msg);
                return true;
            }
            ns.print("Error");
            return false;
        }

        case "CORE": {
            if (ns.hacknet.upgradeCore(cheapest.nodeIndex, 1)) {
                msg = "\nUpgraded Core on Hacknet node " + cheapest.nodeIndex;
                ns.print(msg);
                return true;
            }
            ns.print("Error");
            return false;
        }
    }
}




/**
 * Get node stats
 *
 * @export
 * @param {NS} ns 
 * @returns {{}} Returns object with node. Use JSON.stringify(obj,null,2) to output.
 */
export function getNodeStats(ns) {
    const nodeCount = ns.hacknet.numNodes();
    const allStats = [];

    for (let i = 0; i < nodeCount; i++) {
        allStats.push(ns.hacknet.getNodeStats(i));
    }

    return allStats;
}