export const GENERATE_POST_WORKFLOW_PROMPT = `Generate post workflow:
1. Spawn three independent research agents.
2. Each agent researches trending tech topics from pillar tech websites.
3. Orchestrator synthesizes research and selects one high-conversion/high-impression topic.
4. Writer generates a LinkedIn post, X post, and short inspirational message.
5. Reviewer reviews and fact-checks.
6. Writer/reviewer loop repeats up to three iterations.
7. Return the final polished structured result.`;

const WORKFLOW = 'three-research-agents-orchestrator-writer-reviewer';

export async function runResearchAgents({ now } = {}) {
  const runDate = now || new Date();
  return [
    {
      name: 'Agent 1',
      sourceFocus: 'Product and platform announcements from pillar tech publications',
      summary: 'Tracks major AI product, developer tooling, and platform shifts that could affect builders.',
      sources: [{ title: 'Codex CLI research placeholder', url: '', publisher: 'Codex workflow', publishedAt: runDate, notes: 'Replace with verified sources during command execution.' }],
    },
    {
      name: 'Agent 2',
      sourceFocus: 'Infrastructure, cloud, and security trends',
      summary: 'Tracks cloud infrastructure, cybersecurity, and engineering operations signals.',
      sources: [{ title: 'Codex CLI research placeholder', url: '', publisher: 'Codex workflow', publishedAt: runDate, notes: 'Replace with verified sources during command execution.' }],
    },
    {
      name: 'Agent 3',
      sourceFocus: 'Startup, business, and adoption angles',
      summary: 'Tracks commercialization, adoption, and high-impression founder/operator narratives.',
      sources: [{ title: 'Codex CLI research placeholder', url: '', publisher: 'Codex workflow', publishedAt: runDate, notes: 'Replace with verified sources during command execution.' }],
    },
  ];
}

export function orchestrateTopic(researchAgents = []) {
  return {
    selectedTopic: 'AI-native execution systems are becoming the new operating layer for knowledge work',
    topicRationale: 'This topic connects current AI tooling momentum with a practical operator outcome: turning context into execution.',
    researchSummary: researchAgents.map((agent) => agent.summary).join(' '),
  };
}

export function writePosts({ selectedTopic, topicRationale }) {
  return {
    linkedInPost: `${selectedTopic}\n\nThe next advantage is not just having better tools. It is building a system that turns context into decisions, decisions into tasks, and tasks into shipped outcomes.\n\n${topicRationale}\n\nBuilders who design their own operating layer now will compound faster than teams waiting for a perfect all-in-one app.`,
    xPost: 'AI-native execution systems are the next productivity edge: context → decisions → tasks → shipped outcomes. The winners will build operating layers, not just collect tools.',
    inspirationalMessage: 'Build the system. Trust the process. Ship the work.',
  };
}

export function reviewPosts(posts) {
  const notes = [];
  if ((posts.xPost || '').length > 280) notes.push('X post should stay below 280 characters.');
  if (!posts.linkedInPost?.trim()) notes.push('LinkedIn post is missing.');
  return { approved: notes.length === 0, notes };
}

export function runReviewLoop(topic) {
  let iterationCount = 0;
  let posts = writePosts(topic);
  let review = reviewPosts(posts);
  while (!review.approved && iterationCount < 3) {
    iterationCount += 1;
    posts = { ...posts, xPost: posts.xPost.slice(0, 277) };
    review = reviewPosts(posts);
  }
  return { ...posts, reviewNotes: review.notes, iterationCount };
}

export async function generatePostSkill({ now = new Date() } = {}) {
  const researchAgents = await runResearchAgents({ now });
  const topic = orchestrateTopic(researchAgents);
  const posts = runReviewLoop(topic);
  return {
    runDate: now,
    status: 'success',
    ...topic,
    researchAgents,
    ...posts,
    warnings: ['Default deterministic Codex workflow wrapper used; replace placeholders with live Codex research during command execution.'],
    errors: [],
    metadata: { workflow: WORKFLOW, prompt: GENERATE_POST_WORKFLOW_PROMPT },
  };
}
