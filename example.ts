/**
 * Example: Using Engram with a mock LLM
 * For real usage, replace mockLLM with actual LLM calls
 */

import { Engram, MemoryStore } from './dist/index.js';

// Mock LLM function that extracts memories
const mockLLM = async (prompt: string): Promise<string> => {
  // In reality, this would call Claude, GPT, etc.
  // For demo purposes, we'll return a mock response
  if (prompt.includes('Extract')) {
    return JSON.stringify([
      {
        content: 'User prefers TypeScript over JavaScript',
        category: 'preference',
      },
      {
        content: 'Project uses Next.js 15 with App Router',
        category: 'context',
      },
    ]);
  }
  return '[]';
};

async function main() {
  console.log('🧠 Engram Example\n');

  // Initialize Engram with in-memory store
  const mem = new Engram({
    llm: mockLLM,
    store: new MemoryStore(), // In-memory for this example
  });

  // 1. Store memories from conversation
  console.log('1️⃣  Extracting memories from conversation...');
  const result = await mem.remember([
    { role: 'user', content: 'I prefer TypeScript over JavaScript' },
    {
      role: 'assistant',
      content: "Got it! I'll use TypeScript for your projects.",
    },
    { role: 'user', content: "I'm working on a Next.js 15 project with App Router" },
  ]);

  console.log(`   ✓ Stored ${result.stored.length} memories`);
  console.log(`   ✗ Rejected ${result.rejected.length} (too redundant)\n`);

  // 2. Recall relevant memories
  console.log('2️⃣  Recalling memories about language preference...');
  const memories = await mem.recall('what language does the user prefer?', { k: 3 });

  for (const memory of memories) {
    console.log(`   📝 ${memory.content} [${memory.category}]`);
    console.log(`      importance: ${memory.importance.toFixed(2)}, surprise: ${memory.surprise.toFixed(2)}\n`);
  }

  // 3. Manually store a memory
  console.log('3️⃣  Manually storing a skill...');
  await mem.store('Deploy with `vercel --prod`', {
    category: 'skill',
    importance: 0.9,
  });
  console.log('   ✓ Stored skill\n');

  // 4. Get stats
  console.log('4️⃣  Memory statistics:');
  const stats = await mem.stats();
  console.log(`   Total memories: ${stats.totalMemories}`);
  console.log(`   By category:`, stats.byCategory);
  console.log(`   Average importance: ${stats.averageImportance.toFixed(2)}`);
  console.log(`   Store type: ${stats.storeType}\n`);

  // 5. Export to markdown
  console.log('5️⃣  Exporting to markdown...');
  const markdown = await mem.export('md');
  console.log(markdown);
}

main().catch(console.error);
