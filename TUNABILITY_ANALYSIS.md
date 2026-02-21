# Tunability Analysis: Do We Need Advanced Configuration?

## Current State Analysis

### What's Already Configurable:

```typescript
const mem = new Engram({
  llm,                    // ✅ Fully customizable
  embed,                  // ✅ Fully customizable
  categories,             // ✅ Customizable
  decayRate,              // ✅ Configurable
  decayHalfLife,          // ✅ Configurable
  maxMemories,            // ✅ Configurable
  defaultK,               // ✅ Configurable
  autoMerge,              // ✅ Configurable
  similarityThreshold,    // ✅ Configurable
  store,                  // ✅ Fully customizable
  namespace,              // ✅ Configurable
});
```

### Current Retrieval Scoring (retriever.ts:42):
```typescript
return 0.5 * relevance + 0.3 * importance + 0.2 * recency;
```
**Fixed weights** - no tunability

---

## Proposed Features Analysis

### 1. **Embedding Techniques Tuning** ❓

#### What would this include?
```typescript
embed: {
  function: embedFn,
  batchSize: 10,           // Batch embeddings
  cacheResults: true,      // Cache embeddings
  normalizeVectors: true,  // L2 normalization
  dimensions: 1536,        // Dimensionality
  model: 'text-embedding-3-small'
}
```

#### Reality Check:
- **Embedding function already fully customizable** ✅
- Developers can implement their own batching
- Normalization happens in their embed function
- Cache can be implemented externally

#### Verdict: **NOT NEEDED** ❌
**Why:** Embedding is just a function. Developers have full control already. Adding config would be overengineering.

**Current approach is better:**
```typescript
// Developers can do whatever they want:
const mem = new Engram({
  embed: async (text) => {
    // Their own batching
    // Their own caching
    // Their own normalization
    return customEmbedPipeline(text);
  }
});
```

---

### 2. **Chunking Strategies** ❓

#### What would this include?
```typescript
chunking: {
  strategy: 'sentence' | 'paragraph' | 'semantic',
  maxChunkSize: 500,
  overlap: 50,
  preserveBoundaries: true
}
```

#### Reality Check - When is chunking needed?
1. **Long documents** (>2000 words)
2. **Books, articles, documentation**
3. **Preprocessing before storage**

#### Current Simple Engram Usage:
```typescript
// Users send SHORT messages
await mem.remember([
  { role: 'user', content: 'I like pizza' },  // 12 chars
  { role: 'assistant', content: 'Great!' }     // 6 chars
]);
```

**Typical message length:** 50-500 characters
**When chunking is needed:** >5000 characters

#### Verdict: **MAYBE USEFUL** ⚠️
**Use cases:**
- ✅ Document ingestion (uploading PDFs, articles)
- ❌ Conversational memory (our primary use case)

**Decision:** Add as **optional separate utility**, not core feature

---

### 3. **Retrieval Tuning** ✅ **USEFUL**

#### Current Limitation (retriever.ts:42):
```typescript
// HARDCODED WEIGHTS
return 0.5 * relevance + 0.3 * importance + 0.2 * recency;
```

#### What developers might want:
```typescript
retrievalWeights: {
  relevance: 0.5,    // How well query matches
  importance: 0.3,   // How important is memory
  recency: 0.2,      // How recent is memory
  accessFrequency: 0.0  // How often accessed (currently missing!)
}
```

#### Real-World Scenarios:

**Scenario 1: Tech Support Bot**
```typescript
// Prioritize relevance over recency
retrievalWeights: {
  relevance: 0.8,    // ⬆️ Match user's question exactly
  importance: 0.1,
  recency: 0.1       // ⬇️ Old solutions still valid
}
```

**Scenario 2: Personal Assistant**
```typescript
// Prioritize recent interactions
retrievalWeights: {
  relevance: 0.3,
  importance: 0.2,
  recency: 0.5       // ⬆️ Recent context matters more
}
```

**Scenario 3: Knowledge Base**
```typescript
// Prioritize importance
retrievalWeights: {
  relevance: 0.4,
  importance: 0.5,   // ⬆️ Critical facts prioritized
  recency: 0.1
}
```

#### Verdict: **HIGHLY USEFUL** ✅

---

## Recommended Implementation Plan

### Phase 1: Retrieval Tuning (HIGH VALUE) ✅

**Add to EngramConfig:**
```typescript
interface EngramConfig {
  // ... existing config

  // NEW: Retrieval scoring weights
  retrievalWeights?: {
    relevance?: number;      // default: 0.5
    importance?: number;     // default: 0.3
    recency?: number;        // default: 0.2
    accessFrequency?: number; // default: 0.0 (NEW!)
  };
}
```

**Update retriever.ts:**
```typescript
function computeRetrievalScore(...): number {
  const weights = config.retrievalWeights || {
    relevance: 0.5,
    importance: 0.3,
    recency: 0.2,
    accessFrequency: 0.0
  };

  const relevance = /* calculate relevance */;
  const importance = decayedImportance(memory, config);
  const recency = 1.0 / (1.0 + ageDays / 30);
  const accessFreq = memory.accessCount / 100; // normalize

  return (
    weights.relevance * relevance +
    weights.importance * importance +
    weights.recency * recency +
    weights.accessFrequency * accessFreq
  );
}
```

**Effort:** ~2 hours
**Value:** HIGH
**Breaking changes:** NO

---

### Phase 2: Chunking Utilities (MEDIUM VALUE) ⚠️

**Don't add to core Engram class**
**Create separate utility:**

```typescript
// NEW FILE: src/utils/chunking.ts
import { chunk } from 'simple-engram/utils';

const chunks = chunk(longDocument, {
  strategy: 'paragraph',
  maxSize: 1000,
  overlap: 100
});

// Then store each chunk
for (const chunk of chunks) {
  await mem.remember([
    { role: 'system', content: chunk.text }
  ]);
}
```

**Effort:** ~4 hours
**Value:** MEDIUM (niche use case)
**Breaking changes:** NO

---

### Phase 3: Embedding Config (LOW VALUE) ❌

**Verdict:** SKIP
**Why:** Already fully customizable via function

---

## Final Recommendation

### ✅ **DO IMPLEMENT:**
1. **Retrieval weight tuning** - Covers 80% of customization needs
2. Add `accessFrequency` to scoring (currently missing)

### ⚠️ **CONSIDER:**
3. **Chunking utilities** - Separate module, optional

### ❌ **DON'T IMPLEMENT:**
4. Embedding configuration - Already handled

---

## Example of Final API:

```typescript
// Tech support bot - prioritize relevance
const supportBot = new Engram({
  llm,
  embed,
  retrievalWeights: {
    relevance: 0.8,
    importance: 0.1,
    recency: 0.1,
  }
});

// Personal assistant - prioritize recency
const assistant = new Engram({
  llm,
  retrievalWeights: {
    relevance: 0.3,
    importance: 0.2,
    recency: 0.5,
  }
});

// Knowledge base - prioritize importance
const kb = new Engram({
  llm,
  retrievalWeights: {
    relevance: 0.4,
    importance: 0.5,
    recency: 0.1,
  }
});
```

---

## Summary

| Feature | Value | Effort | Recommendation |
|---------|-------|--------|----------------|
| Retrieval weights | HIGH | LOW | ✅ DO IT |
| Access frequency in scoring | HIGH | LOW | ✅ DO IT |
| Chunking utilities | MEDIUM | MEDIUM | ⚠️ MAYBE |
| Embedding config | LOW | MEDIUM | ❌ SKIP |

**Total effort for Phase 1:** ~2-3 hours
**Total value:** HIGH
**Breaking changes:** NONE

**Conclusion:** Implement retrieval weight tuning. Skip the rest unless users request it.
