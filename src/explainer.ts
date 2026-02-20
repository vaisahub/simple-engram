/**
 * Explainability module for scoring and ranking decisions
 */

import type { Memory } from "./types.js";
import { decayedImportance } from "./decay.js";
import type { EngramConfig } from "./types.js";

/**
 * Generate explanation for surprise score
 */
export function explainSurprise(
  surprise: number,
  semantic: number | null,
  keyword: number,
  rarity: number,
  hasEmbeddings: boolean,
): string {
  if (hasEmbeddings && semantic !== null) {
    return `surprise: ${surprise.toFixed(3)} (semantic: ${semantic.toFixed(2)}, keyword: ${keyword.toFixed(2)}, rarity: ${rarity.toFixed(2)})`;
  } else {
    return `surprise: ${surprise.toFixed(3)} (keyword: ${keyword.toFixed(2)}, rarity: ${rarity.toFixed(2)})`;
  }
}

/**
 * Generate explanation for store decision
 */
export function explainStoreDecision(
  surprise: number,
  importance: number,
  threshold: number,
  categoryBoost: number,
  stored: boolean,
  closestSimilarity?: number,
): string {
  const parts: string[] = [];

  if (closestSimilarity !== undefined) {
    parts.push(`closest existing similarity: ${closestSimilarity.toFixed(3)}`);
  }

  parts.push(
    `× category_boost: ${categoryBoost.toFixed(1)} → importance: ${importance.toFixed(3)}`,
  );

  if (stored) {
    parts.push(`→ STORED (${surprise.toFixed(3)} >= threshold ${threshold})`);
  } else {
    parts.push(`→ REJECTED (${surprise.toFixed(3)} < threshold ${threshold})`);
  }

  return parts.join("\n  ");
}

/**
 * Generate explanation for retrieval score
 */
export function explainRetrievalScore(
  memory: Memory,
  relevance: number,
  importance: number,
  recency: number,
  score: number,
  config: EngramConfig,
): string {
  const baseImportance = memory.importance;
  const decayed = decayedImportance(memory, config);
  const ageDays = Math.floor(
    (Date.now() - memory.createdAt) / (1000 * 60 * 60 * 24),
  );
  const accessBoost = 1 + Math.log2(1 + memory.accessCount) * 0.1;

  const parts: string[] = [
    `retrieval_score: ${score.toFixed(3)}`,
    `  relevance: ${relevance.toFixed(3)}`,
    `  importance: ${importance.toFixed(3)} (base: ${baseImportance.toFixed(3)}, decayed: ${decayed.toFixed(3)}, access_boost: ${accessBoost.toFixed(2)}x)`,
    `  recency: ${recency.toFixed(3)} (${ageDays} days old)`,
    `weights: 0.5 × ${relevance.toFixed(3)} + 0.3 × ${importance.toFixed(3)} + 0.2 × ${recency.toFixed(3)} = ${score.toFixed(3)}`,
  ];

  return parts.join("\n");
}

/**
 * Format age for display
 */
export function formatAge(timestamp: number): string {
  const ageDays = Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24));

  if (ageDays === 0) {
    const ageHours = Math.floor((Date.now() - timestamp) / (1000 * 60 * 60));
    if (ageHours === 0) {
      const ageMinutes = Math.floor((Date.now() - timestamp) / (1000 * 60));
      return `${ageMinutes}m ago`;
    }
    return `${ageHours}h ago`;
  } else if (ageDays < 7) {
    return `${ageDays}d ago`;
  } else if (ageDays < 30) {
    const weeks = Math.floor(ageDays / 7);
    return `${weeks}w ago`;
  } else if (ageDays < 365) {
    const months = Math.floor(ageDays / 30);
    return `${months}mo ago`;
  } else {
    const years = Math.floor(ageDays / 365);
    return `${years}y ago`;
  }
}
