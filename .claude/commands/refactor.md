# Incremental Refactoring Session

## Step 1: Analysis
Scan the project and identify ONE specific refactoring opportunity. Focus on:
- Files longer than 200 lines that can be split
- Components mixing business logic with UI
- Duplicated code across files
- Inconsistent patterns (e.g., mixing fetch/axios, different state management approaches)
- God-components doing too many things
- Missing TypeScript types (any, unknown abuse)
- Dead code or unused imports
- API routes with business logic that should be in services

Prioritize by impact: what refactoring would improve maintainability the most with the least risk?

## Step 2: Report (STOP and wait for approval)
Present your findings in this format:

**Scope:** [exact file(s) to change]
**Problem:** [what's wrong and why it matters]  
**Plan:** [step-by-step what you'll do]
**Risk:** [what could break, what to test after]
**Estimated changes:** [number of files affected]

DO NOT make any changes yet. Wait for my approval or adjustments.

## Step 3: Execute (only after approval)
- Make changes incrementally
- Run typecheck (`npx tsc --noEmit`) after changes
- Run linter if configured
- Summarize what was changed

## Rules
- Never refactor more than 3-5 files in one session
- Keep all changes in one logical scope (one feature/module/pattern)
- Preserve all existing behavior — this is refactoring, not feature work
- If you're unsure about something, ask before changing
- Skip files/folders: node_modules, .next, generated types, migrations