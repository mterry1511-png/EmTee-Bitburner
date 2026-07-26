
export async function main(ns) {
    if (!ns.gang.inGang()) {
        ns.tprint("Error: You need a gang.");
        return;
    }

    // open tail by default
    ns.ui.openTail();
    // ns.ui.setTailMinimized(false); // true: min, false: max
    // ns.ui.moveTail(1380, 0);
    // ns.ui.resizeTail(800,400);

    ns.disableLog("disableLog");
    ns.disableLog("gang.purchaseEquipment");

    const cfg = JSON.parse(ns.read("/data/cfg.json"));

    const equipments = ns.gang.getEquipmentNames();
    const members = ns.gang.getMemberNames();

    // Observes cfg settings
    let shoppingList = [];

    // build list and sort
    for (const equipment of equipments) {
        const cost = ns.gang.getEquipmentCost(equipment);
        const player = ns.getPlayer();         // Update player object before reading it

        if (cost > player.money) {
            continue;
        }

        else {
            shoppingList.push({ item: equipment, cost: cost });           // Add to shopping list
        }
    }

    shoppingList.sort((a, b) => a.cost - b.cost);

    // flags for printing results
    let boughtSomething = false;
    let brokie = true;

    // buy until can't afford
    outer: for (let listItem = 0; listItem < shoppingList.length; listItem++) {
        for (let member = 0; member < members.length; member++) {
            const player = ns.getPlayer();         // Update player object before reading it
            if (player.money < shoppingList[listItem].cost) {
                break outer;
            }

            brokie = false;     // you're not broke you just dont need the item

            // print if we can afford
            if (ns.gang.purchaseEquipment(members[member], shoppingList[listItem].item,)) {
                ns.print("Purchased " + members[member] + " a " + shoppingList[listItem].item + " for " + shoppingList[listItem].cost);
                boughtSomething = true;
            }
        }
    }

    if (!boughtSomething) {
        if (brokie) {
            ns.print("Could not afford anything");
        }
        else {
            ns.print("Did not purchase anything - all items owned already");
        }
    }
}
