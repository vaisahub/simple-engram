# Configuration Guide

Complete guide to all Engram configuration options and tuning strategies.

## Quick Start

```typescript
import { Engram } from 'simple-engram';

const mem = new Engram({
  llm: myLlmFunction,  // Only required option
});
```

---

## Core Configuration

### LLM Function (Required)

Your LLM function that extracts memories from conversations.

```typescript
const mem = new Engram({
  llm: async (prompt: string): Promise<string> => {
    // Your LLM implementation
    const response = await yourLLM.generate({ prompt });
    return response.text;
  }
});
```

**Requirements:**
- Must accept a string prompt
- Must return a Promise<string>
- Should return valid JSON when prompted for memory extraction

**Examples:**

```typescript
// OpenAI
import OpenAI from 'openai';
const client = new OpenAI();

llm: async (prompt) => {
  const response = await client.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
  });
  return response.choices[0].message.content;
}

// Anthropic
import Anthropic from '@anthropic-ai/sdk';
const anthropic = new Anthropic();

llm: async (prompt) => {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });
  return response.content[0].text;
}

// Ollama (local)
import { Ollama } from 'ollama';
const ollama = new Ollama();

llm: async (prompt) => {
  const response = await ollama.generate({
    model: 'llama3.2',
    prompt,
    stream: false,
  });
  return response.response;
}
```

---

### Embedding Function (Optional, Recommended)

Enables semantic search (10x better recall accuracy).

```typescript
const mem = new Engram({
  llm,
  embed: async (text: string): Promise<number[]> => {
    // Your embedding implementation
    const response = await yourEmbedding.create({ input: text });
    return response.embedding;
  }
});
```

**Requirements:**
- Must accept a string
- Must return a Promise<number[]> (vector)
- All vectors must have the same dimensions

**Examples:**

```typescript
// OpenAI (recommended)
import OpenAI from 'openai';
const client = new OpenAI();

embed: async (text) => {
  const response = await client.embeddings.create({
    model: 'text-embedding-3-small', // 1536 dimensions
    input: text,
  });
  return response.data[0].embedding;
}

// Ollama (local, free)
import { Ollama } from 'ollama';
const ollama = new Ollama();

embed: async (text) => {
  const response = await ollama.embeddings({
    model: 'nomic-embed-text', // 768 dimensions
    prompt: text,
  });
  return response.embedding;
}
```

See [Embeddings Guide](../EMBEDDINGS_GUIDE.md) for detailed setup.

---

## Storage Configuration

### In-Memory (Default)

Fast, no persistence. Data lost when process ends.

```typescript
import { MemoryStore } from 'simple-engram';

const mem = new Engram({
  llm,
  store: new MemoryStore(),
});
```

**Use when:**
- Prototyping
- Testing
- Short-lived sessions
- Memory < 10k items

---

### JSON File

Simple file persistence. Good for < 10k memories.

```typescript
import { JsonFileStore } from 'simple-engram';

const mem = new Engram({
  llm,
  store: new JsonFileStore({
    path: './memories.json',
    pretty: true, // Pretty-print JSON (default: false)
  }),
});
```

**Use when:**
- Development
- Small datasets (< 10k memories)
- Simple backup needs

**Note:** Loads entire file into memory. Not suitable for large datasets.

---

### SQLite (Production)

Fast, scalable, handles millions of memories.

```bash
npm install better-sqlite3
```

```typescript
import { SqliteStore } from 'simple-engram';

const mem = new Engram({
  llm,
  store: new SqliteStore({
    path: './memories.db',
    verbose: console.log, // Optional: log SQL queries
  }),
});
```

**Use when:**
- Production
- Large datasets (10k+ memories)
- Need indexing/queries
- Multi-user systems

**Features:**
- Automatic indexing
- Transaction support
- ACID guarantees
- Efficient filtering

See [Storage Guide](./STORAGE.md) for custom adapters.

---

## Surprise Detection

Controls what gets stored as a memory.

### `surpriseThreshold`

Minimum novelty score to store a memory (0-1).

```typescript
const mem = new Engram({
  llm,
  surpriseThreshold: 0.15, // Default
});
```

**Values:**
- `0.0` - Store everything (no filtering)
- `0.15` - Balanced (default)
- `0.3` - More selective (fewer memories)
- `0.5` - Very selective (only highly novel)
- `1.0` - Store nothing (max selectivity)

**How it works:**

Surprise is calculated from:
1. **Semantic novelty** (if embeddings available) - How different from existing memories
2. **Keyword novelty** (always) - Jaccard similarity of words
3. **Category rarity** - How rare this category is

**With embeddings:**
```
surprise = 0.6 × semantic + 0.3 × keyword + 0.1 × rarity
```

**Without embeddings:**
```
surprise = 0.8 × keyword + 0.2 × rarity
```

**Example tuning:**

```typescript
// Chatbot (store most things)
surpriseThreshold: 0.1

// Knowledge base (store only novel info)
surpriseThreshold: 0.3

// Research assistant (store only critical insights)
surpriseThreshold: 0.5
```

---

## Memory Decay

Controls how memories fade over time.

### `decayHalfLifeDays`

Number of days for importance to decay by 50%.

```typescript
const mem = new Engram({
  llm,
  decayHalfLifeDays: 30, // Default
});
```

**Values:**
- `7` - Fast decay (short-term memory)
- `30` - Balanced (default)
- `90` - Slow decay (long-term memory)
- `365` - Very slow decay (permanent-ish)

**Formula:**
```
decayed_importance = importance × e^(-λ × age_days)

where λ = ln(2) / decayHalfLifeDays
```

**Access boost:**
Frequently accessed memories decay slower:
```
access_boost = 1 + log2(1 + access_count) × 0.1
```

**Example:**
```typescript
// 0 accesses → 1.0x (normal decay)
// 1 access   → 1.1x (10% slower decay)
// 10 accesses → 1.35x (35% slower decay)
// 100 accesses → 1.67x (67% slower decay)
```

**Example tuning:**

```typescript
// Personal assistant (remember recent context)
decayHalfLifeDays: 7

// Customer support (balance recent + history)
decayHalfLifeDays: 30

// Knowledge base (long-term storage)
decayHalfLifeDays: 365
```

---

### `maxRetentionDays`

Maximum age before automatic deletion.

```typescript
const mem = new Engram({
  llm,
  maxRetentionDays: 90, // Default
});
```

**Values:**
- `30` - Short-term memory
- `90` - Balanced (default)
- `180` - Medium-term
- `365` - Long-term
- `null` - Never auto-delete

Memories older than this are pruned by `forget()`, regardless of importance.

---

## Retrieval Configuration

### `defaultK`

Default number of memories to recall.

```typescript
const mem = new Engram({
  llm,
  defaultK: 5, // Default
});
```

Can be overridden per query:
```typescript
await mem.recall('query', { k: 10 });
```

---

### `retrievalWeights`

Customize how memories are ranked.

```typescript
const mem = new Engram({
  llm,
  retrievalWeights: {
    relevance: 0.5,        // Default
    importance: 0.3,       // Default
    recency: 0.2,          // Default
    accessFrequency: 0.0,  // Default
  },
});
```

**Components:**

1. **Relevance** - How well the query matches the memory
   - Cosine similarity (with embeddings)
   - Jaccard similarity (without embeddings)

2. **Importance** - Base importance × decay
   - Includes time decay
   - Includes access boost

3. **Recency** - How recently created
   - Linear decay from creation date
   - Recent = higher score

4. **Access Frequency** - How often recalled
   - Normalized: `min(accessCount / 100, 1.0)`
   - Popular memories rank higher

**Ranking formula:**
```
score = w_rel × relevance + w_imp × importance + w_rec × recency + w_freq × accessFreq
```

**Preset configurations:**

```typescript
// Tech support (prioritize exact matches)
retrievalWeights: {
  relevance: 0.8,
  importance: 0.1,
  recency: 0.1,
  accessFrequency: 0.0,
}

// Personal assistant (prioritize recent context)
retrievalWeights: {
  relevance: 0.3,
  importance: 0.2,
  recency: 0.5,
  accessFrequency: 0.0,
}

// Knowledge base (prioritize importance)
retrievalWeights: {
  relevance: 0.4,
  importance: 0.5,
  recency: 0.1,
  accessFrequency: 0.0,
}

// FAQ bot (prioritize frequently asked)
retrievalWeights: {
  relevance: 0.4,
  importance: 0.1,
  recency: 0.1,
  accessFrequency: 0.4,
}
```

---

## Resource Limits

### `maxMemories`

Hard limit on total memories stored.

```typescript
const mem = new Engram({
  llm,
  maxMemories: 10000, // Default
});
```

When limit is reached, lowest-importance memories are pruned automatically.

**Values:**
- `1000` - Small (personal assistant)
- `10000` - Medium (default)
- `100000` - Large (knowledge base)
- `null` - No limit (use with caution)

---

## Namespace

Isolate memory pools (multi-user, multi-agent).

```typescript
const aliceMemory = new Engram({
  llm,
  namespace: 'user_alice',
});

const bobMemory = new Engram({
  llm,
  namespace: 'user_bob',
});
```

**Use cases:**
- Multi-user systems
- Multiple agents
- Testing isolation
- Environment separation (dev/prod)

---

## Complete Example

```typescript
import { Engram, SqliteStore } from 'simple-engram';
import OpenAI from 'openai';

const client = new OpenAI();

const mem = new Engram({
  // Core
  llm: async (prompt) => {
    const response = await client.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
    });
    return response.choices[0].message.content;
  },

  embed: async (text) => {
    const response = await client.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    return response.data[0].embedding;
  },

  // Storage
  store: new SqliteStore({ path: './memories.db' }),

  // Surprise detection
  surpriseThreshold: 0.2,

  // Memory decay
  decayHalfLifeDays: 30,
  maxRetentionDays: 90,

  // Retrieval
  defaultK: 5,
  retrievalWeights: {
    relevance: 0.5,
    importance: 0.3,
    recency: 0.2,
    accessFrequency: 0.0,
  },

  // Limits
  maxMemories: 10000,

  // Isolation
  namespace: 'user_123',
});
```

---

## Tuning Guide

### For Different Use Cases

**Chatbot (short conversations):**
```typescript
{
  surpriseThreshold: 0.1,      // Store most things
  decayHalfLifeDays: 7,        // Short-term memory
  maxRetentionDays: 30,        // Quick cleanup
  retrievalWeights: {
    relevance: 0.3,
    importance: 0.2,
    recency: 0.5,              // Prioritize recent
  },
}
```

**Knowledge Base (long-term storage):**
```typescript
{
  surpriseThreshold: 0.3,      // Only novel info
  decayHalfLifeDays: 365,      // Slow decay
  maxRetentionDays: null,      // Never expire
  retrievalWeights: {
    relevance: 0.4,
    importance: 0.5,           // Prioritize important
    recency: 0.1,
  },
}
```

**Customer Support (balance history + context):**
```typescript
{
  surpriseThreshold: 0.15,     // Balanced
  decayHalfLifeDays: 30,       // Medium decay
  maxRetentionDays: 180,       // Keep for 6 months
  retrievalWeights: {
    relevance: 0.5,
    importance: 0.2,
    recency: 0.2,
    accessFrequency: 0.1,      // Boost common issues
  },
}
```

---

## Performance Tuning

### Memory Usage

**Reduce memory footprint:**
```typescript
{
  maxMemories: 1000,           // Limit total memories
  store: new SqliteStore(),    // Use disk storage
  embed: undefined,            // Skip embeddings (6.4KB each)
}
```

### Speed

**Optimize for speed:**
```typescript
{
  store: new MemoryStore(),    // In-memory (fastest)
  defaultK: 3,                 // Return fewer results
  retrievalWeights: {
    relevance: 1.0,            // Only relevance (skip complex scoring)
    importance: 0.0,
    recency: 0.0,
    accessFrequency: 0.0,
  },
}
```

### Accuracy

**Optimize for accuracy:**
```typescript
{
  embed: embedFunction,        // Enable semantic search
  surpriseThreshold: 0.3,      // More selective storage
  retrievalWeights: {
    relevance: 0.7,            // Prioritize relevance
    importance: 0.2,
    recency: 0.1,
  },
}
```

---

## See Also

- [API Reference](./API.md) - Method documentation
- [Storage Guide](./STORAGE.md) - Storage adapters
- [How It Works](./HOW_IT_WORKS.md) - Algorithm details
- [Examples](./EXAMPLES.md) - Real-world configurations
