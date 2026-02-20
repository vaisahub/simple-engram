# Engram >�

**Plug-and-play memory engine for AI agents**  one import, any LLM, any storage, and your agent never forgets.

**Version**: 0.2.0 (Phase 2 Complete)

Engram is a type-safe, zero-infrastructure memory system that gives your AI agents long-term memory with just a few lines of code. No databases to set up, no vector stores to configure  just plug in your LLM and go.

## ( Features

- **> BYOLLM**: Bring Your Own LLM  works with OpenAI, Anthropic, local models, or any LLM
- **= Smart Extraction**: Automatically identifies what's worth remembering from conversations
- **=� Surprise-based Scoring**: Novel information gets higher importance scores
- **� Time Decay**: Older memories naturally fade (configurable)
- **=� Context Injection**: Format memories for system prompts (bullets, prose, XML, JSON)
- **<� Token Budgeting**: Automatically fits memories within token limits
- **= Memory Merging**: Consolidates duplicate/similar memories
- **=� Multiple Storage**: In-memory, JSON file, or SQLite
- **=� Export/Import**: JSON, Markdown, CSV formats
- **= Zero Dependencies**: No runtime dependencies (all optional)

## =� Installation

```bash
npm install engram
```

**That's it!** Engram has **zero runtime dependencies**. Everything works out of the box with in-memory or JSON file storage.

### Optional Add-ons

Install these **only if you need them**:

```bash
# 🗄️ For SQLite storage (only if you need production-grade persistence)
npm install better-sqlite3

# 🎯 For embeddings (only if you need better semantic search)
# Use any provider: OpenAI, Cohere, local models, etc.
# No installation needed - just bring your own embed function
```

**You can use Engram without installing any of these!** The default in-memory and JSON file storage work great for most use cases.

## =� Quick Start

```typescript
import { Engram } from 'engram';

// 1. Bring your LLM function
const llm = async (prompt: string) => {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  return (await response.json()).choices[0].message.content;
};

// 2. (Optional but recommended) Bring embeddings
const embed = async (text: string) => {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  });
  return (await response.json()).data[0].embedding;
};

// 3. Create Engram
const mem = new Engram({ llm, embed });

// 4. Use it!
const messages = [
  { role: 'user', content: 'I prefer TypeScript over JavaScript' },
  { role: 'assistant', content: "I'll remember that!" },
];

await mem.remember(messages);
// Extracted: "User prefers TypeScript over JavaScript" [preference, importance: 0.85]

const memories = await mem.recall('TypeScript');
// Returns relevant memories, ranked by importance

const context = await mem.context('coding preferences', {
  format: 'bullets',
  maxTokens: 200,
});
// Relevant memories:
// - User prefers TypeScript over JavaScript [preference]
```

## =� API Reference

### Prerequisites Summary

| Method | Requires LLM | Requires Embeddings | Notes |
|--------|--------------|---------------------|-------|
| `remember()` |  **Required** | � Optional | LLM extracts memories from conversations |
| `store()` | � Optional | � Optional | Manual storage; LLM used for surprise scoring if available |
| `recall()` | L Not needed | � Optional | **10x better with embeddings** |
| `context()` | L Not needed | � Optional | Uses `recall()` internally |
| `merge()` | L Not needed | � Optional | **Much better with embeddings** |
| `forget()` | L Not needed | L Not needed | Pure time-based pruning |
| `export()`/`import()` | L Not needed | L Not needed | Pure data operations |
| `bootstrap()` |  **Required** | � Optional | Bulk conversation import |

---

### 1. `remember()` - Extract from Conversations

**Prerequisites:**  LLM Required, � Embeddings Optional

Automatically extracts memorable information from conversations using your LLM.

```typescript
const result = await mem.remember(messages, {
  explain: true,     // Include scoring explanations
  dryRun: false,     // Actually store (vs preview)
  source: 'chat-42', // Tag with source
});

// Result:
// {
//   stored: [{ id, content, category, importance, surprise, ... }],
//   rejected: [{ content, reason: 'duplicate', ... }],
//   dryRun: false
// }
```

**What it does:**
1. Sends conversation to LLM with extraction prompt
2. LLM identifies facts, preferences, skills, etc.
3. Computes surprise score (novelty)
4. Rejects duplicates/redundant info
5. Stores unique memories

---

### 2. `store()` - Manually Store Memory

**Prerequisites:** � LLM Optional, � Embeddings Optional

Manually add a memory without LLM extraction.

```typescript
const memory = await mem.store('Deploy with vercel --prod', {
  category: 'skill',
  importance: 0.9,
  skipSurprise: false, // Compute surprise (requires LLM)
  metadata: { topic: 'deployment' },
});
```

**Use cases:**
- Import from external sources
- Store system-generated facts
- Skip LLM extraction cost

---

### 3. `recall()` - Search Memories

**Prerequisites:** L No LLM, � Embeddings Optional but **STRONGLY RECOMMENDED**

Search and retrieve relevant memories.

```typescript
const memories = await mem.recall('TypeScript projects', {
  k: 5,                          // Top 5 results
  categories: ['skill', 'fact'], // Filter categories
  explain: true,                 // Get ranking explanation
});

// With embeddings: 60% semantic + 30% keyword + 10% importance/recency
// Without: 80% keyword + 20% importance/recency
```

**� Performance comparison:**

| Scenario | With Embeddings | Without Embeddings |
|----------|----------------|-------------------|
| Semantic queries ("how to deploy?") |  Excellent | � Limited |
| Keyword queries ("vercel deployment") |  Excellent |  Good |
| Typos/variations |  Handles well | L Struggles |
| **Recommendation** | **Use in production** | **Dev/testing only** |

---

### 4. `context()` - Format for System Prompts

**Prerequisites:** L No LLM, � Embeddings Optional

Format memories for injection into system prompts.

```typescript
// Bullets (default)
const context = await mem.context('user preferences', {
  format: 'bullets',
  maxTokens: 200,
});
// Relevant memories:
// - User prefers TypeScript [preference]
// - Deploy with vercel --prod [skill]

// Prose
const prose = await mem.context('preferences', { format: 'prose' });
// "Based on previous interactions: User prefers TypeScript, ..."

// XML (for Claude)
const xml = await mem.context('tech stack', {
  format: 'xml',
  includeMetadata: true
});
// <memories>
//   <memory category="preference" age="2d ago" importance="0.85">
//     User prefers TypeScript
//   </memory>
// </memories>

// JSON
const json = await mem.context('skills', { format: 'json' });
// [{"content": "...", "category": "skill", ...}]
```

**Token Budgeting:**

Automatically fits memories within token limits using greedy importance-based selection.

```typescript
const context = await mem.context('query', {
  maxTokens: 500,  // Limit to 500 tokens
  // Selects highest importance memories that fit
});
```

---

### 5. `merge()` - Consolidate Duplicates

**Prerequisites:** L No LLM, � Embeddings Optional but **HIGHLY RECOMMENDED**

Consolidates near-duplicate memories.

```typescript
const result = await mem.merge({
  similarityThreshold: 0.85,  // 0-1 scale (default: 0.85)
  dryRun: false,              // Preview without changes
  explain: true,              // Get merge details
});

// Result:
// {
//   merged: 3,      // Duplicates removed
//   remaining: 17,  // Memories left
//   dryRun: false,
//   details: [
//     {
//       kept: { id, content, importance: 0.9 },
//       absorbed: { id, content, importance: 0.6 },
//       similarity: 0.92,
//       reason: "absorbed has lower importance..."
//     }
//   ]
// }
```

**How similarity works:**
- **With embeddings**: Cosine similarity on vectors (catches semantic similarity)
- **Without embeddings**: Jaccard similarity on keywords (only keyword overlap)

**� Recommendation:** Use embeddings for accurate duplicate detection.

---

### 6. `forget()` - Prune Old Memories

**Prerequisites:** L No LLM, L No Embeddings

Prunes old/unimportant memories using time decay.

```typescript
const result = await mem.forget({
  mode: 'normal',  // 'conservative' | 'normal' | 'aggressive'
  dryRun: false,
});

// Result: { pruned: 5, remaining: 20 }
```

**Decay formula:** `importance � e^(-� � age_days) � access_boost`

**Modes:**
- `conservative`: Keeps memories longer (threshold: 0.10, half-life: 45 days)
- `normal`: Balanced (threshold: 0.20, half-life: 30 days) - **default**
- `aggressive`: Prunes aggressively (threshold: 0.35, half-life: 20 days)

---

### 7. `export()` / `import()` - Data Portability

**Prerequisites:** L No LLM, L No Embeddings

Export and import memories in multiple formats.

```typescript
// Export
const json = await mem.export('json');  // Machine-readable
const md = await mem.export('md');      // Human-readable
const csv = await mem.export('csv');    // Spreadsheet

// Import
const count = await mem.import(json, 'json', {
  onConflict: 'skip',  // 'skip' | 'overwrite' | 'merge'
});
```

---

### 8. `bootstrap()` - Bulk Import

**Prerequisites:**  LLM Required, � Embeddings Optional

Bulk import conversations with progress tracking.

```typescript
const conversations = [
  {
    messages: [
      { role: 'user', content: 'I love TypeScript' },
      { role: 'assistant', content: 'Great choice!' },
    ],
    source: 'session-001',
  },
  // ...
];

const result = await mem.bootstrap(conversations, {
  batchSize: 5,        // Process 5 at a time
  delayMs: 500,        // Delay between batches
  onProgress: (p) => {
    console.log(`${p.completed}/${p.total} processed`);
  },
});
```

---

## =� Storage Options

### In-Memory (Default)

**Prerequisites:** None

```typescript
import { Engram, MemoryStore } from 'engram';

const mem = new Engram({
  llm,
  store: new MemoryStore(),  // or omit (default)
});
```

**Use case:** Development, testing, temporary sessions

---

### JSON File Storage

**Prerequisites:** None (Node.js fs built-in)

```typescript
import { Engram, JsonFileStore } from 'engram';

const mem = new Engram({
  llm,
  store: new JsonFileStore({
    path: './memories.json',  // Default: './engram.json'
    pretty: true,             // Pretty-print (default: true)
  }),
});
```

**Features:**
-  Atomic writes (no corruption)
-  Auto-recovery
-  Human-readable

**Use case:** Simple persistence, <10k memories

---

### SQLite Storage (Phase 2)

**Prerequisites:**  `npm install better-sqlite3`

```typescript
import { Engram, SqliteStore } from 'engram';

const mem = new Engram({
  llm,
  embed,
  store: new SqliteStore({
    path: './engram.db',     // Default: './engram.db'
    wal: true,               // WAL mode (default: true)
    memory: false,           // In-memory DB (default: false)
  }),
});

// Additional utilities
const store = mem.storeAdapter as SqliteStore;
store.vacuum();                    // Reclaim space
const stats = store.stats();       // Get DB stats
await store.close();               // Close connection
```

**Features:**
-  Fast queries with indices
-  ACID compliance
-  Efficient BLOB storage for embeddings
-  Transaction support

**Use case:** Production, >1k memories

**Performance:**

| Operation | MemoryStore | JsonFileStore | SqliteStore |
|-----------|-------------|---------------|-------------|
| Read | 0.001ms | 10-50ms | 0.1ms |
| Write | 0.001ms | 10-50ms | 0.5ms |
| Search (100 items) | 1ms | 10-50ms | 2ms |
| **Best for** | **Testing** | **Simple apps** | **Production** |

---

## � Configuration

```typescript
const mem = new Engram({
  //  Core Functions 
  llm?: LLMFunction,              // Your LLM (required for remember/bootstrap)
  embed?: EmbedFunction,          // Your embeddings (optional but recommended)
  store?: StoreAdapter,           // Storage (default: MemoryStore)

  //  Memory Settings 
  namespace?: string,             // Isolate memories (default: 'default')
  categories?: string[],          // Custom categories

  //  Scoring & Decay 
  decayHalfLife?: number,         // Days until importance halves (default: 30)
  minImportance?: number,         // Minimum to store (default: 0.01)
  redundancyThreshold?: number,   // Similarity = duplicate (default: 0.90)

  //  History & Versioning 
  trackHistory?: boolean,         // Track changes (default: true)
  maxHistoryPerMemory?: number,   // Max history entries (default: 10)

  //  Advanced 
  hooks?: {
    beforeStore?: (memory) => memory | null,
    afterStore?: (memory) => void,
    // ... more hooks
  },
});
```

---

## <� Common Use Cases

### 1. Chatbot with Memory

```typescript
async function chat(userMessage: string) {
  // 1. Recall relevant context
  const context = await mem.context(userMessage, {
    format: 'bullets',
    maxTokens: 500,
  });

  // 2. Add to system prompt
  const systemPrompt = `You are a helpful assistant.\n\n${context}\n\nRemember these details.`;

  // 3. Generate response
  const response = await llm(`${systemPrompt}\n\nUser: ${userMessage}`);

  // 4. Extract memories
  await mem.remember([
    { role: 'user', content: userMessage },
    { role: 'assistant', content: response },
  ]);

  return response;
}
```

### 2. Import Chat History

```typescript
const conversations = await loadChatHistory();

await mem.bootstrap(conversations, {
  batchSize: 10,
  onProgress: (p) => console.log(`${p.completed}/${p.total}`),
});

// Merge duplicates
await mem.merge({ similarityThreshold: 0.85 });
```

### 3. Multi-User System

```typescript
function getMemoryForUser(userId: string) {
  return new Engram({
    llm,
    embed,
    namespace: `user_${userId}`,
    store: new SqliteStore({ path: './users.db' }),
  });
}

const aliceMem = getMemoryForUser('alice');
const bobMem = getMemoryForUser('bob');
// Completely isolated
```

### 4. Periodic Maintenance

```typescript
async function dailyMaintenance() {
  // 1. Merge duplicates
  const merged = await mem.merge({ similarityThreshold: 0.85 });
  console.log(`Merged ${merged.merged} duplicates`);

  // 2. Prune old memories
  const pruned = await mem.forget({ mode: 'normal' });
  console.log(`Pruned ${pruned.pruned} old memories`);

  // 3. Backup
  const backup = await mem.export('json');
  await fs.writeFile('./backup.json', backup);

  // 4. Stats
  const stats = await mem.stats();
  console.log(`Total: ${stats.totalMemories}`);
}
```

---

## =' Troubleshooting

### "NoLLMError: LLM function not configured"

**Cause:** Calling `remember()` or `bootstrap()` without LLM

**Solution:** Add LLM function to config

### "StoreError: better-sqlite3 not installed"

**Cause:** Using `SqliteStore` without dependency

**Solution:** `npm install better-sqlite3`

### Memories not recalled correctly

**Symptom:** `recall()` returns irrelevant results

**Solutions:**
1. **Add embeddings** (most important) - improves recall by 10x
2. Lower `k` parameter: `recall('query', { k: 3 })`
3. Filter by category: `recall('query', { categories: ['skill'] })`

### Too many duplicates

**Symptom:** Similar memories keep getting stored

**Solutions:**
1. Add embeddings for better duplicate detection
2. Run `merge()` periodically: `await mem.merge({ similarityThreshold: 0.80 })`
3. Increase redundancy threshold in config

### Memory growing too large

**Symptom:** Too many memories, slow performance

**Solutions:**
1. Run `forget()` more aggressively: `await mem.forget({ mode: 'aggressive' })`
2. Adjust decay: `new Engram({ llm, decayHalfLife: 14 })`
3. Use SQLite for large datasets: `store: new SqliteStore()`

---

## =� Best Practices

###  DO

- **Use embeddings** for production (10x better recall)
- **Run merge()** periodically (weekly/monthly)
- **Run forget()** to prune (daily/weekly)
- **Use SQLite** for >1000 memories
- **Set source/metadata** to track origins
- **Use namespaces** for multi-user systems
- **Export backups** regularly

### L DON'T

- **Don't skip embeddings** in production
- **Don't store sensitive data** without encryption
- **Don't use in-memory** for production
- **Don't set decayHalfLife** too low (<7 days)
- **Don't forget to close** SqliteStore on shutdown

---

## =� Performance Tips

1. **Batch operations:** Use `bootstrap()` or `putMany()` instead of individual `store()` calls
2. **Use appropriate storage:** In-memory for dev, SQLite for production >1k memories
3. **Limit recall results:** `recall('query', { k: 3 })` instead of default 10
4. **Use token budgeting:** `context('query', { maxTokens: 500 })`

---

## =� License

MIT � 2024

---

## > Contributing

Contributions welcome! Please read CONTRIBUTING.md first.

---

**Built with d for the AI agent community**
