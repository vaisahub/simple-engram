# Storage Guide

Guide to all storage adapters and building custom stores.

## Overview

Engram supports multiple storage backends:
- **MemoryStore** - In-memory (default)
- **JsonFileStore** - JSON file persistence
- **SqliteStore** - SQLite database (production)
- **Custom** - Build your own adapter

---

## MemoryStore (In-Memory)

Fast, no persistence. Data lost when process ends.

```typescript
import { Engram, MemoryStore } from 'simple-engram';

const mem = new Engram({
  llm,
  store: new MemoryStore(),
});
```

### Features
- ✅ Zero dependencies
- ✅ Fastest performance
- ✅ Simple API
- ❌ No persistence
- ❌ Memory-limited

### Use When
- Prototyping
- Testing
- Short-lived sessions
- Memory < 10k items

### Performance
| Operation | Time |
|-----------|------|
| Store | < 1ms |
| Recall | < 20ms |
| Merge | < 50ms |
| Export | < 10ms |

---

## JsonFileStore

Simple file persistence. Good for < 10k memories.

```typescript
import { Engram, JsonFileStore } from 'simple-engram';

const mem = new Engram({
  llm,
  store: new JsonFileStore({
    path: './memories.json',
    pretty: false,  // Pretty-print JSON (default: false)
  }),
});
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `path` | `string` | Required | Path to JSON file |
| `pretty` | `boolean` | `false` | Pretty-print JSON |

### Features
- ✅ Zero dependencies
- ✅ Simple backup/restore
- ✅ Human-readable format
- ❌ Loads entire file into memory
- ❌ Not suitable for large datasets

### Use When
- Development
- Small datasets (< 10k memories)
- Simple backup needs
- Human inspection required

### Performance
| Operation | Time (1k memories) |
|-----------|-------------------|
| Store | < 5ms |
| Recall | < 20ms |
| Load (startup) | < 50ms |
| Save | < 100ms |

### File Format

```json
[
  {
    "id": "abc123",
    "content": "User prefers TypeScript",
    "category": "preference",
    "importance": 0.85,
    "createdAt": 1234567890,
    "accessedAt": 1234567890,
    "accessCount": 0,
    "expiresAt": null,
    "embedding": [0.23, -0.45, ...]
  }
]
```

### Manual Editing

You can manually edit the JSON file while the app is stopped:

```typescript
// Stop app
// Edit memories.json
// Restart app - changes loaded automatically
```

---

## SqliteStore (Production)

Fast, scalable, handles millions of memories.

### Installation

```bash
npm install better-sqlite3
```

### Usage

```typescript
import { Engram, SqliteStore } from 'simple-engram';

const mem = new Engram({
  llm,
  store: new SqliteStore({
    path: './memories.db',
    verbose: undefined,  // Optional: console.log for debugging
  }),
});
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `path` | `string` | Required | Path to SQLite file |
| `verbose` | `function` | `undefined` | Log SQL queries (e.g., console.log) |

### Features
- ✅ Handles millions of memories
- ✅ Automatic indexing
- ✅ Transaction support
- ✅ ACID guarantees
- ✅ Efficient filtering
- ⚠️ Requires better-sqlite3 dependency

### Use When
- Production
- Large datasets (10k+ memories)
- Multi-user systems
- Need indexing/queries

### Performance
| Operation | Time (100k memories) |
|-----------|---------------------|
| Store | < 5ms |
| Recall | < 50ms |
| Merge | < 200ms |
| Export | < 1s |

### Schema

```sql
CREATE TABLE memories (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  category TEXT NOT NULL,
  importance REAL NOT NULL,
  createdAt INTEGER NOT NULL,
  accessedAt INTEGER NOT NULL,
  accessCount INTEGER NOT NULL,
  expiresAt INTEGER,
  embedding BLOB,
  metadata TEXT
);

CREATE INDEX idx_category ON memories(category);
CREATE INDEX idx_importance ON memories(importance);
CREATE INDEX idx_createdAt ON memories(createdAt);
CREATE INDEX idx_expiresAt ON memories(expiresAt);
```

### Advanced Usage

**Debugging SQL queries:**
```typescript
const store = new SqliteStore({
  path: './memories.db',
  verbose: (sql) => console.log('[SQL]', sql),
});
```

**Direct database access:**
```typescript
import Database from 'better-sqlite3';

const db = new Database('./memories.db');
const rows = db.prepare('SELECT * FROM memories WHERE importance > ?').all(0.8);
```

---

## Comparison

| Feature | MemoryStore | JsonFileStore | SqliteStore |
|---------|-------------|---------------|-------------|
| **Dependencies** | 0 | 0 | 1 (better-sqlite3) |
| **Max memories** | ~10k | ~10k | Millions |
| **Persistence** | No | Yes | Yes |
| **Indexing** | No | No | Yes |
| **Transactions** | No | No | Yes |
| **Human-readable** | No | Yes | No |
| **Speed (small)** | Fastest | Fast | Fast |
| **Speed (large)** | N/A | Slow | Fastest |
| **Memory usage** | High | High | Low |

---

## Custom Storage Adapter

Build your own storage backend by implementing the `Store` interface.

### Interface

```typescript
interface Store {
  // Store a memory
  store(memory: Memory): Promise<Memory>;

  // Get memory by ID
  get(id: string): Promise<Memory | null>;

  // Get all memories
  getAll(): Promise<Memory[]>;

  // Update a memory
  update(id: string, updates: Partial<Memory>): Promise<Memory>;

  // Delete a memory
  delete(id: string): Promise<void>;

  // Delete all memories
  clear(): Promise<void>;

  // Search memories
  search(query: string, options?: SearchOptions): Promise<Memory[]>;
}
```

### Example: Redis Adapter

```typescript
import { Store, Memory } from 'simple-engram';
import Redis from 'ioredis';

export class RedisStore implements Store {
  private client: Redis;
  private keyPrefix: string;

  constructor(options: { url: string; prefix?: string }) {
    this.client = new Redis(options.url);
    this.keyPrefix = options.prefix || 'engram:';
  }

  async store(memory: Memory): Promise<Memory> {
    const key = `${this.keyPrefix}${memory.id}`;
    await this.client.set(key, JSON.stringify(memory));
    await this.client.sadd(`${this.keyPrefix}all`, memory.id);
    return memory;
  }

  async get(id: string): Promise<Memory | null> {
    const key = `${this.keyPrefix}${id}`;
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  async getAll(): Promise<Memory[]> {
    const ids = await this.client.smembers(`${this.keyPrefix}all`);
    const memories = await Promise.all(
      ids.map((id) => this.get(id))
    );
    return memories.filter((m) => m !== null) as Memory[];
  }

  async update(id: string, updates: Partial<Memory>): Promise<Memory> {
    const existing = await this.get(id);
    if (!existing) throw new Error(`Memory ${id} not found`);
    const updated = { ...existing, ...updates };
    await this.store(updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    const key = `${this.keyPrefix}${id}`;
    await this.client.del(key);
    await this.client.srem(`${this.keyPrefix}all`, id);
  }

  async clear(): Promise<void> {
    const ids = await this.client.smembers(`${this.keyPrefix}all`);
    const keys = ids.map((id) => `${this.keyPrefix}${id}`);
    if (keys.length > 0) {
      await this.client.del(...keys);
    }
    await this.client.del(`${this.keyPrefix}all`);
  }

  async search(query: string, options?: SearchOptions): Promise<Memory[]> {
    // Implement search logic
    const all = await this.getAll();
    return all; // Simplified
  }
}

// Usage
import { Engram } from 'simple-engram';

const mem = new Engram({
  llm,
  store: new RedisStore({ url: 'redis://localhost:6379' }),
});
```

### Example: PostgreSQL Adapter

```typescript
import { Store, Memory } from 'simple-engram';
import { Pool } from 'pg';

export class PostgresStore implements Store {
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
    this.init();
  }

  private async init() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        category TEXT NOT NULL,
        importance REAL NOT NULL,
        created_at BIGINT NOT NULL,
        accessed_at BIGINT NOT NULL,
        access_count INTEGER NOT NULL,
        expires_at BIGINT,
        embedding REAL[],
        metadata JSONB
      )
    `);

    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_category ON memories(category);
      CREATE INDEX IF NOT EXISTS idx_importance ON memories(importance);
    `);
  }

  async store(memory: Memory): Promise<Memory> {
    await this.pool.query(
      `INSERT INTO memories (id, content, category, importance, created_at, accessed_at, access_count, expires_at, embedding, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO UPDATE SET
         content = $2, category = $3, importance = $4,
         accessed_at = $6, access_count = $7`,
      [
        memory.id,
        memory.content,
        memory.category,
        memory.importance,
        memory.createdAt,
        memory.accessedAt,
        memory.accessCount,
        memory.expiresAt,
        memory.embedding,
        JSON.stringify(memory.metadata || {}),
      ]
    );
    return memory;
  }

  async get(id: string): Promise<Memory | null> {
    const result = await this.pool.query(
      'SELECT * FROM memories WHERE id = $1',
      [id]
    );
    return result.rows[0] ? this.rowToMemory(result.rows[0]) : null;
  }

  async getAll(): Promise<Memory[]> {
    const result = await this.pool.query('SELECT * FROM memories');
    return result.rows.map(this.rowToMemory);
  }

  private rowToMemory(row: any): Memory {
    return {
      id: row.id,
      content: row.content,
      category: row.category,
      importance: row.importance,
      createdAt: row.created_at,
      accessedAt: row.accessed_at,
      accessCount: row.access_count,
      expiresAt: row.expires_at,
      embedding: row.embedding,
      metadata: row.metadata,
    };
  }

  // ... implement other methods
}

// Usage
const mem = new Engram({
  llm,
  store: new PostgresStore('postgresql://localhost/memories'),
});
```

---

## Migration Between Stores

### Export from one, import to another

```typescript
// Export from old store
const oldMem = new Engram({
  llm,
  store: new JsonFileStore({ path: './old.json' }),
});
const backup = await oldMem.export('json');

// Import to new store
const newMem = new Engram({
  llm,
  store: new SqliteStore({ path: './new.db' }),
});
await newMem.import(backup, 'json');
```

### Programmatic migration

```typescript
// Read from old store
const memories = await oldStore.getAll();

// Write to new store
for (const memory of memories) {
  await newStore.store(memory);
}
```

---

## Backup & Restore

### JSON Backup

```typescript
import fs from 'fs/promises';

// Backup
const json = await mem.export('json');
await fs.writeFile('backup.json', json);

// Restore
const backup = await fs.readFile('backup.json', 'utf-8');
await mem.import(backup, 'json');
```

### SQLite Backup

```bash
# Backup SQLite file
cp memories.db memories-backup.db

# Or use SQLite's backup command
sqlite3 memories.db ".backup memories-backup.db"
```

### Automated Backups

```typescript
import cron from 'node-cron';

// Backup every day at midnight
cron.schedule('0 0 * * *', async () => {
  const json = await mem.export('json');
  const filename = `backup-${Date.now()}.json`;
  await fs.writeFile(filename, json);
  console.log('Backup created:', filename);
});
```

---

## Best Practices

### Development
```typescript
const mem = new Engram({
  llm,
  store: new JsonFileStore({ path: './dev-memories.json', pretty: true }),
});
```

### Testing
```typescript
const mem = new Engram({
  llm,
  store: new MemoryStore(), // Fresh state per test
});
```

### Production
```typescript
const mem = new Engram({
  llm,
  store: new SqliteStore({ path: process.env.DB_PATH || './memories.db' }),
});
```

### Multi-tenant
```typescript
function getMemory(userId: string) {
  return new Engram({
    llm,
    store: new SqliteStore({ path: `./data/${userId}.db` }),
    namespace: userId,
  });
}
```

---

## Performance Tips

### Memory Store
- Keep < 10k memories
- Use for testing/prototyping only

### JSON File Store
- Keep < 10k memories
- Use pretty: false in production
- Don't use for high-frequency writes

### SQLite Store
- Use for 10k+ memories
- Regular VACUUM for optimization
- Consider WAL mode for concurrency

```typescript
import Database from 'better-sqlite3';

const db = new Database('./memories.db');
db.pragma('journal_mode = WAL'); // Write-Ahead Logging
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = -64000'); // 64MB cache
```

---

## See Also

- [API Reference](./API.md) - Method documentation
- [Configuration Guide](./CONFIGURATION.md) - All options
- [Examples](./EXAMPLES.md) - Real-world use cases
