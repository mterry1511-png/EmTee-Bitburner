/**
 * Buys a home core upgrade if affordable, otherwise a home RAM upgrade if that's affordable.
 * Requires Singularity (SF4) - callers must gate on cfg.hasSingularity before invoking.
 *
 * Bug fix: this used to call a bare, undefined `upgradeHomeCores()` in both branches (a
 * ReferenceError waiting to happen the first time it ran) instead of
 * `ns.singularity.upgradeHomeCores()` / `ns.singularity.upgradeHomeRam()`.
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
 */
export async function main(ns) {
    const money = ns.getPlayer().money;
    const coreCost = ns.singularity.getUpgradeHomeCoresCost();
    const ramCost = ns.singularity.getUpgradeHomeRamCost();
    if (money >= coreCost) { ns.singularity.upgradeHomeCores(); }
    else if (money >= ramCost) { ns.singularity.upgradeHomeRam(); }
}
