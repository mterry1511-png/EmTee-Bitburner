//import ../

/**
 * Evaluates whether to purchase or upgrade cloud servers based on the current budget.
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