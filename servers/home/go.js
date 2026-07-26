import { killScriptsOnClouds } from "./lib/remotekill.js";

/**
 * Task launcher with integer dispatch.
 * Usage: go [task_number]
 *
 * @param {NS} ns - The Netscript API object
 */

function printUsage(ns, tasks) {
    ns.tprint("=== Task Launcher ===\n");
    for (const [key, task] of Object.entries(tasks)) {
        ns.tprint(`[${key}] ${task.name}`);
        ns.tprint(`    ${task.description}\n`);
    }
}

export async function main(ns) {
    const arg = String(ns.args[0] ?? "").toLowerCase();

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

                for (const cloudName of cloudNames) {
                    ns.exec("buyrep.js", "home", 1, cloudName);
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

                for (const cloudName of cloudNames) {
                    ns.exec("hackexp.js", cloudName, 1);
                }
                ns.tprint(`hackexp.js started on ${cloudNames.length} cloud server(s).`);
            }
        },
    };
 
    // Show usage if no arg or invalid task
    if (arg === "" || !tasks[arg]) {
        printUsage(ns, tasks);
        return;
    }

    // Execute task
    await tasks[arg].run();
}
