/**
 * Tokenizer for keyword search and Jaccard similarity
 */

import type { Memory } from "./types.js";

// Common English stopwords to filter out
const STOPWORDS = new Set([
  "a",
  "about",
  "above",
  "after",
  "again",
  "against",
  "all",
  "am",
  "an",
  "and",
  "any",
  "are",
  "as",
  "at",
  "be",
  "because",
  "been",
  "before",
  "being",
  "below",
  "between",
  "both",
  "but",
  "by",
  "can",
  "did",
  "do",
  "does",
  "doing",
  "don",
  "down",
  "during",
  "each",
  "few",
  "for",
  "from",
  "further",
  "had",
  "has",
  "have",
  "having",
  "he",
  "her",
  "here",
  "hers",
  "herself",
  "him",
  "himself",
  "his",
  "how",
  "i",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "itself",
  "just",
  "me",
  "more",
  "most",
  "my",
  "myself",
  "no",
  "nor",
  "not",
  "now",
  "of",
  "off",
  "on",
  "once",
  "only",
  "or",
  "other",
  "our",
  "ours",
  "ourselves",
  "out",
  "over",
  "own",
  "s",
  "same",
  "she",
  "should",
  "so",
  "some",
  "such",
  "t",
  "than",
  "that",
  "the",
  "their",
  "theirs",
  "them",
  "themselves",
  "then",
  "there",
  "these",
  "they",
  "this",
  "those",
  "through",
  "to",
  "too",
  "under",
  "until",
  "up",
  "very",
  "was",
  "we",
  "were",
  "what",
  "when",
  "where",
  "which",
  "while",
  "who",
  "whom",
  "why",
  "will",
  "with",
  "you",
  "your",
  "yours",
  "yourself",
  "yourselves",
]);

/**
 * Tokenize text into normalized words
 * - Lowercase
 * - Split on whitespace and punctuation
 * - Remove stopwords
 * - Filter tokens with length >= 2
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ") // Replace punctuation with spaces
    .split(/\s+/) // Split on whitespace
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token));
}

/**
 * Estimate token count for budget calculations
 * Rough approximation: chars / 4
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Get unique tokens from text
 */
export function uniqueTokens(text: string): Set<string> {
  return new Set(tokenize(text));
}

/**
 * Token cache using WeakMap for automatic memory management
 * Cache is per-session and automatically cleaned up when Memory objects are GC'd
 */
class TokenCache {
  private cache = new WeakMap<Memory, string[]>();
  private stats = { hits: 0, misses: 0 };

  /**
   * Get tokens for a memory object, using cache if available
   */
  get(memory: Memory): string[] {
    let tokens = this.cache.get(memory);
    if (tokens) {
      this.stats.hits++;
      return tokens;
    }

    // Cache miss - tokenize and store
    tokens = tokenize(memory.content);
    this.cache.set(memory, tokens);
    this.stats.misses++;
    return tokens;
  }

  /**
   * Get cache statistics (useful for debugging and optimization)
   */
  getStats(): { hits: number; misses: number; hitRate: number } {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? this.stats.hits / total : 0;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate,
    };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats = { hits: 0, misses: 0 };
  }
}

/**
 * Global token cache instance
 * Shared across all Engram operations for maximum cache efficiency
 */
export const tokenCache = new TokenCache();
