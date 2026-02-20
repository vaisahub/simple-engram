import { describe, it, expect } from 'vitest';
import { tokenize, estimateTokens, uniqueTokens } from '../src/tokenizer.js';

describe('Tokenizer', () => {
  describe('tokenize', () => {
    it('should tokenize simple text', () => {
      const tokens = tokenize('Hello world');
      expect(tokens).toEqual(['hello', 'world']);
    });

    it('should remove stopwords', () => {
      const tokens = tokenize('The user is a developer');
      expect(tokens).toEqual(['user', 'developer']);
      expect(tokens).not.toContain('the');
      expect(tokens).not.toContain('is');
      expect(tokens).not.toContain('a');
    });

    it('should handle punctuation', () => {
      const tokens = tokenize('Hello, world! How are you?');
      // 'how', 'are', 'you' are stopwords and filtered out
      expect(tokens).toEqual(['hello', 'world']);
    });

    it('should convert to lowercase', () => {
      const tokens = tokenize('TypeScript JavaScript');
      expect(tokens).toEqual(['typescript', 'javascript']);
    });

    it('should filter short tokens', () => {
      const tokens = tokenize('I am a developer');
      expect(tokens).not.toContain('i');
      expect(tokens).toEqual(['developer']);
    });

    it('should handle empty string', () => {
      const tokens = tokenize('');
      expect(tokens).toEqual([]);
    });

    it('should handle special characters', () => {
      const tokens = tokenize('user@example.com');
      expect(tokens).toContain('user');
      expect(tokens).toContain('example');
      expect(tokens).toContain('com');
    });
  });

  describe('estimateTokens', () => {
    it('should estimate token count', () => {
      expect(estimateTokens('hello')).toBe(2); // 5/4 = 1.25 -> 2
      expect(estimateTokens('hello world')).toBe(3); // 11/4 = 2.75 -> 3
    });

    it('should handle empty string', () => {
      expect(estimateTokens('')).toBe(0);
    });
  });

  describe('uniqueTokens', () => {
    it('should return unique tokens as a Set', () => {
      const unique = uniqueTokens('hello world hello');
      expect(unique).toBeInstanceOf(Set);
      expect(unique.size).toBe(2);
      expect(unique.has('hello')).toBe(true);
      expect(unique.has('world')).toBe(true);
    });

    it('should handle duplicates', () => {
      const unique = uniqueTokens('the the the user user');
      expect(unique.size).toBe(1); // Only 'user' (stopwords removed)
      expect(unique.has('user')).toBe(true);
    });
  });
});
