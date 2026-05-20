/** @param {NS} ns */

// called from deployer.js only
export async function main(ns) {
    // Passed from deployer
    const target = ns.args[0];

    //hack
    await ns.hack(target);
}