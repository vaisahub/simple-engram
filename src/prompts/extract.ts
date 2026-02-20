/**
 * Extraction prompt builder for memory extraction
 */

import type { Message } from '../types.js';

// Default category descriptions
const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  fact: 'objective information ("Project uses PostgreSQL 16")',
  preference: 'subjective choice ("User prefers dark mode")',
  skill: 'a procedure or how-to ("Deploy by running pnpm build then vercel --prod")',
  episode: 'an event that happened ("Fixed a null pointer bug in auth.ts on Feb 18")',
  context: 'environment/setup info ("Working on a React Native mobile app")',
};

/**
 * Build the extraction prompt with dynamic categories
 */
export function buildExtractionPrompt(messages: Message[], categories: string[]): string {
  const categoryList = categories
    .map((c) => {
      const description = CATEGORY_DESCRIPTIONS[c] || `custom category "${c}"`;
      return `- ${c}: ${description}`;
    })
    .join('\n');

  const conversationText = messages.map((m) => `${m.role}: ${m.content}`).join('\n');

  return `You are a memory extraction engine. Analyze the conversation below and extract discrete, memorable facts.

Return ONLY a valid JSON array. Each item must have exactly two fields:
- "content": a single atomic fact written as one clear statement
- "category": exactly one of ${JSON.stringify(categories)}

Category definitions:
${categoryList}

Rules:
1. Extract ONLY genuinely new or important information
2. Skip greetings, filler, acknowledgments, and small talk
3. Each fact must be understandable without the original conversation
4. Prefer specific details over vague generalizations
5. If nothing worth remembering exists, return []
6. Do NOT wrap the JSON in markdown code fences

Conversation:
---
${conversationText}
---

JSON array:`;
}

/**
 * Build retry prompt when first extraction fails
 */
export function buildRetryPrompt(messages: Message[]): string {
  const conversationText = messages.map((m) => `${m.role}: ${m.content}`).join('\n');

  return `Your previous response was not valid JSON. Please try again.

Return ONLY a JSON array like this — no other text:
[{"content": "fact here", "category": "fact"}]

If nothing worth remembering, return exactly: []

Conversation:
---
${conversationText}
---`;
}
