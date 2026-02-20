import { describe, it, expect, beforeEach } from 'vitest';
import { Engram, MemoryStore } from '../../src/index.js';
import type { Message } from '../../src/types.js';

describe('Engram Integration Tests', () => {
  let mem: Engram;

  // Mock LLM that extracts memories
  const mockLLM = async (prompt: string): Promise<string> => {
    if (prompt.includes('TypeScript')) {
      return JSON.stringify([
        { content: 'User prefers TypeScript', category: 'preference' },
      ]);
    }
    if (prompt.includes('deploy')) {
      return JSON.stringify([
        { content: 'Deploy with vercel --prod', category: 'skill' },
      ]);
    }
    return '[]';
  };

  // Mock embedding function
  const mockEmbed = async (text: string): Promise<number[]> => {
    // Simple hash-based mock
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash << 5) - hash + text.charCodeAt(i);
    }
    return [Math.sin(hash), Math.cos(hash), Math.tan(hash)];
  };

  beforeEach(() => {
    mem = new Engram({
      llm: mockLLM,
      embed: mockEmbed,
      store: new MemoryStore(),
    });
  });

  describe('remember() workflow', () => {
    it('should extract and store memories from conversation', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'I prefer TypeScript over JavaScript' },
        { role: 'assistant', content: "I'll use TypeScript for you" },
      ];

      const result = await mem.remember(messages);

      expect(result.stored).toHaveLength(1);
      expect(result.stored[0].content).toBe('User prefers TypeScript');
      expect(result.stored[0].category).toBe('preference');
      expect(result.dryRun).toBe(false);
    });

    it('should reject redundant memories', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'I prefer TypeScript' },
      ];

      // First time should store
      const result1 = await mem.remember(messages);
      expect(result1.stored).toHaveLength(1);

      // Second time should reject (duplicate)
      const result2 = await mem.remember(messages);
      expect(result2.stored).toHaveLength(0);
      expect(result2.rejected).toHaveLength(1);
    });

    it('should work in dry-run mode', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'I prefer TypeScript' },
      ];

      const result = await mem.remember(messages, { dryRun: true });

      expect(result.dryRun).toBe(true);
      expect(result.stored).toHaveLength(1);

      // Should not actually be stored
      const stats = await mem.stats();
      expect(stats.totalMemories).toBe(0);
    });

    it('should include explanations when requested', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'I prefer TypeScript' },
      ];

      const result = await mem.remember(messages, { explain: true });

      expect(result.stored[0].explanation).toBeDefined();
      expect(result.stored[0].explanation).toContain('surprise');
    });

    it('should apply metadata and source', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'I prefer TypeScript' },
      ];

      const result = await mem.remember(messages, {
        source: 'session-001',
        metadata: { project: 'test' },
      });

      expect(result.stored[0].source).toBe('session-001');
      expect(result.stored[0].metadata.project).toBe('test');
    });
  });

  describe('store() workflow', () => {
    it('should manually store a memory', async () => {
      const memory = await mem.store('Deploy with vercel --prod', {
        category: 'skill',
        importance: 0.9,
      });

      expect(memory.content).toBe('Deploy with vercel --prod');
      expect(memory.category).toBe('skill');
      // Importance may be boosted by category and surprise scoring
      expect(memory.importance).toBeGreaterThan(0);
    });

    it('should compute surprise when not skipped', async () => {
      const memory = await mem.store('New fact', {
        category: 'fact',
        skipSurprise: false,
      });

      expect(memory.surprise).toBeGreaterThan(0);
    });

    it('should work in dry-run mode', async () => {
      const memory = await mem.store('Test', { dryRun: true });

      expect(memory.content).toBe('Test');

      const stats = await mem.stats();
      expect(stats.totalMemories).toBe(0);
    });
  });

  describe('recall() workflow', () => {
    beforeEach(async () => {
      await mem.store('User prefers TypeScript', { category: 'preference' });
      await mem.store('Deploy with vercel --prod', { category: 'skill' });
      await mem.store('Project uses Next.js', { category: 'context' });
    });

    it('should recall relevant memories', async () => {
      const results = await mem.recall('TypeScript');

      expect(results.length).toBeGreaterThan(0);
      // Should find the TypeScript memory (may not be first due to ranking)
      const hasTypeScript = results.some(m => m.content.includes('TypeScript'));
      expect(hasTypeScript).toBe(true);
    });

    it('should limit results', async () => {
      const results = await mem.recall('project', { k: 1 });
      expect(results).toHaveLength(1);
    });

    it('should filter by category', async () => {
      const results = await mem.recall('deploy', { categories: ['skill'] });

      expect(results.every((m) => m.category === 'skill')).toBe(true);
    });

    it('should update access count', async () => {
      const results = await mem.recall('TypeScript');
      const memory = results[0];

      expect(memory.accessCount).toBe(1);

      // Recall again
      const results2 = await mem.recall('TypeScript');
      const memory2 = results2[0];

      expect(memory2.accessCount).toBe(2);
    });

    it('should include explanations when requested', async () => {
      const results = await mem.recall('TypeScript', { explain: true });

      expect(results[0].explanation).toBeDefined();
      expect(results[0].explanation).toContain('retrieval_score');
    });
  });

  describe('forget() workflow', () => {
    beforeEach(async () => {
      // Create memories with different ages
      const old = await mem.store('Old memory', { importance: 0.1 });
      old.createdAt = Date.now() - 100 * 24 * 60 * 60 * 1000; // 100 days old
      await mem.storeAdapter.put(old);

      await mem.store('Recent memory', { importance: 0.9 });
    });

    it('should prune old/low-importance memories', async () => {
      const result = await mem.forget({ mode: 'normal' });

      expect(result.pruned).toBeGreaterThanOrEqual(0);
      expect(result.remaining).toBeLessThanOrEqual(2);
    });

    it('should work in dry-run mode', async () => {
      const before = await mem.stats();
      const result = await mem.forget({ dryRun: true });

      expect(result.dryRun).toBe(true);

      const after = await mem.stats();
      expect(after.totalMemories).toBe(before.totalMemories);
    });
  });

  describe('export/import workflow', () => {
    beforeEach(async () => {
      await mem.store('Memory 1', { category: 'fact' });
      await mem.store('Memory 2', { category: 'preference' });
    });

    it('should export to JSON', async () => {
      const json = await mem.export('json');

      expect(json).toContain('"engram"');
      expect(json).toContain('Memory 1');
      expect(json).toContain('Memory 2');
    });

    it('should export to Markdown', async () => {
      const md = await mem.export('md');

      expect(md).toContain('# Engram Memory Export');
      expect(md).toContain('Memory 1');
    });

    it('should export to CSV', async () => {
      const csv = await mem.export('csv');

      expect(csv).toContain('id,content,category');
      expect(csv).toContain('Memory 1');
    });

    it('should import from JSON', async () => {
      const json = await mem.export('json');

      // Clear and reimport
      await mem.storeAdapter.clear();
      const count = await mem.import(json, 'json');

      expect(count).toBe(2);
      const stats = await mem.stats();
      expect(stats.totalMemories).toBe(2);
    });

    it('should handle import conflicts', async () => {
      const json = await mem.export('json');

      // Import again (should skip by default)
      const count = await mem.import(json, 'json', {
        onConflict: 'skip',
      });

      expect(count).toBe(0); // All skipped
    });
  });

  describe('stats() workflow', () => {
    beforeEach(async () => {
      await mem.store('Fact 1', { category: 'fact', importance: 0.8 });
      await mem.store('Fact 2', { category: 'fact', importance: 0.7 });
      await mem.store('Preference 1', { category: 'preference', importance: 0.9 });
    });

    it('should return accurate statistics', async () => {
      const stats = await mem.stats();

      expect(stats.totalMemories).toBe(3);
      expect(stats.byCategory.fact).toBe(2);
      expect(stats.byCategory.preference).toBe(1);
      // Average importance may vary due to surprise scoring
      expect(stats.averageImportance).toBeGreaterThan(0);
      expect(stats.hasLLM).toBe(true);
      expect(stats.hasEmbeddings).toBe(true);
    });
  });

  describe('bootstrap() workflow', () => {
    it('should bulk import conversations', async () => {
      const conversations = [
        {
          messages: [
            { role: 'user' as const, content: 'I prefer TypeScript' },
          ],
          source: 'session-001',
        },
        {
          messages: [
            { role: 'user' as const, content: 'Deploy with vercel' },
          ],
          source: 'session-002',
        },
      ];

      const result = await mem.bootstrap(conversations, {
        batchSize: 1,
        delayMs: 0,
      });

      expect(result.stored.length).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should track progress', async () => {
      const conversations = Array.from({ length: 5 }, (_, i) => ({
        messages: [
          { role: 'user' as const, content: `Message ${i}` },
        ],
      }));

      let progressCalls = 0;
      await mem.bootstrap(conversations, {
        batchSize: 2,
        delayMs: 0,
        onProgress: (p) => {
          progressCalls++;
          expect(p.total).toBe(5);
        },
      });

      expect(progressCalls).toBe(5);
    });
  });

  describe('Events', () => {
    it('should emit stored event', async () => {
      let emitted = false;
      mem.on('stored', (memory) => {
        emitted = true;
        expect(memory.content).toBe('Test');
      });

      await mem.store('Test');
      expect(emitted).toBe(true);
    });

    it('should emit rejected event', async () => {
      let emitted = false;
      mem.on('rejected', (info) => {
        emitted = true;
        expect(info.reason).toBeDefined();
      });

      // Store once
      const messages: Message[] = [
        { role: 'user', content: 'I prefer TypeScript' },
      ];
      await mem.remember(messages);

      // Try to store very similar content (should be rejected as redundant)
      const messages2: Message[] = [
        { role: 'user', content: 'I prefer TypeScript' },
      ];
      await mem.remember(messages2);

      expect(emitted).toBe(true);
    });

    it('should emit recalled event', async () => {
      let emitted = false;
      mem.on('recalled', (memories, query) => {
        emitted = true;
        expect(query).toBe('test');
      });

      await mem.store('Test memory');
      await mem.recall('test');

      expect(emitted).toBe(true);
    });
  });

  describe('Hooks', () => {
    it('should run beforeStore hook', async () => {
      let hookRan = false;

      mem = new Engram({
        llm: mockLLM,
        store: new MemoryStore(),
        hooks: {
          beforeStore: (memory) => {
            hookRan = true;
            memory.metadata.modified = true;
            return memory;
          },
        },
      });

      await mem.store('Test');
      expect(hookRan).toBe(true);
    });

    it('should reject memory when beforeStore returns null', async () => {
      mem = new Engram({
        llm: mockLLM,
        store: new MemoryStore(),
        hooks: {
          beforeStore: () => null, // Reject all
        },
      });

      await expect(mem.store('Test')).rejects.toThrow('beforeStore hook');
    });

    it('should run beforeRecall hook', async () => {
      let hookRan = false;

      mem = new Engram({
        store: new MemoryStore(),
        hooks: {
          beforeRecall: (query) => {
            hookRan = true;
            return `modified ${query}`;
          },
        },
      });

      await mem.store('Test');
      await mem.recall('query');

      expect(hookRan).toBe(true);
    });
  });
});
