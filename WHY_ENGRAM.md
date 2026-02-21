# Why Use Simple Engram? 🤔

## The Problem Simple Engram Solves

### Without Simple Engram:
You're building an AI agent or chatbot and you face these challenges:

```typescript
// ❌ Your agent has amnesia
const response = await llm("What's my favorite programming language?");
// → "I don't have access to your previous conversations"

// ❌ You're manually tracking context
let userPreferences = {
  language: "TypeScript",
  deployment: "vercel",
  framework: "Next.js"
};
// → Hardcoded, doesn't scale, no automatic extraction

// ❌ You're building your own memory system
// → Weeks of development for:
//    - Duplicate detection
//    - Time decay
//    - Relevance ranking
//    - Storage management
//    - Export/import
//    - Context injection
```

### With Simple Engram:
```typescript
// ✅ Your agent remembers everything
import { Engram } from 'simple-engram';

const mem = new Engram({ llm });

// Automatic memory extraction
await mem.remember(conversationHistory);
// → Extracts: "User prefers TypeScript", "Deploys with vercel", etc.

// Intelligent recall
const context = await mem.context("user's tech stack");
// → Returns relevant memories formatted for your prompt

// That's it! Your agent now has long-term memory.
```

---

## 10 Reasons to Use Simple Engram

### 1. **Plug-and-Play** 🔌
```typescript
npm install simple-engram

const mem = new Engram({ llm });
await mem.remember(messages);
// Done! Your agent has memory.
```
**No setup, no configuration, no infrastructure.** Just works.

---

### 2. **Zero Dependencies** 🪶
```typescript
// Works immediately with:
npm install simple-engram  // That's it!

// No need to install:
// ❌ Vector databases (Pinecone, Weaviate, etc.)
// ❌ Redis or caching layer
// ❌ PostgreSQL or other DB
// ❌ Embeddings libraries

// Everything works out of the box!
```

---

### 3. **Bring Your Own LLM** 🤖
Works with **any LLM**:

```typescript
// OpenAI
const mem = new Engram({
  llm: async (prompt) => openai.chat.completions.create(...)
});

// Anthropic Claude
const mem = new Engram({
  llm: async (prompt) => anthropic.messages.create(...)
});

// Local models (Ollama, LM Studio)
const mem = new Engram({
  llm: async (prompt) => ollama.generate({ model: 'llama3.2', prompt })
});

// Any LLM API!
```

**Not locked into any provider.** Use what you already have.

---

### 4. **Smart Memory Extraction** 🧠
```typescript
// Conversation:
const messages = [
  { role: 'user', content: 'I prefer TypeScript over JavaScript' },
  { role: 'user', content: 'I usually deploy to Vercel' },
  { role: 'user', content: "Today's weather is nice" }, // Not memorable
];

await mem.remember(messages);

// Automatically extracts:
// ✅ "User prefers TypeScript" [preference, importance: 0.85]
// ✅ "User deploys to Vercel" [skill, importance: 0.78]
// ❌ Skips irrelevant info (weather)
```

**Your LLM decides what's worth remembering.** No manual tagging.

---

### 5. **Intelligent Recall** 🎯
```typescript
// Find relevant memories automatically
const memories = await mem.recall("user's tech preferences");

// With embeddings (optional):
// → Semantic search: "tech preferences" finds "prefers TypeScript"
// → Even with typos: "typescrip" still works

// Without embeddings:
// → Keyword search: Still works great for exact matches

// Ranking by:
// - Relevance to query
// - Importance score
// - Recency
// - Access frequency
```

**Finds what you need, when you need it.**

---

### 6. **Automatic Deduplication** 🔄
```typescript
await mem.store("User prefers TypeScript");
await mem.store("User likes TypeScript"); // Similar!

await mem.merge();
// → Consolidates duplicates automatically
// → Keeps higher importance version
// → Tracks merge history

// No more:
// - "User prefers TypeScript"
// - "User likes TypeScript"
// - "User prefers TS"
// - "User enjoys TypeScript"
```

**Keeps your memory clean without manual effort.**

---

### 7. **Time Decay** ⏰
```typescript
// Old memories naturally fade
const mem = new Engram({
  llm,
  decayHalfLife: 30, // 30 days
});

// Memory from 60 days ago: importance × 0.25
// Memory from 30 days ago: importance × 0.5
// Memory from yesterday: importance × ~1.0

// Frequently accessed memories decay slower!
// → Accessed 10× = stays relevant longer
```

**Mimics human memory.** Old, unused facts fade away.

---

### 8. **Context Injection Made Easy** 💬
```typescript
// Format memories for any LLM
const context = await mem.context("user preferences", {
  format: 'bullets',    // or 'prose', 'xml', 'json'
  maxTokens: 500,       // Fits in your token budget
});

// Add to system prompt:
const systemPrompt = `You are a helpful assistant.

${context}

Remember these details about the user.`;

// Your LLM now has relevant context automatically!
```

**No manual context management.** Works with any LLM format.

---

### 9. **Storage Flexibility** 💾
```typescript
// Start simple (zero dependencies):
const mem = new Engram({
  llm,
  store: new MemoryStore(), // In-memory
});

// Persist to file (still zero dependencies):
const mem = new Engram({
  llm,
  store: new JsonFileStore({ path: './memories.json' }),
});

// Scale to production (optional):
npm install better-sqlite3
const mem = new Engram({
  llm,
  store: new SqliteStore({ path: './simple-engram.db' }),
});
```

**Start simple, scale when needed.** No forced complexity.

---

### 10. **Export & Import** 📤
```typescript
// Export to any format
const json = await mem.export('json');
const markdown = await mem.export('md');
const csv = await mem.export('csv');

// Import from backups
await mem.import(json, 'json');

// Never locked in. Your data, your control.
```

**Full data portability.** No vendor lock-in.

---

## Real-World Use Cases

### 1. **AI Chatbot with Persistent Memory**
```typescript
async function chat(userMessage: string) {
  // 1. Recall relevant context
  const context = await mem.context(userMessage, { maxTokens: 500 });
  
  // 2. Generate response with context
  const response = await llm(`${context}\n\nUser: ${userMessage}`);
  
  // 3. Remember this conversation
  await mem.remember([
    { role: 'user', content: userMessage },
    { role: 'assistant', content: response },
  ]);
  
  return response;
}

// Your chatbot now remembers users across sessions!
```

---

### 2. **Customer Support Agent**
```typescript
// Import customer history
await mem.bootstrap(customerConversations);

// Agent recalls customer preferences automatically
const context = await mem.context(`ticket #${ticketId}`);
// → Finds: Previous issues, preferences, solutions that worked
```

---

### 3. **Personal AI Assistant**
```typescript
// Learns from your conversations
await mem.remember(dailyConversations);

// Recalls your preferences
const memories = await mem.recall("my preferences");
// → "User prefers dark mode"
// → "User works in TypeScript"
// → "User uses VSCode"

// Your AI assistant becomes personalized over time!
```

---

### 4. **Multi-User System**
```typescript
// Isolated memory per user
function getMemoryForUser(userId: string) {
  return new Engram({
    llm,
    namespace: `user_${userId}`,
    store: new SqliteStore(),
  });
}

// Alice and Bob have separate memories
const aliceMem = getMemoryForUser('alice');
const bobMem = getMemoryForUser('bob');
```

---

## Comparison with Alternatives

### vs Manual Context Management
| Feature | Manual | Simple Engram |
|---------|--------|--------|
| Setup time | Hours/days | 5 minutes |
| Duplicate handling | Manual | Automatic |
| Relevance ranking | Manual | Automatic |
| Time decay | You implement it | Built-in |
| Context formatting | You build it | 4 formats built-in |
| **Result** | **Weeks of dev** | **Works immediately** |

---

### vs Vector Databases (Pinecone, Weaviate)
| Feature | Vector DBs | Simple Engram |
|---------|-----------|--------|
| Setup | Complex | One line |
| Dependencies | Many | Zero |
| Cost | $70+/month | Free |
| Embeddings required | Yes | Optional |
| Memory extraction | Manual | Automatic |
| Time decay | Manual | Built-in |
| **Best for** | **Large scale** | **Get started quickly** |

---

### vs LangChain Memory
| Feature | LangChain | Simple Engram |
|---------|-----------|--------|
| Dependencies | Heavy | Zero |
| Setup complexity | Medium | Simple |
| LLM agnostic | No (OpenAI focused) | Yes (any LLM) |
| Storage options | Limited | 3 built-in |
| Memory merging | No | Yes |
| Surprise scoring | No | Yes |
| **Best for** | **LangChain users** | **Standalone memory** |

---

## When NOT to Use Simple Engram

### 1. You need massive scale (10M+ memories)
→ Use dedicated vector databases like Pinecone

### 2. You need real-time updates across distributed systems
→ Use Redis with pub/sub

### 3. You're already using LangChain heavily
→ LangChain's memory might integrate better

### 4. You need complex graph relationships
→ Use Neo4j or other graph databases

---

## When TO Use Simple Engram ✅

### ✅ You're building an AI agent/chatbot
### ✅ You want long-term memory without complexity
### ✅ You want to get started quickly (< 5 minutes)
### ✅ You want zero dependencies
### ✅ You want to use any LLM (not locked to OpenAI)
### ✅ You want automatic memory extraction
### ✅ You want built-in duplicate handling
### ✅ You want progressive complexity (start simple, scale later)
### ✅ You want data portability (export/import)

---

## The Bottom Line

**Simple Engram gives you production-quality memory for AI agents in 5 minutes with zero dependencies.**

```typescript
// This is all you need:
npm install simple-engram

const mem = new Engram({ llm });
await mem.remember(messages);
const context = await mem.context(query);

// Your agent now has long-term memory! 🎉
```

**No databases. No setup. No complexity. Just memory.**

---

## Try It Now

```bash
npm install simple-engram
```

Read the [README.md](./README.md) for full documentation.

Check out [ZERO_DEPS.md](./ZERO_DEPS.md) to see everything that works without dependencies.

**Start building agents that remember.** 🧠
