/**
 * Runs `hack`, `grow`, and `weaken` in sequence to gain experience only.
 * Fills threads to the host's available RAM  (ignores `leaveRamFree` from `/data/cfg.json`).
 * Simple runner — point this script at a target server (no targeting logic).
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
 */
export async function main(ns) {
    const target = ns.args[0];

    // open tail by default
    ns.ui.openTail();
    ns.ui.setTailMinimized(false); // true: min, false: max
    ns.ui.moveTail(1650, 500);
    ns.ui.resizeTail(250, 350);

    ns.disableLog("disableLog");
    ns.disableLog("getServerMaxRam");
    ns.disableLog("getServerUsedRam");
    ns.disableLog("sleep");


    const hack = "./lib/hgw/hack.js";
    const grow = "./lib/hgw/grow.js";
    const weaken = "./lib/hgw/weaken.js";
    let script = hack;

    while (true) {
        // calculate threads
        const availableRam = (ns.getServerMaxRam() - ns.getServerUsedRam());       
        const scriptRam = ns.getScriptRam(script);
        const threads = Math.floor(availableRam / scriptRam);

        // errors
        if (threads < 1) {
            ns.tprint("Insufficient ram on host. Requires minimum 5.1GB");
            break;
        }

        // formatting
        ns.print("\n");

        // waits for the operation to close before continuing
        const pid = ns.run(script, threads, target);
        while (ns.isRunning(pid)) {
            await ns.sleep(50);
        }

        // flipflops between hack, grow and weaken
        switch (script) {
            case hack:
                script = grow;
                break;
            case grow:
                script = weaken;
                break;
            case weaken:
                script = hack;
                break;
        }
    }
}

/**
 * @param {AutocompleteData} data - context about the game, useful when autocompleting
 * @param {string[]} args - current arguments, not including "run script.js"
 * @returns {string[]} - the array of possible autocomplete options
 */
export function autocomplete(data, args) {
  const servers = data.servers;
  const serversWithArgsRemoved = servers.filter((server) => !args.includes(server));

  return serversWithArgsRemoved;
}