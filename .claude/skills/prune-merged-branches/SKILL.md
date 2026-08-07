---
name: prune-merged-branches
description: Find local worktree-* branches (and their linked git worktrees) that are fully merged into master, confirm with the user, then delete both the branches and their worktree directories. Use when asked to prune, clean up, or check on Claude's leftover worktree branches.
---

# Prune merged worktree branches

Claude Code's `EnterWorktree` tool creates a randomly-named branch
(`worktree-<adjective>-<adjective>-<noun>`) plus a linked worktree directory
under `.claude/worktrees/` every time a background job or agent needs to
edit files in isolation. These accumulate over time and need periodic
cleanup once their work has been merged into `master` (normally via GitHub
Desktop, per this project's manual-git-management preference — see
[[feedback_git_manual]] if that memory exists).

This skill only ever targets branches matching `worktree-*` — never touch
`master`, `windowsold`, or any other branch the user created by hand, even
if it also turns out to be merged.

**Must run from the main checkout, not from inside a worktree.** If the
current session is isolated in a worktree (check whether cwd is under
`.claude/worktrees/`), exit it first — `git worktree remove` and
`git branch -d` are repo-wide operations and the isolation guard will
reject them from inside a linked worktree anyway.

## Steps

1. `git worktree list` and `git branch --list "worktree-*"` to enumerate
   every candidate branch and whether it has a linked worktree directory.
2. For each candidate branch, check merge status:
   `git merge-base --is-ancestor <branch> master && echo merged`.
   Split into **merged** and **not merged** buckets.
3. For each **merged** branch's worktree (if it has one), check
   `git -C <worktree-path> status --short` for uncommitted changes.
   - Clean: safe to remove outright.
   - Dirty: this means real work exists that never got committed — do NOT
     discard it silently. Show the diff and ask the user how to handle it
     (commit it somewhere real first, or confirm it's throwaway) before
     proceeding with that one. This exact situation happened before with
     `buyrep-home-fix` — an uncommitted doc fix nearly got lost to a blind
     prune.
4. Report a short table: branch name, merged y/n, worktree clean/dirty/none.
   For any **not merged** branches, stop and ask what to do — don't delete
   unmerged work. Don't ask for confirmation on the merged+clean ones by
   default; listing them in the report before acting is enough given this
   is a repeatable, low-risk cleanup the user has already approved the
   pattern for. If anything is dirty or ambiguous, always confirm first.
5. For each merged+clean branch: remove its worktree
   (`git worktree remove <path>`, or `--force` only if step 3 already
   confirmed it's clean — `git worktree remove` is picky about "clean"
   sometimes flagging untracked build artifacts; use judgement, don't
   force blindly), then delete the branch with `git branch -d <branch>`
   (lowercase `-d`, never `-D` — it refuses to delete anything with
   unmerged commits, which is the safety net if step 2's check was wrong).
6. Check `git branch -r` for any of the pruned branch names existing on
   `origin`. If found, report it but do NOT delete the remote branch or
   push — that crosses into "affects shared state," which this project's
   owner handles manually. Just flag it.
7. Finish with `git worktree list` and `git branch` to confirm the final
   state, and report what was removed.
