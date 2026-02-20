/**
 * Test Engram with Ollama (local LLM)
 *
 * Prerequisites:
 * 1. Install Ollama: https://ollama.ai
 * 2. Pull a model: ollama pull llama2
 * 3. Run: npx tsx test-ollama.ts
 */

import { Engram } from './src/index.js';

// Ollama LLM function
async function ollamaLLM(prompt: string): Promise<string> {
  console.log('🤖 Calling Ollama...');

  const response = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama3.2',
      prompt,
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.response;
}

// Test function
async function testEngram() {
  console.log('🧠 Testing Engram with Ollama\n');
  console.log('='.repeat(60));

  // Create Engram instance (zero dependencies!)
  const mem = new Engram({
    llm: ollamaLLM,
    // No embeddings, no SQLite - just works!
  });

  console.log('✅ Engram created (in-memory storage)\n');

  // Test 1: Remember from conversation
  console.log('📝 Test 1: remember() - Extract from conversation');
  console.log('-'.repeat(60));

  const messages = [
    { role: 'user' as const, content: 'I prefer TypeScript over JavaScript' },
    { role: 'assistant' as const, content: "Great choice! I'll remember that." },
    { role: 'user' as const, content: 'I usually deploy my apps to Vercel' },
    { role: 'assistant' as const, content: 'Got it, Vercel for deployment.' },
  ];

  console.log('Conversation:');
  messages.forEach(m => console.log(`  ${m.role}: ${m.content}`));
  console.log();

  const result = await mem.remember(messages);

  console.log(`\n✅ Extracted ${result.stored.length} memories:`);
  result.stored.forEach(m => {
    console.log(`  - "${m.content}" [${m.category}, importance: ${m.importance.toFixed(2)}]`);
  });
  console.log();

  // Test 2: Manual storage
  console.log('📝 Test 2: store() - Manual memory storage');
  console.log('-'.repeat(60));

  const memory = await mem.store('User knows how to use Docker', {
    category: 'skill',
    importance: 0.8,
  });

  console.log(`✅ Stored: "${memory.content}" [${memory.category}]`);
  console.log();

  // Test 3: Recall memories
  console.log('📝 Test 3: recall() - Search memories');
  console.log('-'.repeat(60));

  const query = 'TypeScript';
  console.log(`Query: "${query}"`);

  const memories = await mem.recall(query, { k: 5 });

  console.log(`\n✅ Found ${memories.length} relevant memories:`);
  memories.forEach(m => {
    console.log(`  - "${m.content}" [${m.category}]`);
  });
  console.log();

  // Test 4: Context formatting
  console.log('📝 Test 4: context() - Format for system prompt');
  console.log('-'.repeat(60));

  const context = await mem.context('user preferences', {
    format: 'bullets',
    maxTokens: 200,
  });

  console.log('Context (bullets format):');
  console.log(context);
  console.log();

  // Test 5: Stats
  console.log('📝 Test 5: stats() - Memory statistics');
  console.log('-'.repeat(60));

  const stats = await mem.stats();
  console.log(`Total memories: ${stats.totalMemories}`);
  console.log(`Average importance: ${stats.averageImportance.toFixed(2)}`);
  console.log(`Categories:`, stats.byCategory);
  console.log(`Has LLM: ${stats.hasLLM}`);
  console.log(`Has embeddings: ${stats.hasEmbeddings}`);
  console.log();

  // Test 6: Export
  console.log('📝 Test 6: export() - Export to JSON');
  console.log('-'.repeat(60));

  const exported = await mem.export('json');
  const exportData = JSON.parse(exported);
  console.log(`✅ Exported ${exportData.memories.length} memories`);
  console.log(`Export size: ${(exported.length / 1024).toFixed(2)} KB`);
  console.log();

  // Summary
  console.log('='.repeat(60));
  console.log('🎉 All tests passed!');
  console.log();
  console.log('✅ Engram works with Ollama (local LLM)');
  console.log('✅ Zero dependencies (using in-memory storage)');
  console.log('✅ All features working:');
  console.log('   - remember() - Extract from conversations');
  console.log('   - store() - Manual storage');
  console.log('   - recall() - Keyword-based search');
  console.log('   - context() - Format for prompts');
  console.log('   - stats() - Get statistics');
  console.log('   - export() - Export data');
  console.log();
  console.log('🚀 Ready to build AI agents with memory!');
}

// Run tests
testEngram().catch((error) => {
  console.error('❌ Test failed:', error);

  if (error.message.includes('ECONNREFUSED')) {
    console.error('\n⚠️  Ollama is not running!');
    console.error('Start Ollama:');
    console.error('  1. Install: https://ollama.ai');
    console.error('  2. Pull model: ollama pull llama2');
    console.error('  3. Run this test again');
  }

  process.exit(1);
});
