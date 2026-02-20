/**
 * In-memory store adapter (default)
 * No persistence — great for testing and ephemeral agents
 */

import type { Memory, MemoryFilter, StoreAdapter } from "../types.js";
import { tokenize } from "../tokenizer.js";
import { jaccardSimilarityTokens } from "../similarity.js";

export class MemoryStore implements StoreAdapter {
  readonly name = "MemoryStore";
  private memories: Map<string, Memory> = new Map();

  async get(id: string): Promise<Memory | null> {
    return this.memories.get(id) ?? null;
  }

  async put(memory: Memory): Promise<void> {
    this.memories.set(memory.id, memory);
  }

  async delete(id: string): Promise<void> {
    this.memories.delete(id);
  }

  async has(id: string): Promise<boolean> {
    return this.memories.has(id);
  }

  async list(filter?: MemoryFilter): Promise<Memory[]> {
    let results = Array.from(this.memories.values());

    if (!filter) {
      return results;
    }

    // Apply namespace filter
    if (filter.namespace) {
      const namespaces = Array.isArray(filter.namespace)
        ? filter.namespace
        : [filter.namespace];
      results = results.filter((m) => namespaces.includes(m.namespace));
    }

    // Apply category filter
    if (filter.categories) {
      results = results.filter((m) => filter.categories!.includes(m.category));
    }

    // Apply importance filter
    if (filter.minImportance !== undefined) {
      results = results.filter((m) => m.importance >= filter.minImportance!);
    }

    // Apply age filter
    if (filter.maxAge !== undefined) {
      const cutoff = Date.now() - filter.maxAge * 24 * 60 * 60 * 1000;
      results = results.filter((m) => m.createdAt >= cutoff);
    }

    // Apply since filter
    if (filter.since !== undefined) {
      results = results.filter((m) => m.createdAt >= filter.since!);
    }

    // Apply metadata filter
    if (filter.metadata) {
      results = results.filter((m) => {
        return Object.entries(filter.metadata!).every(
          ([key, value]) => m.metadata[key] === value,
        );
      });
    }

    // Apply sorting
    if (filter.sortBy) {
      const sortBy = filter.sortBy;
      const order = filter.sortOrder === "asc" ? 1 : -1;

      results.sort((a, b) => {
        let aVal: number, bVal: number;

        switch (sortBy) {
          case "importance":
            aVal = a.importance;
            bVal = b.importance;
            break;
          case "created":
            aVal = a.createdAt;
            bVal = b.createdAt;
            break;
          case "accessed":
            aVal = a.lastAccessed;
            bVal = b.lastAccessed;
            break;
          case "surprise":
            aVal = a.surprise;
            bVal = b.surprise;
            break;
          default:
            aVal = a.createdAt;
            bVal = b.createdAt;
        }

        return (aVal - bVal) * order;
      });
    }

    // Apply pagination
    if (filter.offset !== undefined) {
      results = results.slice(filter.offset);
    }

    if (filter.limit !== undefined) {
      results = results.slice(0, filter.limit);
    }

    return results;
  }

  async search(query: string, k: number): Promise<Memory[]> {
    const queryTokens = tokenize(query);
    const memories = Array.from(this.memories.values());

    // Score each memory by keyword similarity
    const scored = memories.map((memory) => {
      const memoryTokens = tokenize(memory.content);
      const score = jaccardSimilarityTokens(queryTokens, memoryTokens);
      return { memory, score };
    });

    // Sort by score and return top k
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, k).map((item) => item.memory);
  }

  async putMany(memories: Memory[]): Promise<void> {
    for (const memory of memories) {
      this.memories.set(memory.id, memory);
    }
  }

  async deleteMany(ids: string[]): Promise<void> {
    for (const id of ids) {
      this.memories.delete(id);
    }
  }

  async count(namespace?: string): Promise<number> {
    if (!namespace) {
      return this.memories.size;
    }

    let count = 0;
    for (const memory of this.memories.values()) {
      if (memory.namespace === namespace) {
        count++;
      }
    }
    return count;
  }

  async prune(before: number): Promise<number> {
    let pruned = 0;
    const toDelete: string[] = [];

    for (const [id, memory] of this.memories) {
      if (memory.expiresAt !== null && memory.expiresAt < before) {
        toDelete.push(id);
        pruned++;
      }
    }

    for (const id of toDelete) {
      this.memories.delete(id);
    }

    return pruned;
  }

  async clear(namespace?: string): Promise<void> {
    if (!namespace) {
      this.memories.clear();
      return;
    }

    const toDelete: string[] = [];
    for (const [id, memory] of this.memories) {
      if (memory.namespace === namespace) {
        toDelete.push(id);
      }
    }

    for (const id of toDelete) {
      this.memories.delete(id);
    }
  }

  async dump(): Promise<Memory[]> {
    return Array.from(this.memories.values());
  }
}
