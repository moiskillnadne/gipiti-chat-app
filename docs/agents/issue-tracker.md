# Issue tracker: Linear

Issues and specs for this repo live in Linear (team key `GIPITI`). Use the Linear MCP tools (`mcp__claude_ai_Linear__*`), not `gh`. GitHub is used only for code and PRs.

## Conventions

- **Create an issue**: `save_issue` (no `id`), with team, title, and markdown body.
- **Read an issue**: `get_issue` by identifier (e.g. `GIPITI-98`), then `list_comments` for the thread.
- **List issues**: `list_issues`, filtered by team, state, and label.
- **Comment**: `save_comment` on the issue.
- **Apply / remove labels**: `save_issue` with the updated `labels` list. Create missing labels with `create_issue_label`.
- **Close**: `save_issue` with the Done state (or Canceled for `wontfix`), plus a closing comment.

## Pull requests

**PRs as a request surface: no.** PRs are not triaged; branches and PRs reference the Linear identifier (e.g. `GIPITI-98`) so Linear auto-links them.

## When a skill says "publish to the issue tracker"

Create a Linear issue in the GIPITI team.

## When a skill says "fetch the relevant ticket"

Call `get_issue` with the identifier, then `list_comments`.

## Wayfinding operations

- **Map**: a Linear issue labelled `wayfinder:map` holding Notes / Decisions-so-far / Fog.
- **Child ticket**: a Linear sub-issue (`parentId` = map) labelled `wayfinder:<type>`; assigned to the driver once claimed.
- **Blocking**: Linear's native "blocked by" relations.
- **Frontier query**: open children of the map with no open blockers and no assignee; first in map order wins.
- **Claim**: assign to yourself. **Resolve**: comment the answer, set Done, append a pointer to the map's Decisions-so-far.
