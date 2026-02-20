/**
 * Retriever — search and rank memories for recall
 */

import type {
  Memory,
  StoreAdapter,
  EmbedFunction,
  RecallOptions,
  EngramConfig,
} from "./types.js";
import { jaccardSimilarity, cosineSimilarity } from "./similarity.js";
import { decayedImportance } from "./decay.js";
import { explainRetrievalScore } from "./explainer.js";

/**
 * Compute retrieval score for a memory
 */
function computeRetrievalScore(
  memory: Memory,
  query: string,
  queryEmbedding: number[] | undefined,
  config: EngramConfig,
): number {
  // Relevance: how well does this match the query?
  let relevance = 0;

  if (queryEmbedding && memory.embedding) {
    relevance = cosineSimilarity(queryEmbedding, memory.embedding);
  } else {
    relevance = jaccardSimilarity(query, memory.content);
  }

  // Importance: with decay and access boost
  const importance = decayedImportance(memory, config);

  // Recency: slight boost for recent memories
  const ageDays = (Date.now() - memory.createdAt) / (1000 * 60 * 60 * 24);
  const recency = 1.0 / (1.0 + ageDays / 30);

  // Weighted combination
  return 0.5 * relevance + 0.3 * importance + 0.2 * recency;
}

/**
 * Apply filters to memory list
 */
function applyFilters(memories: Memory[], options: RecallOptions): Memory[] {
  let filtered = memories;

  if (options.categories) {
    filtered = filtered.filter((m) => options.categories!.includes(m.category));
  }

  if (options.since !== undefined) {
    filtered = filtered.filter((m) => m.createdAt >= options.since!);
  }

  if (options.namespace !== undefined) {
    filtered = filtered.filter((m) => m.namespace === options.namespace);
  }

  if (options.metadata) {
    filtered = filtered.filter((m) => {
      return Object.entries(options.metadata!).every(
        ([key, value]) => m.metadata[key] === value,
      );
    });
  }

  return filtered;
}

/**
 * Retrieve and rank memories
 */
export async function retrieveMemories(
  query: string,
  store: StoreAdapter,
  config: EngramConfig,
  embedFn?: EmbedFunction,
  options: RecallOptions = {},
): Promise<Memory[]> {
  const k = options.k ?? config.defaultK ?? 5;

  // Step 1: Generate query embedding if available
  let queryEmbedding: number[] | undefined;
  if (embedFn) {
    try {
      queryEmbedding = await embedFn(query);
    } catch {
      // Fall back to keyword search if embedding fails
      queryEmbedding = undefined;
    }
  }

  // Step 2: Candidate generation (over-fetch k * 3)
  let candidates: Memory[] = [];

  // Try vector search if available and embeddings work
  if (queryEmbedding && store.vectorSearch) {
    try {
      const vectorResults = await store.vectorSearch(queryEmbedding, k * 3);
      candidates.push(...vectorResults);
    } catch {
      // Fall back to keyword search
    }
  }

  // Always do keyword search and merge results
  const keywordResults = await store.search(query, k * 3);
  for (const result of keywordResults) {
    if (!candidates.some((c) => c.id === result.id)) {
      candidates.push(result);
    }
  }

  // Step 3: Apply filters
  candidates = applyFilters(candidates, options);

  // Step 4: Score and rank
  const scored = candidates.map((memory) => {
    const score = computeRetrievalScore(memory, query, queryEmbedding, config);
    return { memory, score };
  });

  scored.sort((a, b) => b.score - a.score);

  // Step 5: Apply minImportance filter
  let filtered = scored;
  if (options.minImportance !== undefined) {
    filtered = scored.filter((item) => {
      const decayed = decayedImportance(item.memory, config);
      return decayed >= options.minImportance!;
    });
  }

  // Step 6: Take top k
  const topK = filtered.slice(0, k);

  // Step 7: Add explanations if requested
  const results = topK.map(({ memory, score }) => {
    const enriched = { ...memory };

    // Add decayed importance
    enriched.decayedImportance = decayedImportance(memory, config);

    // Add explanation if requested
    if (options.explain) {
      const relevance =
        queryEmbedding && memory.embedding
          ? cosineSimilarity(queryEmbedding, memory.embedding)
          : jaccardSimilarity(query, memory.content);

      const ageDays = (Date.now() - memory.createdAt) / (1000 * 60 * 60 * 24);
      const recency = 1.0 / (1.0 + ageDays / 30);

      enriched.explanation = explainRetrievalScore(
        memory,
        relevance,
        enriched.decayedImportance,
        recency,
        score,
        config,
      );
    }

    return enriched;
  });

  return results;
}
