import { getAvailableThreads } from "./lib/util.js";

/**
 * Prints usage instructions for buyrep.js to the terminal.
 * @param {NS} ns - The Netscript API object
 * @returns {void}
 */
function printUsage(ns) {
    ns.tprint("Run from home server only");
    ns.tprint("Specify server to run on (cloud or home) - fills ram but observes freeRam parameter in cfg.json");
    ns.tprint("Example usage: 'run buyrep.js cloud-0' or 'run buyrep.js home'");
    ns.tprint("Requires host to be specified")
    return;
}

/**
 * Fills a server's RAM (cloud or home) with `ns.share()` threads to boost faction reputation gain.
 *
 * Self-relaying entry point - the same script plays two roles depending on where it is running:
 *   - Launched on home with a target hostname (cloud or "home"): validates the host against
 *     clouds.json and ns.exec's a fresh copy of ITSELF onto that host, passing the hostname
 *     through, then exits.
 *   - Already running ON the named host (hostname matches arg[0]): skips the relay and drops
 *     straight into the buyrep() fill loop.
 * That is why go.js task 1 launches this on "home" rather than on the cloud directly.
 * @param {NS} ns - The Netscript API object
 * @param {string} ns.args[0] - Target hostname (required), cloud or "home"; "help" prints usage instead
 * @returns {Promise<void>}
 */
export async function main(ns) {
    // printUsage check
    const help = ns.args.includes("help");
    if (help) {
        printUsage(ns);
        return;
    }

    // Store host name, falling back to the hostname this copy is already running on.
    const host = ns.args[0] ?? ns.getHostname();

    // Relay check: if we're ALREADY on the requested host, this is the second (relayed) copy,
    // so skip the exec and run the fill loop here. Otherwise fall through and relay below.
    const currentServer = ns.getServer();
    if (currentServer.hostname === host) {
        await buyrep(ns, host);
        return;
    }

    // Relay leg: only relay onto hosts we actually own. clouds.json is the ownership record,
    // so an Object.hasOwn check is both the validity test and the "is it a cloud" test.
    const clouds = JSON.parse(ns.read("/data/clouds.json"));
    if (Object.hasOwn(clouds, host)) {
        ns.exec("buyrep.js", host, 1, host);
        ns.tprint("Executed buyrep on " + host);
    }

    else {
        ns.tprint("ERROR: Invalid host target - terminated");
        printUsage(ns);
        return;
    }
}

// runs on cloud server

/**
 * Keeps the host's spare RAM saturated with ns.share() threads, forever.
 *
 * Every 10 seconds it recomputes how many share.js threads currently fit (getAvailableThreads
 * subtracts cfg.leaveRamFree for us) and launches a batch of that size. share.js threads are
 * finite-duration, so old batches expire and free RAM that the next pass reclaims - this is a
 * top-up loop, not a one-shot fill.
 *
 * Like every other check-RAM-then-exec site in this project, the free-RAM read and the
 * ns.exec are not atomic; the scheduler is the intended fix (see CLAUDE.md).
 * @param {NS} ns - The Netscript API object
 * @param {string} host - The hostname of the cloud server to fill with share threads
 * @returns {Promise<void>} Never resolves - loops until the script is killed
 */
async function buyrep(ns, host) {
    // default for error catching later
    let threads = 1;

    // Tracks every share.js batch launched so far, since this is a top-up loop - old batches
    // may still be running when a new one launches, unlike hackexp.js's single-PID case.
    let childPids = [];

    // Kill every still-running share.js batch when buyrep is culled, so a restart doesn't
    // leave orphaned share threads squatting on host's RAM.
    ns.atExit(() => {
        for (const pid of childPids) {
            if (ns.isRunning(pid)) ns.kill(pid);
        }
    });

    while (true) {
        // threads to fill hostserver determined
        threads = getAvailableThreads(ns, host, "./lib/share.js");

        // debug ns.tprint("\nthreads: " + threads + "\nhost: " + host);

        // No room right now - back off briefly and re-measure. A full host is the expected
        // steady state for a filler, so this polls slower than the 10s top-up cadence.
        if (threads < 1) {
            ns.print("insufficient RAM to start share.js");
            await ns.sleep(10000);
            continue;
        }

        // Launch the batch, then wait before topping up again.
        const pid = ns.exec("./lib/share.js", host, threads);
        if (pid !== 0) childPids.push(pid);
        childPids = childPids.filter(p => ns.isRunning(p));    // reap finished batches
        await ns.sleep(10010);
    }
}