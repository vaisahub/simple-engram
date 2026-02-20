import { describe, it, expect } from 'vitest';
import {
  cosineSimilarity,
  jaccardSimilarity,
  jaccardSimilarityTokens,
  normalize,
} from '../src/similarity.js';

describe('Similarity', () => {
  describe('cosineSimilarity', () => {
    it('should return 1.0 for identical vectors', () => {
      const a = [1, 2, 3];
      const b = [1, 2, 3];
      expect(cosineSimilarity(a, b)).toBeCloseTo(1.0, 5);
    });

    it('should return 0 for orthogonal vectors', () => {
      const a = [1, 0, 0];
      const b = [0, 1, 0];
      expect(cosineSimilarity(a, b)).toBeCloseTo(0, 5);
    });

    it('should return -1 for opposite vectors', () => {
      const a = [1, 0, 0];
      const b = [-1, 0, 0];
      expect(cosineSimilarity(a, b)).toBeCloseTo(-1, 5);
    });

    it('should compute correct similarity for similar vectors', () => {
      const a = [1, 2, 3];
      const b = [1, 2, 4];
      const sim = cosineSimilarity(a, b);
      expect(sim).toBeGreaterThan(0.9);
      expect(sim).toBeLessThan(1.0);
    });

    it('should throw for vectors of different lengths', () => {
      const a = [1, 2, 3];
      const b = [1, 2];
      expect(() => cosineSimilarity(a, b)).toThrow();
    });

    it('should return 0 for zero vectors', () => {
      const a = [0, 0, 0];
      const b = [1, 2, 3];
      expect(cosineSimilarity(a, b)).toBe(0);
    });
  });

  describe('jaccardSimilarity', () => {
    it('should return 1.0 for identical strings', () => {
      const sim = jaccardSimilarity('hello world', 'hello world');
      expect(sim).toBe(1.0);
    });

    it('should return 0 for completely different strings', () => {
      const sim = jaccardSimilarity('apple banana', 'orange grape');
      expect(sim).toBe(0);
    });

    it('should compute partial similarity', () => {
      const sim = jaccardSimilarity('user prefers typescript', 'user likes typescript');
      expect(sim).toBeGreaterThan(0);
      expect(sim).toBeLessThan(1.0);
    });

    it('should be case-insensitive', () => {
      const sim1 = jaccardSimilarity('Hello World', 'hello world');
      expect(sim1).toBe(1.0);
    });

    it('should return 1.0 for both empty strings', () => {
      const sim = jaccardSimilarity('', '');
      expect(sim).toBe(1.0);
    });

    it('should return 0 when one string is empty', () => {
      const sim = jaccardSimilarity('hello', '');
      expect(sim).toBe(0);
    });
  });

  describe('jaccardSimilarityTokens', () => {
    it('should compute similarity from token arrays', () => {
      const a = ['user', 'prefers', 'typescript'];
      const b = ['user', 'likes', 'typescript'];
      const sim = jaccardSimilarityTokens(a, b);

      // Intersection: {user, typescript} = 2
      // Union: {user, prefers, typescript, likes} = 4
      // Jaccard: 2/4 = 0.5
      expect(sim).toBeCloseTo(0.5, 5);
    });

    it('should return 1.0 for identical token arrays', () => {
      const a = ['hello', 'world'];
      const b = ['hello', 'world'];
      expect(jaccardSimilarityTokens(a, b)).toBe(1.0);
    });

    it('should return 0 for disjoint token arrays', () => {
      const a = ['apple', 'banana'];
      const b = ['orange', 'grape'];
      expect(jaccardSimilarityTokens(a, b)).toBe(0);
    });

    it('should handle empty arrays', () => {
      expect(jaccardSimilarityTokens([], [])).toBe(1.0);
      expect(jaccardSimilarityTokens(['hello'], [])).toBe(0);
      expect(jaccardSimilarityTokens([], ['hello'])).toBe(0);
    });
  });

  describe('normalize', () => {
    it('should normalize vector to unit length', () => {
      const v = [3, 4];
      const normalized = normalize(v);

      // Length should be 1
      const length = Math.sqrt(normalized[0] ** 2 + normalized[1] ** 2);
      expect(length).toBeCloseTo(1.0, 5);

      // Direction should be preserved
      expect(normalized[0]).toBeCloseTo(0.6, 5);
      expect(normalized[1]).toBeCloseTo(0.8, 5);
    });

    it('should handle zero vector', () => {
      const v = [0, 0, 0];
      const normalized = normalize(v);
      expect(normalized).toEqual([0, 0, 0]);
    });

    it('should handle already normalized vector', () => {
      const v = [1, 0, 0];
      const normalized = normalize(v);
      expect(normalized).toEqual([1, 0, 0]);
    });
  });
});
