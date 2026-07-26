/**
 * Long-running loop that keeps a single cloud server's copy of the codebase in
 * sync with home, re-copying every script and data file on an interval.
 *
 * One instance runs per cloud server. daemon.js launches these indirectly via
 * ensureRunning in lib/util.js, which passes the target hostname as ns.args[0] -
 * and which special-cases this script, scp'ing cloudpush.js itself to the target
 * first, since it is the one script that cannot rely on a previous push to have
 * put it there.
 *
 * Sleep interval is re-read from cfg.json every cycle (cfg.cloudPushSleep,
 * defaulting to 5000ms), so changing it in-game takes effect without a restart.
 * The loop never exits on its own - it is terminated by killall.js or by
 * daemon.js's atExit handler.
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
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

    // scp fires every cycle for every file - without this the log is unreadable
    ns.disableLog("disableLog");
    ns.disableLog("scp");

    while (true) {
        await pushScripts(ns, targetCloud);
        // re-read the interval from cfg.json each cycle so in-game config edits
        // are picked up live rather than needing the script restarted
        const cloudPushSleep = JSON.parse(ns.read("/data/cfg.json")).cloudPushSleep ?? 5000;
        await ns.sleep(cloudPushSleep);
    }
}

/**
 * Copy the current .js and .json files from home onto the target cloud server.
 *
 * Note on ns.ls: its second argument is a plain SUBSTRING filter, not a glob.
 * That means ns.ls("home", ".js") already matches ".json" files too (".json"
 * contains ".js"), so the second ns.ls call adds duplicates rather than new
 * files. ns.scp tolerates duplicates, so this is wasted work rather than a
 * correctness problem - see the findings notes.
 *
 * ns.scp preserves the source path of each file, so a file at /lib/util.js on
 * home lands at /lib/util.js on the target. There is no rename option.
 * @param {NS} ns - The Netscript API object
 * @param {string} targetCloud - The hostname of the cloud server to push to
 * @returns {Promise<void>}
 */
export async function pushScripts(ns, targetCloud) {
    const scripts = ns.ls("home", ".js");
    scripts.push(...ns.ls("home", ".json"));
    ns.scp(scripts, targetCloud, "home");
    ns.print("Pushed scripts to " + targetCloud);
}

/**
 * Prints usage instructions for the cloud push helper to the terminal.
 * @param {NS} ns - The Netscript API object
 * @returns {void}
 */
function printusage(ns) {
    ns.tprint("Usage: Launched automatically by daemon. run cloudpush.js [targetCloud]");
}