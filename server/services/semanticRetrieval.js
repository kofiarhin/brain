import { Note } from '../models/Note.js';
import { getAiConfig } from '../config/ai.js';
import { createEmbedding, rerankDocuments } from './nvidiaClient.js';
import { semanticSearchNotes } from './vectorSearch.js';

const words = (message) => [...new Set(String(message).toLowerCase().match(/[a-z0-9]{3,}/g) || [])].slice(0, 8);
async function keywordFallback(message) {
  const terms = words(message);
  const query = terms.length ? { $or: terms.map((word) => ({ content: new RegExp(word, 'i') })) } : {};
  const notes = await Note.find(query).sort({ updatedAt: -1 }).limit(10);
  return { notes, retrieval: {
    mode: notes.length ? 'keyword-fallback' : 'none', candidateCount: notes.length,
    selectedCount: notes.length, embeddingModel: '', rerankModel: '', degraded: true,
  } };
}

export async function retrieveRelevantNotes({ message } = {}) {
  const config = getAiConfig();
  if (!config.vectorEnabled) return keywordFallback(message);
  try {
    const { embedding } = await createEmbedding({ input: message, inputType: 'query' });
    const candidates = await semanticSearchNotes({ queryEmbedding: embedding });
    let selected = candidates.slice(0, config.results);
    let mode = candidates.length ? 'vector' : 'none';
    let rerankModel = '';
    if (config.rerankEnabled && candidates.length > 1) {
      try {
        const ranked = await rerankDocuments({ query: message, documents: candidates.map((x) => x.content), topN: config.results });
        selected = ranked.map(({ index, score }) => ({ ...candidates[index], score }));
        mode = 'vector-reranked';
        rerankModel = config.rerankModel;
      } catch { /* Vector order is the safe fallback. */ }
    }
    return { notes: selected, retrieval: {
      mode, candidateCount: candidates.length, selectedCount: selected.length,
      embeddingModel: config.embeddingModel, rerankModel, degraded: false,
    } };
  } catch { return keywordFallback(message); }
}
