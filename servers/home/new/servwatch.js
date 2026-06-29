/**
 * Watches the network and deploys deployer processes as needed.
 * @param {NS} ns - The Netscript API object
 */
export async function main(ns) {
    // servWatch - refreshes ./data/networks.json regularly and deploys deployers.js
    // use try and finally to kill all deployers.js when terminated 
    // which cascades to all child hack scripts running
}