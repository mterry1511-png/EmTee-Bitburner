---
name: jsdoc-update
description: Scan project JS files for missing or stale JSDoc (undocumented functions, params/returns that no longer match the current signature or behavior) and fix them in place, matching NetscriptDefinitions.d.ts style. Use when asked to update, refresh, audit, or scour JSDoc/doc comments.
---

# JSDoc update

Keep JSDoc blocks in `servers/home/**/*.js` accurate as the code evolves.
The project-wide JSDoc pass (2026-07-26, see CLAUDE.md) already brought
coverage to 58 of 60 files — this skill is a drift-detection sweep, not a
from-scratch pass. Treat an undocumented function as a gap against that
baseline, not the norm.

This is a mechanical, code-derivable task (signatures, param names, return
shapes are facts you can read straight off the code), so work through it
autonomously rather than pausing to ask — but see the "when to flag instead
of guess" note below for the one place judgment calls come up.

## Scope

If invoked with an argument (a file, directory, or glob), scope the sweep
to that. Otherwise default to all of `servers/home/**/*.js`. Never touch
`NetscriptDefinitions.d.ts` — it's the authoritative external reference,
not project code. Skip non-JS files (`cfg.json`, `defaultcfg.json`, etc.)
by extension; they were never in scope for JSDoc.

Work through the scope one directory at a time (`lib/`, `cfg/`, `cloud/`,
`scheduler/`, `stocks/`, `gang/`, `watch/`, top-level `servers/home/*.js`,
...), reporting a short summary after each before moving to the next,
rather than silently editing everything and dumping one giant diff at the
end.

## Style to match

Copy the existing convention exactly (see `lib/util.js` for canonical
examples) — do not invent a different format:

```
/**
 * <one-line summary, imperative or descriptive>
 *
 * <optional additional paragraphs: non-obvious behavior, invariants,
 * bugs/workarounds worth flagging - blank line between paragraphs>
 * @param {Type} paramName - Description
 * @param {Type} [optionalParam=defaultValue] - Description
 * @returns {Type} Description (omit the trailing description for {void})
 */
```

- `{NS}` for the `ns` parameter, always described as "The Netscript API
  object".
- Types for anything touching the Netscript API should match
  `NetscriptDefinitions.d.ts`'s own declared types (check it rather than
  guessing — e.g. what `ns.getServer()` actually returns).
- Match bracket-optional-param and default-value notation
  (`[quiet=false]`) exactly as shown above.
- `@returns {void}` for functions with no return value; otherwise a real
  type and, where the type alone isn't self-explanatory, a short
  description (see `getByPath`'s `@returns {{key: string, value: *}[]}
  Flat list of dotted keys and their leaf values` in `lib/util.js`).

## Steps

1. Pick the next directory/file batch per Scope above.
2. For each file, find every function-like declaration: `function foo()`,
   `export function foo()`, `export async function foo()`, and
   `const foo = (...) => {}` / `const foo = async (...) => {}` assigned at
   module scope. Pair each with any JSDoc block immediately preceding it.
3. Classify each:
   - **Missing** — function has no preceding JSDoc block.
   - **Stale** — a block exists but disagrees with the current signature:
     a param was added/removed/renamed, a param's actual type doesn't
     match the declared `@param` type, `@returns {void}` on a function
     that now returns a value (or vice versa), or the prose description
     describes behavior the function no longer has.
   - **OK** — leave untouched. Do not reword accurate descriptions just to
     rephrase them; only touch what's actually wrong or missing.
4. Fix mechanically-derivable mismatches directly, no need to ask:
   adding/removing/renaming `@param` lines to match the real parameter
   list, correcting a type by reading how the value is used in the body
   (and cross-checking `NetscriptDefinitions.d.ts` for anything passed to
   or returned from an `ns.*` call), and fixing `@returns` to match actual
   `return` statements.
5. For missing prose (summaries, param/return descriptions), draft them
   from reading the function body and its call sites — same bar as the
   existing comments (explain *why*/non-obvious behavior in multi-line
   prose, not just restate the signature).
6. **When to flag instead of guess:** if a function's purpose or a
   parameter's meaning is genuinely unclear even after reading its body
   and callers — not just "could be worded better," but actually
   ambiguous or suspicious (e.g. it looks like it might itself be a bug,
   similar to the dead `getAvailableThreads` branch already called out in
   `lib/util.js`) — do not guess at documentation that might be wrong.
   Leave a `// TODO(jsdoc):` note inline is not the convention here;
   instead, list it in the final report under a "needs a human look"
   section and leave the block as-is (or missing) rather than writing
   confident-sounding prose you're not sure of.
7. After each batch, report: functions fixed (missing → added / stale →
   corrected, with a one-line note of what changed), and anything flagged
   per step 6.
8. Do not commit. Leave changes staged in the working tree for the user to
   review (`git diff`) and commit themselves, per this project's manual-git
   workflow.

## Final report

End with a totals summary across the whole run: files touched, functions
newly documented, functions corrected, functions flagged for human review.
Keep it to a scannable list, not a blow-by-blow transcript.
