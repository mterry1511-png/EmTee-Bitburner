https://github.com/mterry1511-png/EmTee-Bitburner.git


	update clone
git pull origin main

	Commit after done with edits: 
git add .
git commit -m "comment for commit"
git push origin main




	clone repo (first time)
git clone <repo-url>


Check the Current Repository Status
git status

This shows:

The current branch.
Whether you have uncommitted changes.
Whether your branch is ahead of or behind the remote branch.

Example:

On branch main
Your branch is up to date with 'origin/main'.

nothing to commit, working tree clean
Check Which Remote Repository Is Configured
git remote -v

Shows the fetch and push URLs for the repository.

Check Recent Commits
git log --oneline -5

Displays the last five commits.

Check Current Branch
git branch

The active branch is marked with *.