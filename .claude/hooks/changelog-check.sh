#!/usr/bin/env bash
# Stop hook: if project files changed more recently than CHANGELOG.md, block the stop once
# and remind Claude to log the work (CLAUDE.md "Keep the audit trail current").
input=$(cat)
# Already continuing because of this hook - don't loop.
[ "$(printf '%s' "$input" | jq -r '.stop_hook_active // false')" = "true" ] && exit 0

cd "$(dirname "$0")/../.." || exit 0
[ -f CHANGELOG.md ] || exit 0

changed=$(find servers docs CLAUDE.md TODO.md README.md .gitattributes \
    -path servers/home/build -prune -o -type f -newer CHANGELOG.md -print 2>/dev/null | grep -v '^TODO.md$' | head -10)
[ -z "$changed" ] && exit 0

reason="Files changed after CHANGELOG.md was last updated:
$changed
If you changed these this session, add an entry to CHANGELOG.md under today's date (what changed, why, anything deliberately left as-is) and tick/remove the matching TODO.md item. If they aren't your changes, or the work is already logged, say so and stop."
jq -n --arg r "$reason" '{decision: "block", reason: $r}'
