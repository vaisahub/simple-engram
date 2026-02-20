/**
 * Context formatting for system prompt injection
 */

import type { Memory, ContextOptions } from "./types.js";
import { formatAge } from "./explainer.js";
import { estimateTokens } from "./tokenizer.js";

/**
 * Format memories as bullets for system prompt
 */
function formatAsBullets(memories: Memory[], includeMetadata: boolean): string {
  const lines = memories.map((m) => {
    const age = formatAge(m.createdAt);
    const meta = includeMetadata
      ? ` [${m.category}, ${age}]`
      : ` [${m.category}]`;
    return `- ${m.content}${meta}`;
  });
  return lines.join("\n");
}

/**
 * Format memories as XML
 */
function formatAsXml(memories: Memory[], includeMetadata: boolean): string {
  const lines = ["<memories>"];

  for (const m of memories) {
    const age = formatAge(m.createdAt);
    const attrs: string[] = [`category="${m.category}"`];

    if (includeMetadata) {
      attrs.push(`age="${age}"`);
      attrs.push(`importance="${m.importance.toFixed(2)}"`);
    }

    lines.push(`  <memory ${attrs.join(" ")}>${escapeXml(m.content)}</memory>`);
  }

  lines.push("</memories>");
  return lines.join("\n");
}

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Format memories as prose
 */
function formatAsProse(memories: Memory[]): string {
  if (memories.length === 0) return "";

  const facts = memories.map((m) => m.content).join(", ");
  return `Based on previous interactions: ${facts}.`;
}

/**
 * Format memories as JSON
 */
function formatAsJson(memories: Memory[], includeMetadata: boolean): string {
  const items = memories.map((m) => {
    const age = formatAge(m.createdAt);
    const item: any = {
      content: m.content,
      category: m.category,
    };

    if (includeMetadata) {
      item.age = age;
      item.importance = m.importance;
      item.accessed = m.accessCount;
    }

    return item;
  });

  return JSON.stringify(items, null, 2);
}

/**
 * Apply token budgeting to memories
 * Select memories greedily by importance until budget is exhausted
 */
export function applyTokenBudget(
  memories: Memory[],
  maxTokens: number,
  format: "bullets" | "prose" | "xml" | "json",
  includeMetadata: boolean,
  header: string,
): Memory[] {
  if (maxTokens <= 0) return [];

  // Sort by decayed importance (highest first)
  const sorted = [...memories].sort((a, b) => {
    const impA = a.decayedImportance ?? a.importance;
    const impB = b.decayedImportance ?? b.importance;
    return impB - impA;
  });

  // Greedily add memories until budget exhausted
  const selected: Memory[] = [];
  let totalTokens = estimateTokens(header);

  for (const memory of sorted) {
    // Estimate tokens for this memory in the given format
    const memoryTokens = estimateMemoryTokens(memory, format, includeMetadata);

    if (totalTokens + memoryTokens <= maxTokens) {
      selected.push(memory);
      totalTokens += memoryTokens;
    }
  }

  return selected;
}

/**
 * Estimate tokens for a single memory in a given format
 */
function estimateMemoryTokens(
  memory: Memory,
  format: "bullets" | "prose" | "xml" | "json",
  includeMetadata: boolean,
): number {
  const baseTokens = estimateTokens(memory.content);

  switch (format) {
    case "bullets":
      // "- content [category, age]"
      return baseTokens + (includeMetadata ? 5 : 2);

    case "xml":
      // "<memory category="..." age="...">content</memory>"
      return baseTokens + (includeMetadata ? 15 : 8);

    case "json":
      // {"content": "...", "category": "...", "age": "..."}
      return baseTokens + (includeMetadata ? 10 : 5);

    case "prose":
      // "content, "
      return baseTokens + 1;

    default:
      return baseTokens;
  }
}

/**
 * Format memories for context injection
 */
export function formatContext(
  memories: Memory[],
  options: ContextOptions,
): string {
  const format = options.format ?? "bullets";
  const includeMetadata = options.includeMetadata ?? false;
  const header = options.header ?? "Relevant memories:";

  if (memories.length === 0) {
    return "";
  }

  // Apply token budget if specified
  let selected = memories;
  if (options.maxTokens !== undefined) {
    selected = applyTokenBudget(
      memories,
      options.maxTokens,
      format,
      includeMetadata,
      header,
    );
  }

  // Format based on type
  let content: string;
  switch (format) {
    case "bullets":
      content = formatAsBullets(selected, includeMetadata);
      return header ? `${header}\n${content}` : content;

    case "xml":
      content = formatAsXml(selected, includeMetadata);
      return content;

    case "prose":
      content = formatAsProse(selected);
      return content;

    case "json":
      content = formatAsJson(selected, includeMetadata);
      return content;

    default:
      content = formatAsBullets(selected, includeMetadata);
      return header ? `${header}\n${content}` : content;
  }
}
