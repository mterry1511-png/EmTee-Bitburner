import { main as refresh } from "./refresh.js";
import { main as upgradeClouds } from "./cloud/upgradeclouds.js";
import { ensureRunning } from "./lib/util.js";
import * as buyHacknetNodes from "./watch/buyhacknetnodes.js";

/**
 * The long-running background caretaker: one tick every cfg.daemonSleep ms, forever.
 *
 * Per tick it re-reads cfg.json and clouds.json from disk (so config edits take effect on the
 * next tick without a restart), then:
 *   1. refreshes the network map + auto-nukes - UNLESS scheduler.js is running, which owns
 *      refresh.js when present,
 *   2. aborts if cfg.daemonSleep < cfg.refreshInterval, which would mean acting on stale data,
 *   3. upgrades cloud servers if cfg.autobuyClouds,
 *   4. ensures every cfg.watchedScripts entry is running on every cloud,
 *   5. buys hacknet nodes if cfg.autobuyHacknet.
 *
 * Singleton by construction: it kills any other daemon.js on home before starting (using the
 * self-kill guard - comparing proc.pid against ns.pid so it doesn't kill itself), and its
 * atExit handler kills the watched scripts it spawned on clouds so they don't outlive it.
 *
 * Background script, so ns.print throughout - the one ns.tprint is the fatal config error,
 * which has to reach the user.
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>} Never resolves - loops until killed or a config error aborts it
 */
export async function main(ns) {
    // Declared out here (not inside the loop) so the ns.atExit closure below can still see the
    // latest values when the daemon is killed - a loop-scoped const would be out of reach.
    let clouds;
    let watched;
    let firstLoop = true;        // allows different behaviour on first loop

    // Enforce the singleton: close old daemon.js instances, excluding self.
    // Compares PIDs rather than using ns.kill(filename, ...) because a filename kill would
    // also match this process.
    const processes = ns.ps("home");
    for (const proc of processes) {
        if (proc.filename === "daemon.js" && proc.pid !== ns.pid) {
            ns.kill(proc.pid);
        }
    }

    // open tail by default
    ns.ui.openTail();
    ns.ui.setTailMinimized(false); // true: min, false: max
    ns.ui.moveTail(1450, 0);
    ns.ui.resizeTail(250, 350);

    ns.disableLog("disableLog");
    ns.disableLog("sleep");

    // Close all children when killed, so watched scripts don't outlive the daemon that
    // started them. The third argument mirrors ensureRunning's launch convention
    // (`ns.exec(script, host, 1, host)`) - ns.kill(filename, host, ...args) only matches when
    // the args are identical, which is why the hostname has to be repeated here.
    // Runs on the FIRST loop's values only if the daemon dies before `clouds`/`watched` are
    // assigned, in which case both are undefined and the loops simply do nothing.
    ns.atExit(() => {
        for (const cloudName in clouds) {
            for (const script of watched) {
                ns.kill(script, cloudName, cloudName);
            }
        }
    });

    ns.print("\n\nDaemon started...\n\n");

    while (true) {
        // Re-read config every tick rather than once at startup, so edits made via the cfg/*
        // editors are picked up on the next tick without restarting the daemon.
        const cfg = JSON.parse(ns.read("/data/cfg.json"));

        // Clouds list - maintained in .json and by buyserver.js
        clouds = JSON.parse(ns.read("/data/clouds.json"));

        // List of scripts to be watched - maintained in .json
        // WARNING - all added scripts to watched must follow this args format (targethost as arg[0]).
        watched = cfg.watchedScripts;

        // Tick separator in the tail window - printed unconditionally, once per loop.
        const time = new Date().toLocaleTimeString();
        ns.print(`\n [${time}]`);

        //// MAIN EXECUTION BLOCK
        // Refresh network, autonuke+root, update networks.json/clouds.json/rooted.json.
        // Skipped entirely while scheduler.js is alive: the scheduler owns refresh.js when it
        // is running (it needs the scan on its own cadence), so running it here too would
        // duplicate the work and fight over the same json files.
        if (!ns.isRunning("scheduler.js", "home")) {
            await refresh(ns, true);
        }

        // Guard against acting on stale data: if the daemon ticks faster than the refresh
        // interval it would re-read json files that refresh.js hasn't rewritten yet.
        // Fatal rather than a warning - ns.tprint so it surfaces despite being a background script.
        if (cfg.daemonSleep < cfg.refreshInterval) {
            ns.tprint("ERROR: cfg.daemonSleep is smaller than cfg.refreshInterval. Exiting daemon.js");
            return;
        }

        // upgrade clouds up to mincloudRAM if upgrade costs less than maxPercSpend (both in cfg.json)
        if (cfg.autobuyClouds === true) {
            await upgradeClouds(ns);
        }

        // Check watched scripts are running on cloud servers, restarting any that died.
        // The 50ms sleep between checks staggers relaunches so a batch of restarts doesn't
        // spike RAM all at once - same reasoning as dispatch.js's launch staggering.
        for (const cloudName in clouds) {
            for (const script of watched) {
                ensureRunning(ns, script, cloudName);
                await ns.sleep(50);
            }
        }

        // Hacknet autobuy. NOTE: both branches currently do the same thing - the firstLoop
        // split exists so the else-branch can be swapped to buyCheapest() (one upgrade per
        // tick) while the first tick still buys up to max affordable. As written, firstLoop
        // has no effect here. See findings.
        if (cfg.autobuyHacknet == true) {
            if (firstLoop) {
                // buys up to max affordable
                await buyHacknetNodes.main(ns);
            }
            else {
                await buyHacknetNodes.main(ns);             // buys up to max affordable
                // buyHacknetNodes.buyCheapest(ns);         //  Option for single upgrade per daemon tick only
            }
        }

        // TOR router and programs auto buy (requires singularity)

        // Stock market
        // if (ns.stock.hasWseAccount & ns.stock.hasTixApiAccess & ns.stock.has4SDataTixApi) {
        //     ensureRunning(ns, "/stocks/stockmarket.js");
        // }

        // Tick interval, set in cfg.json. Must be >= cfg.refreshInterval (checked above).
        await ns.sleep(cfg.daemonSleep);
        firstLoop = false;
    }
}

