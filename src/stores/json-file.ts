/**
 * JSON file store adapter
 * Persists memories to a single JSON file
 * Zero infrastructure — works out of the box
 */

import { readFile, writeFile, mkdir, rename, unlink } from "fs/promises";
import { existsSync } from "fs";
import { dirname } from "path";
import type { Memory, MemoryFilter, StoreAdapter } from "../types.js";
import { StoreError } from "../errors.js";
import { MemoryStore } from "./memory.js";

interface JsonFileData {
  version: string;
  memories: Memory[];
}

export class JsonFileStore implements StoreAdapter {
  readonly name = "JsonFileStore";
  private filePath: string;
  private memoryStore: MemoryStore;
  private loaded = false;
  private dirty = false;

  constructor(filePath = "./engram.json") {
    this.filePath = filePath;
    this.memoryStore = new MemoryStore();
  }

  /**
   * Load memories from file into memory
   */
  private async load(): Promise<void> {
    if (this.loaded) return;

    try {
      if (!existsSync(this.filePath)) {
        // File doesn't exist yet — start with empty store
        this.loaded = true;
        return;
      }

      const content = await readFile(this.filePath, "utf-8");
      const data: JsonFileData = JSON.parse(content);

      // Load all memories into memory store
      await this.memoryStore.putMany(data.memories);
      this.loaded = true;
    } catch (error) {
      // Try to recover from corrupted file
      if (error instanceof SyntaxError) {
        // Backup corrupted file
        const backupPath = `${this.filePath}.corrupted.${Date.now()}`;
        try {
          await rename(this.filePath, backupPath);
          console.warn(`Corrupted JSON file backed up to ${backupPath}`);
        } catch {
          // If backup fails, just delete the file
          await unlink(this.filePath).catch(() => {});
        }
        this.loaded = true;
        return;
      }

      throw new StoreError(`Failed to load from ${this.filePath}: ${error}`);
    }
  }

  /**
   * Persist memories to file
   */
  private async persist(): Promise<void> {
    if (!this.dirty) return;

    try {
      // Ensure directory exists
      const dir = dirname(this.filePath);
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true, mode: 0o700 });
      }

      const memories = await this.memoryStore.dump();
      const data: JsonFileData = {
        version: "0.1.0",
        memories,
      };

      // Atomic write: write to temp file, then rename
      const tempPath = `${this.filePath}.tmp`;
      await writeFile(tempPath, JSON.stringify(data, null, 2), {
        mode: 0o600, // Read/write for owner only
      });

      await rename(tempPath, this.filePath);
      this.dirty = false;
    } catch (error) {
      throw new StoreError(`Failed to persist to ${this.filePath}: ${error}`);
    }
  }

  async init(): Promise<void> {
    await this.load();
  }

  async close(): Promise<void> {
    await this.persist();
  }

  async get(id: string): Promise<Memory | null> {
    await this.load();
    return this.memoryStore.get(id);
  }

  async put(memory: Memory): Promise<void> {
    await this.load();
    await this.memoryStore.put(memory);
    this.dirty = true;
    await this.persist();
  }

  async delete(id: string): Promise<void> {
    await this.load();
    await this.memoryStore.delete(id);
    this.dirty = true;
    await this.persist();
  }

  async has(id: string): Promise<boolean> {
    await this.load();
    return this.memoryStore.has(id);
  }

  async list(filter?: MemoryFilter): Promise<Memory[]> {
    await this.load();
    return this.memoryStore.list(filter);
  }

  async search(query: string, k: number): Promise<Memory[]> {
    await this.load();
    return this.memoryStore.search(query, k);
  }

  async putMany(memories: Memory[]): Promise<void> {
    await this.load();
    await this.memoryStore.putMany(memories);
    this.dirty = true;
    await this.persist();
  }

  async deleteMany(ids: string[]): Promise<void> {
    await this.load();
    await this.memoryStore.deleteMany(ids);
    this.dirty = true;
    await this.persist();
  }

  async count(namespace?: string): Promise<number> {
    await this.load();
    return this.memoryStore.count(namespace);
  }

  async prune(before: number): Promise<number> {
    await this.load();
    const pruned = await this.memoryStore.prune(before);
    if (pruned > 0) {
      this.dirty = true;
      await this.persist();
    }
    return pruned;
  }

  async clear(namespace?: string): Promise<void> {
    await this.load();
    await this.memoryStore.clear(namespace);
    this.dirty = true;
    await this.persist();
  }

  async dump(): Promise<Memory[]> {
    await this.load();
    return this.memoryStore.dump();
  }
}
