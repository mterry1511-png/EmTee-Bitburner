/**
 * Share this host's RAM with your current faction to boost reputation gain.
 *
 * Deliberately a single ns.share() call and nothing else: the payload script is
 * kept minimal so its per-thread RAM cost stays as low as possible, and the
 * bonus scales with the number of threads it's exec'd with. ns.share() blocks
 * for its duration and then resolves, so the process exits after one cycle -
 * whatever launched it is responsible for relaunching.
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
 */
// Not run directly - exec'd with a thread count by other scripts (e.g. buyrep.js).
export async function main(ns) { 
    await ns.share()
}