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

## Why Use Engram?

### 🎯 Built-in Intelligence
- **Surprise Detection** — Only stores novel information (no duplicates)
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
