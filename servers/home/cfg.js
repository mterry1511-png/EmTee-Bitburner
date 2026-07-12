
/**
 * @param {AutocompleteData} data - context about the game, useful when autocompleting
 * @param {string[]} args - current arguments
 * @returns {string[]} - the array of possible autocomplete options
 */
export function autocomplete(data, args) {
  return ["all", "clouds", "hacknet", "hacking", "toggle", "view", "defaults"];
}


/**
 * Points to cfg scripts from terminal
 * 
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
 */
export async function main(ns) {
    let choice = ns.args[0] ?? null;
    let script;

    if (!choice) {
        choice = await ns.prompt("Select the cfg category", {
            type: "select",
            choices: ["all", "clouds", "hacknet", "hacking", "toggle", "view", "defaults"]
        });
    }

    switch (choice) {
        case "all":
            script = "cfg/cfgall.js";
            break;
        case "clouds":
            script = "cfg/cfgcloud.js";
            break;
        case "hacknet":
            script = "cfg/cfghacknet.js";
            break;
        case "hacking":
            script = "cfg/cfgtarget.js";
            break;
        case "toggle":
            script = "cfg/cfgtoggle.js";
            break;
        case "view":
            script = "cfg/cfgview.js";
            break;
        case "defaults":
            script = "cfg/cfgdefaults.js";
            break;
    }

    ns.run(script, 1);
}