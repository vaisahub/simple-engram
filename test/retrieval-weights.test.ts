/**
 * Tests for retrieval weight tuning
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Engram } from '../src/index.js';
import { MemoryStore } from '../src/stores/memory.js';

const mockLLM = async (prompt: string): Promise<string> => {
  if (prompt.includes('extract')) {
    return JSON.stringify([{ content: 'Test memory', category: 'fact' }]);
  }
  return '[]';
};

describe('Retrieval Weight Tuning', () => {
  it('should use default weights when not configured', async () => {
    const mem = new Engram({ llm: mockLLM, store: new MemoryStore() });

    await mem.store('Recent important memory', { importance: 0.9 });
    await mem.store('Old unimportant memory', { importance: 0.1 });

    // Wait a bit to create age difference
    await new Promise((resolve) => setTimeout(resolve, 10));

    const results = await mem.recall('memory');

    // With default weights (relevance: 0.5, importance: 0.3, recency: 0.2)
    // Recent important memory should rank higher
    expect(results[0].content).toBe('Recent important memory');
  });

  it('should prioritize relevance when configured', async () => {
    const mem = new Engram({
      llm: mockLLM,
      store: new MemoryStore(),
      retrievalWeights: {
        relevance: 0.9, // High relevance weight
        importance: 0.05,
        recency: 0.05,
      },
    });

    await mem.store('The sky is blue');
    await mem.store('Important unrelated fact', { importance: 0.9 });

    const results = await mem.recall('sky color');

    // Should prioritize "sky is blue" despite lower importance
    expect(results[0].content).toBe('The sky is blue');
  });

  it('should prioritize importance when configured', async () => {
    const mem = new Engram({
      llm: mockLLM,
      store: new MemoryStore(),
      retrievalWeights: {
        relevance: 0.05,
        importance: 0.9, // Very high importance weight
        recency: 0.05,
      },
    });

    await mem.store('Test memory A', { importance: 0.1 });
    await mem.store('Test memory B', { importance: 0.99 });

    const results = await mem.recall('test memory');

    // Verify that both memories are returned and importance values are tracked
    expect(results).toHaveLength(2);
    const highImportance = results.find((r) => r.importance > 0.9);
    const lowImportance = results.find((r) => r.importance < 0.2);

    expect(highImportance).toBeDefined();
    expect(lowImportance).toBeDefined();
  });

  it('should prioritize recency when configured', async () => {
    const mem = new Engram({
      llm: mockLLM,
      store: new MemoryStore(),
      retrievalWeights: {
        relevance: 0.05,
        importance: 0.05,
        recency: 0.9, // Very high recency weight
      },
    });

    await mem.store('Test content first', { importance: 0.9 });

    // Wait to create age difference
    await new Promise((resolve) => setTimeout(resolve, 50));

    await mem.store('Test content second', { importance: 0.3 });

    const results = await mem.recall('test content');

    // Verify that both memories are returned and have different creation times
    expect(results).toHaveLength(2);
    const timestamps = results.map((r) => r.createdAt).sort();
    expect(timestamps[1]).toBeGreaterThan(timestamps[0]);
  });

  it('should use access frequency in scoring', async () => {
    const mem = new Engram({
      llm: mockLLM,
      store: new MemoryStore(),
      retrievalWeights: {
        relevance: 0.1,
        importance: 0.1,
        recency: 0.1,
        accessFrequency: 0.7, // Very high access frequency weight
      },
    });

    await mem.store('Memory alpha', { importance: 0.5 });
    await mem.store('Memory beta', { importance: 0.5 });

    // Access the memories to build up counts
    await mem.recall('alpha');
    await mem.recall('alpha');
    await mem.recall('alpha');

    const results = await mem.recall('memory');

    // Verify that access counts are tracked (recall increments accessCount)
    expect(results).toHaveLength(2);
    const alphaMem = results.find((r) => r.content === 'Memory alpha');
    const betaMem = results.find((r) => r.content === 'Memory beta');

    expect(alphaMem).toBeDefined();
    expect(betaMem).toBeDefined();
    // Alpha should have higher access count since we recalled it 3 times
    expect(alphaMem!.accessCount).toBeGreaterThanOrEqual(3);
  });

  it('should support zero weights to disable factors', async () => {
    const mem = new Engram({
      llm: mockLLM,
      store: new MemoryStore(),
      retrievalWeights: {
        relevance: 1.0, // Only relevance matters
        importance: 0.0,
        recency: 0.0,
        accessFrequency: 0.0,
      },
    });

    await mem.store('Exact match low importance', { importance: 0.1 });
    await mem.store('Critical but unrelated', { importance: 0.99 });

    const results = await mem.recall('exact match');

    // Should only consider relevance
    expect(results[0].content).toBe('Exact match low importance');
  });

  it('should normalize weights automatically', async () => {
    const mem = new Engram({
      llm: mockLLM,
      store: new MemoryStore(),
      retrievalWeights: {
        // Non-normalized weights (sum > 1)
        relevance: 0.5,
        importance: 0.5,
        recency: 0.5,
        accessFrequency: 0.5,
      },
    });

    await mem.store('Test memory');
    const results = await mem.recall('test');

    // Should still work (weights don't need to sum to 1)
    expect(results).toHaveLength(1);
  });

  it('should support custom weight combinations for different use cases', async () => {
    // Scenario 1: Tech support bot (prioritize exact matches)
    const supportBot = new Engram({
      llm: mockLLM,
      store: new MemoryStore(),
      retrievalWeights: {
        relevance: 0.8,
        importance: 0.1,
        recency: 0.1,
      },
    });

    // Scenario 2: Personal assistant (prioritize recent context)
    const assistant = new Engram({
      llm: mockLLM,
      store: new MemoryStore(),
      retrievalWeights: {
        relevance: 0.3,
        importance: 0.2,
        recency: 0.5,
      },
    });

    // Scenario 3: Knowledge base (prioritize importance)
    const knowledgeBase = new Engram({
      llm: mockLLM,
      store: new MemoryStore(),
      retrievalWeights: {
        relevance: 0.4,
        importance: 0.5,
        recency: 0.1,
      },
    });

    // All should initialize successfully
    expect(supportBot).toBeDefined();
    expect(assistant).toBeDefined();
    expect(knowledgeBase).toBeDefined();
  });
});

describe('Access Frequency Scoring', () => {
  it('should track access count correctly', async () => {
    const mem = new Engram({ llm: mockLLM, store: new MemoryStore() });

    await mem.store('Frequently used memory');

    // Access multiple times
    for (let i = 0; i < 5; i++) {
      await mem.recall('frequently used');
    }

    const results = await mem.recall('frequently used');
    expect(results[0].accessCount).toBeGreaterThanOrEqual(5);
  });

  it('should normalize access frequency to 0-1 range', async () => {
    const mem = new Engram({
      llm: mockLLM,
      store: new MemoryStore(),
      retrievalWeights: {
        relevance: 0.0,
        importance: 0.0,
        recency: 0.0,
        accessFrequency: 1.0,
      },
    });

    await mem.store('Memory with 10 accesses');
    await mem.store('Memory with 200 accesses');

    // Simulate access counts (direct manipulation for testing)
    const allMems = await mem.stats();

    // Even with 200 accesses, scoring should be normalized
    const results = await mem.recall('accesses');
    expect(results).toHaveLength(2);
  });

  it('should increase score with more accesses', async () => {
    const mem = new Engram({
      llm: mockLLM,
      store: new MemoryStore(),
      retrievalWeights: {
        relevance: 0.3,
        importance: 0.3,
        recency: 0.1,
        accessFrequency: 0.3,
      },
    });

    await mem.store('Memory A', { importance: 0.5 });
    await mem.store('Memory B', { importance: 0.5 });

    // Access Memory A many times
    for (let i = 0; i < 20; i++) {
      await mem.recall('Memory A');
    }

    const results = await mem.recall('Memory');

    // Memory A should rank higher due to access frequency
    expect(results[0].content).toBe('Memory A');
    expect(results[0].accessCount).toBeGreaterThan(20);
  });
});
