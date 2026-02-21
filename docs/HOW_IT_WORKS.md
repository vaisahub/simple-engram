# How It Works

Deep dive into Engram's algorithms and implementation.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Surprise Detection](#surprise-detection)
3. [Memory Decay](#memory-decay)
4. [Retrieval & Ranking](#retrieval--ranking)
5. [Deduplication & Merging](#deduplication--merging)
6. [Embedding Integration](#embedding-integration)

---

## Architecture Overview

Engram's architecture consists of five main components:

```
┌─────────────────────────────────────────────────────────────┐
│                         Engram Core                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────┐   ┌──────────┐   ┌───────────┐   ┌─────────┐ │
│  │ Extractor│   │  Scorer  │   │ Retriever │   │  Decay  │ │
│  └──────────┘   └──────────┘   └───────────┘   └─────────┘ │
│       │              │                │              │       │
│       ├──────────────┴────────────────┴──────────────┤       │
│       │                                                │      │
│  ┌────▼────┐                                     ┌────▼────┐ │
│  │   LLM   │                                     │  Store  │ │
│  │Function │                                     │ Adapter │ │
│  └─────────┘                                     └─────────┘ │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

- **Extractor**: Converts conversations → memories using LLM
- **Scorer**: Determines novelty (surprise) and importance
- **Retriever**: Finds relevant memories with ranking
- **Decay**: Handles time-based importance reduction
- **Store**: Persists memories (memory/file/database)

---

## Surprise Detection

Surprise detection determines if new information is worth storing.

### Algorithm Flow

```
Input: Candidate memory
       Existing memories
       Embed function (optional)

1. Exact duplicate check (fast path)
   ├─ If content matches existing → surprise = 0
   └─ Otherwise, continue

2. Compute embeddings (if available)
   ├─ Embed candidate
   └─ Compare with existing embeddings

3. Compute keyword novelty (always)
   └─ Jaccard similarity on tokens

4. Compute category rarity
   └─ How uncommon is this category?

5. Combine scores
   ├─ With embeddings: 0.6×semantic + 0.3×keyword + 0.1×rarity
   └─ Without embeddings: 0.8×keyword + 0.2×rarity

6. Apply category boost
   └─ importance = surprise × category_weight

7. Storage decision
   └─ Store if surprise ≥ threshold (default 0.15)

Output: Surprise score (0-1)
        Storage decision (boolean)
        Explanation (optional)
```

### Semantic Novelty

Measures how different the candidate is from existing memories using embeddings.

```typescript
function semanticNovelty(
  candidateEmbedding: number[],
  existingMemories: Memory[]
): number {
  if (existingMemories.length === 0) {
    return 1.0; // First memory is always novel
  }

  // Find most similar existing memory
  let maxSimilarity = 0;
  for (const memory of existingMemories) {
    if (memory.embedding) {
      const similarity = cosineSimilarity(
        candidateEmbedding,
        memory.embedding
      );
      maxSimilarity = Math.max(maxSimilarity, similarity);
    }
  }

  // Novelty = 1 - similarity
  // Similar content → low novelty
  // Different content → high novelty
  return 1 - maxSimilarity;
}
```

**Cosine Similarity:**
```
similarity = (A · B) / (||A|| × ||B||)

where:
  A · B = dot product
  ||A|| = magnitude of vector A
```

**Range:** 0-1
- 0 = completely different
- 1 = identical

### Keyword Novelty

Measures how different the words are using Jaccard similarity.

```typescript
function keywordNovelty(
  candidate: MemoryCandidate,
  existingMemories: Memory[]
): number {
  const candidateTokens = tokenize(candidate.content);

  if (existingMemories.length === 0) {
    return 1.0;
  }

  // Find most similar existing memory
  let maxSimilarity = 0;
  for (const memory of existingMemories) {
    const memoryTokens = tokenize(memory.content);
    const similarity = jaccardSimilarity(candidateTokens, memoryTokens);
    maxSimilarity = Math.max(maxSimilarity, similarity);
  }

  return 1 - maxSimilarity;
}
```

**Jaccard Similarity:**
```
J(A, B) = |A ∩ B| / |A ∪ B|

where:
  A ∩ B = intersection (common words)
  A ∪ B = union (all unique words)
```

**Example:**
```
A = ["user", "prefers", "typescript"]
B = ["user", "likes", "typescript"]

Intersection: ["user", "typescript"] → 2 words
Union: ["user", "prefers", "typescript", "likes"] → 4 words

Jaccard = 2/4 = 0.5
Novelty = 1 - 0.5 = 0.5
```

### Category Rarity

Rewards storing information from rare categories.

```typescript
function categoryRarity(
  candidate: MemoryCandidate,
  existingMemories: Memory[]
): number {
  const categoryCount = existingMemories.filter(
    (m) => m.category === candidate.category
  ).length;

  // Inverse log scaling
  // Rare categories → high rarity
  // Common categories → low rarity
  return 1.0 / Math.log2(2 + categoryCount);
}
```

**Examples:**
```
0 existing: 1.0 / log2(2) = 1.0   (very rare)
1 existing: 1.0 / log2(3) = 0.63  (rare)
10 existing: 1.0 / log2(12) = 0.28 (common)
100 existing: 1.0 / log2(102) = 0.15 (very common)
```

### Category Importance Weights

Different categories get different importance multipliers:

```typescript
const categoryWeights = {
  fact: 0.8,        // Factual information
  preference: 0.9,  // User preferences (most important)
  skill: 0.7,       // User skills/abilities
  episode: 0.6,     // Past events/interactions
  context: 0.5,     // Contextual information
};
```

### Full Example

```
Candidate: "User prefers TypeScript"
Existing:
  - "User likes JavaScript" (0.6 similarity)
  - "User prefers dark mode" (0.3 similarity)

1. No exact duplicate ✓

2. Semantic novelty (with embeddings):
   - Most similar: 0.6
   - Novelty: 1 - 0.6 = 0.4

3. Keyword novelty:
   - Tokens: ["user", "prefers", "typescript"]
   - Most similar: 0.4 (with "User prefers dark mode")
   - Novelty: 1 - 0.4 = 0.6

4. Category rarity:
   - Category: "preference"
   - Existing preferences: 1
   - Rarity: 1 / log2(3) = 0.63

5. Combined surprise:
   - 0.6 × 0.4 + 0.3 × 0.6 + 0.1 × 0.63
   - = 0.24 + 0.18 + 0.063
   - = 0.483

6. Importance:
   - 0.483 × 0.9 (preference weight)
   - = 0.435

7. Storage decision:
   - 0.483 ≥ 0.15 (threshold) ✓
   - STORE IT
```

---

## Memory Decay

Memories fade over time following the Ebbinghaus forgetting curve.

### Decay Formula

```typescript
function decayedImportance(
  memory: Memory,
  config: EngramConfig
): number {
  // Age in days
  const ageDays = (Date.now() - memory.createdAt) / (1000 * 60 * 60 * 24);

  // Decay rate (lambda)
  const halfLifeDays = config.decayHalfLifeDays ?? 30;
  const lambda = Math.LN2 / halfLifeDays;

  // Exponential decay
  const decay = Math.exp(-lambda * ageDays);

  // Access boost (frequent access slows decay)
  const accessBoost = 1 + Math.log2(1 + memory.accessCount) * 0.1;

  // Final importance
  return memory.importance * decay * accessBoost;
}
```

### Mathematical Breakdown

**Exponential decay:**
```
decay(t) = e^(-λ × t)

where:
  λ = ln(2) / half_life
  t = age in days
```

**Half-life examples:**
```
t = 0 days    → decay = e^0 = 1.0      (100%)
t = 30 days   → decay = e^(-0.693) = 0.5  (50%)
t = 60 days   → decay = e^(-1.386) = 0.25 (25%)
t = 90 days   → decay = e^(-2.079) = 0.125 (12.5%)
```

**Access boost:**
```
boost = 1 + log2(1 + access_count) × 0.1

Examples:
  0 accesses  → 1 + log2(1) × 0.1 = 1.0     (no boost)
  1 access    → 1 + log2(2) × 0.1 = 1.1     (+10%)
  3 accesses  → 1 + log2(4) × 0.1 = 1.2     (+20%)
  7 accesses  → 1 + log2(8) × 0.1 = 1.3     (+30%)
  15 accesses → 1 + log2(16) × 0.1 = 1.4    (+40%)
  100 accesses → 1 + log2(101) × 0.1 = 1.67 (+67%)
```

### Pruning Modes

**Gentle:** Only remove expired memories
```typescript
function shouldPruneGentle(memory: Memory): boolean {
  return memory.expiresAt !== null && memory.expiresAt < Date.now();
}
```

**Normal:** Remove expired + very low importance
```typescript
function shouldPruneNormal(memory: Memory): boolean {
  if (memory.expiresAt !== null && memory.expiresAt < Date.now()) {
    return true;
  }
  const decayed = decayedImportance(memory, config);
  return decayed < 0.01; // Keep only 1%+ importance
}
```

**Aggressive:** Remove expired + low importance + bottom 10%
```typescript
function shouldPruneAggressive(memories: Memory[]): Memory[] {
  const sorted = memories.sort((a, b) => {
    return decayedImportance(a, config) - decayedImportance(b, config);
  });

  const pruneCount = Math.floor(sorted.length * 0.1);
  return sorted.slice(0, pruneCount);
}
```

---

## Retrieval & Ranking

Finds and ranks memories by relevance to a query.

### Ranking Formula

```typescript
function computeScore(
  memory: Memory,
  query: string,
  weights: RetrievalWeights,
  config: EngramConfig
): number {
  const relevance = computeRelevance(memory, query);
  const importance = decayedImportance(memory, config);
  const recency = computeRecency(memory);
  const accessFreq = normalizeAccessFrequency(memory.accessCount);

  return (
    weights.relevance * relevance +
    weights.importance * importance +
    weights.recency * recency +
    weights.accessFrequency * accessFreq
  );
}
```

### Relevance Computation

**With embeddings (semantic search):**
```typescript
function computeRelevance(
  memory: Memory,
  query: string,
  queryEmbedding?: number[]
): number {
  if (memory.embedding && queryEmbedding) {
    return cosineSimilarity(memory.embedding, queryEmbedding);
  } else {
    // Fallback to keyword matching
    return jaccardSimilarity(tokenize(memory.content), tokenize(query));
  }
}
```

**Without embeddings (keyword search):**
```typescript
function computeRelevance(memory: Memory, query: string): number {
  const memoryTokens = tokenize(memory.content);
  const queryTokens = tokenize(query);
  return jaccardSimilarity(memoryTokens, queryTokens);
}
```

### Recency Score

Linear decay from creation time:
```typescript
function computeRecency(memory: Memory): number {
  const ageDays = (Date.now() - memory.createdAt) / (1000 * 60 * 60 * 24);
  const maxAge = 90; // days

  // Linear decay: 1.0 at age 0, 0.0 at maxAge
  return Math.max(0, 1 - ageDays / maxAge);
}
```

**Examples:**
```
Age 0 days   → recency = 1.0   (brand new)
Age 30 days  → recency = 0.67  (recent)
Age 60 days  → recency = 0.33  (old)
Age 90+ days → recency = 0.0   (very old)
```

### Access Frequency Score

Normalized logarithmic scaling:
```typescript
function normalizeAccessFrequency(accessCount: number): number {
  // Cap at 100 accesses for normalization
  return Math.min(accessCount / 100, 1.0);
}
```

**Examples:**
```
0 accesses   → 0.0
10 accesses  → 0.1
50 accesses  → 0.5
100 accesses → 1.0
200 accesses → 1.0 (capped)
```

### Full Ranking Example

```
Query: "user preferences"
Weights: { relevance: 0.5, importance: 0.3, recency: 0.2, accessFreq: 0.0 }

Memory A: "User prefers TypeScript"
  - Relevance: 0.8 (high keyword match)
  - Importance: 0.7 (decayed from 0.85, 20 days old)
  - Recency: 0.78 (20 days old)
  - Access freq: 0.0
  - Score: 0.5×0.8 + 0.3×0.7 + 0.2×0.78 = 0.4 + 0.21 + 0.156 = 0.766

Memory B: "User lives in SF"
  - Relevance: 0.2 (low keyword match)
  - Importance: 0.9 (recent, high importance)
  - Recency: 0.95 (5 days old)
  - Access freq: 0.0
  - Score: 0.5×0.2 + 0.3×0.9 + 0.2×0.95 = 0.1 + 0.27 + 0.19 = 0.56

Ranking: A (0.766) > B (0.56)
```

---

## Deduplication & Merging

Identifies and consolidates similar memories.

### Merge Algorithm

```
Input: All memories
       Similarity threshold (default 0.85)

1. For each pair of memories:
   ├─ Compute similarity (cosine or Jaccard)
   └─ If similarity ≥ threshold → mark for merge

2. For each merge pair:
   ├─ Keep higher importance version
   ├─ Update access count (sum of both)
   ├─ Track merge history in metadata
   └─ Delete lower importance version

3. Return merge statistics

Output: Number merged, number kept
```

### Similarity Computation

```typescript
function computeSimilarity(a: Memory, b: Memory): number {
  // With embeddings
  if (a.embedding && b.embedding) {
    return cosineSimilarity(a.embedding, b.embedding);
  }

  // Without embeddings
  const tokensA = tokenize(a.content);
  const tokensB = tokenize(b.content);
  return jaccardSimilarity(tokensA, tokensB);
}
```

### Merge Decision

```typescript
function shouldMerge(
  similarity: number,
  threshold: number,
  categoryMatch: boolean
): boolean {
  // Must exceed threshold
  if (similarity < threshold) return false;

  // Same category preferred (but not required)
  // Different categories can merge if very similar (>0.95)
  if (!categoryMatch && similarity < 0.95) return false;

  return true;
}
```

### Merge Example

```
Memory A: "User prefers TypeScript" (importance: 0.8, accessed: 5 times)
Memory B: "User likes TypeScript"   (importance: 0.7, accessed: 2 times)

Similarity: 0.92 (> 0.85 threshold) ✓
Same category: Yes ✓

Decision: MERGE

Result:
  Keep: Memory A (higher importance)
  Update:
    - accessCount: 5 + 2 = 7
    - metadata.mergedFrom: ["Memory B ID"]
  Delete: Memory B
```

---

## Embedding Integration

How embeddings enhance memory operations.

### Embedding Flow

```
1. Store Operation:
   ├─ LLM extracts memory
   ├─ Embed function → vector
   ├─ Store {content, embedding}
   └─ Used for future comparisons

2. Recall Operation:
   ├─ Embed query → vector
   ├─ Compare with stored embeddings
   ├─ Rank by cosine similarity
   └─ Return top K

3. Merge Operation:
   ├─ Compare embeddings pairwise
   ├─ High similarity → merge
   └─ Faster than full text comparison
```

### Vector Storage

```typescript
interface Memory {
  id: string;
  content: string;
  embedding?: number[]; // Optional vector (e.g., 1536 dimensions)
  // ... other fields
}
```

**Storage size:**
```
Without embeddings: ~200 bytes per memory
With embeddings (1536 dims): ~6.4 KB per memory
```

### Cosine Similarity (Fast)

```typescript
function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magnitudeA += a[i] * a[i];
    magnitudeB += b[i] * b[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) return 0;

  return dotProduct / (magnitudeA * magnitudeB);
}
```

**Time complexity:** O(n) where n = embedding dimensions

### Performance Impact

| Operation | Without Embeddings | With Embeddings |
|-----------|-------------------|-----------------|
| **Store** | <5ms | <50ms (embed time) |
| **Recall (first)** | <20ms | <50ms (embed + search) |
| **Recall (cached)** | <20ms | <10ms (search only) |
| **Merge** | <100ms | <50ms (vectors faster) |

---

## Performance Optimizations

### 1. Embedding Caching

```typescript
const embeddingCache = new Map<string, number[]>();

async function embed(text: string): Promise<number[]> {
  if (embeddingCache.has(text)) {
    return embeddingCache.get(text)!;
  }

  const vector = await embedFunction(text);
  embeddingCache.set(text, vector);
  return vector;
}
```

### 2. Batch Processing

```typescript
// Instead of:
for (const memory of memories) {
  await mem.store(memory);
}

// Do:
await Promise.all(memories.map((m) => mem.store(m)));
```

### 3. Index-Based Filtering

SQLite store uses indexes for fast filtering:
```sql
CREATE INDEX idx_category ON memories(category);
CREATE INDEX idx_importance ON memories(importance);
CREATE INDEX idx_createdAt ON memories(createdAt);
```

### 4. Early Termination

```typescript
// Stop when we have enough high-quality matches
function recall(query: string, k: number): Memory[] {
  const results = [];
  for (const memory of sortedMemories) {
    const score = computeScore(memory, query);
    if (score > 0.8) {
      results.push(memory);
      if (results.length === k) break; // Early exit
    }
  }
  return results;
}
```

---

## Algorithm Complexity

| Operation | Time Complexity | Space Complexity |
|-----------|----------------|------------------|
| **Store** | O(n) for duplicate check | O(1) |
| **Recall** | O(n × d) for cosine | O(k) |
| **Merge** | O(n² × d) worst case | O(n) |
| **Forget** | O(n) | O(1) |
| **Export** | O(n) | O(n) |

Where:
- n = number of memories
- d = embedding dimensions
- k = number of results

---

## See Also

- [API Reference](./API.md) - Method documentation
- [Configuration Guide](./CONFIGURATION.md) - Tuning parameters
- [Examples](./EXAMPLES.md) - Real-world usage
- [Embeddings Guide](../EMBEDDINGS_GUIDE.md) - Embedding setup
