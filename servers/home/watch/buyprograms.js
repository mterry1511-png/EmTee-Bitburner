/**
 * Buys every affordable darkweb program not already owned on home.
 * Requires Singularity (SF4) and the TOR router - callers must gate on cfg.hasSingularity and
 * ensure the TOR router is purchased before invoking.
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
 */
export async function main(ns) {
    const torPrograms = ns.singularity.getDarkwebPrograms();

    for (const program of torPrograms) {
        if (!ns.fileExists(program, "home")) {
            const programCost = ns.singularity.getDarkwebProgramCost(program);
            const money = ns.getPlayer().money;
            const affordable = money > programCost && money != 0;
            if (affordable) { ns.singularity.purchaseProgram(program); }
        }
    }
}
