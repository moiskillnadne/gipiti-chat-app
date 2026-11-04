export const meta = {
  name: 'research-solution',
  description:
    'Stage 1: Sonnet scouts code + web and proposes designs, Opus critiques and decides, writes ADR + plan',
  whenToUse:
    'Before implementing a large Linear issue: find the optimal solution and produce a sliced plan',
  phases: [
    { title: 'Scout', detail: 'Sonnet: codebase map + web research', model: 'sonnet' },
    { title: 'Propose', detail: 'Sonnet: independent architectures', model: 'sonnet' },
    { title: 'Critique', detail: 'Opus: adversarial critique and scoring', model: 'opus' },
    { title: 'Refine', detail: 'Sonnet: revise the winner against the critique', model: 'sonnet' },
    { title: 'Decide', detail: 'Opus: final decision, ADR and plan', model: 'opus' },
  ],
}

// args: { issueId, title, brief, date, slug, branch, scoutTopics?: [{key, prompt}], angles?: [{key, prompt}] }
const { issueId, title, brief, date, slug, branch } = args

const DEFAULT_SCOUT_TOPICS = [
  {
    key: 'codebase',
    prompt:
      'Map every place in this repo the feature would touch. For each integration point give path:line and how it works today.',
  },
  {
    key: 'technology',
    prompt:
      'Research the libraries, protocols and platform constraints the feature depends on. Versions must match package.json.',
  },
  {
    key: 'prior-art',
    prompt:
      'Research how comparable products and open-source projects implemented this feature, including UX and security lessons.',
  },
]

const DEFAULT_ANGLES = [
  { key: 'mvp-first', prompt: 'Optimise for the smallest safe MVP that meets the acceptance criteria soonest.' },
  { key: 'security-first', prompt: 'Optimise for security, trust and data integrity first; accept more work.' },
  { key: 'cost-latency-first', prompt: 'Optimise for token cost, latency and operating cost at scale.' },
]

const scoutTopics = args.scoutTopics ?? DEFAULT_SCOUT_TOPICS
const angles = args.angles ?? DEFAULT_ANGLES

const ISSUE = `# ${issueId}: ${title}\n\n${brief}`

// Role prompts are inlined (mirroring .claude/agents/researcher.md and judge.md) because custom
// agent types only register at session start.
const RESEARCHER_ROLE = `You are a Sonnet RESEARCHER. You gather evidence and propose solutions; an Opus judge will try to tear your output apart.
- Code claims cite path:line (read the code, do not guess from file names). Web claims cite a URL and its freshness; prefer official docs, specs, changelogs, source. Flag disagreements between sources.
- Split reports into Verified vs Assumed.
- Check versions: the repo pins ai@6, next@16, drizzle-orm@0.45, next-auth@5 beta. An API from another major version is a finding, not a solution.
- Users are in Russia: for any third-party service check availability to Russian users/accounts.
- Read-only on the repo: never edit app code, never run pnpm build (runs DB migrations), db:*, pnpm dev, git commit/checkout.
- Your final message is the deliverable: dense markdown, no preamble.`

const JUDGE_ROLE = `You are the Opus JUDGE: you critique, decide and write the ADR/plan. Your value is saying no — find the flaw that makes a plausible design fail in production.
- Verify before you trust: spot-check the riskiest claims yourself (open the cited file, fetch the cited doc). Unverifiable claims are risks.
- Priorities: money/billing correctness > security and data integrity (secrets, prompt injection, SSRF, auth) > platform limits (Vercel, 300s chat route, streaming) > UX > cost/latency > elegance.
- Prefer extending existing seams (lib/ai/tools, app/(chat)/api/chat/_lib, lib/billing, Drizzle hand-written migrations) over new frameworks. Penalise anything contradicting CLAUDE.md.
- Cut scope hard; name what is deferred and why. Every criticism comes with the concrete fix or the question to answer.
- Never edit application code; write only the docs you are asked to. Never run pnpm build, db:*, git commit/push/checkout.`

const asResearcher = (prompt, opts) =>
  agent(`${RESEARCHER_ROLE}\n\n---\n\n${prompt}`, { ...opts, model: 'sonnet' })
const asJudge = (prompt, opts) => agent(`${JUDGE_ROLE}\n\n---\n\n${prompt}`, { ...opts, model: 'opus' })

const CRITIQUE_SCHEMA = {
  type: 'object',
  properties: {
    evaluations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          angle: { type: 'string' },
          score: { type: 'number', description: '0-10 overall' },
          strengths: { type: 'array', items: { type: 'string' } },
          fatalFlaws: { type: 'array', items: { type: 'string' } },
          mustFix: { type: 'array', items: { type: 'string' } },
          unverifiedClaims: { type: 'array', items: { type: 'string' } },
        },
        required: ['angle', 'score', 'strengths', 'fatalFlaws', 'mustFix', 'unverifiedClaims'],
      },
    },
    winnerAngle: { type: 'string' },
    rationale: { type: 'string' },
    graftFromOthers: { type: 'array', items: { type: 'string' } },
    questionsForResearch: { type: 'array', items: { type: 'string' } },
  },
  required: ['evaluations', 'winnerAngle', 'rationale', 'graftFromOthers', 'questionsForResearch'],
}

const DECISION_SCHEMA = {
  type: 'object',
  properties: {
    planPath: { type: 'string' },
    adrPath: { type: 'string' },
    decisionSummary: { type: 'string', description: '5-10 lines, Russian' },
    milestones: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          taskIds: { type: 'array', items: { type: 'string' } },
        },
        required: ['id', 'title', 'taskIds'],
      },
    },
    questionsForUser: {
      type: 'array',
      items: { type: 'string' },
      description: 'Decisions only the product owner can make (credentials, app registrations, pricing)',
    },
  },
  required: ['planPath', 'adrPath', 'decisionSummary', 'milestones', 'questionsForUser'],
}


phase('Scout')
const scoutReports = await parallel(
  scoutTopics.map((topic) => () =>
    asResearcher(
      `${ISSUE}\n\n---\n\nYou are one of ${scoutTopics.length} parallel scouts. Your topic: **${topic.key}**.\n\n${topic.prompt}\n\nStay on your topic; other scouts cover the rest. Return a markdown report with sections: Verified findings (with sources), Assumptions, Risks, Open questions.`,
      { label: `scout:${topic.key}`, phase: 'Scout' },
    ),
  ),
)

if (!scoutReports.some(Boolean)) {
  return { status: 'aborted', reason: 'Every scout failed; nothing to propose from' }
}

const research = scoutTopics
  .map((topic, index) => `## Scout report: ${topic.key}\n\n${scoutReports[index] ?? '(scout failed, no report)'}`)
  .join('\n\n---\n\n')
log(`Scouts done: ${scoutReports.filter(Boolean).length}/${scoutTopics.length} reports`)


phase('Propose')
const proposals = await parallel(
  angles.map((angle) => () =>
    asResearcher(
      `${ISSUE}\n\n---\n\n# Research so far\n\n${research}\n\n---\n\nPropose a complete solution from this angle: **${angle.key}**. ${angle.prompt}\n\nOther researchers are proposing from different angles, so commit to yours. Cover: architecture and request flow, data model and migrations, auth/secrets, how it plugs into the chat route and billing, UI surfaces, security guardrails, cost/latency, what is cut from MVP, milestone breakdown, and the top risks with mitigations. Verify anything the research marked as assumed if your design depends on it. Return markdown.`,
      { label: `propose:${angle.key}`, phase: 'Propose' },
    ),
  ),
)

const proposalsText = angles
  .map((angle, index) => `## Proposal: ${angle.key}\n\n${proposals[index] ?? '(proposal failed)'}`)
  .join('\n\n---\n\n')


phase('Critique')
const critique = await asJudge(
  `${ISSUE}\n\n---\n\n# Research\n\n${research}\n\n---\n\n# Proposals\n\n${proposalsText}\n\n---\n\nCritique every proposal adversarially. Spot-check the riskiest claims yourself (open the cited code, fetch the cited docs). Score each 0-10, list fatal flaws and must-fix items, list claims you could not verify. Pick the winner (use the exact angle key), list ideas to graft from the losers, and list concrete questions the refiner must research before the final decision.`,
  { label: 'critique', phase: 'Critique', schema: CRITIQUE_SCHEMA },
)

const winnerIndex = Math.max(0, angles.findIndex((angle) => angle.key === critique.winnerAngle))
log(`Opus picked: ${angles[winnerIndex].key} — ${critique.rationale.slice(0, 160)}`)


phase('Refine')
const refined = await asResearcher(
  `${ISSUE}\n\n---\n\n# Winning proposal (${angles[winnerIndex].key})\n\n${proposals[winnerIndex]}\n\n---\n\n# Opus critique\n\n${JSON.stringify(critique, null, 2)}\n\n---\n\n# Research (for reference)\n\n${research}\n\n---\n\nRevise the winning proposal: fix every must-fix and fatal flaw of the winner, graft the listed ideas, and research each question in questionsForResearch (cite sources). Where the critique is wrong, push back with evidence instead of complying. Return the full revised design in markdown, followed by a section "Answers to research questions" and a section "Disagreements with the critique".`,
  { label: 'refine', phase: 'Refine' },
)


phase('Decide')
const decision = await asJudge(
  `${ISSUE}\n\n---\n\n# Refined design\n\n${refined}\n\n---\n\n# Your earlier critique\n\n${JSON.stringify(critique, null, 2)}\n\n---\n\nMake the final decision. Settle each disagreement the refiner raised. Then write two files:\n\n1. \`docs/adr/NNNN-${slug}.md\` (next free number, start at 0001): Context, Decision, Alternatives considered (the losing proposals and why), Consequences.\n2. \`docs/plans/${date}-${slug}.md\` with frontmatter \`date: ${date}\`, \`status: draft\`, \`branch: ${branch}\`, heading \`# ${title} (${issueId})\`, covering goal, files that change, order of work, risks, verification. End it with a \`## Tasks\` section: milestones \`### M1 — <title>\`, each with tasks \`#### M1-T1 — <title>\` that state files, the exact change, acceptance checks and dependencies. Every task must fit one implementer pass and leave \`pnpm check\` green. M1 must be a vertical slice usable end to end (behind a flag if needed).\n\nWrite the plan in English (code-facing) and the decisionSummary in Russian. Put decisions that need the product owner (app registrations, credentials, pricing) in questionsForUser instead of guessing.`,
  { label: 'decide', phase: 'Decide', schema: DECISION_SCHEMA },
)

return {
  winner: angles[winnerIndex].key,
  scores: critique.evaluations.map(({ angle, score }) => ({ angle, score })),
  ...decision,
}
