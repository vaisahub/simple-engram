/**
 * Markdown export/import format
 */

import type { Memory } from "../types.js";
import { formatAge } from "../explainer.js";

/**
 * Export memories to Markdown format
 */
export function exportToMarkdown(
  memories: Memory[],
  namespace: string,
): string {
  const lines: string[] = [];

  // Header
  lines.push("# Engram Memory Export");
  lines.push(
    `> Exported: ${new Date().toISOString()} | Namespace: ${namespace} | Count: ${memories.length}`,
  );
  lines.push("");

  // Group by category
  const byCategory: Record<string, Memory[]> = {};
  for (const memory of memories) {
    if (!byCategory[memory.category]) {
      byCategory[memory.category] = [];
    }
    byCategory[memory.category].push(memory);
  }

  // Sort categories by count (descending)
  const sortedCategories = Object.keys(byCategory).sort(
    (a, b) => byCategory[b].length - byCategory[a].length,
  );

  // Output each category
  for (const category of sortedCategories) {
    const categoryMemories = byCategory[category];

    // Capitalize category name
    const displayName =
      category.charAt(0).toUpperCase() + category.slice(1) + "s";
    lines.push(`## ${displayName}`);

    // Sort by importance (descending)
    categoryMemories.sort((a, b) => b.importance - a.importance);

    for (const memory of categoryMemories) {
      const age = formatAge(memory.createdAt);
      const metadata = [
        `importance: ${memory.importance.toFixed(2)}`,
        `surprise: ${memory.surprise.toFixed(2)}`,
        `age: ${age}`,
        `accessed: ${memory.accessCount}×`,
        `v${memory.version}`,
      ].join(", ");

      lines.push(`- **${memory.content}** — ${metadata}`);
    }

    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Parse Markdown export
 * Extracts memories from markdown format
 */
export function parseMarkdownExport(markdown: string): Partial<Memory>[] {
  const memories: Partial<Memory>[] = [];
  const lines = markdown.split("\n");

  let currentCategory: string | null = null;

  for (const line of lines) {
    // Parse category headers
    if (line.startsWith("## ")) {
      const categoryName = line.slice(3).trim().toLowerCase();
      // Remove trailing 's' if present
      currentCategory = categoryName.endsWith("s")
        ? categoryName.slice(0, -1)
        : categoryName;
      continue;
    }

    // Parse memory lines
    if (line.startsWith("- **") && currentCategory) {
      // Extract content between ** **
      const contentMatch = line.match(/\*\*(.+?)\*\*/);
      if (!contentMatch) continue;

      const content = contentMatch[1];

      // Extract metadata
      const metaMatch = line.match(/— (.+)$/);
      let importance = 0.7;
      let surprise = 0.5;
      let accessCount = 0;
      let version = 1;

      if (metaMatch) {
        const meta = metaMatch[1];
        const impMatch = meta.match(/importance: ([\d.]+)/);
        const surMatch = meta.match(/surprise: ([\d.]+)/);
        const accMatch = meta.match(/accessed: (\d+)/);
        const verMatch = meta.match(/v(\d+)/);

        if (impMatch) importance = parseFloat(impMatch[1]);
        if (surMatch) surprise = parseFloat(surMatch[1]);
        if (accMatch) accessCount = parseInt(accMatch[1], 10);
        if (verMatch) version = parseInt(verMatch[1], 10);
      }

      memories.push({
        content,
        category: currentCategory,
        importance,
        surprise,
        accessCount,
        version,
        // Other fields will be filled in by the importer
      });
    }
  }

  return memories;
}
