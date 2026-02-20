import { describe, it, expect } from 'vitest';
import { computeSurprise, scoreAndDecide } from '../src/scorer.js';
import type { Memory, MemoryCandidate } from '../src/types.js';

describe('Scorer', () => {
  const createMemory = (content: string, category = 'fact'): Memory => ({
    id: '1',
    content,
    category,
    source: 'test',
    surprise: 0.5,
    importance: 0.5,
    accessCount: 0,
    lastAccessed: Date.now(),
    createdAt: Date.now(),
    embedding: null,
    metadata: {},
    namespace: 'default',
    ttl: null,
    expiresAt: null,
    version: 1,
    history: [],
  });

  describe('computeSurprise', () => {
    it('should return surprise of 1.0 for first memory', async () => {
      const candidate: MemoryCandidate = {
        content: 'User prefers TypeScript',
        category: 'preference',
      };

      const result = await computeSurprise(candidate, []);
      expect(result.surprise).toBeCloseTo(1.0, 1);
    });

    it('should return 0 for exact duplicate', async () => {
      const candidate: MemoryCandidate = {
        content: 'User prefers TypeScript',
        category: 'preference',
      };

      const existing = [createMemory('User prefers TypeScript', 'preference')];

      const result = await computeSurprise(candidate, existing);
      expect(result.surprise).toBe(0);
      expect(result.reason).toBe('duplicate_content');
    });

    it('should detect case-insensitive duplicates', async () => {
      const candidate: MemoryCandidate = {
        content: 'USER PREFERS TYPESCRIPT',
        category: 'preference',
      };

      const existing = [createMemory('user prefers typescript', 'preference')];

      const result = await computeSurprise(candidate, existing);
      expect(result.surprise).toBe(0);
    });

    it('should compute lower surprise for similar content', async () => {
      const candidate: MemoryCandidate = {
        content: 'User likes TypeScript programming',
        category: 'preference',
      };

      const existing = [createMemory('User prefers TypeScript', 'preference')];

      const result = await computeSurprise(candidate, existing);
      expect(result.surprise).toBeLessThan(1.0);
      expect(result.surprise).toBeGreaterThan(0);
    });

    it('should compute higher surprise for different content', async () => {
      const candidate: MemoryCandidate = {
        content: 'Deploy using Vercel CLI',
        category: 'skill',
      };

      const existing = [createMemory('User prefers TypeScript', 'preference')];

      const result = await computeSurprise(candidate, existing);
      expect(result.surprise).toBeGreaterThan(0.7);
    });

    it('should include category rarity in scoring', async () => {
      const candidate: MemoryCandidate = {
        content: 'New fact',
        category: 'fact',
      };

      // Many facts exist
      const manyFacts = Array.from({ length: 50 }, (_, i) =>
        createMemory(`Fact ${i}`, 'fact')
      );

      // Few preferences exist
      const fewPrefs = [
        createMemory('Pref 1', 'preference'),
        createMemory('Pref 2', 'preference'),
      ];

      const resultManyFacts = await computeSurprise(candidate, manyFacts);
      const resultFewPrefs = await computeSurprise(
        { ...candidate, category: 'preference' },
        fewPrefs
      );

      // Rarity should be higher when category is less common
      expect(resultFewPrefs.surprise).toBeGreaterThan(resultManyFacts.surprise);
    });

    it('should use embeddings when available', async () => {
      const candidate: MemoryCandidate = {
        content: 'Machine learning model',
        category: 'fact',
      };

      const existing = [createMemory('AI neural network', 'fact')];
      existing[0].embedding = [0.1, 0.2, 0.3]; // Mock embedding

      const mockEmbed = async (text: string) => {
        if (text.includes('Machine learning')) return [0.1, 0.25, 0.32];
        return [0.1, 0.2, 0.3];
      };

      const result = await computeSurprise(candidate, existing, mockEmbed);

      // Should use semantic similarity
      expect(result.explanation).toContain('semantic');
    });

    it('should find closest existing memory when explaining', async () => {
      const candidate: MemoryCandidate = {
        content: 'User likes TypeScript',
        category: 'preference',
      };

      const existing = [
        createMemory('User prefers TypeScript', 'preference'),
        createMemory('Project uses React', 'context'),
      ];

      const result = await computeSurprise(candidate, existing, undefined, true);

      expect(result.closestExisting).toBeDefined();
      expect(result.closestExisting?.content).toBe('User prefers TypeScript');
    });
  });

  describe('scoreAndDecide', () => {
    it('should store memory above threshold', async () => {
      const candidate: MemoryCandidate = {
        content: 'Completely new information',
        category: 'fact',
      };

      const result = await scoreAndDecide(candidate, [], 0.3, 1.0);

      expect(result.stored).toBe(true);
      expect(result.surprise).toBeGreaterThan(0.3);
    });

    it('should reject memory below threshold', async () => {
      const candidate: MemoryCandidate = {
        content: 'User prefers TypeScript',
        category: 'preference',
      };

      const existing = [createMemory('User prefers TypeScript language', 'preference')];

      const result = await scoreAndDecide(candidate, existing, 0.5, 1.0);

      if (!result.stored) {
        expect(result.reason).toBe('below_threshold');
      }
    });

    it('should apply category boost to importance', async () => {
      const candidate: MemoryCandidate = {
        content: 'New skill',
        category: 'skill',
      };

      const result = await scoreAndDecide(candidate, [], 0.3, 1.5);

      expect(result.importance).toBeCloseTo(result.surprise * 1.5, 2);
    });

    it('should include explanation when requested', async () => {
      const candidate: MemoryCandidate = {
        content: 'New information',
        category: 'fact',
      };

      const result = await scoreAndDecide(candidate, [], 0.3, 1.0, undefined, true);

      expect(result.explanation).toBeDefined();
      expect(result.explanation).toContain('surprise');
      expect(result.explanation).toContain('importance');
    });
  });
});
