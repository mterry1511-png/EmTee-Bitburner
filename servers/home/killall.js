

/**
 * Terminal entry point. Passes an optional target hostname through to killAll.
 * With no argument this is the "stop everything" button - see killAll below for
 * exactly how wide that blast radius is.
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
 */
export async function main(ns) {
    killAll(ns, ns.args[0] ?? null);
}

/**
 * Kill every running script on one server, or - when no target is given - on
 * every cloud server listed in /data/clouds.json plus home.
 *
 * Uses ns.killall rather than per-script ns.kill deliberately: ns.kill(filename,
 * host, ...args) silently does nothing unless the args match the launched script
 * exactly, which is unreliable for the deployer/hgw scripts that carry a target
 * hostname arg. ns.killall sidesteps argument matching entirely.
 *
 * Self-kill safety: ns.killall's safetyGuard parameter defaults to true, so the
 * calling script is skipped and this survives its own ns.killall("home") call.
 * That also means daemon.js, the scheduler and anything else on home DO die -
 * this is not a targeted kill.
 *
 * The cloud list comes from clouds.json (written by scanCloud in scanner.js), so
 * a cloud server bought since the last scan will not be reached.
 * @param {NS} ns - The Netscript API object
 * @param {string|null} [target=null] - Optional target server hostname. If provided, only scripts on that server are killed
 * @returns {Promise<void>}
 */
export async function killAll(ns, target = null) {
    // optional target passed as arg0 via terminal or second arg via script
    // (only targets target server specified)
    if (target) {
        ns.killall(target);
    }
    
    else {
        // no target - sweep every known cloud server, then home last
        const clouds = JSON.parse(ns.read("/data/clouds.json"));

        for (const cloud in clouds) {
            ns.killall(cloud);
        }

        // home is killed last so the cloud sweep above completes first;
        // safetyGuard keeps this script itself alive to finish
        ns.killall("home");
    }
}