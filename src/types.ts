/**
 * Core types for Engram memory engine
 */

// ─────────────────────────────────────────────────────────────────────────────
// Memory Categories
// ─────────────────────────────────────────────────────────────────────────────

export type DefaultCategory =
  | "fact" // objective information: "Project uses PostgreSQL 16"
  | "preference" // subjective choice: "User prefers tabs over spaces"
  | "skill" // learned procedure: "Deploy with `vercel --prod`"
  | "episode" // event that happened: "Debugging session resolved null pointer in auth.ts"
  | "context"; // environmental info: "Working on a React Native mobile app"

export type MemoryCategory = DefaultCategory | string;

// ─────────────────────────────────────────────────────────────────────────────
// Memory Version
// ─────────────────────────────────────────────────────────────────────────────

export interface MemoryVersion {
  content: string;
  timestamp: number;
  reason: "created" | "updated" | "merged" | "conflict_resolved";
}

// ─────────────────────────────────────────────────────────────────────────────
// Core Memory Record
// ─────────────────────────────────────────────────────────────────────────────

export interface Memory {
  // ── Identity ──
  id: string;

  // ── Content ──
  content: string;
  category: MemoryCategory;
  source: string;

  // ── Scores ──
  surprise: number; // 0.0–1.0 — novelty at time of storage
  importance: number; // 0.0–1.0 — base importance (surprise × boost)

  // ── Lifecycle ──
  accessCount: number;
  lastAccessed: number; // epoch ms
  createdAt: number; // epoch ms

  // ── Optional ──
  embedding: number[] | null;
  metadata: Record<string, any>;
  namespace: string;
  ttl: number | null; // seconds
  expiresAt: number | null;

  // ── Versioning ──
  version: number;
  history: MemoryVersion[];

  // ── Computed (not stored, calculated on read) ──
  decayedImportance?: number;
  explanation?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Messages
// ─────────────────────────────────────────────────────────────────────────────

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Memory Candidate (from extraction)
// ─────────────────────────────────────────────────────────────────────────────

export interface MemoryCandidate {
  content: string;
  category: MemoryCategory;
}

// ─────────────────────────────────────────────────────────────────────────────
// LLM and Embedding Adapters
// ─────────────────────────────────────────────────────────────────────────────

export type LLMFunction = (prompt: string) => Promise<string>;
export type EmbedFunction = (text: string) => Promise<number[]>;

// ─────────────────────────────────────────────────────────────────────────────
// Store Adapter
// ─────────────────────────────────────────────────────────────────────────────

export interface MemoryFilter {
  namespace?: string | string[];
  categories?: MemoryCategory[];
  minImportance?: number;
  maxAge?: number; // days
  since?: number; // epoch ms
  metadata?: Record<string, any>;
  limit?: number;
  offset?: number;
  sortBy?: "importance" | "created" | "accessed" | "surprise";
  sortOrder?: "asc" | "desc";
}

export interface StoreAdapter {
  // ── Identity ──
  readonly name: string;

  // ── CRUD ──
  get(id: string): Promise<Memory | null>;
  put(memory: Memory): Promise<void>;
  delete(id: string): Promise<void>;
  has(id: string): Promise<boolean>;

  // ── Query ──
  list(filter?: MemoryFilter): Promise<Memory[]>;
  search(query: string, k: number): Promise<Memory[]>;
  vectorSearch?(embedding: number[], k: number): Promise<Memory[]>;

  // ── Bulk ──
  putMany(memories: Memory[]): Promise<void>;
  deleteMany(ids: string[]): Promise<void>;

  // ── Lifecycle ──
  count(namespace?: string): Promise<number>;
  prune(before: number): Promise<number>;
  clear(namespace?: string): Promise<void>;

  // ── Export ──
  dump(): Promise<Memory[]>;

  // ── Connection ──
  init?(): Promise<void>;
  close?(): Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────────────────────────────────────

export interface EngramHooks {
  beforeStore?: (memory: Memory) => Memory | null | Promise<Memory | null>;
  afterStore?: (memory: Memory) => void | Promise<void>;
  beforeRecall?: (query: string) => string | Promise<string>;
  afterRecall?: (memories: Memory[]) => Memory[] | Promise<Memory[]>;
  beforeExtract?: (messages: Message[]) => Message[] | Promise<Message[]>;
  afterExtract?: (
    candidates: MemoryCandidate[],
  ) => MemoryCandidate[] | Promise<MemoryCandidate[]>;
  beforeForget?: (memories: Memory[]) => Memory[] | Promise<Memory[]>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

export interface EngramConfig {
  // ── Adapters (all optional) ──
  llm?: LLMFunction;
  embed?: EmbedFunction;
  store?: StoreAdapter;

  // ── Scoring ──
  surpriseThreshold?: number;
  importanceBoost?: Record<string, number>;

  // ── Categories ──
  categories?: string[];

  // ── Decay ──
  decayHalfLifeDays?: number;
  maxRetentionDays?: number;
  maxMemories?: number;

  // ── Retrieval ──
  defaultK?: number;
  retrievalWeights?: {
    relevance?: number; // default: 0.5 - How well query matches content
    importance?: number; // default: 0.3 - Base importance with decay
    recency?: number; // default: 0.2 - How recent the memory is
    accessFrequency?: number; // default: 0.0 - How often accessed
  };

  // ── Namespace ──
  namespace?: string;

  // ── Hooks ──
  hooks?: EngramHooks;

  // ── Versioning ──
  trackHistory?: boolean;
  maxHistoryPerMemory?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Operation Options
// ─────────────────────────────────────────────────────────────────────────────

export interface RememberOptions {
  source?: string;
  metadata?: Record<string, any>;
  forceStore?: boolean;
  dryRun?: boolean;
  explain?: boolean;
}

export interface StoreOptions {
  category?: MemoryCategory;
  importance?: number;
  source?: string;
  metadata?: Record<string, any>;
  ttl?: number;
  skipSurprise?: boolean;
  dryRun?: boolean;
  explain?: boolean;
}

export interface RecallOptions {
  k?: number;
  categories?: MemoryCategory[];
  minImportance?: number;
  since?: number;
  namespace?: string;
  metadata?: Record<string, any>;
  explain?: boolean;
}

export interface ForgetOptions {
  mode?: "gentle" | "normal" | "aggressive";
  dryRun?: boolean;
}

export interface ContextOptions {
  k?: number;
  format?: "bullets" | "prose" | "xml" | "json";
  categories?: MemoryCategory[];
  maxTokens?: number;
  includeMetadata?: boolean;
  header?: string;
}

export interface MergeOptions {
  similarityThreshold?: number;
  dryRun?: boolean;
  explain?: boolean;
}

export interface ImportOptions {
  rescore?: boolean;
  namespace?: string;
  dryRun?: boolean;
  onConflict?: "skip" | "overwrite" | "keep_both";
}

// ─────────────────────────────────────────────────────────────────────────────
// Bootstrap
// ─────────────────────────────────────────────────────────────────────────────

export interface BootstrapInput {
  messages: Message[];
  source?: string;
}

export interface BootstrapProgress {
  completed: number;
  total: number;
  stored: number;
  rejected: number;
  errors: number;
  currentBatch: number;
}

export interface BootstrapOptions {
  batchSize?: number;
  delayMs?: number;
  onProgress?: (progress: BootstrapProgress) => void;
  /**
   * Stream individual conversation results as they complete
   *
   * When provided, results are NOT accumulated in the final RememberResult.
   * You are responsible for storing/processing results in this callback.
   * Use this for large imports (1000+ conversations) to avoid memory accumulation.
   *
   * @param result - Result from processing a single conversation
   * @param conversationIndex - Index of the conversation in the input array
   *
   * @example
   * await memory.bootstrap(conversations, {
   *   onResult: (result, index) => {
   *     // You manage storage
   *     db.save(result);
   *     fs.appendFileSync('log.txt', `${index}: ${result.stored.length} stored\n`);
   *   }
   * });
   */
  onResult?: (result: RememberResult, conversationIndex: number) => void;
  dryRun?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Results
// ─────────────────────────────────────────────────────────────────────────────

export interface RejectedInfo {
  content: string;
  surprise: number;
  reason: string;
  explanation?: string;
  closestExisting?: Memory;
}

export interface RememberResult {
  stored: Memory[];
  rejected: RejectedInfo[];
  errors: string[];
  llmTokensUsed?: number;
  dryRun: boolean;
}

export interface ForgetResult {
  pruned: number;
  remaining: number;
  oldestMemory: number;
  dryRun: boolean;
  prunedIds?: string[];
}

export interface MergeDetail {
  kept: Memory;
  absorbed: Memory;
  similarity: number;
  reason?: string;
}

export interface MergeResult {
  merged: number;
  remaining: number;
  dryRun?: boolean;
  details?: MergeDetail[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Stats
// ─────────────────────────────────────────────────────────────────────────────

export interface EngramStats {
  totalMemories: number;
  byCategory: Record<string, number>;
  byNamespace: Record<string, number>;
  averageImportance: number;
  averageSurprise: number;
  averageAge: number;
  oldestMemory: number;
  newestMemory: number;
  storeType: string;
  hasEmbeddings: boolean;
  hasLLM: boolean;
  categories: string[];
  memoryUsageBytes?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Surprise Scoring
// ─────────────────────────────────────────────────────────────────────────────

export interface SurpriseResult {
  surprise: number;
  explanation: string;
  stored?: boolean;
  reason?: string;
  closestExisting?: Memory;
}

// ─────────────────────────────────────────────────────────────────────────────
// Events
// ─────────────────────────────────────────────────────────────────────────────

export interface EngramEvents {
  stored: (memory: Memory) => void;
  rejected: (info: RejectedInfo) => void;
  recalled: (memories: Memory[], query: string) => void;
  forgotten: (ids: string[], count: number) => void;
  merged: (result: MergeResult) => void;
  error: (error: Error) => void;
  warning: (message: string) => void;
}
