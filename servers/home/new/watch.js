// ============================================================================
// watch.js — WORK IN PROGRESS. Design notes only; NOTHING here is implemented.
//
// Intended role: the single front-end for the watcher family, so you toggle and
// inspect the background watchers from one place instead of remembering four
// script paths. The watchers it is meant to front:
//   servwatch  - execs deployer.js against suitable servers, and culls the
//                deployers that are no longer worth the RAM they occupy.
//   cloudwatch - buys new cloud servers and upgrades existing ones.
//
// MATURITY: every function below is an EMPTY BODY. `main` will run, do nothing,
// and exit reporting success — which is the failure mode hardest to notice, so
// do not assume this file is working just because it did not error.
// ============================================================================

/**
 * Entry point for the watcher front-end.
 *
 * NOT IMPLEMENTED - the body is design notes only. Running this exits
 * immediately and silently having done nothing.
 *
 * Planned: parse args, report the running/stopped status of each watcher, and
 * toggle individual watchers on and off.
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
 */
export async function main(ns) {
    // handle args
    // status of watch scripts
    // toggle watch scripts off and on.

    // servwatch - exec deployer.js to attack suitable servers. culls less efficient deployers.
    // cloudwatch -buys new cloud hardware or upgrades
    //


}

/**
 * Print the supported terminal usage for this script.
 *
 * NOT IMPLEMENTED - empty body.
 *
 * Note this is declared with NO parameters. It will need `ns` to print
 * anything; the signature has deliberately been left as-is in this
 * documentation pass rather than changed.
 * @returns {void}
 */
function printUsage() {

}

/**
 * Start, stop or toggle the watcher processes.
 *
 * NOT IMPLEMENTED - empty body, and declared with no parameters despite
 * needing `ns` (and presumably a watcher name and desired state) to do
 * anything.
 * @returns {void}
 */
function watch() {

}

/**
 * Report which watchers are currently running.
 *
 * NOT IMPLEMENTED - empty body, and declared with no parameters despite
 * needing `ns` to inspect running processes.
 *
 * Per the project convention, use the PID-based `ns.ps()` approach for process
 * enumeration rather than `ns.isRunning(filename, host, ...args)`, which
 * requires exact argument matching and fails silently when it does not match.
 * @returns {void}
 */
function status() {

}