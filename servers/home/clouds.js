/**
 * Reads clouds.json file.
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
 */
export async function main(ns) {
    const clouds = JSON.parse(ns.read("./data/clouds.json"));
    
    // open tail by default
    ns.ui.openTail();
    ns.ui.setTailMinimized(false); // true: min, false: max
    // ns.ui.moveTail(1380, 0);
    ns.ui.resizeTail(800,400);

    // print
    ns.print(clouds);
}