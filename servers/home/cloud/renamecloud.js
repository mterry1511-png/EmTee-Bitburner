
/**
 * @param {NS} ns - The Netscript API object. Terminal inputs are passed via ns.args[0] and ns.args[1].
 */
export async function main(ns) {
    const oldName = ns.args[0];
    const newName = ns.args[1];

    if (oldName == "help" || newName == "help" || !oldName || !newName) {
        printusage(ns);
        return;
    }

    ns.cloud.renameServer(oldName, newName);

    // update json
    const clouds = JSON.parse(ns.read("/data/clouds.json"));
    clouds[newName] = clouds[oldName];
    delete clouds[oldName];

    ns.write("/data/clouds.json", JSON.stringify(clouds), "w");

    // print success
    ns.print("Server " + oldName + " renamed to " + newName + ". clouds.json updated.");
}

/**
 * @param {NS} ns - The Netscript API object
 */
export function printusage(ns) {
    ns.print("Usage: run renamecloud.js <oldName> <newName>");
}