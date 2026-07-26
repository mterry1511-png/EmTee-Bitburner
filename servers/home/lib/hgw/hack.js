/**
 * Run one hack() cycle against the target server named in arg[0].
 *
 * One of the three HGW payload scripts (grow / hack / weaken), all identical in
 * shape. They are deliberately this bare: the deployer exec's them with a
 * thread count, and the per-thread RAM cost of the script is what determines
 * how many threads fit on a host, so every extra ns.* call in here would
 * directly reduce achievable thread counts.
 *
 * hack() steals money from the target (raising its security and lowering its
 * money, which weaken.js and grow.js respectively undo) and can fail outright
 * based on hack chance. It blocks for the full hack duration, then the process
 * exits - the deployer relaunches as needed.
 *
 * WARNING: the target must be passed as arg[0]. Nothing here validates it -
 * an undefined target will throw at the ns.hack call.
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
 */

// called from deployer.js only
export async function main(ns) {
    // Passed from deployer as arg[0]
    const target = ns.args[0];

    //hack - blocks until the operation completes
    await ns.hack(target);
}