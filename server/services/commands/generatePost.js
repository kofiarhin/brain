import { commandModels } from './commandContext.js';
import { commandResult } from './commandValidation.js';
import { generatePostSkill } from '../skills/generatePostSkill.js';

const requiredSuccessFields = ['selectedTopic', 'researchSummary', 'linkedInPost', 'xPost', 'inspirationalMessage'];
const statuses = new Set(['success', 'partial', 'failed']);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function clampIterationCount(value) {
  const count = Number.isFinite(Number(value)) ? Number(value) : 0;
  return Math.max(0, Math.min(3, count));
}

function normalizeOutput(output = {}, now = new Date()) {
  return {
    runDate: output.runDate || now,
    status: statuses.has(output.status) ? output.status : 'success',
    selectedTopic: output.selectedTopic || '',
    topicRationale: output.topicRationale || '',
    researchSummary: output.researchSummary || '',
    researchAgents: asArray(output.researchAgents),
    linkedInPost: output.linkedInPost || '',
    xPost: output.xPost || '',
    inspirationalMessage: output.inspirationalMessage || '',
    reviewNotes: asArray(output.reviewNotes),
    iterationCount: clampIterationCount(output.iterationCount),
    warnings: asArray(output.warnings),
    errors: asArray(output.errors),
    metadata: output.metadata || {},
  };
}

function validateGeneratedPost(output) {
  const errors = [];
  if (output.status === 'success') {
    for (const field of requiredSuccessFields) {
      if (!String(output[field] || '').trim()) errors.push(`${field} is required for successful generated posts.`);
    }
  }
  if (Number(output.iterationCount) > 3) errors.push('iterationCount cannot exceed 3.');
  if (errors.length) {
    const error = new Error(errors.join(' '));
    error.statusCode = 500;
    throw error;
  }
}

export async function executeGeneratePost(options = {}) {
  const models = commandModels(options);
  const now = options.now || new Date();
  const postGenerationSkill = options.postGenerationSkill || generatePostSkill;

  try {
    const skillOutput = await postGenerationSkill({ now, models });
    validateGeneratedPost(skillOutput || {});
    const payload = normalizeOutput(skillOutput, now);
    const generatedPost = await models.GeneratedPostModel.create(payload);

    return {
      ...commandResult({
        command: 'generate-post',
        status: generatedPost.status,
        ids: { generatedPostId: String(generatedPost._id) },
        warnings: generatedPost.warnings || [],
        errors: generatedPost.errors || [],
        counts: { generatedPostsCreated: 1, iterationCount: generatedPost.iterationCount || 0 },
      }),
      generatedPost,
    };
  } catch (error) {
    const generatedPost = await models.GeneratedPostModel.create({
      runDate: now,
      status: 'failed',
      errors: [error.message],
      warnings: [],
      metadata: { command: 'generate-post', failedAt: now, reason: error.name || 'Error' },
    });
    return {
      ...commandResult({
        command: 'generate-post',
        status: 'failed',
        ids: { generatedPostId: String(generatedPost._id) },
        warnings: [],
        errors: [error.message],
        counts: { generatedPostsCreated: 1, iterationCount: 0 },
      }),
      generatedPost,
    };
  }
}
