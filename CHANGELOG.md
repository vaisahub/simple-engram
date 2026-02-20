# Changelog

All notable changes to Engram will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-02-20

### Added - Phase 1: Core Memory Engine

#### Core Functionality
- **`remember(messages, opts?)`** — Extract and store memories from conversations using LLM
- **`store(content, opts?)`** — Manually store individual memories without LLM
- **`recall(query, opts?)`** — Retrieve relevant memories using keyword or vector search
- **`forget(opts?)`** — Prune old/low-importance memories with configurable modes (gentle/normal/aggressive)
- **`export(format)`** — Export memories to JSON, Markdown, or CSV formats
- **`import(data, format, opts?)`** — Import memories from JSON or Markdown exports
- **`bootstrap(conversations, opts?)`** — Bulk import from historical conversations with progress tracking
- **`stats()`** — Get comprehensive statistics about stored memories
- **`get(id)`** — Retrieve a specific memory by ID
- **`list(filter?)`** — List all memories with optional filtering

#### Surprise Scoring Algorithm
- Novelty detection using Jaccard similarity (keyword-based)
- Optional cosine similarity (embedding-based) when embeddings available
- Category rarity scoring
- Configurable surprise threshold (default: 0.3)
- Automatic deduplication of exact matches

#### Memory Categories
- Five default categories: fact, preference, skill, episode, context
- Custom category support with configurable importance boosts
- Dynamic extraction prompt that adapts to configured categories

#### Time Decay
- Exponential decay with configurable half-life (default: 30 days)
- Access boost — frequently accessed memories decay slower
- Configurable max retention (default: 90 days)
- Automatic expiration handling

#### Storage Adapters
- **MemoryStore** — In-memory storage (no persistence)
- **JsonFileStore** — Single JSON file storage with atomic writes (default)
  - 0600 file permissions for security
  - Automatic corruption recovery
  - Concurrent write safety

#### Events System
- `stored` — Emitted when memory is successfully stored
- `rejected` — Emitted when memory is rejected (too redundant)
- `recalled` — Emitted when memories are retrieved
- `forgotten` — Emitted when memories are pruned
- `error` — Emitted on errors
- `warning` — Emitted for non-fatal issues

#### Hooks System
- `beforeStore` — Modify or reject memories before storing
- `afterStore` — React to successful storage
- `beforeRecall` — Modify query before retrieval
- `afterRecall` — Filter or modify recalled memories
- `beforeExtract` — Preprocess messages before LLM extraction
- `afterExtract` — Filter extraction candidates
- `beforeForget` — Control what gets pruned

#### Explainability
- **`explain: true` option** on `remember()` and `recall()`
- Detailed scoring breakdowns showing:
  - Surprise components (semantic, keyword, rarity)
  - Importance calculations
  - Relevance scores
  - Decay effects
  - Closest existing memory
- Human-readable age formatting

#### Configuration Options
- BYOLLM — Bring your own LLM function
- BYOE — Bring your own embedding function (optional)
- Configurable surprise threshold
- Category importance boosts
- Decay parameters (half-life, max retention)
- Max memories limit (default: 10,000)
- Namespace support for memory isolation
- History tracking (default: enabled, max 10 versions)

#### Developer Experience
- **`dryRun` mode** on all write operations for safe experimentation
- Type-safe TypeScript API
- Comprehensive error classes
- Zero external dependencies (only Node.js built-ins)
- ESM module support

#### Memory Versioning
- Automatic version tracking on updates
- History of previous content
- Configurable max history per memory (default: 10)

### Documentation
- Comprehensive README with quickstart examples
- API reference for all methods
- Integration guides for Claude, OpenAI, and Ollama
- Hooks and events examples
- Configuration documentation

### Technical Details
- **Lines of code**: ~870 (core ~500, supporting ~370)
- **Dependencies**: Zero (only dev dependencies for build/test)
- **TypeScript**: Full type safety with exported types
- **Build target**: ES2022, ESM modules
- **License**: MIT
