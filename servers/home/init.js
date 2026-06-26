// import functions required
import { scanNetwork } from "./scanner.js";
import { autoNuke } from "./lib/util.js";

/** @param {NS} ns */
export async function main(ns) {

    // Disable logging for ns functions
    // ns.disableLog("disableLog");
    // ns.disableLog("scan");
    // ns.disableLog("getServerRequiredHackingLevel");
    // ns.disableLog("getServerSecurityLevel");
    // ns.disableLog("getServerMoneyAvailable");
    // ns.disableLog("getServerMaxMoney");
    // ns.disableLog("getServerMinSecurityLevel");
    // ns.disableLog("getHostname");

    // import config file
    const cfg = JSON.parse(ns.read("./data/cfg.json"));

    const results = "";

    // Fun little countdown nonsense
    await nonsense(ns);   
    
    // run scanner to build "/data/networks.json"
    scanNetwork(ns, true);

    // write full server information to servers
    const servers = JSON.parse(ns.read("./data/networks.json"));

    // exec autoNuke on all servers
    for (const targetServer of servers) {
        autoNuke(ns, targetServer.hostname, true);
    }

    // Refresh "/data/networks.json"
    scanNetwork(ns, true);

    ns.kill("daemon.js", "home");
    ns.run("daemon.js",1);

    // exec buyRAM

    // exec buyHacknet

    // exec joinFactions

    // exec buyAugments

    // exec buyTor and programs (SINGULARITY)

    // exec watch
    
    await printResults(ns, results, cfg);
}


async function printResults(ns, results, cfg) {
    // check results and print accordingly (NEED TO DEFINE)
    // Consider putting all watch into a single watch.js?



    // Print results
    // ns.tprint("  Executed servWatch for automated nuking\n");
    // ns.tprint("  Executed ramWatch for automated RAM purchasing\n");
    // ns.tprint("  Executed hacknetWatch for automated hacknet purchasing \n");
    // ns.tprint("  Executed augWatch for automated augmentation purchasing \n");
    // ns.tprint("  Executed programWatch for automated TOR router and augmentation purchasing \n");
    ns.tprint("\n\nInitialisation:\n");
    ns.tprint("  Network scanned and stored in ./data/networks.json\n");
    ns.tprint("  Cloud servers updated and stored in ./data/clouds.json\n");
    ns.tprint("  AutoNuked all servers\n");
    ns.tprint("  daemon.js running - watching " + cfg.watchedScripts);
    ns.tprint("  Remember to buy TOR router!");
    ns.tprint("  ... run dispatch.js to get started!");
}


/** @param {NS} ns */
async function nonsense(ns) {
    // Ultra-dramatic cyberpunk boot sequence for Bitburner terminal.

    const chars =
        "01アイウエオカキクケコサシスセソABCDEFGHIJKLMNOPQRSTUVWXYZ" +
        "abcdefghijklmnopqrstuvwxyz" +
        "░▒▓█<>[]{}()/\\|!?@#$%^&*~`+-=_";

    const width = 78;
    const height = 20;

    const messages = [
        ">>> ESTABLISHING NEURAL LINK...",
        ">>> DECRYPTING BLACK ICE...",
        ">>> BYPASSING INTRUSION COUNTERMEASURES...",
        ">>> ROOT ACCESS GRANTED",
        ">>> LOADING COGNITIVE SUBROUTINES...",
        ">>> SPOOFING BIOMETRIC SIGNATURE...",
        ">>> WAKE UP, OPERATOR",
        ">>> REALITY.EXE HAS CRASHED",
        ">>> THE MATRIX HAS YOU...",
        ">>> NO GODS. NO KINGS. ONLY ROOT.",
        ">>> JACKING INTO THE MAINFRAME...",
        ">>> INITIATING QUANTUM HANDSHAKE...",
        ">>> MEMORY FIREWALL DISABLED",
        ">>> DAEMONS AWAKENING...",
        ">>> SYSTEM INTEGRITY: [██████████] 100%",
    ];

    // -----------------------------
    // Helper functions
    // -----------------------------
    const cls = () => ns.ui.clearTerminal();
    const term = (text = "") => ns.tprint(text);

    const randInt = (min, max) =>
        Math.floor(Math.random() * (max - min + 1)) + min;

    const randChoice = (arr) => arr[randInt(0, arr.length - 1)];

    const randChar = () => chars[randInt(0, chars.length - 1)];

    function randomLine() {
        let line = "";
        for (let i = 0; i < width; i++) {
            line += randChar();
        }
        return line;
    }

    function randomFrame() {
        const lines = [];

        for (let i = 0; i < height; i++) {
            lines.push(randomLine());
        }

        // Inject 1–3 messages
        const injections = randInt(1, 3);
        for (let i = 0; i < injections; i++) {
            lines[randInt(0, height - 1)] = randChoice(messages);
        }

        return lines.join("\n");
    }

    async function typeLine(text, delay = 30) {
        let current = "";
        for (const ch of text) {
            current += ch;
            cls();
            term(current + "█");
            await ns.sleep(delay);
        }
        cls();
        term(text);
    }

    async function fakeProgress(label, duration = 300) {
        const steps = 25;
        for (let i = 0; i <= steps; i++) {
            const filled = "█".repeat(i);
            const empty = "░".repeat(steps - i);
            const percent = String(Math.floor((i / steps) * 100)).padStart(3);
            cls();
            term(`${label}`);
            term(`[${filled}${empty}] ${percent}%`);
            await ns.sleep(duration / steps);
        }
    }

    async function flash(text, times = 4, delay = 120) {
        for (let i = 0; i < times; i++) {
            if (i % 2 === 0) term(text);
            await ns.sleep(delay);
        }
    }

    // -----------------------------
    // Phase 1: Initial corruption
    // -----------------------------
    const start = Date.now();
    while (Date.now() - start < 2000) {
        cls();
        term(randomFrame());
        await ns.sleep(60);
    }

    // -----------------------------
    // Phase 2: Warning flashes
    // -----------------------------
    await flash("!! SIGNAL ACQUIRED !!", 6);
    await flash("!! UNAUTHORIZED ACCESS DETECTED !!", 6);

    // -----------------------------
    // Phase 3: Typewriter messages
    // -----------------------------
    await typeLine("Establishing encrypted uplink...");
    await ns.sleep(100);

    await typeLine("Injecting daemons into target memory...");
    await ns.sleep(100);

    await typeLine("Bypassing black ICE...");
    await ns.sleep(100);

    // -----------------------------
    // Phase 4: Progress bars
    // -----------------------------
    await fakeProgress("Decrypting secure channels...");
    await fakeProgress("Loading autonomous agents...");
    await fakeProgress("Synchronising botnet...");

    // -----------------------------
    // Phase 5: Countdown
    // -----------------------------
    cls();
    await ns.sleep(500);

    for (const n of [3, 2, 1]) {
        cls();
        term(`
 ███████╗
 ╚══${n}══╝
        `);
        await ns.sleep(500);
    }
    // Dramatic pause
    await ns.sleep(1000);
    // -----------------------------
    // Phase 6: Final reveal
    // -----------------------------
    cls();
    term(`
██╗███╗   ██╗██╗████████╗██╗ █████╗ ██╗     ██╗███████╗███████╗██████╗
██║████╗  ██║██║╚══██╔══╝██║██╔══██╗██║     ██║╚══███╔╝██╔════╝██╔══██╗
██║██╔██╗ ██║██║   ██║   ██║███████║██║     ██║  ███╔╝ █████╗  ██║  ██║
██║██║╚██╗██║██║   ██║   ██║██╔══██║██║     ██║ ███╔╝  ██╔══╝  ██║  ██║
██║██║ ╚████║██║   ██║   ██║██║  ██║███████╗██║███████╗███████╗██████╔╝
╚═╝╚═╝  ╚═══╝╚═╝   ╚═╝   ╚═╝╚═╝  ╚═╝╚══════╝╚═╝╚══════╝╚══════╝╚═════╝
`);

    // -----------------------------
    // Phase 7: Dramatic countdown
    // -----------------------------



}

