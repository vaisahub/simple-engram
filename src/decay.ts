/**
 * Time decay and forgetting algorithms
 */

import type { Memory, EngramConfig } from './types.js';

/**
 * Calculate decayed importance for a memory
 * Uses exponential decay with access boost
 */
export function decayedImportance(memory: Memory, config: EngramConfig): number {
  const ageDays = (Date.now() - memory.createdAt) / (1000 * 60 * 60 * 24);
  const halfLifeDays = config.decayHalfLifeDays ?? 30;
  const lambda = Math.LN2 / halfLifeDays;
  const decay = Math.exp(-lambda * ageDays);

  // Access boost: frequently accessed memories decay slower
  // 0 accesses → 1.0x, 1 → 1.1x, 10 → 1.35x
  const accessBoost = 1 + Math.log2(1 + memory.accessCount) * 0.1;

  return memory.importance * decay * accessBoost;
}

/**
 * Calculate if a memory should be pruned based on decay
 */
export function shouldPrune(memory: Memory, config: EngramConfig, mode: 'gentle' | 'normal' | 'aggressive'): boolean {
  const now = Date.now();

  // Always prune expired memories
  if (memory.expiresAt !== null && memory.expiresAt < now) {
    return true;
  }

  // Gentle mode: only prune expired
  if (mode === 'gentle') {
    return false;
  }

  // Normal mode: also prune very low importance
  const decayed = decayedImportance(memory, config);
  if (decayed < 0.01) {
    return true;
  }

  // Aggressive mode is handled separately (bottom 10%)
  return false;
}

/**
 * Sort memories by decayed importance (ascending)
 */
export function sortByDecayedImportance(memories: Memory[], config: EngramConfig): Memory[] {
  return memories.sort((a, b) => {
    const decayedA = decayedImportance(a, config);
    const decayedB = decayedImportance(b, config);
    return decayedA - decayedB;
  });
}

/**
 * Calculate expiration timestamp for a memory
 */
export function calculateExpiration(memory: Memory, config: EngramConfig): number | null {
  const maxRetentionMs = (config.maxRetentionDays ?? 90) * 24 * 60 * 60 * 1000;

  if (memory.ttl !== null) {
    // Use memory-specific TTL
    return memory.createdAt + memory.ttl * 1000;
  }

  // Use global max retention
  return memory.createdAt + maxRetentionMs;
}

/**
 * Get age of a memory in days
 */
export function getAgeDays(memory: Memory): number {
  return (Date.now() - memory.createdAt) / (1000 * 60 * 60 * 24);
}
