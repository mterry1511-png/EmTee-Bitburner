/**
 * Dumps the current contents of /data/cfg.json into this script's tail window.
 * Read-only - the only cfg script that never writes. Output goes to the tail via
 * ns.print rather than ns.tprint so the whole config can sit in its own resizable
 * window instead of flooding the terminal.
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
 */
export async function main(ns) {
    const cfg = JSON.parse(ns.read("/data/cfg.json"));

    // The tail window is the whole point of this script, so open and size it before
    // printing rather than waiting for the user to click through to it
    ns.ui.openTail();
    ns.ui.setTailMinimized(false); // true: min, false: max
    // Left over from pinning the window to a fixed screen position - kept as a
    // reminder of the call, since window placement is monitor-dependent
    // ns.ui.moveTail(1380, 0);
    ns.ui.resizeTail(1000,500);

    // Printed as an object, not a string - Bitburner pretty-prints objects passed
    // to ns.print, so the nesting stays readable without a manual JSON.stringify
    ns.clearLog();
    ns.print(cfg);
}