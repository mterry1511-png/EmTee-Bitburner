---
name: checklist-tick
description: Reconcile docs/checklist.txt against CLAUDE.md (and docs/review-findings.md), asking the user to confirm ambiguous items rather than deciding unilaterally. Use when asked to sync, update, or "tick" the checklist.
---

# Checklist tick

Keep `docs/checklist.txt` in sync with the project's source of truth. The
checklist is a derived artifact — never treat it as authoritative; CLAUDE.md
(and docs/review-findings.md, while it exists) always win on conflict.

This is a collaborative pass, not an autonomous rewrite: only auto-apply
changes that are unambiguous from the text. For anything judgment-based —
whether an item is actually done, still relevant, or superseded — ask the
user rather than deciding alone.

## Steps

1. Read `CLAUDE.md` at the repo root. Read `docs/review-findings.md` too, if
   it still exists — it's a transient work queue that feeds priority items
   into the checklist.
2. Read the current `docs/checklist.txt`.
3. Sort proposed changes into two buckets:
   - **Unambiguous, apply directly:** CLAUDE.md explicitly marks the item
     "Resolved"/done, or a brand-new item is clearly present with no
     existing counterpart (new confirmed bug, new "On the Horizon" entry).
   - **Needs a call, ask first:** an item looks likely done/stale but isn't
     explicitly marked so, an item seems superseded by newer text but the
     old wording is still technically present, or a section (like the
     review-findings follow-up block) might need to be dropped entirely.
4. For the "needs a call" bucket, use `AskUserQuestion` to walk through each
   one with the user (batch related items into one question where sensible)
   — offer options like "mark done / keep open / remove / not sure yet"
   rather than silently guessing.
5. Apply the agreed changes: check off (`[x]`), add, remove, or reword items
   as confirmed. Preserve the existing section structure and ordering style.
6. Only write the file if something actually changed — don't touch it on a
   no-op run.

Report a one-line summary of what changed (or "no changes") — don't dump the
full diff unless asked.
