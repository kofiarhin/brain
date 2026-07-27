import crypto from 'crypto';
import { getAiConfig } from '../config/ai.js';
import { createEmbedding, NvidiaProviderError } from './nvidiaClient.js';

export const normalizeEmbeddableContent = (value) => String(value || '').trim().replace(/\s+/g, ' ');
export const embeddingContentHash = (value) => crypto.createHash('sha256').update(normalizeEmbeddableContent(value)).digest('hex');

export async function embedNote(note) {
  const config = getAiConfig();
  const hash = embeddingContentHash(note.content);
  if (note.embeddingStatus === 'ready' && note.embeddingContentHash === hash && note.embeddingModel === config.embeddingModel) return note;
  note.embeddingStatus = note.embedding?.length ? 'stale' : 'pending';
  note.embeddingErrorCode = '';
  await note.save();
  try {
    const result = await createEmbedding({ input: normalizeEmbeddableContent(note.content), inputType: 'passage' });
    Object.assign(note, {
      embedding: result.embedding, embeddingModel: result.model, embeddingDimensions: result.dimensions,
      embeddingContentHash: hash, embeddingStatus: 'ready', embeddingUpdatedAt: new Date(), embeddingErrorCode: '',
    });
  } catch (error) {
    note.embeddingStatus = 'failed';
    note.embeddingErrorCode = error instanceof NvidiaProviderError ? error.code : 'EMBEDDING_FAILED';
  }
  await note.save();
  return note;
}
