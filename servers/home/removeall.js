/**
 * Prompts for confirmation, then deletes every file on the current host.
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
 */
export async function main(ns) {
    const hostname = ns.getHostname();
    const input = await ns.prompt(`WARNING: Delete all files on ${hostname}?`, { type: "boolean" });

    if (!input) {
        ns.tprint("Cancelling");
        return;
    }

    for (const file of ns.ls(hostname)) {
        ns.rm(file);
    }
    ns.tprint(`Deleted all files on ${hostname}`);
}