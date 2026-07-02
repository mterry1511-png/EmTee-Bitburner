

/**
 * Entry point for the script when run from the terminal.
 * @param {NS} ns - The Netscript namespace provided by Bitburner
 * @returns {Promise<void>}
 */
export async function main(ns) {
    killAll(ns, ns.args[0] ?? null);
}

/**
 * Kills all scripts on the specified target server, or kills all scripts
 * on every cloud server and home if no target is specified.
 * @param {NS} ns - The Netscript namespace provided by Bitburner
 * @param {string|null} [target=null] - Optional target server name. If provided, only scripts on that server are killed
 * @returns {Promise<void>}
 */
export async function killAll(ns, target = null) {
    // optional target passed as arg0 via terminal or second arg via script
    // (only targets target server specified)
    if (target) {
        ns.killall(target);
    }
    
    else {
        const clouds = JSON.parse(ns.read("/data/clouds.json"));

        for (const cloud in clouds) {
            ns.killall(cloud);
        }

        ns.killall("home");
    }
}