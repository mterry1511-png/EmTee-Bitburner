

export async function main(ns) {
    killAll(ns, ns.args[0] ?? null);
}

export async function killAll(ns, target = null) {
    // optional target passed as arg0 via terminal or second arg via script
    // (only targets target server specified)
    if (target) {
        ns.killall(target);
    }
    
    else {
        const clouds = JSON.parse(ns.read("/data/clouds.json"));

        for (const cloud in clouds) {
            ns.killall(cloud);
        }

        ns.killall("home");
    }
}