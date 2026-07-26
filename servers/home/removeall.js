/**
 * Prompt for confirmation, then delete every file on the host this script is
 * running on.
 *
 * WARNING: irreversible, and genuinely everything - ns.ls with no substring
 * filter returns scripts, .json data files, .txt files and .lit/.cct alike, so
 * this wipes cfg.json and the cached networks/clouds/rooted data along with the
 * code. Intended for cleaning out a cloud server, not for use on home.
 *
 * Note ns.ls is per-host: it only ever lists the one server passed to it, so
 * running this only ever affects ns.getHostname() and never propagates across
 * the network.
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
 */
export async function main(ns) {
    const hostname = ns.getHostname();
    // boolean prompt type gives a real Yes/No dialog and resolves to a real boolean
    const input = await ns.prompt(`WARNING: Delete all files on ${hostname}?`, { type: "boolean" });

    if (!input) {
        ns.tprint("Cancelling");
        return;
    }

    // ns.rm with no host arg defaults to the current server, which is the same
    // host we just listed - so the loop stays confined to this machine
    for (const file of ns.ls(hostname)) {
        ns.rm(file);
    }
    ns.tprint(`Deleted all files on ${hostname}`);
}