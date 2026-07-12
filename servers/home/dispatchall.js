
export async function main(ns) {
    let clouds = JSON.parse(ns.read("/data/clouds.json"));    // load clouds.json
    let cloudNames = Object.keys(clouds);                     // fills array with cloud names

    if (cloudNames.length > 0) {
        for (let i = 0; i < cloudNames.length; i++) {
            ns.exec("dispatch.js", "home", 1, cloudNames[i], "ranked", true);
        }
    }
}