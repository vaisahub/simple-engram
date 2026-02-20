# ✅ Zero Dependencies Mode

**Engram works perfectly without installing better-sqlite3 or embeddings!**

## Quick Start (No Dependencies)

```typescript
import { Engram } from 'engram';

// Just your LLM - that's all you need!
const mem = new Engram({
  llm: async (prompt) => {
    // Your LLM call (OpenAI, Anthropic, local, etc.)
    return yourLLMResponse;
  },
  // No embeddings, no SQLite - it just works!
});

// All features work out of the box:
✅ mem.remember(messages)      // Extract from conversations
✅ mem.store('fact')           // Manual storage
✅ mem.recall('query')         // Keyword-based search
✅ mem.context('query')        // Format for prompts
✅ mem.merge()                 // Deduplicate (Jaccard similarity)
✅ mem.forget()                // Time-based pruning
✅ mem.export('json')          // Export data
```

## Default Storage (No Dependencies)

**In-Memory** (default):
```typescript
const mem = new Engram({ llm });
// Stores in RAM - fast, no files
```

**JSON File** (still no dependencies):
```typescript
import { JsonFileStore } from 'engram';

const mem = new Engram({
  llm,
  store: new JsonFileStore({ path: './memories.json' }),
});
// Stores in JSON file - no better-sqlite3 needed!
```

## When to Add Optional Dependencies

### Add Embeddings (Optional)
**Install:** None! Just bring your embed function
**Benefit:** 10x better semantic search
```typescript
const mem = new Engram({
  llm,
  embed: async (text) => yourEmbeddings(text),
});
```

### Add SQLite (Optional)
**Install:** `npm install better-sqlite3`
**Benefit:** Better performance with >1k memories
```typescript
import { SqliteStore } from 'engram';

const mem = new Engram({
  llm,
  store: new SqliteStore({ path: './engram.db' }),
});
```

## Feature Comparison

| Feature | Without Any Deps | With Embeddings | With SQLite |
|---------|-----------------|-----------------|-------------|
| remember() | ✅ Works | ✅ Better | ✅ Better |
| recall() | ✅ Keyword search | ✅ Semantic search | ✅ Semantic + Fast |
| merge() | ✅ Jaccard | ✅ Cosine | ✅ Cosine + Fast |
| Storage | ✅ Memory/JSON | ✅ Memory/JSON | ✅ Production DB |
| **Good for** | **Getting started** | **Production quality** | **Production scale** |

## Summary

- **Zero dependencies required** - Engram works out of the box!
- **Optional embeddings** - Add when you need better search
- **Optional SQLite** - Add when you scale beyond 1k memories
- **You choose** - Start simple, add complexity only when needed
