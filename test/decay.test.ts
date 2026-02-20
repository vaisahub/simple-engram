import { describe, it, expect } from 'vitest';
import {
  decayedImportance,
  shouldPrune,
  sortByDecayedImportance,
  calculateExpiration,
  getAgeDays,
} from '../src/decay.js';
import type { Memory, EngramConfig } from '../src/types.js';

describe('Decay', () => {
  const createMemory = (
    importance: number,
    ageDays: number,
    accessCount = 0
  ): Memory => {
    const now = Date.now();
    return {
      id: '1',
      content: 'test',
      category: 'fact',
      source: 'test',
      surprise: 0.5,
      importance,
      accessCount,
      lastAccessed: now,
      createdAt: now - ageDays * 24 * 60 * 60 * 1000,
      embedding: null,
      metadata: {},
      namespace: 'default',
      ttl: null,
      expiresAt: null,
      version: 1,
      history: [],
    };
  };

  const defaultConfig: EngramConfig = {
    decayHalfLifeDays: 30,
    maxRetentionDays: 90,
    maxMemories: 10000,
  };

  describe('decayedImportance', () => {
    it('should not decay brand new memories', () => {
      const memory = createMemory(1.0, 0);
      const decayed = decayedImportance(memory, defaultConfig);
      expect(decayed).toBeCloseTo(1.0, 1);
    });

    it('should decay to half at half-life', () => {
      const memory = createMemory(1.0, 30); // 30 days old
      const decayed = decayedImportance(memory, defaultConfig);
      expect(decayed).toBeCloseTo(0.5, 1);
    });

    it('should decay to quarter at 2x half-life', () => {
      const memory = createMemory(1.0, 60); // 60 days old
      const decayed = decayedImportance(memory, defaultConfig);
      expect(decayed).toBeCloseTo(0.25, 1);
    });

    it('should apply access boost', () => {
      const unaccessed = createMemory(1.0, 30, 0);
      const accessed = createMemory(1.0, 30, 10);

      const decayedUnaccessed = decayedImportance(unaccessed, defaultConfig);
      const decayedAccessed = decayedImportance(accessed, defaultConfig);

      // Accessed memory should decay slower
      expect(decayedAccessed).toBeGreaterThan(decayedUnaccessed);
    });

    it('should use custom half-life', () => {
      const memory = createMemory(1.0, 15);
      const customConfig = { ...defaultConfig, decayHalfLifeDays: 15 };

      const decayed = decayedImportance(memory, customConfig);
      expect(decayed).toBeCloseTo(0.5, 1);
    });

    it('should handle zero importance', () => {
      const memory = createMemory(0, 30);
      const decayed = decayedImportance(memory, defaultConfig);
      expect(decayed).toBe(0);
    });
  });

  describe('shouldPrune', () => {
    it('should prune expired memories in all modes', () => {
      const memory = createMemory(1.0, 0);
      memory.expiresAt = Date.now() - 1000; // Expired

      expect(shouldPrune(memory, defaultConfig, 'gentle')).toBe(true);
      expect(shouldPrune(memory, defaultConfig, 'normal')).toBe(true);
      expect(shouldPrune(memory, defaultConfig, 'aggressive')).toBe(true);
    });

    it('should not prune non-expired in gentle mode', () => {
      const memory = createMemory(0.01, 60); // Very low importance but not expired
      expect(shouldPrune(memory, defaultConfig, 'gentle')).toBe(false);
    });

    it('should prune very low importance in normal mode', () => {
      const memory = createMemory(0.005, 90);
      // After decay, importance will be < 0.01
      expect(shouldPrune(memory, defaultConfig, 'normal')).toBe(true);
    });

    it('should not prune decent importance in normal mode', () => {
      const memory = createMemory(0.5, 30);
      // After decay, importance ~ 0.25, which is > 0.01
      expect(shouldPrune(memory, defaultConfig, 'normal')).toBe(false);
    });

    it('should handle null expiresAt', () => {
      const memory = createMemory(0.5, 30);
      memory.expiresAt = null;
      expect(shouldPrune(memory, defaultConfig, 'gentle')).toBe(false);
    });
  });

  describe('sortByDecayedImportance', () => {
    it('should sort by decayed importance ascending', () => {
      const memories = [
        createMemory(1.0, 0), // High, new
        createMemory(1.0, 60), // High, old (decayed)
        createMemory(0.5, 0), // Medium, new
      ];

      const sorted = sortByDecayedImportance(memories, defaultConfig);

      // Expect ascending order
      const decayed0 = decayedImportance(sorted[0], defaultConfig);
      const decayed1 = decayedImportance(sorted[1], defaultConfig);
      const decayed2 = decayedImportance(sorted[2], defaultConfig);

      expect(decayed0).toBeLessThanOrEqual(decayed1);
      expect(decayed1).toBeLessThanOrEqual(decayed2);
    });

    it('should handle empty array', () => {
      const sorted = sortByDecayedImportance([], defaultConfig);
      expect(sorted).toEqual([]);
    });
  });

  describe('calculateExpiration', () => {
    it('should use memory-specific TTL if set', () => {
      const memory = createMemory(1.0, 0);
      memory.ttl = 3600; // 1 hour
      memory.createdAt = 1000;

      const expiration = calculateExpiration(memory, defaultConfig);
      expect(expiration).toBe(1000 + 3600 * 1000);
    });

    it('should use maxRetentionDays if no TTL', () => {
      const memory = createMemory(1.0, 0);
      memory.ttl = null;
      memory.createdAt = 1000;

      const expiration = calculateExpiration(memory, defaultConfig);
      const expected = 1000 + 90 * 24 * 60 * 60 * 1000;
      expect(expiration).toBe(expected);
    });

    it('should use custom maxRetentionDays', () => {
      const memory = createMemory(1.0, 0);
      memory.ttl = null;
      memory.createdAt = 1000;

      const customConfig = { ...defaultConfig, maxRetentionDays: 30 };
      const expiration = calculateExpiration(memory, customConfig);
      const expected = 1000 + 30 * 24 * 60 * 60 * 1000;
      expect(expiration).toBe(expected);
    });
  });

  describe('getAgeDays', () => {
    it('should calculate age in days', () => {
      const memory = createMemory(1.0, 30);
      const age = getAgeDays(memory);
      expect(age).toBeCloseTo(30, 0);
    });

    it('should handle brand new memories', () => {
      const memory = createMemory(1.0, 0);
      const age = getAgeDays(memory);
      expect(age).toBeCloseTo(0, 1);
    });

    it('should handle old memories', () => {
      const memory = createMemory(1.0, 365);
      const age = getAgeDays(memory);
      expect(age).toBeGreaterThanOrEqual(365);
    });
  });
});
