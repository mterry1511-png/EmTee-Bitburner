/**
 * @param {NS} ns - The Netscript API object
 */
export async function main(ns) {
    const targetCloud = ns.args[0] ?? null;

    if (ns.args[0] === "help") {
        printusage(ns);
        return;
    }

    if (!targetCloud) {
        ns.tprint("ERROR: cloudpush.js requires a target server as an argument.");
        return;
    }

    ns.disableLog("disableLog");
    ns.disableLog("scp");

    while (true) {
        await pushScripts(ns, targetCloud);
        const cloudPushSleep = JSON.parse(ns.read("/data/cfg.json")).cloudPushSleep ?? 5000;
        await ns.sleep(cloudPushSleep);
    }
}

/**
 * @param {NS} ns - The Netscript API object
 * @param {string} targetCloud - The target cloud server to push scripts to
 */
export async function pushScripts(ns, targetCloud) {
    const scripts = ns.ls("home", ".js");
    scripts.push(...ns.ls("home", ".json"));
    ns.scp(scripts, targetCloud, "home");
    ns.print("Pushed scripts to " + targetCloud);
}

/**
 * @param {NS} ns - The Netscript API object
 */
function printusage(ns) {
    ns.tprint("Usage: Launched automatically by daemon. run cloudpush.js [targetCloud]");
}