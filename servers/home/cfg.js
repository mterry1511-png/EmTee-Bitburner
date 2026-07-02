/**
 * Reads cfg.json config file as log 
 * COULD BE UPGRADED WiTH SINGULARITY
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
 */
export async function main(ns) {
    const cfg = JSON.parse(ns.read("./data/cfg.json"));
    
    // open tail by default
    ns.ui.openTail();
    ns.ui.setTailMinimized(false); // true: min, false: max
    // ns.ui.moveTail(1380, 0);
    ns.ui.resizeTail(1000,500);

    // print
    ns.print(cfg);
}