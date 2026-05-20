import { start } from "./deployer.js";

/** @param {NS} ns */
export async function main(ns) {
    const scriptHost = ns.args[0] ?? "home";
    const targetMode = ns.args[1] ?? "best";
    await start(ns, scriptHost, targetMode);
}