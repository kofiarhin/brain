import { Note } from '../models/Note.js';
import { getAiConfig } from '../config/ai.js';

export async function semanticSearchNotes({ queryEmbedding, limit, numCandidates } = {}) {
  const config = getAiConfig();
  const notes = await Note.aggregate([
    { $vectorSearch: {
      index: config.vectorIndex, path: 'embedding', queryVector: queryEmbedding,
      numCandidates: numCandidates || config.candidates, limit: limit || config.candidates,
      filter: { embeddingStatus: 'ready', embeddingModel: config.embeddingModel },
    } },
    { $project: { content: 1, embeddingModel: 1, embeddingDimensions: 1, score: { $meta: 'vectorSearchScore' } } },
  ]);
  return notes.filter((note) => note.embeddingDimensions === config.embeddingDimensions)
    .map((note) => ({ id: String(note._id), content: note.content, score: Number(note.score) }));
}
