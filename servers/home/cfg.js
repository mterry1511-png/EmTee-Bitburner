
/**
 * Supplies the terminal's tab-completion list for this script.
 * The returned strings are the cfg categories accepted as ns.args[0] below —
 * keep this array and the switch in main() in sync when a new editor is added.
 * @param {{servers: string[], txts: string[], scripts: string[], flags: Function}} data - Context about the game, useful when autocompleting
 * @param {string[]} args - The arguments already typed on the terminal line
 * @returns {string[]} The array of possible autocomplete options
 */
export function autocomplete(data, args) {
  return ["all", "clouds", "hacknet", "hacking", "gang", "toggle", "view", "defaults"];
}


/**
 * Launches the requested cfg editor script from the terminal.
 * Acts purely as a dispatcher/menu: it edits no config itself, it just maps a
 * category name onto the matching script under /cfg/ and runs it. The category
 * can come in as an argument, or — if none was given — from a select-style
 * ns.prompt listing the same choices as autocomplete().
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
 */
export async function main(ns) {
    let choice = ns.args[0] ?? null;
    let script;

    // No category argument supplied, so ask for one via a dropdown dialog
    if (!choice) {
        choice = await ns.prompt("Select the cfg category", {
            type: "select",
            choices: ["all", "clouds", "hacknet", "hacking", "gang", "toggle", "view", "defaults"]
        });
    }

    // Map the chosen category onto the script that edits it.
    // Note the "hacking" choice maps to cfgtarget.js, not a like-named file.
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
        case "gang":
            script = "cfg/cfggang.js";
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

    // Fire-and-forget: the editor script owns its own prompt loop from here,
    // so there is nothing for this dispatcher to wait on or report back.
    ns.run(script, 1);
}
