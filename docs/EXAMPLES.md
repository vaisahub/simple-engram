# Real-World Examples

Practical examples of using Engram in different applications.

## Table of Contents

1. [Chatbot with Memory](#chatbot-with-memory)
2. [Customer Support Agent](#customer-support-agent)
3. [Personal AI Assistant](#personal-ai-assistant)
4. [Multi-User System](#multi-user-system)
5. [Knowledge Base](#knowledge-base)
6. [Research Assistant](#research-assistant)
7. [Task Automation Agent](#task-automation-agent)

---

## Chatbot with Memory

A conversational chatbot that remembers user preferences across sessions.

```typescript
import { Engram, SqliteStore } from 'simple-engram';
import OpenAI from 'openai';

const client = new OpenAI();

// Initialize memory
const mem = new Engram({
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
  store: new SqliteStore({ path: './chatbot.db' }),
  decayHalfLifeDays: 7, // Short-term memory
});

// Chat function
async function chat(userMessage: string): Promise<string> {
  // 1. Recall relevant context
  const context = await mem.context(userMessage, {
    format: 'bullets',
    maxTokens: 500,
    k: 5,
  });

  // 2. Generate response with context
  const systemPrompt = `You are a helpful chatbot assistant.

${context}

Remember these details about the user in your responses.`;

  const response = await client.chat.completions.create({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
  });

  const assistantMessage = response.choices[0].message.content;

  // 3. Remember this conversation
  await mem.remember([
    { role: 'user', content: userMessage },
    { role: 'assistant', content: assistantMessage },
  ]);

  return assistantMessage;
}

// Usage
await chat('I prefer dark mode in all my apps');
// → "Got it! I'll remember that you prefer dark mode."

await chat('What do I prefer?');
// → "You prefer dark mode in all your apps."
```

---

## Customer Support Agent

Support agent that recalls customer history and preferences.

```typescript
import { Engram, SqliteStore } from 'simple-engram';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

// Per-customer memory
function getCustomerMemory(customerId: string) {
  return new Engram({
    llm: async (prompt) => {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      });
      return response.content[0].text;
    },
    store: new SqliteStore({ path: './support.db' }),
    namespace: `customer_${customerId}`,
    decayHalfLifeDays: 90, // Long-term customer memory
    retrievalWeights: {
      relevance: 0.5,
      importance: 0.3,
      recency: 0.1,
      accessFrequency: 0.1, // Boost frequent issues
    },
  });
}

// Handle support ticket
async function handleTicket(customerId: string, issue: string) {
  const mem = getCustomerMemory(customerId);

  // Recall customer history
  const context = await mem.context(issue, {
    format: 'xml',
    k: 10,
    categories: ['issue', 'preference', 'fact'],
  });

  // Generate support response
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `You are a support agent helping a customer.

${context}

Customer issue: ${issue}

Provide a helpful response based on their history.`,
      },
    ],
  });

  const solution = response.content[0].text;

  // Remember this interaction
  await mem.store(`Customer reported: ${issue}`, {
    category: 'issue',
    importance: 0.8,
  });

  return solution;
}

// Usage
await handleTicket('user_123', 'My API key is not working');
// → Recalls previous API key issues, provides personalized solution
```

---

## Personal AI Assistant

AI assistant that learns user preferences and workflows over time.

```typescript
import { Engram, SqliteStore } from 'simple-engram';
import OpenAI from 'openai';

const client = new OpenAI();

const mem = new Engram({
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
  store: new SqliteStore({ path: './assistant.db' }),
  surpriseThreshold: 0.2, // Learn from most interactions
  decayHalfLifeDays: 30,
});

// Assistant command handler
async function handleCommand(command: string): Promise<string> {
  // Recall relevant preferences and workflows
  const preferences = await mem.recall('preferences', {
    categories: ['preference', 'skill'],
    k: 10,
  });

  const workflows = await mem.recall(command, {
    categories: ['episode'], // Past commands
    k: 5,
  });

  // Generate personalized response
  const context = `
User preferences:
${preferences.map((p) => `- ${p.content}`).join('\n')}

Previous similar commands:
${workflows.map((w) => `- ${w.content}`).join('\n')}
`;

  const response = await client.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: 'system',
        content: `You are a personal AI assistant. ${context}`,
      },
      { role: 'user', content: command },
    ],
  });

  const result = response.choices[0].message.content;

  // Remember this command
  await mem.store(`User ran command: ${command}`, {
    category: 'episode',
    importance: 0.7,
  });

  return result;
}

// Bootstrap with initial preferences
async function bootstrap() {
  await mem.store('User prefers TypeScript over JavaScript', {
    category: 'preference',
    importance: 0.9,
  });
  await mem.store('User uses VSCode', {
    category: 'preference',
    importance: 0.8,
  });
  await mem.store('User deploys to Vercel', {
    category: 'skill',
    importance: 0.7,
  });
}

// Usage
await bootstrap();
await handleCommand('Create a new Next.js project');
// → Uses TypeScript (remembered preference)
// → Suggests Vercel deployment (remembered skill)
```

---

## Multi-User System

System with isolated memory per user.

```typescript
import { Engram, SqliteStore } from 'simple-engram';
import OpenAI from 'openai';

const client = new OpenAI();

// Memory cache
const memoryCache = new Map<string, Engram>();

// Get or create user memory
function getUserMemory(userId: string): Engram {
  if (!memoryCache.has(userId)) {
    const mem = new Engram({
      llm: async (prompt) => {
        const response = await client.chat.completions.create({
          model: 'gpt-4',
          messages: [{ role: 'user', content: prompt }],
        });
        return response.choices[0].message.content;
      },
      store: new SqliteStore({ path: './multi-user.db' }),
      namespace: userId,
      maxMemories: 1000, // Limit per user
    });
    memoryCache.set(userId, mem);
  }
  return memoryCache.get(userId)!;
}

// Handle user request
async function handleUserRequest(userId: string, request: string) {
  const mem = getUserMemory(userId);

  const context = await mem.context(request, {
    format: 'bullets',
    k: 5,
  });

  // Generate response with user-specific context
  const response = await client.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: 'system',
        content: `You are a helpful assistant.\n\n${context}`,
      },
      { role: 'user', content: request },
    ],
  });

  const result = response.choices[0].message.content;

  // Remember for this user
  await mem.remember([
    { role: 'user', content: request },
    { role: 'assistant', content: result },
  ]);

  return result;
}

// Usage
await handleUserRequest('alice', 'I prefer Python');
await handleUserRequest('bob', 'I prefer JavaScript');

await handleUserRequest('alice', 'What do I prefer?');
// → "You prefer Python"

await handleUserRequest('bob', 'What do I prefer?');
// → "You prefer JavaScript"
```

---

## Knowledge Base

Long-term knowledge storage with minimal decay.

```typescript
import { Engram, SqliteStore } from 'simple-engram';
import OpenAI from 'openai';

const client = new OpenAI();

const mem = new Engram({
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
  store: new SqliteStore({ path: './knowledge.db' }),
  surpriseThreshold: 0.3, // Only store novel info
  decayHalfLifeDays: 365, // Very slow decay
  maxRetentionDays: null, // Never expire
  retrievalWeights: {
    relevance: 0.4,
    importance: 0.5, // Prioritize important facts
    recency: 0.1,
    accessFrequency: 0.0,
  },
});

// Add knowledge from documents
async function indexDocument(title: string, content: string) {
  // Split into chunks
  const chunks = content.split('\n\n').filter((c) => c.length > 50);

  for (const chunk of chunks) {
    await mem.store(chunk, {
      category: 'fact',
      importance: 0.8,
      metadata: { source: title },
    });
  }
}

// Query knowledge base
async function query(question: string): Promise<string> {
  const relevant = await mem.recall(question, {
    k: 10,
    minImportance: 0.5,
    explain: true,
  });

  const context = relevant.map((m) => m.content).join('\n\n');

  const response = await client.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: 'system',
        content: `Answer the question based on this context:\n\n${context}`,
      },
      { role: 'user', content: question },
    ],
  });

  return response.choices[0].message.content;
}

// Usage
await indexDocument('TypeScript Docs', '...');
await indexDocument('React Guide', '...');

const answer = await query('How do I use TypeScript with React?');
// → Finds relevant sections from both docs
```

---

## Research Assistant

Assistant that builds knowledge from research sessions.

```typescript
import { Engram, SqliteStore } from 'simple-engram';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

const mem = new Engram({
  llm: async (prompt) => {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });
    return response.content[0].text;
  },
  store: new SqliteStore({ path: './research.db' }),
  surpriseThreshold: 0.25,
  decayHalfLifeDays: 60,
  retrievalWeights: {
    relevance: 0.6,
    importance: 0.3,
    recency: 0.1,
  },
});

// Research session
async function researchTopic(topic: string, sources: string[]) {
  console.log(`Researching: ${topic}`);

  for (const source of sources) {
    // Extract insights from source
    const prompt = `Extract key insights from this source about ${topic}:\n\n${source}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const insights = response.content[0].text;

    // Store insights
    await mem.store(insights, {
      category: 'fact',
      importance: 0.8,
      metadata: { topic, source: source.slice(0, 100) },
    });
  }

  console.log(`Indexed ${sources.length} sources`);
}

// Generate research summary
async function summarizeResearch(topic: string): Promise<string> {
  const findings = await mem.recall(topic, {
    k: 20,
    minImportance: 0.5,
  });

  const context = findings.map((f) => f.content).join('\n\n');

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: `Write a comprehensive research summary about ${topic} based on these findings:\n\n${context}`,
      },
    ],
  });

  return response.content[0].text;
}

// Usage
await researchTopic('AI Memory Systems', [
  'Paper 1 content...',
  'Paper 2 content...',
  'Blog post content...',
]);

const summary = await summarizeResearch('AI Memory Systems');
console.log(summary);
```

---

## Task Automation Agent

Agent that learns from task execution patterns.

```typescript
import { Engram, SqliteStore } from 'simple-engram';
import OpenAI from 'openai';

const client = new OpenAI();

const mem = new Engram({
  llm: async (prompt) => {
    const response = await client.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
    });
    return response.choices[0].message.content;
  },
  store: new SqliteStore({ path: './automation.db' }),
  decayHalfLifeDays: 14,
  retrievalWeights: {
    relevance: 0.4,
    importance: 0.2,
    recency: 0.2,
    accessFrequency: 0.2, // Learn from common tasks
  },
});

// Execute task
async function executeTask(taskDescription: string): Promise<string> {
  // Recall similar past tasks
  const similar = await mem.recall(taskDescription, {
    categories: ['episode'],
    k: 5,
  });

  const context = similar.length
    ? `Similar past tasks:\n${similar.map((s) => s.content).join('\n')}`
    : 'No similar tasks found.';

  // Generate execution plan
  const response = await client.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: 'system',
        content: `You are a task automation agent.\n\n${context}`,
      },
      {
        role: 'user',
        content: `Create a step-by-step plan for: ${taskDescription}`,
      },
    ],
  });

  const plan = response.choices[0].message.content;

  // Store execution
  await mem.store(`Executed task: ${taskDescription}`, {
    category: 'episode',
    importance: 0.7,
    metadata: { plan, timestamp: Date.now() },
  });

  return plan;
}

// Learn from success/failure
async function recordOutcome(
  taskDescription: string,
  success: boolean,
  notes: string
) {
  await mem.store(
    `Task "${taskDescription}" ${success ? 'succeeded' : 'failed'}: ${notes}`,
    {
      category: success ? 'skill' : 'context',
      importance: success ? 0.9 : 0.8,
    }
  );
}

// Usage
const plan = await executeTask('Deploy to production');
// → Recalls previous deployment patterns

await recordOutcome('Deploy to production', true, 'Completed in 5 minutes');
// → Agent learns successful pattern

const plan2 = await executeTask('Deploy to production');
// → Uses learned successful pattern
```

---

## Best Practices

### 1. Bootstrap with Initial Context

```typescript
async function bootstrap(mem: Engram) {
  await mem.store('User timezone: UTC-8', {
    category: 'fact',
    importance: 0.9,
  });
  await mem.store('User language: English', {
    category: 'preference',
    importance: 0.9,
  });
}
```

### 2. Use Categories Consistently

```typescript
// Good
await mem.store('User prefers dark mode', { category: 'preference' });
await mem.store('User lives in SF', { category: 'fact' });

// Avoid mixing categories
await mem.store('User prefers dark mode and lives in SF', { category: 'fact' });
```

### 3. Set Appropriate Importance

```typescript
// Critical info
await mem.store('User API key: abc123', { importance: 1.0 });

// Important preference
await mem.store('User prefers TypeScript', { importance: 0.8 });

// Contextual detail
await mem.store('User asked about weather', { importance: 0.3 });
```

### 4. Tune for Your Use Case

```typescript
// Chatbot: short-term, recent context
{ decayHalfLifeDays: 7, recency: 0.5 }

// Knowledge base: long-term, important facts
{ decayHalfLifeDays: 365, importance: 0.5 }

// Support agent: balance + common issues
{ decayHalfLifeDays: 30, accessFrequency: 0.2 }
```

### 5. Clean Up Regularly

```typescript
import cron from 'node-cron';

// Daily cleanup
cron.schedule('0 0 * * *', async () => {
  await mem.forget({ mode: 'normal' });
  await mem.merge({ similarityThreshold: 0.85 });
});
```

---

## See Also

- [API Reference](./API.md) - Method documentation
- [Configuration Guide](./CONFIGURATION.md) - Tuning options
- [Storage Guide](./STORAGE.md) - Storage backends
- [How It Works](./HOW_IT_WORKS.md) - Algorithm details
