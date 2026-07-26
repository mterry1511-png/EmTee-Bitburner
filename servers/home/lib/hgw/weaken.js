/**
 * Run one weaken() cycle against the target server named in arg[0].
 *
 * One of the three HGW payload scripts (grow / hack / weaken), all identical in
 * shape. They are deliberately this bare: the deployer exec's them with a
 * thread count, and the per-thread RAM cost of the script is what determines
 * how many threads fit on a host, so every extra ns.* call in here would
 * directly reduce achievable thread counts.
 *
 * weaken() lowers the target's security level back toward its minimum, undoing
 * the security added by hack() and grow(). It blocks for the full weaken
 * duration - the longest of the three - then the process exits, and the
 * deployer relaunches as needed.
 *
 * WARNING: the target must be passed as arg[0]. Nothing here validates it -
 * an undefined target will throw at the ns.weaken call.
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
 */
export async function main(ns) {
    // Passed from deployer as arg[0]
    const target = ns.args[0];

    // weaken - blocks until the operation completes
    await ns.weaken(target);
}