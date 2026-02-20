# Engram

> Plug-and-play memory engine for AI agents — one import, any LLM, any storage, and your agent never forgets.

**Version**: 0.1.0 (Phase 1)
**License**: MIT

## Why Engram?

Every agentic framework re-invents memory. Engram is different:

- **Zero infrastructure** — Default store is a single JSON file. No database required.
- **BYOLLM** — You pass an `async (prompt) => string` function. We never import a provider.
- **BYOE** — Embeddings are optional. Everything works (worse) without them.
- **Small core** — Core engine is under 500 lines. Everything else is adapters.
- **Surprise-first** — Novel information is retained. Redundant information is rejected. No LLM call for this decision.
- **Export-native** — Memories are always exportable to JSON, Markdown, CSV. Never locked in.
- **Transparent** — Every scoring decision is explainable. Every store/reject has a reason.

## Installation

```bash
npm install engram
```

## Quick Start

### With Claude (Anthropic)

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { Engram } from 'engram';

const client = new Anthropic();

const mem = new Engram({
  llm: async (prompt) => {
    const r = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });
    return r.content[0].text;
  },
});

// Extract and store memories from a conversation
const result = await mem.remember([
  { role: 'user', content: 'I prefer TypeScript over JavaScript' },
  { role: 'assistant', content: 'Got it! I'll use TypeScript for your projects.' },
]);

console.log(`Stored ${result.stored.length} memories`);
console.log(`Rejected ${result.rejected.length} (too redundant)`);

// Recall relevant memories
const relevant = await mem.recall('what language does the user prefer?');
console.log(relevant[0].content); // "User prefers TypeScript over JavaScript"
```

### With OpenAI

```typescript
import OpenAI from 'openai';
import { Engram } from 'engram';

const openai = new OpenAI();

const mem = new Engram({
  llm: async (p) => {
    const r = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: p }],
    });
    return r.choices[0].message.content;
  },
  embed: async (text) => {
    const r = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    return r.data[0].embedding;
  },
});
```

### With Ollama (free, local)

```typescript
import { Engram } from 'engram';

const mem = new Engram({
  llm: async (prompt) => {
    const r = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      body: JSON.stringify({ model: 'qwen2.5:7b', prompt, stream: false }),
    });
    return (await r.json()).response;
  },
  embed: async (text) => {
    const r = await fetch('http://localhost:11434/api/embeddings', {
      method: 'POST',
      body: JSON.stringify({ model: 'nomic-embed-text', prompt: text }),
    });
    return (await r.json()).embedding;
  },
});
```

### Manual mode (no LLM, no embeddings)

```typescript
import { Engram, JsonFileStore } from 'engram';

const mem = new Engram({ store: new JsonFileStore('./brain.json') });

await mem.store('User prefers TypeScript', { category: 'preference' });
await mem.store('Project uses Next.js 15', { category: 'context' });

const relevant = await mem.recall('what framework');
// Returns memories matching "framework" by keyword similarity
```

## Core API

### `remember(messages, opts?)` — Extract memories from conversation

```typescript
const result = await mem.remember([
  { role: 'user', content: '...' },
  { role: 'assistant', content: '...' },
], {
  source: 'session-001',    // Track where memories came from
  dryRun: true,             // Preview without writing
  explain: true,            // Include scoring breakdown
});

console.log(result.stored);   // Memories that were stored
console.log(result.rejected); // Memories that were too redundant
console.log(result.errors);   // Any LLM errors
```

### `store(content, opts?)` — Manually store a memory

```typescript
const memory = await mem.store('Deploy with `vercel --prod`', {
  category: 'skill',
  importance: 0.9,
  metadata: { project: 'my-app' },
});
```

### `recall(query, opts?)` — Retrieve memories

```typescript
const memories = await mem.recall('how to deploy', {
  k: 5,                           // Top 5 results
  categories: ['skill'],          // Filter by category
  minImportance: 0.5,             // After decay
  explain: true,                  // Show scoring
});
```

### `forget(opts?)` — Prune old memories

```typescript
const result = await mem.forget({
  mode: 'normal',  // 'gentle' | 'normal' | 'aggressive'
  dryRun: true,    // Preview what would be deleted
});

console.log(`Would prune ${result.pruned} memories`);
```

### `export(format)` and `import(data, format)`

```typescript
// Export
const json = await mem.export('json');
const markdown = await mem.export('md');
const csv = await mem.export('csv');

// Import
const count = await mem.import(json, 'json');
```

### `stats()` — Get statistics

```typescript
const stats = await mem.stats();
console.log(stats.totalMemories);
console.log(stats.byCategory);
console.log(stats.averageImportance);
```

## Configuration

```typescript
const mem = new Engram({
  // Adapters
  llm: myLlmFunction,              // Optional — needed for remember()
  embed: myEmbedFunction,          // Optional — better recall with it
  store: new JsonFileStore(),      // Default: JsonFileStore('./engram.json')

  // Scoring
  surpriseThreshold: 0.3,          // Min novelty to store (0-1)
  importanceBoost: {               // Category multipliers
    fact: 1.0,
    preference: 1.2,
    skill: 1.3,
    episode: 0.8,
    context: 0.9,
  },

  // Categories
  categories: ['fact', 'preference', 'skill', 'episode', 'context'],

  // Decay
  decayHalfLifeDays: 30,           // Importance halves every 30 days
  maxRetentionDays: 90,            // Hard expiry
  maxMemories: 10_000,             // Max total memories

  // Retrieval
  defaultK: 5,                     // Default results per recall

  // Namespace
  namespace: 'default',            // Isolate memory pools

  // Versioning
  trackHistory: true,              // Track content changes
  maxHistoryPerMemory: 10,         // Max versions kept
});
```

## Events

```typescript
mem.on('stored', (memory) => {
  console.log(`📝 Stored: "${memory.content}" [${memory.category}]`);
});

mem.on('rejected', (info) => {
  console.log(`⏭️  Skipped: "${info.content}" — ${info.reason}`);
});

mem.on('recalled', (memories, query) => {
  console.log(`🔍 Recalled ${memories.length} for "${query}"`);
});

mem.on('forgotten', (ids, count) => {
  console.log(`🗑️  Pruned ${count} memories`);
});

mem.on('error', (err) => {
  console.error(`❌ Error: ${err.message}`);
});
```

## Hooks

```typescript
const mem = new Engram({
  hooks: {
    // Redact PII before storing
    beforeStore: (memory) => {
      memory.content = memory.content.replace(/\b[\w.-]+@[\w.-]+\.\w+\b/g, '[EMAIL]');
      return memory;
    },

    // Expand queries
    beforeRecall: (query) => {
      return `${query} (project: my-app)`;
    },

    // Archive before deleting
    beforeForget: async (memories) => {
      await archiveToS3(memories);
      return memories;
    },
  },
});
```

## Explainability

Every decision can be inspected:

```typescript
// See why memories were stored or rejected
const result = await mem.remember(messages, { explain: true });
console.log(result.stored[0].explanation);
// "surprise: 0.721 (semantic: 0.683, keyword: 0.812, rarity: 0.450)
//  × category_boost(preference): 1.2 → importance: 0.865
//  → STORED (above threshold 0.3)"

// See why memories were recalled
const memories = await mem.recall('deploy', { explain: true });
console.log(memories[0].explanation);
// "retrieval_score: 0.823
//    relevance: 0.912 (cosine similarity with query)
//    importance: 0.760 (base: 0.920, decayed from 30d, access_boost: 1.1x)
//    recency: 0.650 (30 days old)"
```

## Store Adapters

### Built-in

- **MemoryStore** — In-memory (no persistence, great for testing)
- **JsonFileStore** — Single JSON file (default, zero setup)

### Coming in Phase 2+

- **SqliteStore** — Local SQLite database
- Community adapters: PostgreSQL, Redis, Qdrant, Turso

## Roadmap

- ✅ **Phase 1** (v0.1.0) — Core memory engine with JSON/Markdown export
- 🚧 **Phase 2** (v0.2.0) — Smart recall, context injection, SqliteStore
- 📅 **Phase 3** (v0.3.0) — Multi-agent, namespaces, shared memory
- 📅 **Phase 4** (v0.4.0) — Tool use, MCP server, skill learning
- 📅 **Phase 5** (v1.0.0) — Production hardening, Python SDK, analytics

## Philosophy

Engram follows seven non-negotiable principles:

1. **Zero infrastructure** — No database required to start
2. **BYOLLM** — Never import a provider, you pass the function
3. **BYOE** — Embeddings optional, everything works without them
4. **Small core** — Core under 500 lines, rest is adapters
5. **Surprise-first** — Novel info retained, redundant rejected
6. **Export-native** — Never locked in, always exportable
7. **Transparent** — Every decision is explainable

## Contributing

This is Phase 1. We welcome contributions for:

- Store adapters (SQLite, PostgreSQL, Redis, etc.)
- Embedding providers (Voyage, Cohere, etc.)
- Bug fixes and tests
- Documentation improvements

## License

MIT © Engram Contributors

---

**Built with inspiration from:** Titans (Google), Mem0, Letta, Lynkr, and the broader agentic memory research community.
