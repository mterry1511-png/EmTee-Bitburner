/**
 * Kill processes by script name on cloud servers.
 * @param {NS} ns - The Netscript API object
 * @param {string[]} scripts - Array of script filenames to kill
 * @returns {Promise<number>} - Number of processes killed
 */
export async function killScriptsOnClouds(ns, scripts) {
    const clouds = JSON.parse(ns.read("/data/clouds.json"));
    let killCount = 0;

    for (const cloudName in clouds) {
        const processes = ns.ps(cloudName);
        for (const proc of processes) {
            if (scripts.includes(proc.filename)) {
                ns.kill(proc.pid);
                killCount++;
            }
        }
    }
    return killCount;
}
