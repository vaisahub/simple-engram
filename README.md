# Simple Engram 🧠

**Memory engine for AI agents** — Give your AI long-term memory in 5 minutes.

```bash
npm install simple-engram
```

Works with **any LLM** (OpenAI, Anthropic, Ollama), **zero setup**, **zero dependencies**.

## 🧮 Built-in Intelligence

Simple Engram uses smart algorithms to automatically manage memories:

- **🎯 Semantic Search** — Cosine similarity with optional embeddings (OpenAI, Ollama, Voyage AI)
- **🔄 Smart Deduplication** — TF-IDF + cosine similarity detects duplicates (>85% similarity threshold)
- **📊 Importance Scoring** — TF-IDF frequency analysis ranks memory relevance
- **⚡ Surprise Detection** — Statistical novelty detection highlights new information
- **🧹 Memory Decay** — Ebbinghaus forgetting curve with configurable half-life (default: 7 days)
- **🔀 Auto-merging** — Similar memories (>90% similarity) merge automatically with version tracking
- **⚖️ Adaptive Ranking** — Weighted scoring: importance × recency × access frequency

All algorithms run automatically — **no configuration needed**.

---

## Quick Start

```typescript
import { Engram } from 'simple-engram';

// 1. Bring your LLM function (any provider works!)
const llm = async (prompt: string) => {
  // Your LLM call here (OpenAI, Claude, Ollama, etc.)
  return response;
};

// 2. Create memory engine
const mem = new Engram({ llm });

// 3. Extract memories from conversations
await mem.remember([
  { role: 'user', content: 'I prefer TypeScript over JavaScript' }
]);

// 4. Recall relevant memories
const memories = await mem.recall('coding preferences');

// 5. Format for system prompt
const context = await mem.context('user preferences', {
  format: 'bullets',
  maxTokens: 300
});

console.log(context);
// Output:
// Relevant memories:
// - User prefers TypeScript over JavaScript [preference]
```

---

## Features

- ✅ **Works with any LLM** (OpenAI, Anthropic, Ollama, local models)
- ✅ **Zero setup** (no database, no vector store, no config)
- ✅ **Zero dependencies** (works out of the box)
- ✅ **Smart extraction** (automatically identifies what's worth remembering)
- ✅ **Semantic search** (finds relevant memories, optional embeddings)
- ✅ **Type-safe** (full TypeScript support)
- ✅ **Production ready** (150 tests, battle-tested)

---

## Installation

```bash
npm install simple-engram
```

**That's it!** No other dependencies needed.

### Optional Add-ons

```bash
# For better semantic search (recommended)
# Bring your own embeddings function

# For SQLite storage (production persistence)
npm install better-sqlite3
```

---

## Complete Examples

### Example 1: OpenAI

```typescript
import { Engram } from 'simple-engram';
import OpenAI from 'openai';

const client = new OpenAI();

const llm = async (prompt: string) => {
  const response = await client.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }]
  });
  return response.choices[0].message.content;
};

const mem = new Engram({ llm });

await mem.remember([
  { role: 'user', content: 'I live in San Francisco' },
  { role: 'assistant', content: 'Got it!' }
]);

const memories = await mem.recall('location');
console.log(memories[0].content); // "User lives in San Francisco"
```

### Example 2: Anthropic Claude

```typescript
import { Engram } from 'simple-engram';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

const llm = async (prompt: string) => {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }]
  });
  return response.content[0].text;
};

const mem = new Engram({ llm });

await mem.remember([
  { role: 'user', content: 'I prefer dark mode in IDEs' }
]);

const context = await mem.context('preferences', {
  format: 'xml'
});
// Returns: <memories><memory>User prefers dark mode in IDEs</memory></memories>
```

### Example 3: Ollama (100% Free & Local)

```typescript
import { Engram } from 'simple-engram';

const llm = async (prompt: string) => {
  const response = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    body: JSON.stringify({
      model: 'llama3.2',
      prompt,
      stream: false
    })
  });
  return (await response.json()).response;
};

const mem = new Engram({ llm });

// Works exactly the same!
await mem.remember([
  { role: 'user', content: 'I use Docker for containerization' }
]);

const memories = await mem.recall('Docker');
```

### Example 4: With Embeddings (10x Better Search)

```typescript
import { Engram } from 'simple-engram';
import OpenAI from 'openai';

const client = new OpenAI();

const llm = async (prompt: string) => {
  const response = await client.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }]
  });
  return response.choices[0].message.content;
};

const embed = async (text: string) => {
  const response = await client.embeddings.create({
    model: 'text-embedding-3-small',
    input: text
  });
  return response.data[0].embedding;
};

const mem = new Engram({ llm, embed });

await mem.store('User prefers TypeScript');

// Semantic search (understands meaning, not just keywords!)
const memories = await mem.recall('programming languages');
// Finds "TypeScript" even though query doesn't contain it!
```

---

## Core API

### `remember(messages, options?)`
Extract and store memories from conversations using LLM.

```typescript
await mem.remember([
  { role: 'user', content: 'I prefer TypeScript' },
  { role: 'assistant', content: "I'll remember that!" }
]);
```

**Requires**: LLM function

### `store(content, options?)`
Manually store a memory without LLM extraction.

```typescript
await mem.store('User lives in San Francisco', {
  category: 'fact',
  importance: 0.9
});
```

**Requires**: Nothing (always works)

### `recall(query, options?)`
Find relevant memories by query.

```typescript
const memories = await mem.recall('user location', {
  k: 5,  // Return top 5 memories
  categories: ['fact', 'preference']
});
```

**Better with**: Embeddings (10x better semantic search)

### `context(query, options?)`
Format memories for system prompts.

```typescript
const context = await mem.context('user preferences', {
  format: 'bullets',  // or 'prose', 'xml', 'json'
  maxTokens: 300
});

const systemPrompt = `You are a helpful assistant.\n\n${context}`;
```

**Formats**:
- `bullets`: Bullet points (default)
- `prose`: Natural paragraphs
- `xml`: XML tags (best for Claude)
- `json`: JSON array

### `merge(options?)`
Consolidate duplicate/similar memories.

```typescript
await mem.merge({
  similarityThreshold: 0.85,
  dryRun: true  // Test before actually merging
});
```

### `forget(options?)`
Remove old or low-importance memories.

```typescript
await mem.forget({
  mode: 'normal',  // or 'gentle', 'aggressive'
  maxAge: 90  // Days
});
```

### `export(format)` / `import(data, format)`
Export/import memories for backup.

```typescript
const json = await mem.export('json');
await mem.import(json, 'json');
```

---

## Storage Options

### 1. In-Memory (Default)

```typescript
const mem = new Engram({ llm });
// Fast, no persistence
```

### 2. JSON File

```typescript
import { JsonFileStore } from 'simple-engram';

const mem = new Engram({
  llm,
  store: new JsonFileStore({ path: './memories.json' })
});
// Simple persistence, works for <10k memories
```

### 3. SQLite (Production)

```bash
npm install better-sqlite3
```

```typescript
import { SqliteStore } from 'simple-engram';

const mem = new Engram({
  llm,
  store: new SqliteStore({ path: './memories.db' })
});
// Fast, scalable, handles millions of memories
```

---

## Configuration

```typescript
const mem = new Engram({
  llm: myLlmFunction,           // Required: Your LLM function
  embed: myEmbedFunction,        // Optional: Embeddings for semantic search
  store: new JsonFileStore(),    // Optional: Storage adapter
  surpriseThreshold: 0.3,        // Optional: Novelty threshold (0-1)
  decayHalfLife: 30,             // Optional: Memory decay (days)
  maxMemories: 10000,            // Optional: Max memories to store
  namespace: 'user-123'          // Optional: Isolate memory pools
});
```

---

## Why Engram?

### Before Engram
```typescript
// Manually manage memory
const memories = [];

// Extract from conversations (write LLM prompts)
const extracted = await llm('Extract facts from: ...');
memories.push(JSON.parse(extracted));

// Search (keyword matching only)
const relevant = memories.filter(m => m.includes(query));

// Format for prompts (manual)
const context = relevant.map(m => `- ${m}`).join('\n');

// Deduplicate (complex logic)
// ... 100+ lines of code
```

### With Engram
```typescript
const mem = new Engram({ llm });

await mem.remember(messages);
const context = await mem.context(query, { format: 'bullets' });
await mem.merge();
```

**3 lines vs 100+ lines. Zero setup. Production ready.**

---

## Advanced Features

### Memory Categories

```typescript
await mem.store('User prefers TypeScript', {
  category: 'preference',
  importance: 0.9
});

// Built-in categories: fact, preference, skill, episode, context
// Or use custom categories
```

### Time Decay

Older memories naturally fade (configurable):

```typescript
const mem = new Engram({
  llm,
  decayHalfLife: 30,    // Memories decay over 30 days
  maxRetention: 90       // Delete after 90 days
});
```

### Explainability

```typescript
const memories = await mem.recall('coding', { explain: true });

console.log(memories[0].explanation);
// "Relevant because: high keyword match (0.85), recent access, important"
```

### Hooks & Events

```typescript
mem.on('stored', (memory) => {
  console.log('Stored:', memory.content);
});

mem.hooks.beforeStore = async (memory) => {
  // Modify or reject memories before storing
  if (memory.content.includes('secret')) {
    throw new Error('No secrets allowed!');
  }
  return memory;
};
```

---

## Real-World Examples

### Chatbot with Memory

```typescript
import { Engram } from 'simple-engram';

const mem = new Engram({ llm });

async function chat(userMessage: string) {
  // Get relevant context
  const context = await mem.context(userMessage, {
    format: 'bullets',
    maxTokens: 300
  });

  // Generate response with context
  const systemPrompt = `You are a helpful assistant.\n\n${context}`;
  const response = await llm(`${systemPrompt}\n\nUser: ${userMessage}`);

  // Remember this conversation
  await mem.remember([
    { role: 'user', content: userMessage },
    { role: 'assistant', content: response }
  ]);

  return response;
}

// Now your chatbot remembers everything!
await chat('I prefer dark mode');
await chat('What do I prefer?'); // "You prefer dark mode"
```

### Customer Support Agent

```typescript
const mem = new Engram({
  llm,
  embed,  // Use embeddings for better search
  namespace: `customer-${customerId}`  // Isolate per customer
});

await mem.remember(conversationHistory);

const relevantIssues = await mem.recall('previous issues', {
  categories: ['issue', 'feedback']
});
```

---

## Testing

Engram is battle-tested:

- ✅ **150 tests passing** across 8 test suites
- ✅ **Real-world validated** with Ollama (local, free)
- ✅ **Semantic search verified** (finds "TypeScript" from "programming languages" query)
- ✅ **Typo tolerance** (finds "containerization" from "containr tecnology")
- ✅ **Production ready**

---

## Performance

| Operation | Time (1k memories) |
|-----------|-------------------|
| `store()` | <5ms |
| `recall()` (keyword) | <20ms |
| `recall()` (embeddings) | <50ms + embed time |
| `remember()` | LLM latency + <50ms |
| `context()` | <10ms |
| `merge()` | <100ms |

---

## Cost

**$0/month** with local models (Ollama):
- LLM: Free (Ollama llama3.2)
- Embeddings: Free (Ollama nomic-embed-text)
- Storage: Free (in-memory or JSON file)

**Or use cloud**:
- OpenAI GPT-4: ~$3-30/month
- Embeddings: ~$0.13/1M tokens
- Much cheaper than vector databases ($70+/month)

---

## Documentation

- **[WHY_ENGRAM.md](./WHY_ENGRAM.md)** - Why use Engram vs alternatives
- **[ZERO_DEPS.md](./ZERO_DEPS.md)** - Zero dependencies guide
- **[OLLAMA_TEST_RESULTS.md](./OLLAMA_TEST_RESULTS.md)** - Test results (no embeddings)
- **[EMBEDDINGS_TEST_RESULTS.md](./EMBEDDINGS_TEST_RESULTS.md)** - Test results (with embeddings)
- **[COMPLETE_TEST_SUMMARY.md](./COMPLETE_TEST_SUMMARY.md)** - Full comparison

---

## Requirements

- **Node.js**: >= 18.0.0
- **LLM function**: Any provider (OpenAI, Anthropic, Ollama, local)
- **Optional**: Embeddings function for semantic search
- **Optional**: better-sqlite3 for SQLite storage

---

## FAQ

**Q: Do I need a vector database?**
A: No! Engram works without any database. Use in-memory or JSON file storage.

**Q: Do I need embeddings?**
A: No! Keyword search works great. Embeddings make it 10x better (semantic search) but are optional.

**Q: Does it work with local models?**
A: Yes! Tested with Ollama. 100% free, 100% local.

**Q: How much does it cost?**
A: $0 with Ollama (local). Or ~$3-30/month with OpenAI/Claude.

**Q: Is it production ready?**
A: Yes! 150 tests, real-world validated, type-safe.

**Q: Can I use it with my existing LLM setup?**
A: Yes! Just pass your existing LLM function. Works with any provider.

---

## TypeScript Support

Full TypeScript types included:

```typescript
import { Engram, Memory, RecallOptions } from 'simple-engram';

const mem: Engram = new Engram({ llm });
const memories: Memory[] = await mem.recall('query');
```

---

## Contributing

Contributions welcome! See [GitHub issues](https://github.com/vaisahub/simple-engram/issues).

---

## License

MIT — Free to use, modify, and distribute.

---

## Links

- **GitHub**: https://github.com/vaisahub/simple-engram
- **npm**: https://www.npmjs.com/package/simple-engram
- **Issues**: https://github.com/vaisahub/simple-engram/issues

---

## Quick Reference

```typescript
import { Engram } from 'simple-engram';

const mem = new Engram({ llm });

await mem.remember(messages);           // Extract from conversations
await mem.store(content, options);      // Manually store
const memories = await mem.recall(query); // Find relevant
const context = await mem.context(query); // Format for prompts
await mem.merge();                      // Deduplicate
await mem.forget();                     // Prune old
const json = await mem.export('json'); // Backup
await mem.import(json, 'json');        // Restore
```

**Start building agents with memory in 5 minutes!** 🚀
