/**
 * Engram — Plug-and-play memory engine for AI agents
 * Phase 1: Core memory engine
 * Phase 2: Smart recall & context injection
 */

import { randomUUID } from "crypto";
import { EngramEmitter } from "./events.js";
import type {
  EngramConfig,
  Memory,
  Message,
  RememberOptions,
  RememberResult,
  StoreOptions,
  RecallOptions,
  ForgetOptions,
  ForgetResult,
  EngramStats,
  ImportOptions,
  BootstrapInput,
  BootstrapOptions,
  BootstrapProgress,
  RejectedInfo,
  StoreAdapter,
  LLMFunction,
  EmbedFunction,
  ContextOptions,
  MergeOptions,
  MergeResult,
} from "./types.js";
import { NoLLMError, EngramError } from "./errors.js";
import { JsonFileStore } from "./stores/json-file.js";
import { extractMemories } from "./extractor.js";
import { scoreAndDecide } from "./scorer.js";
import { retrieveMemories } from "./retriever.js";
import {
  shouldPrune,
  sortByDecayedImportance,
  calculateExpiration,
} from "./decay.js";
import {
  runBeforeStore,
  runAfterStore,
  runBeforeRecall,
  runAfterRecall,
  runBeforeExtract,
  runAfterExtract,
  runBeforeForget,
} from "./hooks/index.js";
import { exportToJson, parseJsonExport } from "./formats/json.js";
import { exportToMarkdown, parseMarkdownExport } from "./formats/markdown.js";
import { exportToCsv } from "./formats/csv.js";
import { formatContext } from "./context.js";

const DEFAULT_CATEGORIES = [
  "fact",
  "preference",
  "skill",
  "episode",
  "context",
];

const DEFAULT_IMPORTANCE_BOOST: Record<string, number> = {
  fact: 1.0,
  preference: 1.2,
  skill: 1.3,
  episode: 0.8,
  context: 0.9,
};

export class Engram extends EngramEmitter {
  private config: Required<
    Omit<EngramConfig, "llm" | "embed" | "hooks" | "store">
  > & {
    llm?: LLMFunction;
    embed?: EmbedFunction;
    hooks?: EngramConfig["hooks"];
  };
  private storeAdapter: StoreAdapter;

  constructor(config: EngramConfig = {}) {
    super();

    // Initialize config with defaults
    this.config = {
      llm: config.llm,
      embed: config.embed,
      surpriseThreshold: config.surpriseThreshold ?? 0.3,
      importanceBoost: {
        ...DEFAULT_IMPORTANCE_BOOST,
        ...config.importanceBoost,
      },
      categories: config.categories ?? DEFAULT_CATEGORIES,
      decayHalfLifeDays: config.decayHalfLifeDays ?? 30,
      maxRetentionDays: config.maxRetentionDays ?? 90,
      maxMemories: config.maxMemories ?? 10_000,
      defaultK: config.defaultK ?? 5,
      retrievalWeights: {
        relevance: config.retrievalWeights?.relevance ?? 0.5,
        importance: config.retrievalWeights?.importance ?? 0.3,
        recency: config.retrievalWeights?.recency ?? 0.2,
        accessFrequency: config.retrievalWeights?.accessFrequency ?? 0.0,
      },
      namespace: config.namespace ?? "default",
      hooks: config.hooks,
      trackHistory: config.trackHistory ?? true,
      maxHistoryPerMemory: config.maxHistoryPerMemory ?? 10,
    };

    this.storeAdapter = config.store ?? new JsonFileStore();
  }

  /**
   * Initialize the store
   */
  async init(): Promise<void> {
    if (this.storeAdapter.init) {
      await this.storeAdapter.init();
    }
  }

  /**
   * Close and cleanup
   */
  async close(): Promise<void> {
    if (this.storeAdapter.close) {
      await this.storeAdapter.close();
    }
  }

  /**
   * remember() — Extract and store memories from conversation
   */
  async remember(
    messages: Message[],
    options: RememberOptions = {},
  ): Promise<RememberResult> {
    // Validate LLM is provided
    if (!this.config.llm) {
      throw new NoLLMError();
    }

    const result: RememberResult = {
      stored: [],
      rejected: [],
      errors: [],
      dryRun: options.dryRun ?? false,
    };

    try {
      // Step 1: Run beforeExtract hook
      const processedMessages = await runBeforeExtract(
        messages,
        this.config.hooks,
      );

      // Step 2: Extract candidates
      const { candidates, errors } = await extractMemories(
        processedMessages,
        this.config.llm,
        this.config.categories,
      );

      result.errors.push(...errors);

      // Step 3: Run afterExtract hook
      const filteredCandidates = await runAfterExtract(
        candidates,
        this.config.hooks,
      );

      // Step 4: Load existing memories for scoring
      const existing = await this.storeAdapter.list({
        namespace: this.config.namespace,
      });

      // Step 5: Score each candidate
      for (const candidate of filteredCandidates) {
        const categoryBoost =
          this.config.importanceBoost[candidate.category] ?? 1.0;

        const decision = await scoreAndDecide(
          candidate,
          existing,
          options.forceStore ? 0 : this.config.surpriseThreshold,
          categoryBoost,
          this.config.embed,
          options.explain,
        );

        if (!decision.stored) {
          // Rejected
          const rejected: RejectedInfo = {
            content: candidate.content,
            surprise: decision.surprise,
            reason: decision.reason ?? "below_threshold",
            explanation: decision.explanation,
            closestExisting: decision.closestExisting,
          };
          result.rejected.push(rejected);

          if (!options.dryRun) {
            this.emit("rejected", rejected);
          }
          continue;
        }

        // Step 6: Create memory record
        const now = Date.now();
        const memory: Memory = {
          id: randomUUID(),
          content: candidate.content,
          category: candidate.category,
          source: options.source ?? "unknown",
          surprise: decision.surprise,
          importance: decision.importance,
          accessCount: 0,
          lastAccessed: now,
          createdAt: now,
          embedding: this.config.embed
            ? await this.config.embed(candidate.content)
            : null,
          metadata: options.metadata ?? {},
          namespace: this.config.namespace,
          ttl: null,
          expiresAt: calculateExpiration(
            { createdAt: now, ttl: null } as Memory,
            this.config,
          ),
          version: 1,
          history: [],
          explanation: decision.explanation,
        };

        // Step 7: Dry-run check
        if (options.dryRun) {
          result.stored.push(memory);
          continue;
        }

        // Step 8: Run beforeStore hook
        const approvedMemory = await runBeforeStore(memory, this.config.hooks);
        if (!approvedMemory) {
          result.rejected.push({
            content: candidate.content,
            surprise: decision.surprise,
            reason: "hook_rejected",
          });
          continue;
        }

        // Step 9: Store
        await this.storeAdapter.put(approvedMemory);
        result.stored.push(approvedMemory);

        // Step 10: Run afterStore hook and emit event
        await runAfterStore(approvedMemory, this.config.hooks);
        this.emit("stored", approvedMemory);

        // Add to existing for subsequent candidates
        existing.push(approvedMemory);
      }
    } catch (error) {
      if (error instanceof Error) {
        this.emit("error", error);
        result.errors.push(error.message);
      }
    }

    return result;
  }

  /**
   * store() — Manually store a memory
   */
  async store(content: string, options: StoreOptions = {}): Promise<Memory> {
    const now = Date.now();

    // Step 1: Compute surprise if not skipping
    let surprise = 0.7; // Default
    let importance = options.importance ?? 0.7;

    if (!options.skipSurprise) {
      const existing = await this.storeAdapter.list({
        namespace: this.config.namespace,
      });
      const category = options.category ?? "fact";
      const categoryBoost = this.config.importanceBoost[category] ?? 1.0;

      const decision = await scoreAndDecide(
        { content, category },
        existing,
        0, // No threshold check for manual store
        categoryBoost,
        this.config.embed,
        options.explain,
      );

      surprise = decision.surprise;
      importance = decision.importance;
    }

    // Step 2: Create memory
    const memory: Memory = {
      id: randomUUID(),
      content,
      category: options.category ?? "fact",
      source: options.source ?? "manual",
      surprise,
      importance,
      accessCount: 0,
      lastAccessed: now,
      createdAt: now,
      embedding: this.config.embed ? await this.config.embed(content) : null,
      metadata: options.metadata ?? {},
      namespace: this.config.namespace,
      ttl: options.ttl ?? null,
      expiresAt: calculateExpiration(
        { createdAt: now, ttl: options.ttl ?? null } as Memory,
        this.config,
      ),
      version: 1,
      history: [],
    };

    // Step 3: Dry-run check
    if (options.dryRun) {
      return memory;
    }

    // Step 4: Run hooks
    const approved = await runBeforeStore(memory, this.config.hooks);
    if (!approved) {
      throw new EngramError(
        "Memory rejected by beforeStore hook",
        "HOOK_REJECTED",
      );
    }

    // Step 5: Store
    await this.storeAdapter.put(approved);

    // Step 6: Emit events
    await runAfterStore(approved, this.config.hooks);
    this.emit("stored", approved);

    return approved;
  }

  /**
   * recall() — Retrieve memories
   */
  async recall(query: string, options: RecallOptions = {}): Promise<Memory[]> {
    // Step 1: Run beforeRecall hook
    const processedQuery = await runBeforeRecall(query, this.config.hooks);

    // Step 2: Retrieve
    const memories = await retrieveMemories(
      processedQuery,
      this.storeAdapter,
      this.config,
      this.config.embed,
      options,
    );

    // Step 3: Run afterRecall hook
    const filtered = await runAfterRecall(memories, this.config.hooks);

    // Step 4: Update access tracking (unless dry-run)
    const now = Date.now();
    for (const memory of filtered) {
      memory.accessCount++;
      memory.lastAccessed = now;
      await this.storeAdapter.put(memory);
    }

    // Step 5: Emit event
    this.emit("recalled", filtered, query);

    return filtered;
  }

  /**
   * context() — Format memories for system prompt injection (Phase 2)
   */
  async context(query: string, options: ContextOptions = {}): Promise<string> {
    // Step 1: Recall relevant memories
    const memories = await this.recall(query, {
      k: options.k,
      categories: options.categories,
      explain: false, // Don't need explanations for context
    });

    // Step 2: Format for injection
    return formatContext(memories, options);
  }

  /**
   * forget() — Prune old/low-importance memories
   */
  async forget(options: ForgetOptions = {}): Promise<ForgetResult> {
    const mode = options.mode ?? "normal";
    const dryRun = options.dryRun ?? false;

    // Step 1: Load all memories
    const allMemories = await this.storeAdapter.list({
      namespace: this.config.namespace,
    });

    // Step 2: Determine what to prune
    const toDelete: Memory[] = [];

    for (const memory of allMemories) {
      if (shouldPrune(memory, this.config, mode)) {
        toDelete.push(memory);
      }
    }

    // Step 3: Aggressive mode — also prune bottom 10%
    if (mode === "aggressive") {
      const remaining = allMemories.filter((m) => !toDelete.includes(m));
      const sorted = sortByDecayedImportance(remaining, this.config);
      const bottomCount = Math.ceil(sorted.length * 0.1);
      toDelete.push(...sorted.slice(0, bottomCount));
    }

    // Step 4: Enforce max memories
    const afterPrune = allMemories.filter((m) => !toDelete.includes(m));
    if (afterPrune.length > this.config.maxMemories) {
      const sorted = sortByDecayedImportance(afterPrune, this.config);
      const excess = afterPrune.length - this.config.maxMemories;
      toDelete.push(...sorted.slice(0, excess));
    }

    // Step 5: Run beforeForget hook
    const approved = await runBeforeForget(toDelete, this.config.hooks);

    const prunedIds = approved.map((m) => m.id);
    const remaining = allMemories.length - approved.length;
    const oldest =
      remaining > 0
        ? Math.min(
            ...allMemories
              .filter((m) => !prunedIds.includes(m.id))
              .map((m) => m.createdAt),
          )
        : Date.now();

    // Step 6: Delete if not dry-run
    if (!dryRun) {
      await this.storeAdapter.deleteMany(prunedIds);
      this.emit("forgotten", prunedIds, prunedIds.length);
    }

    return {
      pruned: approved.length,
      remaining,
      oldestMemory: oldest,
      dryRun,
      prunedIds: dryRun ? prunedIds : undefined,
    };
  }

  /**
   * merge() — Consolidate near-duplicate memories (Phase 2)
   */
  async merge(options: MergeOptions = {}): Promise<MergeResult> {
    const threshold = options.similarityThreshold ?? 0.85;
    const dryRun = options.dryRun ?? false;
    const explain = options.explain ?? false;

    // Step 1: Load all memories
    const allMemories = await this.storeAdapter.list({
      namespace: this.config.namespace,
    });

    // Step 2: Group by category
    const byCategory: Record<string, Memory[]> = {};
    for (const memory of allMemories) {
      if (!byCategory[memory.category]) {
        byCategory[memory.category] = [];
      }
      byCategory[memory.category].push(memory);
    }

    // Step 3: Find pairs to merge
    const details: MergeResult["details"] = [];
    const toDelete: string[] = [];

    for (const category of Object.keys(byCategory)) {
      const memories = byCategory[category];

      for (let i = 0; i < memories.length; i++) {
        if (toDelete.includes(memories[i].id)) continue;

        for (let j = i + 1; j < memories.length; j++) {
          if (toDelete.includes(memories[j].id)) continue;

          // Compute similarity
          let similarity = 0;
          if (
            memories[i].embedding &&
            memories[j].embedding &&
            this.config.embed
          ) {
            const { cosineSimilarity } = await import("./similarity.js");
            similarity = cosineSimilarity(
              memories[i].embedding!,
              memories[j].embedding!,
            );
          } else {
            const { jaccardSimilarity } = await import("./similarity.js");
            similarity = jaccardSimilarity(
              memories[i].content,
              memories[j].content,
            );
          }

          if (similarity >= threshold) {
            // Merge: keep higher importance, absorb lower
            const [kept, absorbed] =
              memories[i].importance >= memories[j].importance
                ? [memories[i], memories[j]]
                : [memories[j], memories[i]];

            if (explain) {
              details.push({
                kept,
                absorbed,
                similarity,
                reason: `absorbed has lower importance, similarity ${similarity.toFixed(2)} > threshold ${threshold}`,
              });
            }

            // Mark for deletion
            toDelete.push(absorbed.id);

            // Update kept memory's history if tracking
            if (this.config.trackHistory && !dryRun) {
              kept.history.push({
                content: absorbed.content,
                timestamp: absorbed.createdAt,
                reason: "merged",
              });

              // Trim history if needed
              if (kept.history.length > this.config.maxHistoryPerMemory) {
                kept.history = kept.history.slice(
                  -this.config.maxHistoryPerMemory,
                );
              }

              kept.version++;

              // Merge metadata
              if (!kept.metadata.mergedFrom) {
                kept.metadata.mergedFrom = [];
              }
              kept.metadata.mergedFrom.push(absorbed.id);

              await this.storeAdapter.put(kept);
            }
          }
        }
      }
    }

    // Step 4: Delete absorbed memories
    if (!dryRun && toDelete.length > 0) {
      await this.storeAdapter.deleteMany(toDelete);
      this.emit("merged", {
        merged: toDelete.length,
        remaining: allMemories.length - toDelete.length,
        details,
      });
    }

    return {
      merged: toDelete.length,
      remaining: allMemories.length - toDelete.length,
      dryRun,
      details: explain ? details : undefined,
    };
  }

  /**
   * export() — Export memories to various formats
   */
  async export(format: "json" | "md" | "csv"): Promise<string> {
    const memories = await this.storeAdapter.list({
      namespace: this.config.namespace,
    });

    switch (format) {
      case "json":
        return exportToJson(
          memories,
          this.config.namespace,
          this.config.categories,
        );
      case "md":
        return exportToMarkdown(memories, this.config.namespace);
      case "csv":
        return exportToCsv(memories);
      default:
        throw new EngramError(
          `Unknown export format: ${format}`,
          "INVALID_FORMAT",
        );
    }
  }

  /**
   * import() — Import memories from exports
   */
  async import(
    data: string,
    format: "json" | "md",
    options: ImportOptions = {},
  ): Promise<number> {
    let partial: Partial<Memory>[];

    // Parse based on format
    if (format === "json") {
      partial = parseJsonExport(data);
    } else if (format === "md") {
      partial = parseMarkdownExport(data);
    } else {
      throw new EngramError(
        `Unknown import format: ${format}`,
        "INVALID_FORMAT",
      );
    }

    const now = Date.now();
    const toImport: Memory[] = [];

    // Fill in missing fields
    for (const mem of partial) {
      const memory: Memory = {
        id: mem.id ?? randomUUID(),
        content: mem.content ?? "",
        category: mem.category ?? "fact",
        source: mem.source ?? "import",
        surprise: mem.surprise ?? 0.5,
        importance: mem.importance ?? 0.5,
        accessCount: mem.accessCount ?? 0,
        lastAccessed: mem.lastAccessed ?? now,
        createdAt: mem.createdAt ?? now,
        embedding: null,
        metadata: mem.metadata ?? {},
        namespace: options.namespace ?? this.config.namespace,
        ttl: mem.ttl ?? null,
        expiresAt:
          mem.expiresAt ??
          calculateExpiration(
            { createdAt: now, ttl: null } as Memory,
            this.config,
          ),
        version: mem.version ?? 1,
        history: mem.history ?? [],
      };

      // Check for conflicts
      const existing = await this.storeAdapter.get(memory.id);
      if (existing) {
        if (options.onConflict === "skip") continue;
        if (options.onConflict === "keep_both") {
          memory.id = randomUUID();
        }
        // 'overwrite' — just continue with the same ID
      }

      // Recompute embeddings if available
      if (this.config.embed) {
        memory.embedding = await this.config.embed(memory.content);
      }

      toImport.push(memory);
    }

    // Dry-run check
    if (options.dryRun) {
      return toImport.length;
    }

    // Store all
    await this.storeAdapter.putMany(toImport);

    // Emit events
    for (const memory of toImport) {
      this.emit("stored", memory);
    }

    return toImport.length;
  }

  /**
   * stats() — Get statistics
   */
  async stats(): Promise<EngramStats> {
    const memories = await this.storeAdapter.list();

    const byCategory: Record<string, number> = {};
    const byNamespace: Record<string, number> = {};
    let totalImportance = 0;
    let totalSurprise = 0;
    let totalAge = 0;
    let oldest = Infinity;
    let newest = 0;

    for (const memory of memories) {
      byCategory[memory.category] = (byCategory[memory.category] ?? 0) + 1;
      byNamespace[memory.namespace] = (byNamespace[memory.namespace] ?? 0) + 1;

      totalImportance += memory.importance;
      totalSurprise += memory.surprise;
      totalAge += (Date.now() - memory.createdAt) / (1000 * 60 * 60 * 24);

      oldest = Math.min(oldest, memory.createdAt);
      newest = Math.max(newest, memory.createdAt);
    }

    const count = memories.length;

    return {
      totalMemories: count,
      byCategory,
      byNamespace,
      averageImportance: count > 0 ? totalImportance / count : 0,
      averageSurprise: count > 0 ? totalSurprise / count : 0,
      averageAge: count > 0 ? totalAge / count : 0,
      oldestMemory: oldest === Infinity ? 0 : oldest,
      newestMemory: newest,
      storeType: this.storeAdapter.name,
      hasEmbeddings: !!this.config.embed,
      hasLLM: !!this.config.llm,
      categories: this.config.categories,
    };
  }

  /**
   * get() — Get a memory by ID
   */
  async get(id: string): Promise<Memory | null> {
    return this.storeAdapter.get(id);
  }

  /**
   * list() — List memories with filters
   */
  async list(filter?: RecallOptions): Promise<Memory[]> {
    return this.storeAdapter.list(filter);
  }

  /**
   * bootstrap() — Bulk import from conversations
   */
  async bootstrap(
    conversations: BootstrapInput[],
    options: BootstrapOptions = {},
  ): Promise<RememberResult> {
    const batchSize = options.batchSize ?? 5;
    const delayMs = options.delayMs ?? 500;

    const aggregated: RememberResult = {
      stored: [],
      rejected: [],
      errors: [],
      dryRun: options.dryRun ?? false,
    };

    const progress: BootstrapProgress = {
      completed: 0,
      total: conversations.length,
      stored: 0,
      rejected: 0,
      errors: 0,
      currentBatch: 0,
    };

    // Process in batches
    for (let i = 0; i < conversations.length; i += batchSize) {
      const batch = conversations.slice(i, i + batchSize);
      progress.currentBatch++;

      for (const conv of batch) {
        const result = await this.remember(conv.messages, {
          source: conv.source,
          dryRun: options.dryRun,
        });

        aggregated.stored.push(...result.stored);
        aggregated.rejected.push(...result.rejected);
        aggregated.errors.push(...result.errors);

        progress.completed++;
        progress.stored += result.stored.length;
        progress.rejected += result.rejected.length;
        progress.errors += result.errors.length;

        if (options.onProgress) {
          options.onProgress(progress);
        }
      }

      // Delay between batches
      if (i + batchSize < conversations.length) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    return aggregated;
  }
}

// Re-export types and utilities
export type * from "./types.js";
export * from "./errors.js";
export { MemoryStore } from "./stores/memory.js";
export { JsonFileStore } from "./stores/json-file.js";
export { SqliteStore } from "./stores/sqlite.js";
