# Agentic System Integration Guide

Complete guide for integrating Engram into AI agents and agentic systems.

---

## Table of Contents

- [Overview](#overview)
- [Installation & Setup](#installation--setup)
- [Basic Integration Pattern](#basic-integration-pattern)
- [Agent Execution Loop](#agent-execution-loop)
- [Production Agent Implementation](#production-agent-implementation)
- [Workflow Patterns](#workflow-patterns)
- [Storage Options](#storage-options)
- [Monitoring & Debugging](#monitoring--debugging)
- [Best Practices](#best-practices)

---

## Overview

Engram provides persistent, intelligent memory for AI agents. The typical workflow involves:

1. **Recall** relevant memories before generating responses
2. **Inject** memory context into agent prompts
3. **Extract** and store new memories from conversations
4. **Maintain** memory health through pruning and merging

---

## Installation & Setup

```bash
npm install simple-engram
```

### Basic Setup

```typescript
import { Engram } from 'simple-engram';
import Anthropic from '@anthropic-ai/sdk';

// Initialize your LLM
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Initialize Engram with your LLM
const memory = new Engram({
  llm: async (prompt) => {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });
    return response.content[0].text;
  },
  // Optional: Add embeddings for semantic search
  embed: async (text) => {
    // Use OpenAI, Voyage, or local embeddings
    const embedding = await yourEmbeddingService.embed(text);
    return embedding;
  }
});

await memory.init();
```

---

## Basic Integration Pattern

### Minimal Example

```typescript
async function agentWithMemory(userMessage: string): Promise<string> {
  // 1. Recall relevant memories
  const context = await memory.context(userMessage, {
    format: 'bullets',
    maxTokens: 1000
  });

  // 2. Build prompt with memory context
  const systemPrompt = `You are a helpful AI assistant.

Here's what you remember about the user:
${context}

Use this information to provide personalized responses.`;

  // 3. Get agent response
  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }]
  });

  const agentResponse = response.content[0].text;

  // 4. Store new memories from this exchange
  await memory.remember([
    { role: 'user', content: userMessage },
    { role: 'assistant', content: agentResponse }
  ]);

  return agentResponse;
}
```

---

## Agent Execution Loop

### Complete Loop with All Steps

```typescript
async function agentLoop(userMessage: string) {
  // STEP 1: Recall relevant memories for context
  const relevantMemories = await memory.recall(userMessage, {
    k: 5, // Get top 5 memories
    categories: ['fact', 'preference', 'skill']
  });

  // STEP 2: Format memories as context
  const memoryContext = await memory.context(userMessage, {
    format: 'bullets',
    maxTokens: 1000,
    includeMetadata: true
  });

  // STEP 3: Build your agent prompt with memory context
  const systemPrompt = `You are a helpful AI assistant.

Here's what you remember about the user:
${memoryContext}

Use this information to provide personalized responses.`;

  // STEP 4: Call your agent/LLM with enriched context
  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    system: systemPrompt,
    messages: [
      { role: 'user', content: userMessage }
    ]
  });

  const agentResponse = response.content[0].text;

  // STEP 5: Extract and store new memories from conversation
  await memory.remember([
    { role: 'user', content: userMessage },
    { role: 'assistant', content: agentResponse }
  ]);

  // STEP 6: Periodic cleanup (run periodically, not every turn)
  // Run maintenance tasks as needed
  // await memory.forget({ mode: 'normal' });
  // await memory.merge();

  return agentResponse;
}
```

---

## Production Agent Implementation

### Full-Featured Agent Class

```typescript
import { Engram, Memory, Message } from 'simple-engram';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

class IntelligentAgent {
  private memory: Engram;
  private conversationHistory: Message[] = [];
  private anthropic: Anthropic;
  private openai: OpenAI;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    this.memory = new Engram({
      llm: this.callLLM.bind(this),
      embed: this.callEmbedding.bind(this),

      // Tune retrieval for your use case
      retrievalWeights: {
        relevance: 0.5,        // How well query matches
        importance: 0.3,       // Base importance
        recency: 0.15,         // Recent memories
        accessFrequency: 0.05  // Often-accessed facts
      },

      // Memory decay settings
      decayHalfLifeDays: 30,
      maxRetentionDays: 90,

      // Surprise detection (lower = more selective)
      surpriseThreshold: 0.15,
    });
  }

  async init(): Promise<void> {
    await this.memory.init();
  }

  /**
   * Main entry point for processing user input
   */
  async processUserInput(userMessage: string): Promise<string> {
    // 1. Retrieve relevant context from memory
    const memories = await this.memory.recall(userMessage, {
      k: 7,
      explain: false
    });

    const context = await this.memory.context(userMessage, {
      format: 'numbered',
      includeMetadata: true,
      maxTokens: 1500
    });

    // 2. Build conversation with memory context
    const systemPrompt = `You are an AI assistant with long-term memory.

Relevant context from past interactions:
${context}

Use this context to provide personalized, consistent responses.`;

    const messages = [
      ...this.conversationHistory,
      { role: 'user', content: userMessage }
    ];

    // 3. Get agent response
    const response = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      system: systemPrompt,
      max_tokens: 2048,
      messages: messages as any
    });

    const agentResponse = response.content[0].text;

    // 4. Update conversation history
    this.conversationHistory.push(
      { role: 'user', content: userMessage },
      { role: 'assistant', content: agentResponse }
    );

    // 5. Extract and store memories asynchronously
    // Don't block response on memory extraction
    this.storeMemoriesAsync().catch(err => {
      console.error('Memory storage failed:', err);
    });

    return agentResponse;
  }

  /**
   * Extract and store memories from conversation history
   */
  private async storeMemoriesAsync(): Promise<void> {
    if (this.conversationHistory.length === 0) return;

    // Extract memories from recent conversation
    const result = await this.memory.remember(this.conversationHistory, {
      source: 'conversation',
      explain: false
    });

    // Log results for monitoring
    console.log(`Memory extraction: ${result.stored.length} stored, ${result.rejected.length} rejected`);

    if (result.errors.length > 0) {
      console.error('Memory extraction errors:', result.errors);
    }

    // Clear conversation history after extraction
    this.conversationHistory = [];
  }

  /**
   * Perform memory maintenance (run periodically)
   */
  async maintenance(): Promise<void> {
    console.log('Running memory maintenance...');

    // 1. Clean up old/unimportant memories
    const forgetResult = await this.memory.forget({
      mode: 'normal'  // or 'aggressive' for more pruning
    });

    console.log(`Pruned ${forgetResult.pruned} memories, ${forgetResult.remaining} remaining`);

    // 2. Merge near-duplicates
    const mergeResult = await this.memory.merge({
      similarityThreshold: 0.85,
      explain: false
    });

    console.log(`Merged ${mergeResult.merged} duplicate memories`);
  }

  /**
   * Get memory statistics
   */
  async getMemoryStats(): Promise<any> {
    return await this.memory.stats();
  }

  /**
   * Export memories for backup
   */
  async exportMemories(format: 'json' | 'md' | 'csv' = 'json'): Promise<string> {
    return await this.memory.export(format);
  }

  /**
   * Manual memory storage (for explicit facts)
   */
  async storeExplicitFact(content: string, category = 'fact'): Promise<void> {
    await this.memory.store(content, {
      category,
      source: 'explicit',
      importance: 0.8
    });
  }

  /**
   * LLM wrapper for Engram
   */
  private async callLLM(prompt: string): Promise<string> {
    const response = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    });
    return response.content[0].text;
  }

  /**
   * Embedding wrapper for Engram
   */
  private async callEmbedding(text: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    return response.data[0].embedding;
  }

  /**
   * Cleanup resources
   * IMPORTANT: Always call this when done to prevent memory leaks
   */
  async close(): Promise<void> {
    // Engram's close() automatically removes all event listeners
    // and closes the store adapter
    await this.memory.close();
  }
}

// Usage example
async function main() {
  const agent = new IntelligentAgent();
  await agent.init();

  // Process user messages
  const response1 = await agent.processUserInput("My name is Alice and I love hiking");
  console.log(response1);

  const response2 = await agent.processUserInput("What outdoor activities do you think I'd enjoy?");
  console.log(response2);

  // Run maintenance periodically (e.g., daily)
  await agent.maintenance();

  // Get statistics
  const stats = await agent.getMemoryStats();
  console.log('Memory stats:', stats);

  await agent.close();
}
```

---

## Workflow Patterns

### Pattern A: Real-time Agent (Chatbot, Assistant)

```typescript
// Immediate memory recall and storage per message
async function realtimeAgent(userMessage: string) {
  // 1. Recall relevant memories
  const context = await memory.context(userMessage);

  // 2. Generate response with context
  const response = await llm.generate({ context, message: userMessage });

  // 3. Store new memories immediately
  await memory.remember([
    { role: 'user', content: userMessage },
    { role: 'assistant', content: response }
  ]);

  return response;
}
```

### Pattern B: Batch Processing Agent

```typescript
// Accumulate conversation, extract at end of session
class BatchAgent {
  private sessionMessages: Message[] = [];

  async processMessage(userMessage: string): Promise<string> {
    // Use in-session history for context
    const response = await this.generateResponse(userMessage);

    this.sessionMessages.push(
      { role: 'user', content: userMessage },
      { role: 'assistant', content: response }
    );

    return response;
  }

  async endSession(): Promise<void> {
    // Extract all memories at once
    await memory.remember(this.sessionMessages);
    this.sessionMessages = [];
  }
}
```

### Pattern C: Multi-Agent System

```typescript
// Different agents with isolated namespaces
const customerServiceAgent = new Engram({
  llm,
  namespace: 'customer-service'
});

const technicalSupportAgent = new Engram({
  llm,
  namespace: 'technical-support'
});

const sharedKnowledge = new Engram({
  llm,
  namespace: 'shared-knowledge'
});

// Agents can share memories when needed
const sharedMemories = await sharedKnowledge.recall(query);
```

### Pattern D: User-Specific Memory

```typescript
// Create separate memory instance per user
function getUserMemory(userId: string): Engram {
  return new Engram({
    llm,
    embed,
    namespace: `user-${userId}`,
    store: new SqliteStore({ path: `./memories/${userId}.db` })
  });
}

const aliceMemory = getUserMemory('alice-123');
const bobMemory = getUserMemory('bob-456');
```

---

## Cross-Session Persistence

**IMPORTANT:** Engram automatically loads existing memories when using persistent storage.

### How It Works

```typescript
// Session 1: Store memories
const memory = new Engram({
  llm,
  store: new SqliteStore({ path: './agent-memory.db' })
});
await memory.init(); // Loads existing memories from DB

await memory.remember([
  { role: 'user', content: 'My name is Alice' }
]);
await memory.close();

// ===== Process Restarts =====

// Session 2: New process, hours/days later
const memory2 = new Engram({
  llm,
  store: new SqliteStore({ path: './agent-memory.db' }) // Same DB!
});
await memory2.init(); // Loads "My name is Alice" from Session 1

// New memory automatically compares against existing
await memory2.remember([
  { role: 'user', content: 'I also like Python' }
]);
// ✅ Knows about Alice AND Python
// ✅ Cross-session memory works automatically!

const memories = await memory2.recall('Alice');
console.log(memories[0].content); // "My name is Alice" (from Session 1)
```

### Key Points

1. **Automatic Loading**: `init()` loads all existing memories from storage
2. **Automatic Comparison**: New memories are compared against ALL existing memories
3. **No Manual Sync**: Engram handles loading/saving automatically
4. **Works With**: SqliteStore, JsonFileStore (not MemoryStore)

### Common Pattern: Long-Running Agent

```typescript
class PersistentAgent {
  private memory: Engram;

  async start() {
    this.memory = new Engram({
      llm: this.llm,
      store: new SqliteStore({ path: `./users/${this.userId}.db` })
    });

    // Load all existing memories from previous sessions
    await this.memory.init();

    console.log('Loaded memories from past sessions');
  }

  async processMessage(userMessage: string) {
    // Automatically compares against all existing memories
    await this.memory.remember([
      { role: 'user', content: userMessage }
    ]);

    // Recall uses all memories (old + new)
    const context = await this.memory.context(userMessage);
    return this.generateResponse(context);
  }

  async stop() {
    await this.memory.close(); // Saves any pending changes
  }
}
```

---

## Storage Options

### In-Memory (Default)

```typescript
import { MemoryStore } from 'simple-engram';

const memory = new Engram({
  store: new MemoryStore()
});

// Pros: Fast, no dependencies
// Cons: Lost on restart, not scalable
// Use case: Development, testing, temporary agents
```

### JSON File

```typescript
import { JsonFileStore } from 'simple-engram';

const memory = new Engram({
  store: new JsonFileStore({
    path: './memories.json'
  })
});

// Pros: Simple, human-readable, persistent
// Cons: Slower for large datasets
// Use case: Small agents, easy debugging
```

### SQLite (Recommended for Production)

```typescript
import { SqliteStore } from 'simple-engram';

const memory = new Engram({
  store: new SqliteStore({
    path: './memories.db'
  })
});

// Pros: Fast, persistent, scalable, efficient queries
// Cons: Requires better-sqlite3 dependency
// Use case: Production agents, large memory stores
```

---

## Monitoring & Debugging

### Event Listeners

```typescript
// Listen to memory events
memory.on('stored', (mem) => {
  console.log(`✓ Stored: ${mem.content} [${mem.category}]`);
});

memory.on('rejected', (info) => {
  console.log(`✗ Rejected: ${info.content} (${info.reason})`);
});

memory.on('recalled', (memories, query) => {
  console.log(`📚 Recalled ${memories.length} memories for: "${query}"`);
});

memory.on('forgotten', (ids, count) => {
  console.log(`🗑️ Pruned ${count} memories`);
});

memory.on('error', (error) => {
  console.error('❌ Memory error:', error);
});

memory.on('warning', (message) => {
  console.warn('⚠️ Warning:', message);
  // Example: "Memory usage at 80%: 8000/10000. Monitor memory growth."
});
```

### Event Listener Best Practices

**⚠️ IMPORTANT: Prevent Memory Leaks**

Event listeners can cause memory leaks if not managed properly. Follow these patterns:

```typescript
// ❌ BAD: Listener persists in memory forever
function addListener() {
  memory.on('stored', (mem) => console.log(mem));
}
// Called 1000 times = 1000 listeners accumulating!

// ✅ GOOD: Use .once() for one-time events
memory.once('stored', (mem) => {
  console.log(`First memory stored: ${mem.content}`);
});

// ✅ GOOD: Remove listener when done
const storedListener = (mem) => console.log(mem);
memory.on('stored', storedListener);

// Later, when done listening:
memory.off('stored', storedListener);

// ✅ BEST: Always close when done (automatically removes ALL listeners)
async function runAgent() {
  const memory = new Engram({ llm });

  try {
    memory.on('stored', (mem) => console.log(mem));
    // ... use memory
  } finally {
    await memory.close(); // Removes all listeners + cleanup
  }
}

// ✅ PATTERN: Scoped listeners in production
class Agent {
  private memory: Engram;
  private listeners: Map<string, Function> = new Map();

  async init() {
    this.memory = new Engram({ llm });

    // Store references for cleanup
    const storedListener = (mem) => this.handleStored(mem);
    const errorListener = (err) => this.handleError(err);

    this.memory.on('stored', storedListener);
    this.memory.on('error', errorListener);

    this.listeners.set('stored', storedListener);
    this.listeners.set('error', errorListener);
  }

  async cleanup() {
    // Remove listeners before closing
    for (const [event, listener] of this.listeners) {
      this.memory.off(event as any, listener as any);
    }
    this.listeners.clear();

    await this.memory.close();
  }

  private handleStored(mem: Memory) {
    console.log(`Stored: ${mem.content}`);
  }

  private handleError(error: Error) {
    console.error('Memory error:', error);
  }
}
```

**Why This Matters:**

Without proper cleanup:
- Each `memory.on()` call adds a listener that stays in memory
- In long-running agents, this accumulates over time
- Can cause: increased memory usage, slower performance, eventual crashes

**Safety Features (Added in v0.3.0+):**
- `setMaxListeners(50)` warns if >50 listeners added
- `close()` automatically calls `removeAllListeners()`

### Dry-Run Mode

```typescript
// Preview what would be stored without actually storing
const preview = await memory.remember(messages, {
  dryRun: true,
  explain: true
});

console.log('Would store:', preview.stored.length);
console.log('Would reject:', preview.rejected.length);

// Inspect details
preview.stored.forEach(mem => {
  console.log(`  - ${mem.content} (importance: ${mem.importance})`);
});

preview.rejected.forEach(info => {
  console.log(`  - ${info.content} (reason: ${info.reason}, surprise: ${info.surprise})`);
});
```

### Explain Mode

```typescript
// Get detailed explanations for decisions
const result = await memory.remember(messages, {
  explain: true
});

result.stored.forEach(mem => {
  console.log(`Stored: ${mem.content}`);
  console.log(`Explanation: ${mem.explanation}`);
});

result.rejected.forEach(info => {
  console.log(`Rejected: ${info.content}`);
  console.log(`Explanation: ${info.explanation}`);
  if (info.closestExisting) {
    console.log(`Similar to: ${info.closestExisting.content}`);
  }
});
```

### Statistics Dashboard

```typescript
async function printMemoryDashboard() {
  const stats = await memory.stats();

  console.log('\n=== Memory Dashboard ===');
  console.log(`Total Memories: ${stats.totalMemories}`);
  console.log(`Store Type: ${stats.storeType}`);
  console.log(`Has Embeddings: ${stats.hasEmbeddings ? 'Yes' : 'No'}`);
  console.log(`\nBy Category:`);
  Object.entries(stats.byCategory).forEach(([cat, count]) => {
    console.log(`  ${cat}: ${count}`);
  });
  console.log(`\nAverages:`);
  console.log(`  Importance: ${stats.averageImportance.toFixed(2)}`);
  console.log(`  Surprise: ${stats.averageSurprise.toFixed(2)}`);
  console.log(`  Age (days): ${stats.averageAge.toFixed(1)}`);
  console.log('=======================\n');
}
```

---

## Best Practices

### 1. Always Close Engram Instances

```typescript
// Single instance pattern (recommended for most apps)
const memory = new Engram({ llm, embed });

// Use throughout app lifecycle
// ...

// Cleanup at shutdown
process.on('SIGTERM', async () => {
  await memory.close();
  process.exit(0);
});

// Per-request pattern (if needed)
async function handleRequest() {
  const memory = new Engram({ llm });
  try {
    // Use memory
    return result;
  } finally {
    await memory.close(); // Always cleanup
  }
}
```

### 2. Use Embeddings for Better Recall

```typescript
// Without embeddings: keyword matching only
const memory1 = new Engram({ llm });

// With embeddings: semantic understanding
const memory2 = new Engram({
  llm,
  embed: yourEmbeddingFunction
});

// "Docker" query will find memories about "containerization"
```

### 3. Tune Retrieval Weights for Your Use Case

```typescript
// Chatbot: prioritize recent conversations
const chatbot = new Engram({
  llm,
  retrievalWeights: {
    relevance: 0.4,
    recency: 0.4,
    importance: 0.2,
    accessFrequency: 0.0
  }
});

// Knowledge base: prioritize important facts
const knowledgeBase = new Engram({
  llm,
  retrievalWeights: {
    relevance: 0.5,
    importance: 0.4,
    recency: 0.05,
    accessFrequency: 0.05
  }
});
```

### 4. Run Maintenance Periodically

```typescript
// Run daily or when memory count exceeds threshold
async function dailyMaintenance() {
  const stats = await memory.stats();

  if (stats.totalMemories > 5000) {
    await memory.forget({ mode: 'aggressive' });
  } else {
    await memory.forget({ mode: 'normal' });
  }

  await memory.merge({ similarityThreshold: 0.85 });
}

// Schedule maintenance
setInterval(dailyMaintenance, 24 * 60 * 60 * 1000); // Daily
```

### 5. Handle Errors Gracefully

```typescript
async function safeAgentLoop(userMessage: string) {
  try {
    // Recall with fallback
    let context = '';
    try {
      context = await memory.context(userMessage);
    } catch (error) {
      console.warn('Memory recall failed, continuing without context:', error);
    }

    // Generate response
    const response = await generateResponse(userMessage, context);

    // Store memories with error handling
    try {
      await memory.remember([
        { role: 'user', content: userMessage },
        { role: 'assistant', content: response }
      ]);
    } catch (error) {
      console.error('Memory storage failed:', error);
      // Don't fail the response if memory storage fails
    }

    return response;
  } catch (error) {
    console.error('Agent loop failed:', error);
    throw error;
  }
}
```

### 6. Use Namespaces for Isolation

```typescript
// Separate memories by user, project, or context
const userMemory = new Engram({
  llm,
  namespace: `user-${userId}`
});

const projectMemory = new Engram({
  llm,
  namespace: `project-${projectId}`
});

// Prevents memory leakage between contexts
```

### 7. Balance Surprise Threshold

```typescript
// More selective (fewer, higher-quality memories)
const selective = new Engram({
  llm,
  surpriseThreshold: 0.15  // Low threshold = high bar
});

// More inclusive (more memories stored)
const inclusive = new Engram({
  llm,
  surpriseThreshold: 0.5  // High threshold = low bar
});

// Start with default (0.3) and adjust based on your needs
```

### 8. Backup Regularly

```typescript
// Export memories for backup
async function backupMemories() {
  const json = await memory.export('json');
  await fs.writeFile(`./backups/memories-${Date.now()}.json`, json);
}

// Run weekly
setInterval(backupMemories, 7 * 24 * 60 * 60 * 1000);
```

---

## Performance Considerations

### Memory Extraction is Async

Memory extraction requires LLM calls, which can be slow. Don't block user responses:

```typescript
// ❌ Bad: Blocks response
async function badAgent(userMessage: string) {
  const response = await generateResponse(userMessage);
  await memory.remember([...]); // Blocks for 1-2 seconds
  return response;
}

// ✓ Good: Non-blocking
async function goodAgent(userMessage: string) {
  const response = await generateResponse(userMessage);
  memory.remember([...]).catch(console.error); // Don't await
  return response;
}
```

### Batch Operations

Use batch processing for bulk imports:

```typescript
// Use bootstrap for importing many conversations
await memory.bootstrap(conversations, {
  batchSize: 10,      // Process 10 at a time
  delayMs: 500,       // Delay between batches
  onProgress: (progress) => {
    console.log(`${progress.completed}/${progress.total} completed`);
  }
});
```

### Context Token Limits

Control token usage when injecting context:

```typescript
const context = await memory.context(query, {
  maxTokens: 1000,  // Limit context size
  k: 5              // Or limit number of memories
});
```

---

## Common Pitfalls

### 1. Not Cleaning Up Event Listeners

```typescript
// ❌ Don't: Create instances without cleanup
async function processUser(userId: string) {
  const memory = new Engram({ llm });
  await memory.remember(messages);
  // memory instance left dangling with active listeners!
}

// ✓ Do: Always close when done
async function processUser(userId: string) {
  const memory = new Engram({ llm });
  try {
    await memory.remember(messages);
  } finally {
    await memory.close(); // Cleanup listeners + resources
  }
}

// ✓ Or: Reuse single instance
const sharedMemory = new Engram({ llm });
// Use throughout app lifecycle
// Then at shutdown:
process.on('SIGTERM', async () => {
  await sharedMemory.close();
  process.exit(0);
});
```

### 2. Storing Too Much

```typescript
// ❌ Don't store raw conversation logs
await memory.remember([
  { role: 'user', content: 'hi' },
  { role: 'assistant', content: 'Hello! How can I help?' }
]);
// Result: Wastes memory on non-informative exchanges

// ✓ Let Engram filter automatically (it will reject "hi")
// Or only remember meaningful exchanges
```

### 3. Not Using Embeddings

```typescript
// ❌ Without embeddings: poor semantic recall
const memory1 = new Engram({ llm });
await memory1.store("I use Docker for deployments");
const results = await memory1.recall("containerization"); // May not find it

// ✓ With embeddings: semantic search works
const memory2 = new Engram({ llm, embed });
await memory2.store("I use Docker for deployments");
const results = await memory2.recall("containerization"); // Finds it!
```

### 4. Ignoring Maintenance

```typescript
// ❌ Never pruning = memory bloat
// After months: 50,000 memories, slow queries

// ✓ Regular maintenance
setInterval(async () => {
  await memory.forget({ mode: 'normal' });
  await memory.merge();
}, 24 * 60 * 60 * 1000);
```

---

## Next Steps

- [API Reference](./API.md) - Complete method documentation
- [Configuration Guide](./CONFIGURATION.md) - All options explained
- [Examples](./EXAMPLES.md) - Real-world use cases
- [How It Works](./HOW_IT_WORKS.md) - Algorithm deep dive

---

## Support

- GitHub Issues: https://github.com/vaisahub/simple-engram/issues
- Documentation: https://github.com/vaisahub/simple-engram#readme

---

MIT © [Vaisakh](https://github.com/vaisahub)
