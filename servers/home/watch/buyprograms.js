/**
 * Buy the TOR router and the port-opening programs automatically.
 *
 * NOT IMPLEMENTED - empty body. This is the real SF4 placeholder in this
 * project (despite its name, new/singularity.js makes no Singularity calls at
 * all and is not gated).
 *
 * Genuinely inert until Source-File 4 is unlocked: the calls it will need -
 * ns.singularity.purchaseTor() and ns.singularity.purchaseProgram() - throw
 * without SF4, so this cannot be written and tested yet. `init.js:78` and
 * `daemon.js:98` both have their call sites commented out waiting on it.
 *
 * Contrast with watch/buyhacknetnodes.js, which needs no SF4 at all - the
 * ns.hacknet.* namespace is ungated.
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
 */
export async function main(ns) {
    // NEEDS SINGULARITY
}