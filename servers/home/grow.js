/** @param {NS} ns */
export async function main(ns) {
    // Passed from deployer
    const target = ns.args[0];

    // grow
    await ns.grow(target);
}