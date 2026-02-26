/**
 * Surprise scorer — the core novelty detection algorithm
 */

import type {
  Memory,
  MemoryCandidate,
  EmbedFunction,
  SurpriseResult,
} from "./types.js";
import { tokenize, tokenCache } from "./tokenizer.js";
import { cosineSimilarity, jaccardSimilarityTokens } from "./similarity.js";
import { explainSurprise, explainStoreDecision } from "./explainer.js";

/**
 * Check for exact duplicate (fast path)
 */
function isExactDuplicate(
  candidate: MemoryCandidate,
  existing: Memory[],
): boolean {
  const normalizedContent = candidate.content.toLowerCase().trim();
  return existing.some(
    (m) => m.content.toLowerCase().trim() === normalizedContent,
  );
}

/**
 * Compute semantic novelty using embeddings
 */
async function semanticNovelty(
  candidateEmbedding: number[],
  existing: Memory[],
): Promise<number> {
  if (existing.length === 0) return 1.0;

  let maxSimilarity = 0;

  for (const mem of existing) {
    if (!mem.embedding) continue;
    const sim = cosineSimilarity(candidateEmbedding, mem.embedding);
    maxSimilarity = Math.max(maxSimilarity, sim);
  }

  return 1.0 - maxSimilarity;
}

/**
 * Compute keyword novelty using Jaccard similarity
 * Uses token cache for Memory objects to avoid re-tokenization
 */
function keywordNovelty(
  candidate: MemoryCandidate,
  existing: Memory[],
): number {
  if (existing.length === 0) return 1.0;

  const candidateTokens = tokenize(candidate.content);
  let maxJaccard = 0;

  for (const mem of existing) {
    // Use cached tokens for Memory objects
    const memTokens = tokenCache.get(mem);
    const jaccard = jaccardSimilarityTokens(candidateTokens, memTokens);
    maxJaccard = Math.max(maxJaccard, jaccard);
  }

  return 1.0 - maxJaccard;
}

/**
 * Compute category rarity
 * More memories in the category = lower rarity score
 */
function categoryRarity(
  candidate: MemoryCandidate,
  existing: Memory[],
): number {
  const countInCategory = existing.filter(
    (m) => m.category === candidate.category,
  ).length;
  return 1.0 / Math.log2(2 + countInCategory);
  // 0 existing → 1.0, 1 → 0.63, 10 → 0.29, 100 → 0.15
}

/**
 * Find the most similar existing memory
 * Uses token cache for Memory objects to avoid re-tokenization
 */
function findMostSimilar(
  candidate: MemoryCandidate,
  existing: Memory[],
  candidateEmbedding?: number[],
): { memory: Memory; similarity: number } | null {
  if (existing.length === 0) return null;

  let maxSimilarity = 0;
  let mostSimilar: Memory | null = null;

  const candidateTokens = tokenize(candidate.content);

  for (const mem of existing) {
    let similarity = 0;

    if (candidateEmbedding && mem.embedding) {
      // Use cosine similarity if embeddings available
      similarity = cosineSimilarity(candidateEmbedding, mem.embedding);
    } else {
      // Fall back to Jaccard with cached tokens
      const memTokens = tokenCache.get(mem);
      similarity = jaccardSimilarityTokens(candidateTokens, memTokens);
    }

    if (similarity > maxSimilarity) {
      maxSimilarity = similarity;
      mostSimilar = mem;
    }
  }

  return mostSimilar
    ? { memory: mostSimilar, similarity: maxSimilarity }
    : null;
}

/**
 * Compute surprise score for a memory candidate
 * This is the core algorithm that determines if a memory is novel enough to store
 */
export async function computeSurprise(
  candidate: MemoryCandidate,
  existing: Memory[],
  embedFn?: EmbedFunction,
  explain = false,
): Promise<SurpriseResult> {
  // Step 0: Fast path for exact duplicates
  if (isExactDuplicate(candidate, existing)) {
    return {
      surprise: 0,
      explanation: "exact duplicate detected",
      stored: false,
      reason: "duplicate_content",
    };
  }

  // Step 1: Compute embeddings if available
  let candidateEmbedding: number[] | undefined;
  let semantic: number | null = null;

  if (embedFn) {
    try {
      candidateEmbedding = await embedFn(candidate.content);
      semantic = await semanticNovelty(candidateEmbedding, existing);
    } catch (error) {
      // Fall back to keyword-only if embedding fails
      candidateEmbedding = undefined;
      semantic = null;
    }
  }

  // Step 2: Compute keyword novelty (always)
  const keyword = keywordNovelty(candidate, existing);

  // Step 3: Compute category rarity
  const rarity = categoryRarity(candidate, existing);

  // Step 4: Combine scores
  let surprise: number;
  let explanationText: string;

  if (semantic !== null) {
    // With embeddings: 60% semantic, 30% keyword, 10% rarity
    surprise = 0.6 * semantic + 0.3 * keyword + 0.1 * rarity;
    explanationText = explainSurprise(
      surprise,
      semantic,
      keyword,
      rarity,
      true,
    );
  } else {
    // Without embeddings: 80% keyword, 20% rarity
    surprise = 0.8 * keyword + 0.2 * rarity;
    explanationText = explainSurprise(surprise, null, keyword, rarity, false);
  }

  // Step 5: Find closest existing memory if explaining
  let closestExisting: Memory | undefined;

  if (explain) {
    const closest = findMostSimilar(candidate, existing, candidateEmbedding);
    if (closest) {
      closestExisting = closest.memory;
    }
  }

  return {
    surprise,
    explanation: explanationText,
    closestExisting,
  };
}

/**
 * Score a candidate and determine if it should be stored
 */
export async function scoreAndDecide(
  candidate: MemoryCandidate,
  existing: Memory[],
  threshold: number,
  categoryBoost: number,
  embedFn?: EmbedFunction,
  explain = false,
): Promise<{
  surprise: number;
  importance: number;
  stored: boolean;
  reason?: string;
  explanation?: string;
  closestExisting?: Memory;
}> {
  const result = await computeSurprise(candidate, existing, embedFn, explain);

  const importance = result.surprise * categoryBoost;
  const stored = result.surprise >= threshold;

  let fullExplanation: string | undefined;
  if (explain) {
    const closestSim = result.closestExisting
      ? result.closestExisting.embedding && embedFn
        ? cosineSimilarity(
            await embedFn(candidate.content),
            result.closestExisting.embedding,
          )
        : jaccardSimilarityTokens(
            tokenize(candidate.content),
            tokenCache.get(result.closestExisting),
          )
      : undefined;

    fullExplanation =
      result.explanation +
      "\n  " +
      explainStoreDecision(
        result.surprise,
        importance,
        threshold,
        categoryBoost,
        stored,
        closestSim,
      );
  }

  return {
    surprise: result.surprise,
    importance,
    stored,
    reason: stored ? undefined : "below_threshold",
    explanation: fullExplanation,
    closestExisting: result.closestExisting,
  };
}
