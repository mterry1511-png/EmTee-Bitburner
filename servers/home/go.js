import { killScriptsOnClouds } from "./lib/remotekill.js";

/**
 * Prints the task menu: every task's number, name and description.
 * Iterates the task registry itself, so a task added to `tasks` in main() shows up here
 * automatically with no second list to keep in sync.
 * @param {NS} ns - The Netscript API object
 * @param {Object<string, {name: string, description: string, run: function(): Promise<void>}>} tasks - The task registry defined in main()
 * @returns {void}
 */
function printUsage(ns, tasks) {
    ns.tprint("=== Task Launcher ===\n");
    for (const [key, task] of Object.entries(tasks)) {
        ns.tprint(`[${key}] ${task.name}`);
        ns.tprint(`    ${task.description}\n`);
    }
}

/**
 * Numbered task launcher - a shortcut menu for the cloud-server chores run most often.
 * Usage: run go.js [taskNumber]; with no arg (or an unknown one) it prints the menu.
 *
 * Each entry in the `tasks` registry is `{name, description, run}`, where `run` is an async
 * closure over `ns`. Keys are object keys, so they are STRINGS - `ns.args[0]` is stringified
 * before lookup so that `go 1` and `go "1"` both resolve.
 *
 * Note: this is a manual shortcut menu, not part of the automated startup chain - init.js
 * starts daemon.js, and dispatch.js/dispatchall.js handle HGW deployment.
 * @param {NS} ns - The Netscript API object
 * @param {string|number} [ns.args[0]] - Task number to run; omitted or unrecognised prints usage
 * @returns {Promise<void>}
 */
export async function main(ns) {
    // Stringify + lowercase so a numeric arg still matches the string keys of `tasks`.
    const arg = String(ns.args[0] ?? "").toLowerCase();

    // Task registry. Add an entry here and it appears in the menu automatically.
    const tasks = {
        0: {
            name: "Kill all buyrep and hackexp on clouds",
            description: "Terminate buyrep.js and hackexp.js processes on all cloud servers",
            run: async () => {
                const scripts = ["buyrep.js", "hackexp.js"];
                const killCount = await killScriptsOnClouds(ns, scripts);
                ns.tprint(`Killed ${killCount} process(es) on cloud servers.`);
            }
        },
        1: {
            name: "Start buyrep on all clouds",
            description: "Launch buyrep.js on each owned cloud server",
            run: async () => {
                const clouds = JSON.parse(ns.read("/data/clouds.json"));
                const cloudNames = Object.keys(clouds);

                if (cloudNames.length === 0) {
                    ns.tprint("No cloud servers available.");
                    return;
                }

                // Launched on HOME, not on the cloud - buyrep.js is its own relay: given a
                // cloud hostname it re-execs itself onto that cloud, then fills its RAM with
                // share.js threads. (Contrast task 2, which execs hackexp.js on the cloud
                // directly because hackexp.js has no such relay step.)
                for (const cloudName of cloudNames) {
                    ns.exec("buyrep.js", "home", 1, cloudName);
                    await ns.sleep(20);

                }
                ns.tprint(`buyrep.js started on ${cloudNames.length} cloud server(s).`);
            }
        },
        2: {
            name: "Start hackexp on all clouds",
            description: "Launch hackexp.js on each owned cloud server",
            run: async () => {
                const clouds = JSON.parse(ns.read("/data/clouds.json"));
                const cloudNames = Object.keys(clouds);

                if (cloudNames.length === 0) {
                    ns.tprint("No cloud servers available.");
                    return;
                }

                // Exec'd directly on each cloud with no target arg, so each instance
                // independently resolves its own "best" target via targeting.getTarget.
                for (const cloudName of cloudNames) {
                    ns.exec("hackexp.js", cloudName, 1);
                    await ns.sleep(20);
                }
                ns.tprint(`hackexp.js started on ${cloudNames.length} cloud server(s).`);
            }
        },
        3: {
            name: "Start buyrep and hackexp 10:90 on clouds",
            description: "Split clouds: first half runs buyrep.js, second half runs hackexp.js",
            run: async () => {
                const clouds = JSON.parse(ns.read("/data/clouds.json"));
                const cloudNames = Object.keys(clouds);

                if (cloudNames.length === 0) {
                    ns.tprint("No cloud servers available.");
                    return;
                }

                const splitPoint = Math.ceil(cloudNames.length * 0.1);
                const buyrepClouds = cloudNames.slice(0, splitPoint);
                const hackexpClouds = cloudNames.slice(splitPoint);

                // Launch buyrep on first half
                for (const cloudName of buyrepClouds) {
                    ns.exec("buyrep.js", "home", 1, cloudName);
                    await ns.sleep(20);
                }

                // Launch hackexp on second half
                for (const cloudName of hackexpClouds) {
                    ns.exec("hackexp.js", cloudName, 1);
                    await ns.sleep(20);
                }

                ns.tprint(`buyrep.js started on ${buyrepClouds.length} cloud(s), hackexp.js started on ${hackexpClouds.length} cloud(s).`);
            }
        },
    };
    

    // Show usage if no arg or invalid task. Note task "0" is safe here: the guard tests
    // `arg === ""` on the string, not the truthiness of the number, so "0" still dispatches.
    if (arg === "" || !tasks[arg]) {
        printUsage(ns, tasks);
        return;
    }

    // Execute task. Awaited so go.js stays alive (and holds its RAM) until the task finishes.
    await tasks[arg].run();
}
