// ============================================================================
// cloudwatch.js — WORK IN PROGRESS. Design notes only; NOTHING is implemented.
//
// Intended role: the cloud-server purchasing/upgrading watcher, fronted by
// new/watch.js.
//
// MATURITY: empty body. Note also that this file exports `start`, NOT `main` —
// Bitburner's runner requires an exported `main`, so as written this file
// cannot be `run` or `exec`'d at all, only imported. Nothing currently imports
// it either, so it is unreachable from anywhere.
// ============================================================================

//import ../

/**
 * Buy or upgrade cloud servers within the configured spending budget.
 *
 * NOT IMPLEMENTED - the body is the algorithm sketch below and nothing else.
 * Calling this does nothing and returns immediately.
 *
 * Planned algorithm, per the notes in the body: compute a budget as a
 * percentage of current cash, enumerate every purchased server, treat both
 * "upgrade a server that is below mincloudRAM" and "buy another server, if we
 * are under targetCloudServs" as candidate actions, discard the candidates that
 * do not fit the budget, then execute the CHEAPEST remaining one and loop.
 * Always taking the cheapest action is what keeps the fleet growing evenly
 * rather than sinking the whole budget into one large server.
 *
 * Exported as `start`, not `main` - see the file header.
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
 */
export async function start(ns) {
    // Script summary
// Check current money and calculate the spend budget (money * (maxPercSpend / 100))
// Get the list of purchased servers and their current RAM
// Build a list of candidate actions — every server below mincloudRAM is a valid upgrade candidate, and if you have fewer than targetCloudServs servers, buying a new one at mincloudRAM is also a candidate
// Filter candidates to those whose cost fits within budget
// Execute the cheapest valid action, then loop

}