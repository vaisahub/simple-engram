# Simple Engram

**Zero-dependency memory engine for AI agents** — One import, any LLM, any storage, and your agent never forgets.

```bash
npm install simple-engram
```

[![NPM Version](https://img.shields.io/npm/v/simple-engram)](https://www.npmjs.com/package/simple-engram)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-green.svg)](package.json)

**→ [Agentic System Integration Guide](./docs/AGENTIC_WORKFLOW.md)** — Complete workflow for integrating Engram into AI agents

---

## What is Engram?

Engram gives your AI agent a **persistent, intelligent memory** that automatically:
- ✅ Extracts important facts from conversations
- ✅ Detects and filters duplicates (no redundancy)
- ✅ Forgets old/unimportant information naturally
- ✅ Recalls relevant memories when needed

**Zero configuration required.** Bring your own LLM (OpenAI, Anthropic, Ollama, etc.) and start using memory in 3 lines of code.

---

## Quick Start

```typescript
import { Engram } from 'simple-engram';

// 1. Bring your LLM (any provider works!)
const llm = async (prompt: string) => {
  // Your LLM call here
  return response;
};

// 2. Create memory engine
const mem = new Engram({ llm });

// 3. Extract & store memories from conversations
await mem.remember([
  { role: 'user', content: 'I prefer TypeScript over JavaScript' },
  { role: 'assistant', content: 'Got it! I'll use TypeScript.' }
]);

// 4. Recall relevant memories
const memories = await mem.recall('coding preferences');
console.log(memories[0].content);
// → "User prefers TypeScript over JavaScript"

// 5. Format as context for your agent
const context = await mem.context('preferences', { format: 'bullets' });
// → "- User prefers TypeScript over JavaScript [preference]"
```

---

## How It Works

### Two-Phase Memory Processing

**Phase 1: Extraction (Uses Your LLM)**
- Calls your LLM once per `remember()` to extract facts
- Cost: ~500-1000 tokens per extraction
- Example: "I like Python" → extracts "User prefers Python programming language"

**Phase 2: Surprise Detection (No LLM - Fast & Free)**
- Uses embeddings (if provided) OR keywords for similarity comparison
- Pure mathematical scoring: cosine similarity or Jaccard index
- Cost: $0 (local computation)
- Example: Compares "User prefers Python" against all existing memories

**Total Cost per remember():**
- With embeddings: 1 LLM call + N embedding calls (~$0.015-0.02)
- Without embeddings: 1 LLM call only (~$0.015)

**Cost Optimization:**
```typescript
// Use hooks to skip LLM for small talk
const memory = new Engram({
  llm,
  hooks: {
    beforeExtract: async (messages) => {
      if (isSmallTalk(messages)) return []; // Skip LLM!
      return messages;
    }
  }
});
```

---

## Why Use Engram?

### 🎯 Built-in Intelligence
- **Surprise Detection** — Only stores novel information (no duplicates, no LLM)
- **Memory Decay** — Ebbinghaus forgetting curve with access frequency boost
- **Smart Retrieval** — Semantic search with configurable ranking weights
- **Auto-merging** — Combines similar memories automatically

### 🔌 Bring Your Own Everything
- **BYOLLM** — Works with any LLM (OpenAI, Anthropic, Ollama, Groq, etc.)
- **BYOE** — Optional embeddings for 10x better search (OpenAI, Voyage, local models)
- **BYOS** — In-memory or SQLite storage (custom adapters supported)

### 🪶 Zero Dependencies
- No external packages in production
- No network calls (you control the LLM/embeddings)
- Works offline with local models

### 🧩 Simple API
```typescript
await mem.remember(messages);  // Store memories
await mem.recall(query);       // Retrieve memories
await mem.forget();            // Prune old memories
await mem.context(query);      // Format for LLM prompts
```

---

## When NOT to Use Engram

❌ **Don't use if you need:**
- Full conversation history (use a database instead)
- Exact verbatim recall (Engram extracts facts, not transcripts)
- Real-time streaming (memory extraction is async)
- Complex queries (Engram is simple keyword/semantic search, not SQL)

✅ **Use Engram when you want:**
- Long-term memory across sessions
- Automatic deduplication and summarization
- Natural forgetting of outdated info
- Personalization without managing a database

---

## Multi-User / Namespace Support

**Isolate memories per user, tenant, or context using namespaces.**

```typescript
import { Engram, SqliteStore } from 'simple-engram';

// Pattern 1: Separate Engram instance per user
function getUserMemory(userId: string) {
  return new Engram({
    llm,
    namespace: `user-${userId}`,
    store: new SqliteStore({ path: './shared.db' })
  });
}

const aliceMemory = getUserMemory('alice-123');
const bobMemory = getUserMemory('bob-456');

await aliceMemory.remember([{ role: 'user', content: 'I like Python' }]);
await bobMemory.remember([{ role: 'user', content: 'I like Java' }]);

// Memories are completely isolated - Alice and Bob never see each other's data
const alicePrefs = await aliceMemory.recall('preferences'); // Only Alice's
const bobPrefs = await bobMemory.recall('preferences');     // Only Bob's

// Pattern 2: Multi-tenant agent
class MultiTenantAgent {
  private memories = new Map<string, Engram>();

  getMemory(userId: string): Engram {
    if (!this.memories.has(userId)) {
      this.memories.set(userId, new Engram({
        llm: this.llm,
        namespace: `tenant-${userId}`,
        store: new SqliteStore({ path: './tenants.db' })
      }));
    }
    return this.memories.get(userId)!;
  }
}
```

**Key Points:**
- Namespaces provide complete memory isolation
- Single database can store multiple namespaces
- Perfect for SaaS, multi-user agents, or context separation

---

## Cross-Session Memory

**Engram automatically loads and compares against existing memories across process restarts.**

```typescript
import { Engram, SqliteStore } from 'simple-engram';

// Session 1
const memory = new Engram({
  llm,
  store: new SqliteStore({ path: './memory.db' })
});
await memory.init(); // Load existing

await memory.remember([{ role: 'user', content: 'I prefer TypeScript' }]);
await memory.close();

// ===== Process restarts =====

// Session 2 (hours/days later)
const memory2 = new Engram({
  llm,
  store: new SqliteStore({ path: './memory.db' }) // Same path!
});
await memory2.init(); // Loads "I prefer TypeScript" from Session 1

await memory2.remember([{ role: 'user', content: 'I also like Python' }]);
// ✅ Compares against TypeScript preference from Session 1
// ✅ Cross-session memory works automatically!
```

**Key Points:**
- `init()` loads all existing memories from storage
- New memories are compared against ALL existing memories
- Works with SqliteStore and JsonFileStore (not MemoryStore)

---

## Advanced Filtering

**Filter memories by category, importance, date, and metadata.**

```typescript
// Filter by category
const preferences = await mem.recall('coding', {
  categories: ['preference'],      // Only preferences
  minImportance: 0.7              // High importance only
});

// Filter by date
const recent = await mem.recall('projects', {
  since: Date.now() - 7 * 24 * 60 * 60 * 1000,  // Last 7 days
  categories: ['fact', 'episode']
});

// Filter by metadata
const workMemories = await mem.recall('tasks', {
  metadata: { project: 'engram', priority: 'high' }
});

// Combined filters
const filtered = await mem.recall('python', {
  categories: ['skill', 'preference'],
  minImportance: 0.5,
  since: Date.now() - 30 * 24 * 60 * 60 * 1000, // Last 30 days
  k: 10  // Top 10 results
});
```

**Efficient Database-Level Filtering:**
- SqliteStore uses SQL WHERE clauses (indexed)
- Filters applied at database level (not client-side)
- Scales efficiently to 10k+ memories

---

## Code Examples

### OpenAI (Cloud)
```typescript
import OpenAI from 'openai';
import { Engram } from 'simple-engram';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const mem = new Engram({
  llm: async (prompt) => {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
    });
    return response.choices[0].message.content;
  }
});

await mem.remember([
  { role: 'user', content: 'My name is Alice and I love hiking' }
]);

const memories = await mem.recall('Alice');
// → [{ content: "User's name is Alice", category: "fact", ... }]
```

### Anthropic Claude
```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const mem = new Engram({
  llm: async (prompt) => {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });
    return response.content[0].text;
  }
});
```

### Any LLM Provider
```typescript
// Works with Ollama, LM Studio, or any local/cloud LLM
const mem = new Engram({
  llm: async (prompt) => {
    // Use your preferred LLM library here
    const response = await yourLLM.generate({ prompt });
    return response.text;
  }
});
```

### With Embeddings (10x Better Search)
```typescript
import OpenAI from 'openai';

const openai = new OpenAI();

const mem = new Engram({
  llm: async (prompt) => {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
    });
    return response.choices[0].message.content;
  },
  embed: async (text) => {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    return response.data[0].embedding;
  }
});

await mem.remember([
  { role: 'user', content: 'I use Docker for containerization' }
]);

// Semantic search (finds "Docker" even if you search "containers")
const memories = await mem.recall('containerization tools');
```

---

## Configuration Options

```typescript
const mem = new Engram({
  llm,                           // Required: Your LLM function
  embed,                         // Optional: Embedding function (recommended!)

  // Surprise detection
  surpriseThreshold: 0.15,       // Novelty threshold (0-1, lower = more selective)

  // Memory decay
  decayHalfLifeDays: 30,         // Half-life for importance decay
  maxRetentionDays: 90,          // Max age before auto-deletion

  // Retrieval tuning
  defaultK: 5,                   // Number of memories to recall
  retrievalWeights: {            // Customize ranking
    relevance: 0.5,              // How well query matches content
    importance: 0.3,             // Base importance with decay
    recency: 0.2,                // How recent the memory is
    accessFrequency: 0.0,        // How often accessed
  },

  // Storage
  store: new MemoryStore(),      // In-memory (default) or SqliteStore
  maxMemories: 10000,            // Hard limit on memory count
});
```

---

## Documentation

📚 **Detailed Guides:**
- [Agentic System Integration](./docs/AGENTIC_WORKFLOW.md) — Complete workflow for AI agents
- [API Reference](./docs/API.md) — Complete method documentation
- [Configuration Guide](./docs/CONFIGURATION.md) — All options explained
- [Storage Adapters](./docs/STORAGE.md) — In-memory, SQLite, custom stores
- [Embeddings Guide](./EMBEDDINGS_GUIDE.md) — Setup for semantic search
- [Examples](./docs/EXAMPLES.md) — Real-world use cases
- [How It Works](./docs/HOW_IT_WORKS.md) — Algorithm deep dive

---

## License

MIT © [Vaisakh](https://github.com/vaisahub)

---

## Contributing

Issues and PRs welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.
