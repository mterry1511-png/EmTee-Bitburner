// import functions required
import { scanNetwork, scanCloud } from "./scanner.js";
import { autoNuke } from "./lib/util.js";
import { jsonEdit } from "./lib/util.js";

/**
 * Resets cfg.json to defaults on every run, and additionally bootstraps the automation
 * environment the first time it runs after an augmentation reset.
 *
 * cfg.json is reset unconditionally, every run - see the always-reset block below.
 *
 * POST-AUG-RESET DETECTION - everything past the always-reset block is gated on it:
 * `ns.getResetInfo().lastAugReset` is a timestamp the game updates every time the player
 * installs augmentations. `cfg.json` stores the last value init.js saw (a key that survives
 * the always-reset above, since it's absent from defaultcfg.json by design). If the two
 * differ, this is the first init.js run since a reset and the full bootstrap runs; if they
 * match, init.js stops after the cfg reset. That makes init.js safe to re-run at any time.
 *
 * Bootstrap order, and why:
 *   1. Reset cfg.json to defaults (`/cfg/cfgall.js "default"`) - runs every time, since a
 *      reset wipes progress and the old tuned config no longer matches capabilities, and
 *      re-running init.js between resets is also a convenient way to force cfg back to
 *      defaults.
 *   2. RE-READ cfg.json from disk. The in-memory `cfg` captured at the top of main() is now
 *      stale, because cfgall.js rewrote the file in a separate process.
 *   3. (First run since a reset only) Boot animation, then scan the network and cloud
 *      inventory.
 *   4. autoNuke every scanned server (root access is also wiped by a reset), then re-scan so
 *      networks.json reflects the newly-gained root.
 *   5. Restart daemon.js and print the "what to do next" summary.
 *
 * PID-POLLING WAIT: `ns.run()` returns a PID synchronously and does NOT block, so the code
 * must poll `while (ns.isRunning(pid)) await ns.sleep(200)` to wait for cfgall.js to finish.
 * Without that wait, step 2 would read cfg.json before cfgall.js had written it.
 *
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
 */
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
    let cfg = JSON.parse(ns.read("/data/cfg.json"));

    // Post-aug-reset check: compare the game's live lastAugReset timestamp against the one
    // cfg.json remembers from the previous init.js run. Different => we've reset since then.
    // Computed before the always-reset below runs, since that reset doesn't touch lastAugReset.
    const resetInfo = ns.getResetInfo();
    const isFirstRunSinceReset = cfg.lastAugReset !== resetInfo.lastAugReset;

    // Reset cfg.json to defaults every run, regardless of aug-reset status. ns.run() does NOT
    // block - it hands back a PID immediately - so poll ns.isRunning() until cfgall.js exits
    // before reading cfg.json back below.
    const defaulterPid = ns.run("/cfg/cfgall.js", 1, "default");
    while (ns.isRunning(defaulterPid)) {
        await ns.sleep(200);
    }
    // Re-read from disk: cfgall.js rewrote cfg.json in another process, so the `cfg` object
    // read at the top of main() is stale.
    cfg = JSON.parse(ns.read("/data/cfg.json"));

    // and if it is a first run since reset - run the rest of the bootstrap
    if (isFirstRunSinceReset) {
        ns.tprint("New augmentation reset detected — default cfg loaded.");

        // Record the reset we just handled, so isFirstRunSinceReset is false on the next
        // init.js run until another aug reset happens. Without this, lastAugReset was never
        // written and every run redid the full bootstrap, wiping cfg.json back to defaults.
        jsonEdit(ns, "lastAugReset", resetInfo.lastAugReset);

        // Placeholder for a future collected-results string; printResults() ignores it today.
        const results = "";

        // Fun little countdown nonsense
        await nonsense(ns);

        // run scanner to build "/data/networks.json"
        scanNetwork(ns, true);
        scanCloud(ns, true);

        // read full server information to servers
        const servers = JSON.parse(ns.read("/data/networks.json"));

        // An aug reset revokes root on every server, so re-nuke everything we now qualify for.
        // The `true` third arg is autoNuke's `quiet` flag - suppresses per-server log spam.
        for (const targetServer of servers) {
            autoNuke(ns, targetServer.hostname, true);
        }

        // Re-scan so networks.json records the root access just gained above -
        // the first scan ran before any nuking, so its hasAdminRights flags are now out of date.
        scanNetwork(ns, true);

        // Restart the daemon so it picks up the freshly-defaulted cfg.json.
        // ns.kill(filename, host, ...args) requires an EXACT args match, so this only kills a
        // daemon.js that was launched with no args - a daemon started with args survives and
        // you end up with two. Prefer PID-based killing via ns.ps() (see findings).
        ns.kill("daemon.js", "home");
        ns.run("daemon.js", 1);

        // exec buyRAM

        // exec buyHacknet

        // exec joinFactions

        // exec buyAugments

        // exec buyTor and programs (SINGULARITY)

        // exec watch

        await printResults(ns, results, cfg);
    }


    /**
     * Prints the post-bootstrap summary and next-step hints to the terminal.
     * Terminal-facing, so ns.tprint rather than ns.print.
     * @param {NS} ns - The Netscript API object
     * @param {string} results - Currently unused; reserved for a collected results string
     * @param {object} cfg - The freshly re-read configuration object; only cfg.watchedScripts is displayed
     * @returns {Promise<void>}
     */
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
        ns.tprint("  Remember to buy TOR router and buy programs with buy -l and buy -a");
        ns.tprint('  "cfg toggle" to turn things on, or "cfg all" for full config');
        ns.tprint('  "run go.js 1" or "run dispatch.js" to get started!');
    }


    /**
     * Plays a stylised cyberpunk boot animation in the terminal.
     * Purely cosmetic - it changes no state and blocks for roughly 10 seconds while it runs.
     * Works by repeatedly clearing the terminal (ns.ui.clearTerminal) and re-printing a frame,
     * which is why every helper inside pairs a cls() with a term().
     * @param {NS} ns - The Netscript API object
     * @returns {Promise<void>}
     */
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
        const cls = () => ns.ui.clearTerminal();            // wipe the terminal (one animation frame)
        const term = (text = "") => ns.tprint(text);        // print one animation frame

        // Inclusive on both ends: randInt(0, n - 1) is the safe index form used below.
        const randInt = (min, max) =>
            Math.floor(Math.random() * (max - min + 1)) + min;

        const randChoice = (arr) => arr[randInt(0, arr.length - 1)];    // random element
        const randChar = () => chars[randInt(0, chars.length - 1)];     // random glyph from `chars`

        /**
         * Builds one row of random glyphs, `width` characters wide.
         * @returns {string} A single line of visual noise
         */
        function randomLine() {
            let line = "";
            for (let i = 0; i < width; i++) {
                line += randChar();
            }
            return line;
        }

        /**
         * Builds a full screen of noise, then overwrites a few random rows with flavour text
         * so readable messages appear to surface out of the static.
         * @returns {string} A `height`-line frame, newline joined
         */
        function randomFrame() {
            const lines = [];

            for (let i = 0; i < height; i++) {
                lines.push(randomLine());
            }

            // Inject 1–3 messages. Rows are picked independently, so the same row can be
            // chosen twice and one message simply overwrites the other - harmless here.
            const injections = randInt(1, 3);
            for (let i = 0; i < injections; i++) {
                lines[randInt(0, height - 1)] = randChoice(messages);
            }

            return lines.join("\n");
        }

        /**
         * Reveals text one character at a time, redrawing the whole terminal each step
         * with a block cursor appended, then settles on the finished line.
         * @param {string} text - The line to type out
         * @param {number} [delay=30] - Milliseconds between characters
         * @returns {Promise<void>}
         */
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

        /**
         * Animates a cosmetic 0-100% progress bar. Nothing is actually being measured -
         * `duration` is split evenly across 25 fixed steps.
         * @param {string} label - Caption printed above the bar
         * @param {number} [duration=300] - Total milliseconds the bar takes to fill
         * @returns {Promise<void>}
         */
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

        /**
         * Prints `text` on every other iteration, pausing between each.
         * Despite the name this does not flash: there is no cls() in the loop, so the "off"
         * iterations add nothing and the result is `times / 2` stacked copies of the line
         * appearing one after another. See findings.
         * @param {string} text - The line to print
         * @param {number} [times=4] - Loop iterations (half of which print)
         * @param {number} [delay=120] - Milliseconds between iterations
         * @returns {Promise<void>}
         */
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
        // Phase 7: (unused - countdown already happens in Phase 5)
        // -----------------------------



    }
}
