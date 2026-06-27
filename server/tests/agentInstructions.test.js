import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const agentsInstructions = readFileSync(resolve(process.cwd(), 'AGENTS.md'), 'utf8');

describe('Codex command instructions', () => {
  test('update brain is explicitly separated from day planning side effects', () => {
    expect(agentsInstructions).toContain('Do not generate or write a day plan. Day planning is handled only by the dedicated day planning command.');
    expect(agentsInstructions).toContain('`update brain` and `update life` must not call `/api/day-plans/start`, `/api/day-plans/restart`, `startDaySession()`, `restartDaySession()`, or create/update `DayPlan` records.');
    expect(agentsInstructions).toContain('Do not output a schedule, time blocks, win condition, or generated daily plan when updating the brain.');
    expect(agentsInstructions).toContain('Do not generate, start, restart, upsert, or print a day plan.');
    expect(agentsInstructions).toContain('After completing `update brain`, create exactly one `BrainUpdateReport` in MongoDB.');
    expect(agentsInstructions).toContain('Running `update brain` must create zero `DayPlan` records.');
  });

  test('daily output is scoped to dedicated planning commands only', () => {
    expect(agentsInstructions).toContain('Use this section only for dedicated day-planning triggers');
    expect(agentsInstructions).toContain('Do not use this section for `update life` or `update brain`.');
  });
});
