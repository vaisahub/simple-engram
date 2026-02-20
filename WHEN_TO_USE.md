# When to Use Simple Engram 🤔

## Quick Answer

Use **simple-engram** when you're building an AI agent or chatbot that needs to **remember conversations** across multiple interactions.

---

## 🎯 Perfect Use Cases

### 1. **AI Chatbots with Memory**

```typescript
import { Engram } from 'simple-engram';
import OpenAI from 'openai';

const client = new OpenAI();
const memory = new Engram({
  llm: async (prompt) => {
    const response = await client.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
    });
    return response.choices[0].message.content;
  },
});

// User conversation happens
const conversation = [
  { role: 'user', content: 'Hi, my name is Alice and I love pizza' },
  { role: 'assistant', content: 'Nice to meet you, Alice!' },
];

// 💾 Store the conversation
await memory.remember(conversation);

// Later... (days/weeks later)
const context = await memory.context('user preferences');
// Returns: "Alice loves pizza"

// Use context in your chatbot
const systemPrompt = `You are a helpful assistant.\n\nContext: ${context}`;
```

**Why use simple-engram here?**
- User expects bot to remember their name and preferences
- Conversations span multiple sessions
- Need to recall relevant information contextually

---

### 2. **Personal AI Assistants**

```typescript
// User talks to their AI assistant throughout the day
await memory.remember([
  { role: 'user', content: 'Schedule meeting with John at 3pm tomorrow' },
  { role: 'assistant', content: 'Meeting scheduled!' },
]);

await memory.remember([
  { role: 'user', content: 'I hate monday meetings' },
  { role: 'assistant', content: 'Noted!' },
]);

// Later when scheduling
const preferences = await memory.context('meeting preferences');
// AI knows: "User hates monday meetings, has meeting with John at 3pm"
```

**Why use simple-engram here?**
- Assistant needs to learn user preferences over time
- Should recall past commitments and habits
- Builds a personalized experience

---

### 3. **Customer Support Bots**

```typescript
// Multi-session support ticket
const customerMem = new Engram({
  llm,
  namespace: `customer-${userId}`, // Isolate per customer
});

// Session 1: Initial problem
await customerMem.remember([
  { role: 'user', content: "My payment isn't working" },
  { role: 'assistant', content: 'Let me help. Which card?' },
  { role: 'user', content: 'Visa ending in 1234' },
]);

// Session 2: Follow-up (days later)
const history = await customerMem.context('payment issue');
// Bot remembers: "Customer had payment issue with Visa 1234"
```

**Why use simple-engram here?**
- Support spans multiple sessions
- Context from previous conversations critical
- Avoid asking same questions repeatedly

---

### 4. **AI Coding Assistants**

```typescript
const devMem = new Engram({ llm, namespace: 'project-xyz' });

// Conversation about codebase
await devMem.remember([
  { role: 'user', content: 'We use React with TypeScript' },
  { role: 'assistant', content: 'Great choice!' },
  { role: 'user', content: 'Our API is REST-based' },
]);

// Later when generating code
const context = await devMem.context('tech stack');
// AI knows: "Project uses React, TypeScript, REST API"
```

**Why use simple-engram here?**
- Assistant learns codebase patterns
- Remembers architectural decisions
- Provides contextually relevant suggestions

---

### 5. **Educational/Tutoring Bots**

```typescript
const studentMem = new Engram({ llm, namespace: `student-${studentId}` });

await studentMem.remember([
  { role: 'user', content: "I don't understand recursion" },
  { role: 'assistant', content: "Let's practice..." },
]);

await studentMem.remember([
  { role: 'user', content: 'I aced the recursion test!' },
  { role: 'assistant', content: 'Excellent progress!' },
]);

// Later
const progress = await studentMem.context('learning progress');
// Tutor knows: "Student struggled with recursion but mastered it"
```

**Why use simple-engram here?**
- Track student progress over time
- Adapt teaching based on past struggles
- Provide personalized learning path

---

### 6. **Multi-User Applications**

```typescript
// Separate memory per user
const getUserMemory = (userId: string) => {
  return new Engram({
    llm,
    namespace: `user-${userId}`,
  });
};

// User 1's memories stay isolated
const alice = getUserMemory('alice');
await alice.remember([{ role: 'user', content: 'I like cats' }]);

// User 2's memories are separate
const bob = getUserMemory('bob');
await bob.remember([{ role: 'user', content: 'I like dogs' }]);
```

**Why use simple-engram here?**
- Need per-user memory isolation
- Scale to thousands of users
- Simple namespace-based separation

---

## 🚫 When NOT to Use Simple Engram

### ❌ Single-shot Q&A (No Memory Needed)

```typescript
// Don't use simple-engram for this:
const answer = await llm('What is 2+2?');
// Just call your LLM directly
```

### ❌ Very Large Scale (Millions of Memories)

If you need to store millions of memories with complex vector search, use:
- Pinecone, Weaviate, or Qdrant (dedicated vector databases)
- simple-engram is optimized for <100k memories per namespace

### ❌ Real-time Collaborative Filtering

If you need recommendations across all users:
- Use dedicated recommendation engines
- simple-engram is for **per-agent** or **per-user** memory

### ❌ When Context Window is Sufficient

```typescript
// If your entire conversation fits in context (e.g., <100 messages)
// You might not need persistent memory yet
const messages = [...allConversationHistory]; // Fits in context
await llm(messages);
```

---

## 📋 Decision Tree

```
Do you need your AI to remember things across sessions?
├─ NO → Don't use simple-engram (just use LLM context)
└─ YES → Continue...

Do you have <100k memories per user/agent?
├─ NO → Use dedicated vector DB (Pinecone, Weaviate)
└─ YES → Continue...

Do you want minimal setup?
├─ NO → You might want more complex solutions
└─ YES → ✅ Use simple-engram!
```

---

## 💡 Real-World Example

### Before Simple Engram (Manual Memory)

```typescript
// You'd have to manually:
const conversationHistory = []; // Store in database
conversationHistory.push(message);

// Later, retrieve and search
const relevant = await searchDatabase(conversationHistory, query);
const context = buildContext(relevant);
```

**Problems:**
- 50+ lines of code
- Database schema design
- Search/ranking logic
- Duplicate detection
- Context formatting

### After Simple Engram (One Line)

```typescript
await memory.remember(messages); // That's it!

// Later
const context = await memory.context(query); // Magic!
```

**Benefits:**
- 2 lines of code
- No database setup
- Built-in search & ranking
- Automatic duplicate handling
- Formatted context ready to use

---

## 🎬 Getting Started

```bash
npm install simple-engram
```

```typescript
import { Engram } from 'simple-engram';

// 1. Bring your LLM
const mem = new Engram({ llm: yourLLMFunction });

// 2. Remember conversations
await mem.remember(messages);

// 3. Recall when needed
const context = await mem.context('user preferences');

// That's it! 🎉
```

---

## 📊 Comparison

| Feature | Manual Solution | simple-engram |
|---------|----------------|---------------|
| Setup time | Hours/days | 5 minutes |
| Code complexity | 100+ lines | 3 lines |
| Duplicate handling | Manual | Automatic |
| Context ranking | Manual | Automatic |
| Memory decay | Manual | Built-in |
| Export/import | Manual | Built-in |
| Dependencies | Many | Zero |

---

## 🚀 Start Building

Check out the [README.md](./README.md) for full documentation and examples!
