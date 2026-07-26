// ============================================================================
// newScriptTemplate.js — copy this file as the starting point for any new script.
//
// It exists to make the house JSDoc style the path of least resistance. The
// block below is the reference version of that style: copy its shape, not just
// its tags. The rules it demonstrates:
//
//   1. First line is a ONE-LINE summary, in the imperative ("Buys...", not
//      "This function buys..." or "Buying..."). It is the line that shows up in
//      the editor tooltip, so it has to stand alone.
//   2. Further paragraphs, separated by a blank ` *` line, only where the
//      behaviour is subtle or surprising. Document the trap, not the obvious.
//      "Reads cfg.json" needs no paragraph; "re-reads cfg.json every tick
//      because cfgall.js rewrites it out from under us" does.
//   3. `@param {NS} ns - The Netscript API object` — verbatim, always first.
//      Never abbreviate it, never drop the description; it is copy-pasted
//      identically across the whole project so it greps cleanly.
//   4. Optional parameters use the bracket-with-default form,
//      `@param {number} [maxSpend=0] - ...`. The brackets are what tells the
//      editor the argument may be omitted; a bare `@param {number} maxSpend`
//      on a defaulted parameter is wrong and will mis-report to autocomplete.
//   5. `@returns` is ALWAYS present. Including `@returns {void}` for a function
//      that returns nothing, and `@returns {Promise<void>}` for an async one
//      that returns nothing. An absent @returns reads as "the author forgot",
//      not as "returns nothing" — say it explicitly.
//   6. Types match `NetscriptDefinitions.d.ts` conventions: `string[]` over
//      `Array<string>`, inline object shapes like `{host: string, threads: number}`
//      for small ad-hoc returns, `*` only when the value genuinely can be anything.
//
// Conventions worth remembering while filling this in (see the root CLAUDE.md
// for the full list):
//   - `ns.tprint` for terminal-facing scripts, `ns.print` for background daemons.
//   - Terminal args always arrive as STRINGS. A boolean flag must be parsed as
//     `String(ns.args[0] ?? false).toLowerCase() === "true"` — a bare truthiness
//     check is a bug, because the string "false" is truthy.
//   - Keep data-retrieval functions separate from the functions that print.
// ============================================================================

/**
 * One-line summary of what this script does, in the imperative.
 *
 * Extra paragraphs go here, and only here, when the behaviour is subtle or
 * surprising enough that a reader would otherwise get it wrong. Explain the
 * "why", not the "what" — the code already says what it does.
 *
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
 */
export async function main(ns) {

}