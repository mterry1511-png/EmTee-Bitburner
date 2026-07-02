/**
 * Continuously grows the supplied target server.
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
 */
export async function main(ns) {
  var target = ns.args[0];

  while(true) {
    await ns.grow(target);
  }
  
}