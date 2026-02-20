import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStore } from '../../src/stores/memory.js';
import type { Memory } from '../../src/types.js';

describe('MemoryStore', () => {
  let store: MemoryStore;

  const createMemory = (id: string, content: string): Memory => ({
    id,
    content,
    category: 'fact',
    source: 'test',
    surprise: 0.5,
    importance: 0.5,
    accessCount: 0,
    lastAccessed: Date.now(),
    createdAt: Date.now(),
    embedding: null,
    metadata: {},
    namespace: 'default',
    ttl: null,
    expiresAt: null,
    version: 1,
    history: [],
  });

  beforeEach(() => {
    store = new MemoryStore();
  });

  describe('Basic CRUD', () => {
    it('should store and retrieve memory', async () => {
      const memory = createMemory('1', 'test content');
      await store.put(memory);

      const retrieved = await store.get('1');
      expect(retrieved).toEqual(memory);
    });

    it('should return null for non-existent memory', async () => {
      const retrieved = await store.get('non-existent');
      expect(retrieved).toBeNull();
    });

    it('should update existing memory', async () => {
      const memory = createMemory('1', 'original');
      await store.put(memory);

      const updated = { ...memory, content: 'updated' };
      await store.put(updated);

      const retrieved = await store.get('1');
      expect(retrieved?.content).toBe('updated');
    });

    it('should delete memory', async () => {
      const memory = createMemory('1', 'test');
      await store.put(memory);

      await store.delete('1');
      const retrieved = await store.get('1');
      expect(retrieved).toBeNull();
    });

    it('should check if memory exists', async () => {
      const memory = createMemory('1', 'test');
      await store.put(memory);

      expect(await store.has('1')).toBe(true);
      expect(await store.has('non-existent')).toBe(false);
    });
  });

  describe('Bulk operations', () => {
    it('should store multiple memories', async () => {
      const memories = [
        createMemory('1', 'first'),
        createMemory('2', 'second'),
        createMemory('3', 'third'),
      ];

      await store.putMany(memories);

      expect(await store.count()).toBe(3);
      expect(await store.get('2')).toEqual(memories[1]);
    });

    it('should delete multiple memories', async () => {
      const memories = [
        createMemory('1', 'first'),
        createMemory('2', 'second'),
        createMemory('3', 'third'),
      ];

      await store.putMany(memories);
      await store.deleteMany(['1', '3']);

      expect(await store.count()).toBe(1);
      expect(await store.has('2')).toBe(true);
      expect(await store.has('1')).toBe(false);
    });
  });

  describe('List and filter', () => {
    beforeEach(async () => {
      const memories = [
        { ...createMemory('1', 'fact 1'), category: 'fact', importance: 0.8 },
        { ...createMemory('2', 'pref 1'), category: 'preference', importance: 0.6 },
        { ...createMemory('3', 'fact 2'), category: 'fact', importance: 0.7 },
        { ...createMemory('4', 'skill 1'), category: 'skill', importance: 0.9 },
      ];
      await store.putMany(memories);
    });

    it('should list all memories without filter', async () => {
      const all = await store.list();
      expect(all).toHaveLength(4);
    });

    it('should filter by category', async () => {
      const facts = await store.list({ categories: ['fact'] });
      expect(facts).toHaveLength(2);
      expect(facts.every((m) => m.category === 'fact')).toBe(true);
    });

    it('should filter by minimum importance', async () => {
      const important = await store.list({ minImportance: 0.75 });
      expect(important).toHaveLength(2); // 0.8 and 0.9
    });

    it('should sort by importance descending', async () => {
      const sorted = await store.list({
        sortBy: 'importance',
        sortOrder: 'desc',
      });

      expect(sorted[0].importance).toBe(0.9);
      expect(sorted[3].importance).toBe(0.6);
    });

    it('should apply pagination', async () => {
      const page1 = await store.list({ limit: 2, offset: 0 });
      const page2 = await store.list({ limit: 2, offset: 2 });

      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(2);
      expect(page1[0].id).not.toBe(page2[0].id);
    });
  });

  describe('Search', () => {
    beforeEach(async () => {
      const memories = [
        createMemory('1', 'TypeScript programming language'),
        createMemory('2', 'JavaScript web development'),
        createMemory('3', 'Python data science'),
        createMemory('4', 'TypeScript is great for large projects'),
      ];
      await store.putMany(memories);
    });

    it('should search by keywords', async () => {
      const results = await store.search('TypeScript', 10);
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((m) => m.content.includes('TypeScript'))).toBe(true);
    });

    it('should limit results', async () => {
      const results = await store.search('programming', 1);
      expect(results).toHaveLength(1);
    });

    it('should rank by relevance', async () => {
      const results = await store.search('TypeScript programming', 10);
      // First result should be most relevant
      expect(results[0].content).toContain('TypeScript');
      expect(results[0].content).toContain('programming');
    });
  });

  describe('Count and stats', () => {
    it('should count total memories', async () => {
      await store.putMany([
        createMemory('1', 'test1'),
        createMemory('2', 'test2'),
      ]);

      expect(await store.count()).toBe(2);
    });

    it('should count by namespace', async () => {
      await store.putMany([
        { ...createMemory('1', 'test1'), namespace: 'ns1' },
        { ...createMemory('2', 'test2'), namespace: 'ns1' },
        { ...createMemory('3', 'test3'), namespace: 'ns2' },
      ]);

      expect(await store.count('ns1')).toBe(2);
      expect(await store.count('ns2')).toBe(1);
    });
  });

  describe('Prune', () => {
    it('should prune expired memories', async () => {
      const now = Date.now();
      await store.putMany([
        { ...createMemory('1', 'test1'), expiresAt: now - 1000 }, // Expired
        { ...createMemory('2', 'test2'), expiresAt: now + 1000 }, // Not expired
        { ...createMemory('3', 'test3'), expiresAt: null }, // Never expires
      ]);

      const pruned = await store.prune(now);
      expect(pruned).toBe(1);
      expect(await store.count()).toBe(2);
    });
  });

  describe('Clear', () => {
    it('should clear all memories', async () => {
      await store.putMany([
        createMemory('1', 'test1'),
        createMemory('2', 'test2'),
      ]);

      await store.clear();
      expect(await store.count()).toBe(0);
    });

    it('should clear by namespace', async () => {
      await store.putMany([
        { ...createMemory('1', 'test1'), namespace: 'ns1' },
        { ...createMemory('2', 'test2'), namespace: 'ns2' },
      ]);

      await store.clear('ns1');
      expect(await store.count()).toBe(1);
      expect(await store.count('ns2')).toBe(1);
    });
  });

  describe('Dump', () => {
    it('should dump all memories', async () => {
      const memories = [
        createMemory('1', 'test1'),
        createMemory('2', 'test2'),
      ];
      await store.putMany(memories);

      const dump = await store.dump();
      expect(dump).toHaveLength(2);
      expect(dump).toEqual(expect.arrayContaining(memories));
    });
  });
});
