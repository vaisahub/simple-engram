/**
 * CSV export format
 */

import type { Memory } from "../types.js";

/**
 * Escape CSV field
 */
function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Export memories to CSV format
 */
export function exportToCsv(memories: Memory[]): string {
  const lines: string[] = [];

  // Header
  lines.push(
    "id,content,category,surprise,importance,accessCount,createdAt,version,metadata",
  );

  // Data rows
  for (const memory of memories) {
    const row = [
      memory.id,
      escapeCsv(memory.content),
      memory.category,
      memory.surprise.toFixed(3),
      memory.importance.toFixed(3),
      memory.accessCount.toString(),
      memory.createdAt.toString(),
      memory.version.toString(),
      escapeCsv(JSON.stringify(memory.metadata)),
    ];

    lines.push(row.join(","));
  }

  return lines.join("\n");
}
