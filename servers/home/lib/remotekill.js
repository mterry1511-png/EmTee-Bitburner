/**
 * Kill every process running one of the given scripts across all cloud servers.
 *
 * Matches on filename only and kills by PID - ns.kill(filename, host, ...args)
 * requires an exact argument match and fails silently otherwise, so enumerating
 * with ns.ps() and killing the PID is the reliable way to clear a script whose
 * arguments we don't know.
 *
 * Only touches purchased cloud servers (the keys of clouds.json); home and
 * ordinary rooted network servers are left alone.
 *
 * Nothing here awaits, so this could be a plain synchronous function - it's
 * async only because callers await it.
 * @param {NS} ns - The Netscript API object
 * @param {string[]} scripts - Array of script filenames to kill
 * @returns {Promise<number>} - Number of processes killed
 */
export async function killScriptsOnClouds(ns, scripts) {
    const clouds = JSON.parse(ns.read("/data/clouds.json"));
    let killCount = 0;

    // clouds.json is an object keyed by hostname, hence for...in over its keys
    for (const cloudName in clouds) {
        // Live process list for that host - filename, pid, args, threads
        const processes = ns.ps(cloudName);
        for (const proc of processes) {
            if (scripts.includes(proc.filename)) {
                ns.kill(proc.pid);
                await ns.sleep(50);
                killCount++;
            }
        }
    }
    return killCount;
}
