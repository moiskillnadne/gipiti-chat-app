export const meta = {
  name: 'implement-plan',
  description:
    'Stage 2: Sonnet implements one plan milestone task by task, Opus reviews each task and the milestone',
  whenToUse: 'After research-solution produced an approved plan in docs/plans with a ## Tasks section',
  phases: [
    { title: 'Load', detail: 'Sonnet: read plan, pick the milestone tasks', model: 'sonnet' },
    { title: 'Implement', detail: 'Sonnet: code + tests + commit per task', model: 'sonnet' },
    { title: 'Review', detail: 'Opus: review each task commit', model: 'opus' },
    { title: 'Final', detail: 'Sonnet full pnpm check, Opus milestone review', model: 'opus' },
  ],
}

// args: { planPath, milestone, maxFixRounds?: number, shouldCommit?: boolean }
const { planPath, milestone } = args
const maxFixRounds = args.maxFixRounds ?? 2
const shouldCommit = args.shouldCommit ?? true

const COMMIT_RULE = shouldCommit
  ? 'Commits are ENABLED: commit only this task\'s files with a conventional commit message ending with "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>".'
  : 'Commits are DISABLED: leave changes uncommitted.'

// Inlined from .claude/agents/implementer.md: custom agent types only register at session start.
const IMPLEMENTER_ROLE = `You are a Sonnet IMPLEMENTER: you implement exactly one task of an approved plan so it reads as if it was always part of the codebase.
1. Read the plan and the task, the code it touches, and one or two neighbouring files to copy their idiom.
2. For DB schema, AI model or AI tool changes follow .claude/skills/repo-recipes/SKILL.md.
3. Implement with unit tests next to the logic (**/__tests__/**/*.test.ts, AAA). UI strings go to messages/ru.json.
4. Run pnpm check:fast and fix everything (pnpm format for formatting) until green.
5. If you depart from the plan, update the plan file to match and report why.
Hard limits: never run pnpm build or db:migrate or touch a real database (hand-write migrations + journal entries; db:generate is broken); never git push/checkout/reset --hard/stash or rewrite history; never touch .env* or commit secrets. If blocked (missing decision, contradictory spec, external credentials needed), stop and report status "blocked" with the exact question instead of guessing.`

const asImplementer = (prompt, opts) =>
  agent(`${IMPLEMENTER_ROLE}\n\n---\n\n${prompt}`, { ...opts, model: 'sonnet' })

const TASKS_SCHEMA = {
  type: 'object',
  properties: {
    branch: { type: 'string' },
    baseSha: { type: 'string', description: 'git rev-parse HEAD before any work' },
    isWorkingTreeClean: { type: 'boolean' },
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          spec: { type: 'string', description: 'The task section from the plan, verbatim' },
        },
        required: ['id', 'title', 'spec'],
      },
    },
  },
  required: ['branch', 'baseSha', 'isWorkingTreeClean', 'tasks'],
}

const IMPLEMENT_SCHEMA = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['done', 'blocked'] },
    summary: { type: 'string' },
    filesChanged: { type: 'array', items: { type: 'string' } },
    isCheckPassing: { type: 'boolean', description: 'pnpm check:fast green at the end' },
    headSha: { type: 'string', description: 'git rev-parse HEAD after the work' },
    planDeviations: { type: 'array', items: { type: 'string' } },
    blockedQuestion: { type: 'string' },
  },
  required: ['status', 'summary', 'filesChanged', 'isCheckPassing', 'headSha', 'planDeviations'],
}

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['approve', 'changes_requested'] },
    blocking: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          file: { type: 'string' },
          line: { type: 'number' },
          issue: { type: 'string' },
          fix: { type: 'string' },
        },
        required: ['file', 'issue', 'fix'],
      },
    },
    nonBlocking: { type: 'array', items: { type: 'string' } },
  },
  required: ['verdict', 'blocking', 'nonBlocking'],
}

const reviewTask = (task, fromSha, toSha, round) =>
  agent(
    `Review the implementation of plan task **${task.id} — ${task.title}** from \`${planPath}\`.\n\nReview target: \`git diff ${fromSha}..${toSha}\` plus any uncommitted changes (\`git diff HEAD\`).\n\n## Task spec\n\n${task.spec}\n\nCheck that it does what the spec says (no less, no unrequested extras), is correct, safe (secrets, prompt injection, SSRF, auth), keeps billing correct, has tests for the logic, and follows the repo conventions. Mark as blocking only what must change before the next task builds on it.`,
    {
      label: `review:${task.id}#${round}`,
      phase: 'Review',
      agentType: 'review',
      model: 'opus',
      schema: REVIEW_SCHEMA,
    },
  )


phase('Load')
const loaded = await agent(
  `Read \`${planPath}\` and return every task of milestone **${milestone}** from its "## Tasks" section, in order, with each task's section copied verbatim into spec. Also report the current branch, \`git rev-parse HEAD\` as baseSha, and whether \`git status --porcelain\` is empty. Do not change anything.`,
  { label: 'load-plan', phase: 'Load', model: 'sonnet', effort: 'low', schema: TASKS_SCHEMA },
)

if (loaded.branch === 'main') {
  return { status: 'aborted', reason: 'Refusing to implement on main. Create a feature branch first.' }
}
if (!loaded.tasks.length) {
  return { status: 'aborted', reason: `No tasks found for ${milestone} in ${planPath}` }
}
log(`${milestone}: ${loaded.tasks.length} tasks on ${loaded.branch}`)

const taskResults = []
let currentSha = loaded.baseSha

// Tasks run one after another: they build on each other and share files.
for (const task of loaded.tasks) {
  const implementation = await asImplementer(
    `Implement plan task **${task.id} — ${task.title}** from \`${planPath}\` (read the whole plan for context; earlier tasks of this milestone are already in the tree).\n\n## Task spec\n\n${task.spec}\n\n${COMMIT_RULE}`,
    { label: `implement:${task.id}`, phase: 'Implement', schema: IMPLEMENT_SCHEMA },
  )

  if (!implementation || implementation.status === 'blocked') {
    taskResults.push({ id: task.id, status: 'blocked', question: implementation?.blockedQuestion })
    log(`${task.id} blocked — stopping the milestone`)
    break
  }

  let review = await reviewTask(task, currentSha, implementation.headSha, 1)
  let headSha = implementation.headSha
  let fixRound = 0

  while (review?.verdict === 'changes_requested' && fixRound < maxFixRounds) {
    fixRound += 1
    const fix = await asImplementer(
      `The Opus reviewer requested changes to plan task **${task.id} — ${task.title}** (\`${planPath}\`).\n\n## Blocking findings\n\n${JSON.stringify(review.blocking, null, 2)}\n\nFix every blocking finding. If a finding is wrong, do not change the code; explain why in summary with evidence. Keep \`pnpm check:fast\` green. ${COMMIT_RULE} Use a \`fix(...)\` commit.`,
      { label: `fix:${task.id}#${fixRound}`, phase: 'Implement', schema: IMPLEMENT_SCHEMA },
    )
    headSha = fix?.headSha ?? headSha
    review = await reviewTask(task, currentSha, headSha, fixRound + 1)
  }

  const isApproved = review?.verdict === 'approve'
  taskResults.push({
    id: task.id,
    status: isApproved ? 'approved' : 'unresolved',
    summary: implementation.summary,
    planDeviations: implementation.planDeviations,
    fixRounds: fixRound,
    openFindings: isApproved ? [] : review?.blocking ?? ['review failed'],
    nonBlocking: review?.nonBlocking ?? [],
  })
  currentSha = headSha

  if (!isApproved) {
    log(`${task.id} still has blocking findings after ${fixRound} fix rounds — stopping for a human decision`)
    break
  }
  log(`${task.id} approved by Opus after ${fixRound} fix round(s)`)
}


phase('Final')
const isMilestoneComplete =
  taskResults.length === loaded.tasks.length && taskResults.every((result) => result.status === 'approved')

if (!isMilestoneComplete) {
  return { status: 'stopped', milestone, branch: loaded.branch, taskResults }
}

const fullCheck = await asImplementer(
  `Milestone ${milestone} of \`${planPath}\` is implemented. Run the full \`pnpm check\` (typecheck, lint, unit tests, next build) and fix anything it reports without changing behaviour. ${COMMIT_RULE}`,
  { label: 'full-check', phase: 'Final', schema: IMPLEMENT_SCHEMA },
)

const milestoneReview = await agent(
  `Final review of milestone **${milestone}** from \`${planPath}\`: \`git diff ${loaded.baseSha}..HEAD\` plus uncommitted changes. Judge the milestone as a whole: does it meet the milestone's goal and acceptance checks end to end, are the pieces consistent with each other, anything a per-task review would miss (cross-file bugs, missing migration journal entries, missing i18n strings, unguarded feature flag, billing gaps)? List under nonBlocking anything the plan file should be updated with to match what was built.`,
  { label: 'milestone-review', phase: 'Final', agentType: 'review', model: 'opus', schema: REVIEW_SCHEMA },
)

return {
  status: milestoneReview?.verdict === 'approve' && fullCheck?.isCheckPassing ? 'ready' : 'needs-work',
  milestone,
  branch: loaded.branch,
  isFullCheckPassing: fullCheck?.isCheckPassing ?? false,
  taskResults,
  milestoneReview,
}
