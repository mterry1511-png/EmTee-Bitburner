/**
 * Grow a target server using the deployer-provided target argument.
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
 */
export async function main(ns) {
    // Passed from deployer
    const target = ns.args[0];

    // grow
    await ns.grow(target);
}