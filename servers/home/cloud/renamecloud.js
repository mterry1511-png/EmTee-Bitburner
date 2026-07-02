import { killAll } from "../killall.js";

/**
 * Renames a cloud server and updates the cloud registry file.
 * @param {NS} ns - The Netscript API object. Terminal inputs are passed via ns.args[0] and ns.args[1]
 * @returns {Promise<void>}
 */
export async function main(ns) {
    const oldName = ns.args[0];
    const newName = ns.args[1];

    if (oldName == "help" || newName == "help" || !oldName || !newName) {
        printusage(ns);
        return;
    }

    killAll(ns,oldName);
    ns.cloud.renameServer(oldName, newName);

    // update json
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