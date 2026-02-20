/**
 * JSON export/import format
 */

import type { Memory } from '../types.js';

export interface JsonExportData {
  engram: {
    version: string;
    exportedAt: string;
    namespace: string;
    count: number;
    categories: string[];
  };
  memories: Memory[];
}

/**
 * Export memories to JSON format
 */
export function exportToJson(memories: Memory[], namespace: string, categories: string[]): string {
  const data: JsonExportData = {
    engram: {
      version: '0.1.0',
      exportedAt: new Date().toISOString(),
      namespace,
      count: memories.length,
      categories,
    },
    memories,
  };

  return JSON.stringify(data, null, 2);
}

/**
 * Parse JSON export data
 */
export function parseJsonExport(json: string): Memory[] {
  const data = JSON.parse(json) as JsonExportData;

  if (!data.engram || !data.memories) {
    throw new Error('Invalid Engram JSON export format');
  }

  return data.memories.map((memory) => {
    // Validate required fields
    if (!memory.id || !memory.content || !memory.category) {
      throw new Error('Invalid memory record in JSON export');
    }

    return memory;
  });
}
