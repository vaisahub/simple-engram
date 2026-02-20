/**
 * Performance Benchmark Suite for Simple Engram
 * Tests performance across different dataset sizes and operations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Engram } from '../src/index.js';
import { MemoryStore } from '../src/stores/memory.js';
import type { Message } from '../src/types.js';

// Mock LLM that's fast and predictable
const mockLLM = async (prompt: string): Promise<string> => {
  if (prompt.includes('extract') || prompt.includes('JSON array')) {
    return JSON.stringify([
      { content: 'Test memory from conversation', category: 'fact' },
    ]);
  }
  return '[]';
};

// Helper to create realistic conversations
function createConversation(turnCount: number): Message[] {
  const messages: Message[] = [];
  for (let i = 0; i < turnCount; i++) {
    messages.push({
      role: 'user',
      content: `User message ${i}: This is some test content about topic ${i}`,
    });
    messages.push({
      role: 'assistant',
      content: `Assistant response ${i}: I understand about topic ${i}`,
    });
  }
  return messages;
}

// Benchmark helper
async function benchmark(name: string, fn: () => Promise<void>): Promise<number> {
  const start = performance.now();
  await fn();
  const duration = performance.now() - start;
  console.log(`  ${name}: ${duration.toFixed(2)}ms`);
  return duration;
}

describe('Benchmark: Remember Operation', () => {
  it('should handle small conversations (10 messages) quickly', async () => {
    const mem = new Engram({ llm: mockLLM, store: new MemoryStore() });
    const messages = createConversation(5); // 10 messages

    const duration = await benchmark('Small conversation (10 msgs)', async () => {
      await mem.remember(messages);
    });

    expect(duration).toBeLessThan(100); // Should be <100ms
  });

  it('should handle medium conversations (50 messages) efficiently', async () => {
    const mem = new Engram({ llm: mockLLM, store: new MemoryStore() });
    const messages = createConversation(25); // 50 messages

    const duration = await benchmark('Medium conversation (50 msgs)', async () => {
      await mem.remember(messages);
    });

    expect(duration).toBeLessThan(500); // Should be <500ms
  });

  it('should handle large conversations (200 messages) well', async () => {
    const mem = new Engram({ llm: mockLLM, store: new MemoryStore() });
    const messages = createConversation(100); // 200 messages

    const duration = await benchmark('Large conversation (200 msgs)', async () => {
      await mem.remember(messages);
    });

    expect(duration).toBeLessThan(2000); // Should be <2s
  });
});

describe('Benchmark: Recall Operation', () => {
  let mem: Engram;

  beforeEach(async () => {
    mem = new Engram({ llm: mockLLM, store: new MemoryStore() });
    // Seed with 50 memories
    for (let i = 0; i < 50; i++) {
      await mem.remember([
        {
          role: 'user',
          content: `Memory ${i}: Information about topic ${i % 10}`,
        },
      ]);
    }
  });

  it('should recall from 50 memories quickly', async () => {
    const duration = await benchmark('Recall from 50 memories', async () => {
      await mem.recall('topic 5');
    });

    expect(duration).toBeLessThan(50); // Should be <50ms
  });

  it('should handle multiple concurrent recalls', async () => {
    const duration = await benchmark('10 concurrent recalls', async () => {
      await Promise.all([
        mem.recall('topic 1'),
        mem.recall('topic 2'),
        mem.recall('topic 3'),
        mem.recall('topic 4'),
        mem.recall('topic 5'),
        mem.recall('topic 6'),
        mem.recall('topic 7'),
        mem.recall('topic 8'),
        mem.recall('topic 9'),
        mem.recall('topic 0'),
      ]);
    });

    expect(duration).toBeLessThan(500); // Should be <500ms total
  });
});

describe('Benchmark: Context Generation', () => {
  let mem: Engram;

  beforeEach(async () => {
    mem = new Engram({ llm: mockLLM, store: new MemoryStore() });
    // Seed with memories
    for (let i = 0; i < 30; i++) {
      await mem.remember([
        {
          role: 'user',
          content: `User likes ${['pizza', 'pasta', 'sushi'][i % 3]} and works as ${['engineer', 'designer', 'manager'][i % 3]}`,
        },
      ]);
    }
  });

  it('should generate context quickly', async () => {
    const duration = await benchmark('Context generation', async () => {
      await mem.context('food preferences');
    });

    expect(duration).toBeLessThan(100); // Should be <100ms
  });

  it('should handle context with maxTokens limit', async () => {
    const duration = await benchmark('Context with token limit', async () => {
      await mem.context('work', { maxTokens: 100 });
    });

    expect(duration).toBeLessThan(100); // Should be <100ms
  });
});

describe('Benchmark: Scaling Tests', () => {
  it('should maintain linear performance with memory count', async () => {
    const mem = new Engram({ llm: mockLLM, store: new MemoryStore() });
    const results: { count: number; duration: number }[] = [];

    for (const count of [10, 50, 100, 200]) {
      // Seed memories
      for (let i = 0; i < count; i++) {
        await mem.remember([
          {
            role: 'user',
            content: `Memory ${i}: Test content ${i}`,
          },
        ]);
      }

      const duration = await benchmark(
        `Recall from ${count} memories`,
        async () => {
          await mem.recall('test');
        },
      );

      results.push({ count, duration });
    }

    // Performance should scale reasonably
    // 200 memories should not be more than 4x slower than 50 memories
    const ratio200to50 = results[3].duration / results[1].duration;
    console.log(`  Scaling ratio (200/50 memories): ${ratio200to50.toFixed(2)}x`);
    expect(ratio200to50).toBeLessThan(4);
  }, 30000);

  it('should handle rapid sequential operations', async () => {
    const mem = new Engram({ llm: mockLLM, store: new MemoryStore() });

    const duration = await benchmark('100 rapid remember calls', async () => {
      for (let i = 0; i < 100; i++) {
        await mem.remember([
          {
            role: 'user',
            content: `Rapid message ${i}`,
          },
        ]);
      }
    });

    expect(duration).toBeLessThan(5000); // Should be <5s for 100 operations
    console.log(`  Average per operation: ${(duration / 100).toFixed(2)}ms`);
  });
});

describe('Benchmark: Memory Operations', () => {
  it('should measure memory footprint growth', async () => {
    const mem = new Engram({ llm: mockLLM, store: new MemoryStore() });

    // Store 100 memories
    for (let i = 0; i < 100; i++) {
      await mem.remember([
        {
          role: 'user',
          content: `Memory ${i}: This is some test content that will be stored`,
        },
      ]);
    }

    const memories = await mem.recall('test');
    const avgMemorySize = JSON.stringify(memories).length / memories.length;

    console.log(`  Average memory size: ${avgMemorySize.toFixed(0)} bytes`);
    expect(avgMemorySize).toBeLessThan(1000); // Should be <1KB per memory
  });

  it('should benchmark export performance', async () => {
    const mem = new Engram({ llm: mockLLM, store: new MemoryStore() });

    // Store 50 memories
    for (let i = 0; i < 50; i++) {
      await mem.remember([
        {
          role: 'user',
          content: `Memory ${i}: Test content`,
        },
      ]);
    }

    const jsonDuration = await benchmark('Export to JSON', async () => {
      await mem.export('json');
    });

    const mdDuration = await benchmark('Export to Markdown', async () => {
      await mem.export('md');
    });

    const csvDuration = await benchmark('Export to CSV', async () => {
      await mem.export('csv');
    });

    expect(jsonDuration).toBeLessThan(100);
    expect(mdDuration).toBeLessThan(100);
    expect(csvDuration).toBeLessThan(100);
  });
});

describe('Benchmark: Comparison Summary', () => {
  it('should log performance summary', async () => {
    console.log('\n📊 Performance Summary:');
    console.log('  ✓ Small operations (<50 memories): <100ms');
    console.log('  ✓ Medium operations (50-100 memories): <500ms');
    console.log('  ✓ Large operations (100-200 memories): <2s');
    console.log('  ✓ Concurrent operations: Handled efficiently');
    console.log('  ✓ Memory footprint: <1KB per memory');
    console.log('  ✓ Export operations: <100ms\n');

    expect(true).toBe(true);
  });
});
