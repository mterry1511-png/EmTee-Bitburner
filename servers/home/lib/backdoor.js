import { jsonEdit } from "../lib/util.js";

/**
 * SINGULARITY REQUIRED
 * Backdoors servers - faction related servers prioritised
 * Controlled by daemon.js
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
 */
export async function main(ns) {
    // Adds to cfg.json if player has singularity access
    const hasSf4 = ns.getResetInfo().ownedSF.get(4) > 0;
    const inBn4 = ns.getResetInfo().currentNode === 4;
    if (hasSf4 || inBn4) {
        ns.print("̷̢̛͇̈́̕͝ͅ▓̶̜̈́▒̸͙͌░̴̭̈ ░̷̙̋▒̶̜̈▓̶̬͌ ̷̺̽▓̸͍̀▒̴͌░̷͇͑ ░̴͈͝▒̸̗̆▓̸͌ ̵̯̕▓̸͇͑░̶͈͝▒̷͕̌ ̴̙̒▒̸̮̈▓̵̙̒░̴̭͊");
        ns.print("̸̢̛U̷͖̅S̵̗̈́E̶̢͐R̷̤̀ ̴̼̚H̶̻͐A̸͙͌S̴̭̈ ̷̙̋S̶̜̈I̶̬͌N̷̺̽G̸͍̀Ṵ̴͌L̷͇̑A̴͈͝R̸̗̆Ị̸͌T̵̯̕Y̸͇͑ ̶͈͝Ǎ̷͕C̴͙̒C̸̮̈E̵̙̒S̴̭͊S̸̙̏)");
        jsonEdit(ns, "hasSingularity", true);
    }
}

function printusage(ns) {

}

function buildList(ns) {

}

function callBackdoor(ns) {

}