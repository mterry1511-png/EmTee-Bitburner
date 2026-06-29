/**
 * Hack a target server using the deployer-provided target argument.
 * @param {NS} ns - The Netscript API object
 */

// called from deployer.js only
export async function main(ns) {
    // Passed from deployer
    const target = ns.args[0];

    //hack
    await ns.hack(target);
}