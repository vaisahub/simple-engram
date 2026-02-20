# Engram Quick Start

Get started with Engram in 5 minutes.

## Installation

```bash
npm install engram
```

## Basic Usage

```typescript
import { Engram } from 'engram';

// 1. Configure with your LLM
const mem = new Engram({
  llm: async (prompt) => {
    // Call your LLM here (Claude, GPT, Ollama, etc.)
    return llmResponse;
  },
});

// 2. Store memories from conversation
await mem.remember([
  { role: 'user', content: 'I prefer TypeScript' },
  { role: 'assistant', content: "I'll use TypeScript" },
]);

// 3. Recall relevant memories
const memories = await mem.recall('what language does user prefer?');
console.log(memories[0].content); // "User prefers TypeScript"
```

## Common Patterns

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
```

### With OpenAI (+ Embeddings)

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

### With Ollama (Free, Local)

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

### Manual Storage (No LLM)

```typescript
import { Engram, JsonFileStore } from 'engram';

const mem = new Engram({
  store: new JsonFileStore('./brain.json')
});

// Store directly
await mem.store('User prefers TypeScript', {
  category: 'preference',
  importance: 0.9
});

// Recall works with keyword search
const memories = await mem.recall('TypeScript');
```

## Essential Methods

### remember() — Extract from conversation

```typescript
const result = await mem.remember([
  { role: 'user', content: '...' },
  { role: 'assistant', content: '...' },
]);

console.log(`Stored: ${result.stored.length}`);
console.log(`Rejected: ${result.rejected.length}`);
```

### store() — Manual storage

```typescript
await mem.store('Deploy with `vercel --prod`', {
  category: 'skill',
  importance: 0.9,
  metadata: { project: 'my-app' },
});
```

### recall() — Retrieve memories

```typescript
const memories = await mem.recall('how to deploy', {
  k: 5,                    // top 5 results
  categories: ['skill'],   // filter by category
  minImportance: 0.5,      // after decay
});
```

### forget() — Prune old memories

```typescript
await mem.forget({
  mode: 'normal',  // 'gentle' | 'normal' | 'aggressive'
});
```

### export() & import() — Backup/restore

```typescript
// Export
const json = await mem.export('json');
const markdown = await mem.export('md');

// Import
await mem.import(json, 'json');
```

## Configuration Options

```typescript
const mem = new Engram({
  llm: myLlmFunction,           // Required for remember()
  embed: myEmbedFunction,       // Optional — better recall

  surpriseThreshold: 0.3,       // Min novelty to store (0-1)

  categories: [                 // Customize categories
    'fact', 'preference', 'skill', 'episode', 'context'
  ],

  importanceBoost: {            // Category multipliers
    fact: 1.0,
    preference: 1.2,
    skill: 1.3,
    episode: 0.8,
    context: 0.9,
  },

  decayHalfLifeDays: 30,        // Importance halves every 30 days
  maxRetentionDays: 90,         // Hard expiry
  maxMemories: 10_000,          // Max total memories

  namespace: 'default',         // Isolate memory pools
});
```

## Events

```typescript
mem.on('stored', (memory) => {
  console.log(`📝 ${memory.content}`);
});

mem.on('rejected', (info) => {
  console.log(`⏭️  Skipped: ${info.content} — ${info.reason}`);
});

mem.on('recalled', (memories, query) => {
  console.log(`🔍 Found ${memories.length} for "${query}"`);
});
```

## Hooks (Advanced)

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
  },
});
```

## Explainability

```typescript
// See why memories were stored/rejected
const result = await mem.remember(messages, { explain: true });
console.log(result.stored[0].explanation);
// "surprise: 0.721 (semantic: 0.683, keyword: 0.812, rarity: 0.450)
//  × category_boost(preference): 1.2 → importance: 0.865
//  → STORED (above threshold 0.3)"

// See why memories were recalled
const memories = await mem.recall('deploy', { explain: true });
console.log(memories[0].explanation);
// "retrieval_score: 0.823
//    relevance: 0.912
//    importance: 0.760 (decayed from 0.920)
//    recency: 0.650"
```

## Dry Run Mode

```typescript
// Preview without writing
const preview = await mem.remember(messages, { dryRun: true });
console.log(`Would store: ${preview.stored.length}`);
console.log(`Would reject: ${preview.rejected.length}`);
// Nothing written, no events emitted
```

## Common Use Cases

### 1. Conversational AI with Memory

```typescript
async function chat(userMessage: string) {
  // Recall relevant context
  const memories = await mem.recall(userMessage, { k: 3 });

  // Build system prompt with context
  const context = memories.map(m => m.content).join('\n');
  const systemPrompt = `Relevant context:\n${context}`;

  // Call LLM with context
  const response = await llm(systemPrompt + '\n\n' + userMessage);

  // Remember this interaction
  await mem.remember([
    { role: 'user', content: userMessage },
    { role: 'assistant', content: response },
  ]);

  return response;
}
```

### 2. Project Knowledge Base

```typescript
// Store project facts
await mem.store('Uses Next.js 15 with App Router', { category: 'context' });
await mem.store('Database is Supabase with RLS', { category: 'fact' });
await mem.store('Deploy with vercel --prod', { category: 'skill' });

// Recall when coding
const relevant = await mem.recall('how to deploy', { categories: ['skill'] });
```

### 3. Learning User Preferences

```typescript
// As user interacts, store preferences
await mem.store('User prefers dark mode', { category: 'preference' });
await mem.store('User likes concise responses', { category: 'preference' });

// Recall when adapting behavior
const prefs = await mem.recall('user preferences', { categories: ['preference'] });
```

### 4. Session History Import

```typescript
// Import old conversations
await mem.bootstrap([
  { messages: conversation1, source: 'session-001' },
  { messages: conversation2, source: 'session-002' },
], {
  batchSize: 10,
  delayMs: 1000,
  onProgress: (p) => console.log(`${p.completed}/${p.total}`),
});
```

## Troubleshooting

### Q: Why are my memories being rejected?

**A:** Memories are rejected if their surprise score is below the threshold (default: 0.3). This means they're too similar to existing memories. You can:

1. Lower the threshold: `surpriseThreshold: 0.2`
2. Use `explain: true` to see the scoring breakdown
3. Use `forceStore: true` to bypass the threshold

### Q: How do I improve recall quality?

**A:**

1. **Add embeddings** — Vastly improves relevance
2. **Use categories** — Filter recall by category for precision
3. **Adjust k** — Retrieve more results and filter client-side
4. **Use hooks** — Implement custom ranking in `afterRecall`

### Q: How do I prevent memory overload?

**A:**

1. Set `maxMemories` — Hard limit (default: 10,000)
2. Run `forget()` periodically — Prune old memories
3. Use `maxRetentionDays` — Auto-expire after X days
4. Use `aggressive` forget mode — Remove bottom 10%

### Q: Can I use without an LLM?

**A:** Yes! Use `store()` for manual memory creation. `recall()` works with keyword search (no embeddings needed). Only `remember()` requires an LLM.

## Next Steps

- Read the [full README](./README.md) for comprehensive docs
- Check [examples](./example.ts) for real usage
- See [CHANGELOG](./CHANGELOG.md) for version history
- Review [specification](../engram-full-spec.md) for deep dive

## Support

- **Issues**: [GitHub Issues](https://github.com/your-org/engram/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/engram/discussions)

---

**Happy memory engineering!** 🧠
