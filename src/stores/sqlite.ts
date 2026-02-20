/**
 * SQLite-based persistent storage adapter
 * Fast, ACID-compliant, single-file database
 */

import type { StoreAdapter, Memory, MemoryFilter } from "../types.js";
import { StoreError } from "../errors.js";

// Dynamic import for better-sqlite3 (optional dependency)
let Database: any = null;
try {
  Database = (await import("better-sqlite3")).default;
} catch {
  // Not installed - will error if attempted to use
}

/**
 * SQLite store configuration
 */
export interface SqliteStoreConfig {
  /**
   * Path to SQLite database file
   * @default './engram.db'
   */
  path?: string;

  /**
   * Enable WAL mode for better concurrency
   * @default true
   */
  wal?: boolean;

  /**
   * Memory-only database (no persistence)
   * @default false
   */
  memory?: boolean;

  /**
   * Enable verbose logging
   * @default false
   */
  verbose?: boolean;
}

/**
 * SQLite store adapter
 */
export class SqliteStore implements StoreAdapter {
  public readonly name = "SqliteStore";
  private db: any;
  private config: Required<SqliteStoreConfig>;

  constructor(config: SqliteStoreConfig = {}) {
    if (!Database) {
      throw new StoreError(
        "better-sqlite3 not installed. Run: npm install better-sqlite3",
      );
    }

    this.config = {
      path: config.path ?? "./engram.db",
      wal: config.wal ?? true,
      memory: config.memory ?? false,
      verbose: config.verbose ?? false,
    };

    // Open database
    const dbPath = this.config.memory ? ":memory:" : this.config.path;
    this.db = new Database(dbPath, {
      verbose: this.config.verbose ? console.log : undefined,
    });

    // Enable WAL mode for better concurrency
    if (this.config.wal && !this.config.memory) {
      this.db.pragma("journal_mode = WAL");
    }

    // Initialize schema
    this.initSchema();
  }

  /**
   * Initialize database schema
   */
  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        category TEXT NOT NULL,
        source TEXT NOT NULL,
        surprise REAL NOT NULL,
        importance REAL NOT NULL,
        accessCount INTEGER NOT NULL DEFAULT 0,
        lastAccessed INTEGER NOT NULL,
        createdAt INTEGER NOT NULL,
        embedding BLOB,
        metadata TEXT NOT NULL,
        namespace TEXT NOT NULL DEFAULT 'default',
        ttl INTEGER,
        expiresAt INTEGER,
        version INTEGER NOT NULL DEFAULT 1,
        history TEXT NOT NULL DEFAULT '[]',
        decayedImportance REAL
      );

      CREATE INDEX IF NOT EXISTS idx_namespace
        ON memories(namespace);

      CREATE INDEX IF NOT EXISTS idx_category
        ON memories(namespace, category);

      CREATE INDEX IF NOT EXISTS idx_importance
        ON memories(namespace, importance DESC);

      CREATE INDEX IF NOT EXISTS idx_created
        ON memories(namespace, createdAt DESC);

      CREATE INDEX IF NOT EXISTS idx_expires
        ON memories(expiresAt)
        WHERE expiresAt IS NOT NULL;
    `);
  }

  /**
   * Serialize memory to database row
   */
  private serialize(memory: Memory): any {
    return {
      id: memory.id,
      content: memory.content,
      category: memory.category,
      source: memory.source,
      surprise: memory.surprise,
      importance: memory.importance,
      accessCount: memory.accessCount,
      lastAccessed: memory.lastAccessed,
      createdAt: memory.createdAt,
      embedding: memory.embedding
        ? Buffer.from(new Float32Array(memory.embedding).buffer)
        : null,
      metadata: JSON.stringify(memory.metadata),
      namespace: memory.namespace,
      ttl: memory.ttl,
      expiresAt: memory.expiresAt,
      version: memory.version,
      history: JSON.stringify(memory.history),
      decayedImportance: memory.decayedImportance ?? null,
    };
  }

  /**
   * Deserialize database row to memory
   */
  private deserialize(row: any): Memory {
    return {
      id: row.id,
      content: row.content,
      category: row.category,
      source: row.source,
      surprise: row.surprise,
      importance: row.importance,
      accessCount: row.accessCount,
      lastAccessed: row.lastAccessed,
      createdAt: row.createdAt,
      embedding: row.embedding
        ? Array.from(new Float32Array(row.embedding.buffer))
        : null,
      metadata: JSON.parse(row.metadata),
      namespace: row.namespace,
      ttl: row.ttl,
      expiresAt: row.expiresAt,
      version: row.version,
      history: JSON.parse(row.history),
      decayedImportance: row.decayedImportance,
    };
  }

  async get(id: string): Promise<Memory | null> {
    const stmt = this.db.prepare("SELECT * FROM memories WHERE id = ?");
    const row = stmt.get(id);
    return row ? this.deserialize(row) : null;
  }

  async put(memory: Memory): Promise<void> {
    const data = this.serialize(memory);
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO memories (
        id, content, category, source, surprise, importance,
        accessCount, lastAccessed, createdAt, embedding, metadata,
        namespace, ttl, expiresAt, version, history, decayedImportance
      ) VALUES (
        @id, @content, @category, @source, @surprise, @importance,
        @accessCount, @lastAccessed, @createdAt, @embedding, @metadata,
        @namespace, @ttl, @expiresAt, @version, @history, @decayedImportance
      )
    `);
    stmt.run(data);
  }

  async delete(id: string): Promise<void> {
    const stmt = this.db.prepare("DELETE FROM memories WHERE id = ?");
    stmt.run(id);
  }

  async has(id: string): Promise<boolean> {
    const stmt = this.db.prepare("SELECT 1 FROM memories WHERE id = ? LIMIT 1");
    return stmt.get(id) !== undefined;
  }

  async list(options: MemoryFilter = {}): Promise<Memory[]> {
    let query = "SELECT * FROM memories WHERE namespace = ?";
    const params: any[] = [options.namespace ?? "default"];

    // Filter by categories
    if (options.categories && options.categories.length > 0) {
      const placeholders = options.categories.map(() => "?").join(",");
      query += ` AND category IN (${placeholders})`;
      params.push(...options.categories);
    }

    // Filter by minimum importance
    if (options.minImportance !== undefined) {
      query += " AND importance >= ?";
      params.push(options.minImportance);
    }

    // Filter by date range
    if (options.since !== undefined) {
      query += " AND createdAt >= ?";
      params.push(options.since);
    }
    if (options.maxAge !== undefined) {
      const cutoff = Date.now() - options.maxAge * 24 * 60 * 60 * 1000;
      query += " AND createdAt >= ?";
      params.push(cutoff);
    }

    // Sorting
    const sortBy = options.sortBy ?? "createdAt";
    const sortOrder = options.sortOrder ?? "desc";
    query += ` ORDER BY ${sortBy} ${sortOrder.toUpperCase()}`;

    // Pagination
    if (options.limit !== undefined) {
      query += " LIMIT ?";
      params.push(options.limit);
      if (options.offset !== undefined) {
        query += " OFFSET ?";
        params.push(options.offset);
      }
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params);
    return rows.map((row: any) => this.deserialize(row));
  }

  async search(
    query: string,
    k: number,
    namespace?: string,
  ): Promise<Memory[]> {
    const ns = namespace ?? "default";

    // Simple keyword-based search using FTS or LIKE
    // For better search, consider enabling FTS5 extension
    const stmt = this.db.prepare(`
      SELECT * FROM memories
      WHERE namespace = ? AND content LIKE ?
      ORDER BY importance DESC
      LIMIT ?
    `);

    const rows = stmt.all(ns, `%${query}%`, k);
    return rows.map((row: any) => this.deserialize(row));
  }

  async count(namespace?: string): Promise<number> {
    const ns = namespace ?? "default";
    const stmt = this.db.prepare(
      "SELECT COUNT(*) as count FROM memories WHERE namespace = ?",
    );
    const result = stmt.get(ns);
    return result.count;
  }

  async clear(namespace?: string): Promise<void> {
    const ns = namespace ?? "default";
    const stmt = this.db.prepare("DELETE FROM memories WHERE namespace = ?");
    stmt.run(ns);
  }

  async dump(namespace?: string): Promise<Memory[]> {
    const ns = namespace ?? "default";
    const stmt = this.db.prepare("SELECT * FROM memories WHERE namespace = ?");
    const rows = stmt.all(ns);
    return rows.map((row: any) => this.deserialize(row));
  }

  async putMany(memories: Memory[]): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO memories (
        id, content, category, source, surprise, importance,
        accessCount, lastAccessed, createdAt, embedding, metadata,
        namespace, ttl, expiresAt, version, history, decayedImportance
      ) VALUES (
        @id, @content, @category, @source, @surprise, @importance,
        @accessCount, @lastAccessed, @createdAt, @embedding, @metadata,
        @namespace, @ttl, @expiresAt, @version, @history, @decayedImportance
      )
    `);

    const transaction = this.db.transaction((mems: Memory[]) => {
      for (const memory of mems) {
        stmt.run(this.serialize(memory));
      }
    });

    transaction(memories);
  }

  async deleteMany(ids: string[]): Promise<void> {
    const placeholders = ids.map(() => "?").join(",");
    const stmt = this.db.prepare(
      `DELETE FROM memories WHERE id IN (${placeholders})`,
    );
    stmt.run(...ids);
  }

  async prune(timestamp: number, namespace?: string): Promise<number> {
    const ns = namespace ?? "default";
    const stmt = this.db.prepare(`
      DELETE FROM memories
      WHERE namespace = ?
        AND expiresAt IS NOT NULL
        AND expiresAt <= ?
    `);
    const result = stmt.run(ns, timestamp);
    return result.changes;
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
    }
  }

  /**
   * Run VACUUM to reclaim space
   */
  vacuum(): void {
    this.db.exec("VACUUM");
  }

  /**
   * Get database statistics
   */
  stats(): {
    pageSize: number;
    pageCount: number;
    freePages: number;
    sizeBytes: number;
  } {
    const pageSize = this.db.pragma("page_size", { simple: true });
    const pageCount = this.db.pragma("page_count", { simple: true });
    const freePages = this.db.pragma("freelist_count", { simple: true });

    return {
      pageSize,
      pageCount,
      freePages,
      sizeBytes: pageSize * pageCount,
    };
  }
}
