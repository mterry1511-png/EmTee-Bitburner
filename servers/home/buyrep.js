import { getAvailableThreads } from "./lib/util.js";

/**
 * Prints usage instructions for buyrep.js to the terminal.
 * @param {NS} ns - The Netscript API object
 * @returns {void}
 */
function printusage(ns) {
    ns.tprint("Run from home server only");
    ns.tprint("Specify cloud server to run on - fills ram but observes freeRam parameter in cfg.json");
    ns.tprint("Example usage: 'run buyrep.js cloud-0'");
    ns.tprint("Requires host to be specified")
    return;
}
 
/**
 * Fills a cloud server's RAM with `ns.share()` threads to boost faction reputation gain.
 *
 * Self-relaying entry point - the same script plays two roles depending on where it is running:
 *   - Launched on home with a cloud hostname: validates the host against clouds.json and
 *     ns.exec's a fresh copy of ITSELF onto that cloud, passing the hostname through, then exits.
 *   - Already running ON the named host (hostname matches arg[0]): skips the relay and drops
 *     straight into the buyrep() fill loop.
 * That is why go.js task 1 launches this on "home" rather than on the cloud directly.
 *
 * Refuses to run against home: share threads are meant to occupy otherwise-idle cloud RAM,
 * not compete with home's hacking work.
 * @param {NS} ns - The Netscript API object
 * @param {string} ns.args[0] - Target cloud hostname (required); "help" prints usage instead
 * @returns {Promise<void>}
 */
export async function main(ns) {
    // printusage check 
    const help = ns.args.includes("help");
    if (help) {
        printusage(ns);
        return;
    }

    // Store host name. NOTE: the fallback yields a Server OBJECT, not a hostname string -
    // so omitting arg[0] does not degrade gracefully to "current server". See findings.
    const host = ns.args[0] ?? ns.getServer();

    // if host is home, return error
    if (host == "home") {
        ns.tprint("ERROR: buyrep must be ran on a cloud server\n");
        printusage(ns);
        return;
    }

    // Relay check: if we're ALREADY on the requested host, this is the second (relayed) copy,
    // so skip the exec and run the fill loop here. Otherwise fall through and relay below.
    const currentServer = ns.getServer();
    if (currentServer.hostname == host) {
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
        printusage(ns);
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
    // load config
    const cfg = JSON.parse(ns.read("/data/cfg.json"));      // unused below - see findings

    // default for error catching later
    let threads = 1;

    while (true) {
        // threads to fill hostserver determined
        threads = getAvailableThreads(ns, host, "./lib/share.js");

        // debug ns.tprint("\nthreads: " + threads + "\nhost: " + host);

        // No room right now - back off briefly and re-measure. The 100ms retry makes this a
        // tight busy-loop compared to the 10s cadence of the success path.
        if (threads < 1) {
            await ns.sleep(100);
            ns.print("insufficient RAM to start share.js");
            continue;
        }

        // Launch the batch, then wait before topping up again.
        // NOTE: ns.exec is synchronous and returns a PID, not a Promise - the `await` here
        // does nothing. See findings.
        await ns.exec("./lib/share.js", host, threads);
        await ns.sleep(10000);
    }
}