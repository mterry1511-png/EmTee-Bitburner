# Git cheat sheet

Repo: https://github.com/mterry1511-png/EmTee-Bitburner.git (default branch: `master`)

| Task | Command |
|---|---|
| Clone (first time) | `git clone <repo-url>` |
| Update local copy | `git pull origin master` |
| Status: branch, uncommitted changes, ahead/behind remote | `git status` |
| Show configured remotes | `git remote -v` |
| Last five commits | `git log --oneline -5` |
| List branches (active one marked `*`) | `git branch` |

Commit after finishing edits:

```
git add .
git commit -m "message"
git push origin master
```
