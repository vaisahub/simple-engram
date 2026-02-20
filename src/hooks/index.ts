/**
 * Hooks system for Engram
 * Allows users to inject custom logic at key points in the pipeline
 */

import type {
  EngramHooks,
  Memory,
  Message,
  MemoryCandidate,
} from "../types.js";

/**
 * Run beforeStore hook
 */
export async function runBeforeStore(
  memory: Memory,
  hooks?: EngramHooks,
): Promise<Memory | null> {
  if (!hooks?.beforeStore) {
    return memory;
  }

  try {
    const result = await hooks.beforeStore(memory);
    return result;
  } catch (error) {
    // If hook throws, treat as rejection
    return null;
  }
}

/**
 * Run afterStore hook
 */
export async function runAfterStore(
  memory: Memory,
  hooks?: EngramHooks,
): Promise<void> {
  if (!hooks?.afterStore) {
    return;
  }

  try {
    await hooks.afterStore(memory);
  } catch {
    // Swallow errors in afterStore hooks
  }
}

/**
 * Run beforeRecall hook
 */
export async function runBeforeRecall(
  query: string,
  hooks?: EngramHooks,
): Promise<string> {
  if (!hooks?.beforeRecall) {
    return query;
  }

  try {
    const result = await hooks.beforeRecall(query);
    return result;
  } catch {
    // On error, return original query
    return query;
  }
}

/**
 * Run afterRecall hook
 */
export async function runAfterRecall(
  memories: Memory[],
  hooks?: EngramHooks,
): Promise<Memory[]> {
  if (!hooks?.afterRecall) {
    return memories;
  }

  try {
    const result = await hooks.afterRecall(memories);
    return result;
  } catch {
    // On error, return original memories
    return memories;
  }
}

/**
 * Run beforeExtract hook
 */
export async function runBeforeExtract(
  messages: Message[],
  hooks?: EngramHooks,
): Promise<Message[]> {
  if (!hooks?.beforeExtract) {
    return messages;
  }

  try {
    const result = await hooks.beforeExtract(messages);
    return result;
  } catch {
    // On error, return original messages
    return messages;
  }
}

/**
 * Run afterExtract hook
 */
export async function runAfterExtract(
  candidates: MemoryCandidate[],
  hooks?: EngramHooks,
): Promise<MemoryCandidate[]> {
  if (!hooks?.afterExtract) {
    return candidates;
  }

  try {
    const result = await hooks.afterExtract(candidates);
    return result;
  } catch {
    // On error, return original candidates
    return candidates;
  }
}

/**
 * Run beforeForget hook
 */
export async function runBeforeForget(
  memories: Memory[],
  hooks?: EngramHooks,
): Promise<Memory[]> {
  if (!hooks?.beforeForget) {
    return memories;
  }

  try {
    const result = await hooks.beforeForget(memories);
    return result;
  } catch {
    // On error, return original memories
    return memories;
  }
}
