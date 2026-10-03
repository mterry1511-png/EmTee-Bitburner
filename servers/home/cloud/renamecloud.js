import { killAll } from "../killall.js";

/**
 * Rename one cloud server and move its entry in /data/clouds.json to match.
 *
 * Every script on the server is killed first: running processes are bound to the
 * hostname they were launched against, so leaving them alive across a rename
 * would strand them (and daemon.js's ensureRunning would then start a second
 * copy under the new name).
 *
 * The registry is patched by hand rather than by re-running scanCloud - the
 * entry is moved from the old key to the new one so the recorded maxRam carries
 * over. Note this hand-patch is only authoritative until the next scanCloud
 * call, which rebuilds the file wholesale from networks.json.
 *
 * Args: ns.args[0] = current hostname, ns.args[1] = new hostname. Passing "help"
 * as either, or omitting either, prints usage instead.
 * @param {NS} ns - The Netscript API object. Terminal inputs are passed via ns.args[0] and ns.args[1]
 * @returns {Promise<void>}
 */
export async function main(ns) {
    const oldName = ns.args[0];
    const newName = ns.args[1];

    if (oldName === "help" || newName === "help" || !oldName || !newName) {
        printusage(ns);
        return;
    }

    // stop everything on the server before the hostname changes underneath it
    await killAll(ns, oldName);

    // renameServer returns false (it doesn't throw) on failure - e.g. a typo'd oldName
    // or a newName that's already taken. Bail before touching the registry, otherwise
    // clouds.json would list a host that doesn't exist and lose the one that does.
    if (!ns.cloud.renameServer(oldName, newName)) {
        ns.tprint("ERROR: could not rename " + oldName + " to " + newName + " - does " + oldName + " exist, and is " + newName + " free? clouds.json left unchanged.");
        return;
    }

    // update json - move the entry to the new key, preserving its maxRam
    const clouds = JSON.parse(ns.read("/data/clouds.json"));
    clouds[newName] = clouds[oldName];
    delete clouds[oldName];

    ns.write("/data/clouds.json", JSON.stringify(clouds), "w");

    // print success
    ns.tprint("All processes stopped on " + oldName);
    ns.tprint("Server " + oldName + " renamed to " + newName + ". clouds.json updated.");
}

/**
 * Prints usage instructions for the renamecloud helper.
 * @param {NS} ns - The Netscript API object
 * @returns {void}
 */
export function printusage(ns) {
    ns.tprint("Usage: run /cloud/renamecloud.js <oldName> <newName>");
}