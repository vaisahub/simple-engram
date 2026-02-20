/**
 * Memory extractor — converts conversations to memory candidates using LLM
 */

import type { Message, MemoryCandidate, LLMFunction } from "./types.js";
import { buildExtractionPrompt, buildRetryPrompt } from "./prompts/extract.js";
import { ExtractionError } from "./errors.js";

/**
 * Parse extraction response from LLM
 * Handles various formats including markdown code blocks
 */
function parseExtraction(raw: string, categories: string[]): MemoryCandidate[] {
  // Step 1: Strip markdown code fences if present
  const cleaned = raw
    .replace(/```json?\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  // Step 2: Try direct parse
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return validateCandidates(parsed, categories);
    }
  } catch {
    // Continue to step 3
  }

  // Step 3: Try to find array in the response
  const match = cleaned.match(/\[[\s\S]*?\]/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed)) {
        return validateCandidates(parsed, categories);
      }
    } catch {
      // Continue to step 4
    }
  }

  // Step 4: Give up
  return [];
}

/**
 * Validate and clean candidates
 */
function validateCandidates(
  arr: any[],
  categories: string[],
): MemoryCandidate[] {
  const validCategories = new Set(categories);

  return arr
    .filter(
      (item) =>
        typeof item === "object" &&
        typeof item.content === "string" &&
        item.content.trim().length > 0 &&
        typeof item.category === "string",
    )
    .map((item) => ({
      content: item.content.trim().slice(0, 500), // Enforce max length
      category: validCategories.has(item.category) ? item.category : "fact", // Default unknown categories to 'fact'
    }));
}

/**
 * Extract memory candidates from messages using LLM
 */
export async function extractMemories(
  messages: Message[],
  llm: LLMFunction,
  categories: string[],
): Promise<{
  candidates: MemoryCandidate[];
  errors: string[];
}> {
  const errors: string[] = [];

  try {
    // First attempt
    const prompt = buildExtractionPrompt(messages, categories);
    let response = await llm(prompt);
    let candidates = parseExtraction(response, categories);

    // If parsing failed, retry once with stricter prompt
    if (candidates.length === 0 && response.trim() !== "[]") {
      const retryPrompt = buildRetryPrompt(messages);
      response = await llm(retryPrompt);
      candidates = parseExtraction(response, categories);

      // If still failed, record error
      if (candidates.length === 0 && response.trim() !== "[]") {
        errors.push("extraction_parse_failed");
      }
    }

    return { candidates, errors };
  } catch (error) {
    if (error instanceof Error) {
      throw new ExtractionError(error.message);
    }
    throw new ExtractionError("Unknown error during extraction");
  }
}
