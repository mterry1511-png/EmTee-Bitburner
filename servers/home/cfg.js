
/**
 * Points to cfg scripts from terminal
 * 
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
 */
export async function main(ns) {
    let script;
    const choice = await ns.prompt("Select the cfg category", {
        type: "select",
        choices: ["All", "Clouds", "Hacknet", "Targeting", "View"]
    });

    switch (choice) {
        case "All":
            script = "cfg/cfgall.js"; 
            break;
        case "Clouds":
            script = "cfg/cfgcloud.js";
            break;
        case "Hacknet":
            script = "cfg/cfghacknet.js";
            break;
        case "Targeting":
            script = "cfg/cfgtarget.js";
            break;
        case "View":
            script = "cfg/cfgview.js";
            break;
    }

    ns.run(script, 1);
}