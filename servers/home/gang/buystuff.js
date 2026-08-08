// ============================================================================
// buystuff.js — gang equipment purchasing. One-shot, not a daemon.
//
// Buys equipment (weapons, armour, vehicles, rootkits, augmentations) for every
// gang member, cheapest item first, until money runs out. Runs once and exits.
//
// Requires an active gang. ns.gang.* is NOT SF4-gated - it needs a gang, which
// is a BitNode 2 / SF2 karma unlock, not Singularity.
// ============================================================================

/**
 * Buy every affordable piece of gang equipment for every gang member,
 * cheapest-first, until the money runs out.
 *
 * Two passes. The first builds a shopping list of items currently affordable
 * and sorts it ascending by cost. The second walks that list outer / members
 * inner, so it kits out ALL members with the cheapest item before moving to the
 * next price tier rather than fully equipping member one and leaving the rest
 * bare.
 *
 * `ns.gang.purchaseEquipment` returns false rather than throwing when a member
 * already owns the item, so re-running this is safe and idempotent - it just
 * buys whatever is newly affordable.
 *
 * Known rough edges, documented rather than fixed here:
 *   - The `cfg` read below is unused; the "Observes cfg settings" comment is
 *     stale. It observes nothing and has no spend cap.
 *   - The affordability filter in the build pass uses money as it stands BEFORE
 *     any purchase, and the list is never rebuilt as money drains.
 *   - The `brokie` flag is cleared before any purchase is attempted, so the
 *     "Could not afford anything" message is nearly unreachable.
 *
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>} Resolves once the shopping pass finishes; returns
 *   early without buying anything if the player has no gang.
 */
export async function main(ns) {
    if (!ns.gang.inGang()) {
        ns.tprint("Error: You need a gang.");
        return;
    }

    const cfg = JSON.parse(ns.read("/data/cfg.json"));

    if (cfg.gangCfg.autoAscend && !ns.args.includes("override") ) {
        ns.tprint("Error: Disable auto ascend or override with arg 'override'");
        return;
    }

    // open tail by default
    ns.ui.openTail();
    // ns.ui.setTailMinimized(false); // true: min, false: max
    // ns.ui.moveTail(1380, 0);
    // ns.ui.resizeTail(800,400);

    // disableLog("disableLog") silences the log line that disableLog itself
    // emits - an idiom, not a typo. The second call silences the per-purchase
    // API log so only our own ns.print lines appear in the tail.
    ns.disableLog("disableLog");
    ns.disableLog("gang.purchaseEquipment");

    const equipments = ns.gang.getEquipmentNames();
    const members = ns.gang.getMemberNames();

    // will observe cfg settings
    let shoppingList = [];

    // Build pass: keep every item affordable at CURRENT money, then sort
    // cheapest-first so the buy pass spreads spend across all members before
    // moving up a price tier.
    // build list and sort
    for (const equipment of equipments) {
        const cost = ns.gang.getEquipmentCost(equipment);
        // Re-read each iteration, but nothing is purchased in this loop, so
        // money cannot change here - the comment overstates what this does.
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

    // Buy pass. Outer loop = item (cheapest first), inner loop = member, so
    // every member gets item N before anyone gets item N+1.
    // The labelled `outer:` break abandons the WHOLE pass the moment an item is
    // unaffordable - correct, because the list is cost-ascending, so anything
    // further along costs at least as much.
    // buy until can't afford
    outer: for (let listItem = 0; listItem < shoppingList.length; listItem++) {
        for (let member = 0; member < members.length; member++) {
            const player = ns.getPlayer();         // Update player object before reading it
            if (player.money < shoppingList[listItem].cost) {
                break outer;
            }

            // Set before any purchase is attempted, so this only stays true when
            // the shopping list or the member list is empty. It does not
            // actually distinguish "broke" from "already owned".
            brokie = false;     // you're not broke you just dont need the item

            // purchaseEquipment returns false when the member already owns the
            // item - so a false here is normal, not an error.
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
