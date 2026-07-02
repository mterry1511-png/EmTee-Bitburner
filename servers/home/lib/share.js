/**
 * Shares available RAM to help farm reputation while running under multiple threads.
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
 */
// Exec this to run multiple threads. ran only from other scripts
export async function main(ns) { 
    await ns.share()
}