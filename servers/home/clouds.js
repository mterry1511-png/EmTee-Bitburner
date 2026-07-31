/**
 * Viewer script: dumps the current contents of the cloud server registry into a
 * tail window so it can be eyeballed without opening the file.
 *
 * Read-only - it never writes. The file it reads is written by scanCloud in
 * scanner.js (and patched directly by buycloud.js / renamecloud.js), and has the
 * shape `{ [hostname: string]: { maxRam: number } }`.
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
 */
export async function main(ns) {
    const clouds = JSON.parse(ns.read("./data/clouds.json"));
    
    // open tail by default - this script has no terminal output, the tail IS the output
    ns.ui.openTail();
    ns.ui.setTailMinimized(false); // true: min, false: max
    // ns.ui.moveTail(1380, 0);
    ns.ui.resizeTail(800,400);

    // print the parsed object - ns.print renders objects readably, no stringify needed
    ns.clearLog();
    ns.print(clouds);
}
