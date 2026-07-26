// ============================================================================
// servwatch.js — WORK IN PROGRESS. Design notes only; NOTHING is implemented.
//
// Intended role: the server-side watcher, fronted by new/watch.js. Keeps the
// network scan fresh and keeps deployers pointed at worthwhile targets.
//
// MATURITY: empty body. `main` runs, does nothing, and exits successfully.
// ============================================================================

/**
 * Keep ./data/networks.json fresh and keep deployer processes running against
 * suitable targets.
 *
 * NOT IMPLEMENTED - the body is design notes only. Running this exits
 * immediately having done nothing.
 *
 * Planned: refresh the network scan on a regular cadence, deploy deployer.js
 * against targets that qualify, and cull deployers that no longer earn their
 * RAM.
 *
 * On teardown, kill every deployer this script started - killing a deployer
 * cascades to all the hack/grow/weaken children it spawned, so one kill pass at
 * this level cleans up the whole tree. Use `ns.atExit()` for that, NOT
 * try/finally: a `finally` block does not run when a Bitburner script is
 * killed, so cleanup written that way silently never happens.
 * (new/singularity.js's `deployer` already does this correctly and is worth
 * copying from.)
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
 */
export async function main(ns) {
    // servWatch - refreshes ./data/networks.json regularly and deploys deployers.js
    // register an ns.atExit() handler to kill all deployers.js when terminated
    // which cascades to all child hack scripts running
}