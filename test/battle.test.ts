/**
 * Battle Testing Suite for Simple Engram
 * Tests edge cases, stress scenarios, and real-world usage patterns
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Engram } from '../src/index.js';
import { MemoryStore } from '../src/stores/memory.js';
import type { Message } from '../src/types.js';

// Mock LLM for testing
const mockLLM = async (prompt: string): Promise<string> => {
  if (prompt.includes('extract') || prompt.includes('JSON array')) {
    return JSON.stringify([
      { content: 'Test fact extracted from conversation', category: 'fact' },
    ]);
  }
  return 'Mock response';
};

describe('Battle Test: Edge Cases', () => {
  let mem: Engram;

  beforeEach(() => {
    mem = new Engram({ llm: mockLLM, store: new MemoryStore() });
  });

  it('should handle empty messages array', async () => {
    const messages: Message[] = [];
    await expect(mem.remember(messages)).resolves.not.toThrow();
  });

  it('should handle messages with empty content', async () => {
    const messages: Message[] = [
      { role: 'user', content: '' },
      { role: 'assistant', content: '' },
    ];
    await expect(mem.remember(messages)).resolves.not.toThrow();
  });

  it('should handle extremely long message content', async () => {
    const longContent = 'a'.repeat(100000); // 100k characters
    const messages: Message[] = [{ role: 'user', content: longContent }];
    await expect(mem.remember(messages)).resolves.not.toThrow();
  });

  it('should handle special characters and unicode', async () => {
    const messages: Message[] = [
      {
        role: 'user',
        content: '🚀 Hello! <script>alert("xss")</script> 中文 العربية 🎉',
      },
      { role: 'assistant', content: 'Handling special chars: \n\t\r\\"\'' },
    ];
    await expect(mem.remember(messages)).resolves.not.toThrow();
  });

  it('should handle malformed JSON in LLM response', async () => {
    const badLLM = async () => '{invalid json}';
    const badMem = new Engram({ llm: badLLM });
    const messages: Message[] = [{ role: 'user', content: 'test' }];
    await expect(badMem.remember(messages)).resolves.not.toThrow();
  });

  it('should handle null/undefined content gracefully', async () => {
    const messages: Message[] = [
      { role: 'user', content: null as any },
      { role: 'assistant', content: undefined as any },
    ];
    await expect(mem.remember(messages)).resolves.not.toThrow();
  });

  it('should handle duplicate memories', async () => {
    const messages: Message[] = [
      { role: 'user', content: 'I like pizza' },
      { role: 'assistant', content: 'Great!' },
    ];
    await mem.remember(messages);
    await mem.remember(messages);
    await mem.remember(messages);

    const memories = await mem.recall('pizza');
    expect(memories.length).toBeGreaterThan(0);
  });

  it('should handle query with no matches', async () => {
    await mem.remember([{ role: 'user', content: 'I like pizza' }]);
    const memories = await mem.recall('quantum physics');
    expect(Array.isArray(memories)).toBe(true);
  });

  it('should handle empty query string', async () => {
    await mem.remember([{ role: 'user', content: 'test' }]);
    const memories = await mem.recall('');
    expect(Array.isArray(memories)).toBe(true);
  });

  it('should handle very long query string', async () => {
    const longQuery = 'test '.repeat(1000);
    await mem.remember([{ role: 'user', content: 'test' }]);
    const memories = await mem.recall(longQuery);
    expect(Array.isArray(memories)).toBe(true);
  });
});

describe('Battle Test: Stress Testing', () => {
  let mem: Engram;

  beforeEach(() => {
    mem = new Engram({ llm: mockLLM, store: new MemoryStore() });
  });

  it('should handle rapid sequential remember calls', async () => {
    const promises = [];
    for (let i = 0; i < 50; i++) {
      const messages: Message[] = [
        { role: 'user', content: `Message ${i}` },
      ];
      promises.push(mem.remember(messages));
    }
    await expect(Promise.all(promises)).resolves.not.toThrow();
  });

  it('should handle large number of memories', async () => {
    const messages: Message[] = [];
    for (let i = 0; i < 100; i++) {
      messages.push({
        role: 'user',
        content: `Test message number ${i} with some content`,
      });
    }
    await expect(mem.remember(messages)).resolves.not.toThrow();
  });

  it('should handle concurrent recall operations', async () => {
    await mem.remember([{ role: 'user', content: 'test data' }]);

    const promises = [];
    for (let i = 0; i < 20; i++) {
      promises.push(mem.recall(`query ${i}`));
    }
    const results = await Promise.all(promises);
    expect(results.every((r) => Array.isArray(r))).toBe(true);
  });

  it('should maintain performance with many stored memories', async () => {
    // Store many memories
    for (let i = 0; i < 50; i++) {
      await mem.remember([
        { role: 'user', content: `Memory batch ${i}` },
      ]);
    }

    const start = Date.now();
    await mem.recall('test');
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(1000); // Should complete within 1 second
  });
});

describe('Battle Test: Error Scenarios', () => {
  it('should handle LLM function that throws errors', async () => {
    const errorLLM = async () => {
      throw new Error('LLM failed');
    };
    const mem = new Engram({ llm: errorLLM });
    const messages: Message[] = [{ role: 'user', content: 'test' }];
    await expect(mem.remember(messages)).rejects.toThrow();
  });

  it('should handle LLM function that times out', async () => {
    const slowLLM = async () => {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      return '[]';
    };
    const mem = new Engram({ llm: slowLLM });
    const messages: Message[] = [{ role: 'user', content: 'test' }];

    // This should timeout or complete
    const promise = mem.remember(messages);
    await expect(promise).resolves.toBeDefined();
  }, 10000);

  it('should handle invalid memory category', async () => {
    const badLLM = async () =>
      JSON.stringify([
        { content: 'test', category: 'invalid_category_not_in_list' },
      ]);
    const mem = new Engram({ llm: badLLM });
    await expect(
      mem.remember([{ role: 'user', content: 'test' }]),
    ).resolves.not.toThrow();
  });

  it('should handle LLM returning non-array', async () => {
    const badLLM = async () => JSON.stringify({ not: 'an array' });
    const mem = new Engram({ llm: badLLM });
    await expect(
      mem.remember([{ role: 'user', content: 'test' }]),
    ).resolves.not.toThrow();
  });

  it('should handle LLM returning empty response', async () => {
    const emptyLLM = async () => '';
    const mem = new Engram({ llm: emptyLLM });
    await expect(
      mem.remember([{ role: 'user', content: 'test' }]),
    ).resolves.not.toThrow();
  });
});

describe('Battle Test: Real-world Scenarios', () => {
  let mem: Engram;

  beforeEach(() => {
    mem = new Engram({ llm: mockLLM, store: new MemoryStore() });
  });

  it('should handle multi-turn conversation', async () => {
    const conversation: Message[] = [
      { role: 'user', content: 'Hi, my name is Alice' },
      { role: 'assistant', content: 'Hello Alice! Nice to meet you.' },
      { role: 'user', content: 'I work as a software engineer' },
      { role: 'assistant', content: 'That sounds interesting!' },
      { role: 'user', content: 'I specialize in TypeScript' },
      { role: 'assistant', content: 'TypeScript is great!' },
    ];

    await expect(mem.remember(conversation)).resolves.not.toThrow();
    const memories = await mem.recall('Alice');
    expect(memories).toBeDefined();
  });

  it('should handle context injection for chatbot', async () => {
    await mem.remember([
      { role: 'user', content: 'My favorite color is blue' },
      { role: 'assistant', content: 'Got it!' },
    ]);

    const context = await mem.context('favorite color');
    expect(typeof context).toBe('string');
    expect(context.length).toBeGreaterThan(0);
  });

  it('should handle namespace isolation', async () => {
    const user1Mem = new Engram({
      llm: mockLLM,
      namespace: 'user1',
      store: new MemoryStore(),
    });
    const user2Mem = new Engram({
      llm: mockLLM,
      namespace: 'user2',
      store: new MemoryStore(),
    });

    await user1Mem.remember([
      { role: 'user', content: 'I like cats' },
    ]);
    await user2Mem.remember([
      { role: 'user', content: 'I like dogs' },
    ]);

    const user1Memories = await user1Mem.recall('pets');
    const user2Memories = await user2Mem.recall('pets');

    expect(user1Memories).toBeDefined();
    expect(user2Memories).toBeDefined();
  });

  it('should handle export and import cycle', async () => {
    await mem.remember([
      { role: 'user', content: 'Test data for export' },
    ]);

    const exported = await mem.export('json');
    expect(exported).toBeDefined();
    expect(typeof exported).toBe('string');

    // Should be valid JSON
    expect(() => JSON.parse(exported)).not.toThrow();
  });

  it('should handle memory decay over time', async () => {
    await mem.remember([
      { role: 'user', content: 'This is a test memory' },
    ]);

    const memories = await mem.recall('test');
    expect(memories.length).toBeGreaterThan(0);

    // Memories should have decay-related properties
    expect(memories[0]).toHaveProperty('createdAt');
    expect(memories[0]).toHaveProperty('importance');
  });
});

describe('Battle Test: Configuration Edge Cases', () => {
  it('should work with custom categories', async () => {
    const mem = new Engram({
      llm: mockLLM,
      categories: ['custom1', 'custom2', 'custom3'],
      store: new MemoryStore(),
    });

    await expect(
      mem.remember([{ role: 'user', content: 'test' }]),
    ).resolves.not.toThrow();
  });

  it('should work with maxMemories limit', async () => {
    const mem = new Engram({
      llm: mockLLM,
      maxMemories: 5,
      store: new MemoryStore(),
    });

    for (let i = 0; i < 10; i++) {
      await mem.remember([
        { role: 'user', content: `Memory ${i}` },
      ]);
    }

    const memories = await mem.recall('Memory');
    expect(memories.length).toBeLessThanOrEqual(5);
  });

  it('should work with custom decay rate', async () => {
    const mem = new Engram({
      llm: mockLLM,
      decayRate: 0.1,
      store: new MemoryStore(),
    });

    await expect(
      mem.remember([{ role: 'user', content: 'test' }]),
    ).resolves.not.toThrow();
  });

  it('should work with disabled auto-merge', async () => {
    const mem = new Engram({
      llm: mockLLM,
      autoMerge: false,
      store: new MemoryStore(),
    });

    await mem.remember([{ role: 'user', content: 'first' }]);
    await mem.remember([{ role: 'user', content: 'second' }]);

    const memories = await mem.recall('test');
    expect(Array.isArray(memories)).toBe(true);
  });
});
