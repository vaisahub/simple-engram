# API Reference

Complete documentation for all Engram methods and options.

## Constructor

### `new Engram(config)`

Creates a new Engram memory engine instance.

```typescript
import { Engram } from 'simple-engram';

const mem = new Engram({
  llm,                           // Required: Your LLM function
  embed,                         // Optional: Embedding function
  store,                         // Optional: Storage adapter
  surpriseThreshold,             // Optional: Novelty threshold
  decayHalfLifeDays,            // Optional: Memory decay rate
  maxRetentionDays,             // Optional: Max age before deletion
  defaultK,                     // Optional: Default recall count
  retrievalWeights,             // Optional: Ranking weights
  maxMemories,                  // Optional: Hard memory limit
  namespace,                    // Optional: Isolate memory pools
});
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `llm` | `(prompt: string) => Promise<string>` | **Required** | Your LLM function that takes a prompt and returns a response |
| `embed` | `(text: string) => Promise<number[]>` | `undefined` | Optional embedding function for semantic search |
| `store` | `Store` | `MemoryStore` | Storage adapter (in-memory, SQLite, or custom) |
| `surpriseThreshold` | `number` | `0.15` | Novelty threshold (0-1, lower = more selective) |
| `decayHalfLifeDays` | `number` | `30` | Half-life for importance decay in days |
| `maxRetentionDays` | `number` | `90` | Maximum age before auto-deletion |
| `defaultK` | `number` | `5` | Default number of memories to recall |
| `retrievalWeights` | `object` | See below | Customize ranking weights |
| `maxMemories` | `number` | `10000` | Hard limit on memory count |
| `namespace` | `string` | `undefined` | Namespace for isolating memory pools |

**Retrieval Weights:**

```typescript
retrievalWeights: {
  relevance: 0.5,        // How well query matches content (0-1)
  importance: 0.3,       // Base importance with decay (0-1)
  recency: 0.2,          // How recent the memory is (0-1)
  accessFrequency: 0.0,  // How often accessed (0-1)
}
```

---

## Core Methods

### `remember(messages, options?)`

Extract and store memories from conversations using your LLM.

```typescript
await mem.remember(
  [
    { role: 'user', content: 'I prefer TypeScript over JavaScript' },
    { role: 'assistant', content: "I'll remember that!" }
  ],
  {
    importance: 0.8,           // Optional: Override importance
    category: 'preference',    // Optional: Override category
    explain: false,            // Optional: Get extraction explanation
  }
);
```

**Parameters:**

- `messages`: `Array<{role: string, content: string}>` - Conversation messages
- `options.importance`: `number` - Override importance (0-1)
- `options.category`: `string` - Override category
- `options.explain`: `boolean` - Return extraction explanation

**Returns:** `Promise<Memory[]>` - Array of stored memories

**Requires:** LLM function

---

### `store(content, options?)`

Manually store a memory without LLM extraction.

```typescript
await mem.store('User lives in San Francisco', {
  category: 'fact',
  importance: 0.9,
  expiresAt: Date.now() + 86400000, // 24 hours
});
```

**Parameters:**

- `content`: `string` - Memory content to store
- `options.category`: `string` - Memory category (fact, preference, skill, episode, context)
- `options.importance`: `number` - Importance score (0-1)
- `options.expiresAt`: `number` - Expiration timestamp (ms)

**Returns:** `Promise<Memory>` - The stored memory

**Requires:** Nothing (always works)

---

### `recall(query, options?)`

Find relevant memories by query.

```typescript
const memories = await mem.recall('user location', {
  k: 5,                           // Number of results
  categories: ['fact', 'preference'],  // Filter by categories
  minImportance: 0.5,            // Minimum importance threshold
  explain: true,                 // Include ranking explanation
});
```

**Parameters:**

- `query`: `string` - Search query
- `options.k`: `number` - Number of results to return (default: 5)
- `options.categories`: `string[]` - Filter by categories
- `options.minImportance`: `number` - Minimum importance threshold (0-1)
- `options.explain`: `boolean` - Include ranking explanation

**Returns:** `Promise<Memory[]>` - Ranked array of memories

**Better with:** Embeddings (enables semantic search)

---

### `context(query, options?)`

Format memories for system prompts.

```typescript
const context = await mem.context('user preferences', {
  format: 'bullets',    // 'bullets', 'prose', 'xml', 'json'
  maxTokens: 300,       // Token limit (approximate)
  k: 5,                 // Number of memories
  categories: ['preference', 'fact'],
});

const systemPrompt = `You are a helpful assistant.\n\n${context}`;
```

**Parameters:**

- `query`: `string` - Search query
- `options.format`: `'bullets' | 'prose' | 'xml' | 'json'` - Output format
- `options.maxTokens`: `number` - Approximate token limit
- `options.k`: `number` - Number of memories
- `options.categories`: `string[]` - Filter by categories

**Returns:** `Promise<string>` - Formatted context string

**Formats:**

- `bullets`: Bullet points with categories (default)
  ```
  Relevant memories:
  - User prefers TypeScript over JavaScript [preference]
  - User lives in San Francisco [fact]
  ```

- `prose`: Natural paragraphs
  ```
  Relevant memories: User prefers TypeScript over JavaScript. User lives in San Francisco.
  ```

- `xml`: XML tags (best for Claude)
  ```xml
  <memories>
    <memory category="preference">User prefers TypeScript over JavaScript</memory>
    <memory category="fact">User lives in San Francisco</memory>
  </memories>
  ```

- `json`: JSON array
  ```json
  [
    {"content": "User prefers TypeScript over JavaScript", "category": "preference"},
    {"content": "User lives in San Francisco", "category": "fact"}
  ]
  ```

---

### `merge(options?)`

Consolidate duplicate or similar memories.

```typescript
await mem.merge({
  similarityThreshold: 0.85,  // Similarity threshold (0-1)
  dryRun: true,              // Preview without merging
  explain: true,             // Get merge explanations
});
```

**Parameters:**

- `options.similarityThreshold`: `number` - Threshold for merging (default: 0.85)
- `options.dryRun`: `boolean` - Preview merges without applying
- `options.explain`: `boolean` - Return merge explanations

**Returns:** `Promise<{merged: number, kept: number}>` - Merge statistics

**How it works:**

1. Compares all memories pairwise
2. Finds pairs with similarity > threshold
3. Keeps higher importance version
4. Tracks merge history in metadata

---

### `forget(options?)`

Remove old or low-importance memories.

```typescript
await mem.forget({
  mode: 'normal',      // 'gentle', 'normal', 'aggressive'
  maxAge: 90,          // Maximum age in days
  minImportance: 0.1,  // Minimum importance threshold
  dryRun: true,        // Preview without deleting
});
```

**Parameters:**

- `options.mode`: `'gentle' | 'normal' | 'aggressive'` - Pruning strategy
- `options.maxAge`: `number` - Max age in days (overrides config)
- `options.minImportance`: `number` - Min importance threshold
- `options.dryRun`: `boolean` - Preview without deleting

**Returns:** `Promise<{pruned: number, kept: number}>` - Pruning statistics

**Pruning Modes:**

- **gentle**: Only removes expired memories
- **normal**: Removes expired + decayed importance < 0.01
- **aggressive**: Removes expired + decayed + bottom 10% by importance

---

## Utility Methods

### `stats()`

Get memory statistics.

```typescript
const stats = await mem.stats();
console.log(stats);
// {
//   total: 42,
//   byCategory: { fact: 20, preference: 15, skill: 7 },
//   avgImportance: 0.72,
//   oldest: 1234567890,
//   newest: 1234567899,
// }
```

**Returns:** `Promise<MemoryStats>` - Memory statistics object

---

### `export(format)`

Export all memories for backup.

```typescript
const json = await mem.export('json');
const markdown = await mem.export('md');
const csv = await mem.export('csv');

// Save to file
await fs.writeFile('backup.json', json);
```

**Parameters:**

- `format`: `'json' | 'md' | 'csv'` - Export format

**Returns:** `Promise<string>` - Serialized memories

---

### `import(data, format)`

Import memories from backup.

```typescript
const json = await fs.readFile('backup.json', 'utf-8');
await mem.import(json, 'json');
```

**Parameters:**

- `data`: `string` - Serialized memories
- `format`: `'json' | 'md' | 'csv'` - Import format

**Returns:** `Promise<{imported: number, skipped: number}>` - Import statistics

---

### `clear()`

Delete all memories (irreversible).

```typescript
await mem.clear();
```

**Returns:** `Promise<void>`

---

## Memory Object

All methods that return memories use this structure:

```typescript
interface Memory {
  id: string;               // Unique identifier
  content: string;          // Memory content
  category: string;         // Category (fact, preference, skill, episode, context)
  importance: number;       // Importance score (0-1)
  createdAt: number;        // Creation timestamp (ms)
  accessedAt: number;       // Last access timestamp (ms)
  accessCount: number;      // Number of times accessed
  expiresAt: number | null; // Expiration timestamp (ms) or null
  embedding?: number[];     // Embedding vector (if using embeddings)
  metadata?: Record<string, unknown>; // Additional metadata
}
```

---

## Events & Hooks

### Events

Listen to memory events:

```typescript
mem.on('stored', (memory: Memory) => {
  console.log('Stored:', memory.content);
});

mem.on('recalled', (memories: Memory[]) => {
  console.log('Recalled:', memories.length);
});

mem.on('merged', (result: {merged: number, kept: number}) => {
  console.log('Merged:', result.merged);
});

mem.on('pruned', (result: {pruned: number, kept: number}) => {
  console.log('Pruned:', result.pruned);
});
```

### Hooks

Modify behavior before/after operations:

```typescript
// Before storing
mem.hooks.beforeStore = async (memory: Memory) => {
  // Modify or reject memories
  if (memory.content.includes('secret')) {
    throw new Error('No secrets allowed!');
  }
  return memory;
};

// After storing
mem.hooks.afterStore = async (memory: Memory) => {
  console.log('Stored:', memory.id);
};

// Before recall
mem.hooks.beforeRecall = async (query: string) => {
  console.log('Recalling:', query);
  return query;
};

// After recall
mem.hooks.afterRecall = async (memories: Memory[]) => {
  // Filter or modify results
  return memories.filter(m => m.importance > 0.5);
};
```

---

## Type Definitions

```typescript
import type {
  Engram,
  EngramConfig,
  Memory,
  MemoryCandidate,
  RecallOptions,
  ContextOptions,
  MergeOptions,
  ForgetOptions,
  MemoryStats,
  Store,
  LLMFunction,
  EmbedFunction,
} from 'simple-engram';
```

---

## Error Handling

All async methods can throw errors. Wrap in try-catch:

```typescript
try {
  await mem.remember(messages);
} catch (error) {
  if (error.message.includes('LLM')) {
    console.error('LLM error:', error);
  } else if (error.message.includes('storage')) {
    console.error('Storage error:', error);
  } else {
    throw error;
  }
}
```

Common errors:

- `LLM function required` - No LLM provided
- `Invalid importance` - Importance not in 0-1 range
- `Storage error` - Database/file error
- `Invalid format` - Unknown export/import format

---

## See Also

- [Configuration Guide](./CONFIGURATION.md) - Deep dive into all options
- [Storage Adapters](./STORAGE.md) - Storage backends
- [Examples](./EXAMPLES.md) - Real-world use cases
- [How It Works](./HOW_IT_WORKS.md) - Algorithm details
