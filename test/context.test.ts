import { describe, it, expect } from 'vitest';
import { formatContext, applyTokenBudget } from '../src/context.js';
import type { Memory } from '../src/types.js';

describe('Context Formatting', () => {
  const createMemory = (id: string, content: string, importance = 0.5): Memory => ({
    id,
    content,
    category: 'fact',
    source: 'test',
    surprise: 0.5,
    importance,
    accessCount: 0,
    lastAccessed: Date.now(),
    createdAt: Date.now() - 24 * 60 * 60 * 1000, // 1 day ago
    embedding: null,
    metadata: {},
    namespace: 'default',
    ttl: null,
    expiresAt: null,
    version: 1,
    history: [],
  });

  describe('formatContext()', () => {
    it('should format as bullets', () => {
      const memories = [
        createMemory('1', 'User prefers TypeScript'),
        createMemory('2', 'Deploy with vercel'),
      ];

      const result = formatContext(memories, { format: 'bullets' });

      expect(result).toContain('Relevant memories:');
      expect(result).toContain('- User prefers TypeScript [fact]');
      expect(result).toContain('- Deploy with vercel [fact]');
    });

    it('should format as bullets with metadata', () => {
      const memories = [createMemory('1', 'Test fact')];

      const result = formatContext(memories, {
        format: 'bullets',
        includeMetadata: true,
      });

      expect(result).toContain('- Test fact [fact, 1d ago]');
    });

    it('should format as prose', () => {
      const memories = [
        createMemory('1', 'User likes TypeScript'),
        createMemory('2', 'Project uses Next.js'),
      ];

      const result = formatContext(memories, { format: 'prose' });

      expect(result).toContain('Based on previous interactions:');
      expect(result).toContain('User likes TypeScript');
      expect(result).toContain('Project uses Next.js');
    });

    it('should format as XML', () => {
      const memories = [createMemory('1', 'Test content')];

      const result = formatContext(memories, { format: 'xml' });

      expect(result).toContain('<memories>');
      expect(result).toContain('<memory category="fact">Test content</memory>');
      expect(result).toContain('</memories>');
    });

    it('should format as XML with metadata', () => {
      const memories = [createMemory('1', 'Test content', 0.8)];

      const result = formatContext(memories, {
        format: 'xml',
        includeMetadata: true,
      });

      expect(result).toContain('age="1d ago"');
      expect(result).toContain('importance="0.80"');
    });

    it('should format as JSON', () => {
      const memories = [createMemory('1', 'Test content')];

      const result = formatContext(memories, { format: 'json' });

      const parsed = JSON.parse(result);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].content).toBe('Test content');
      expect(parsed[0].category).toBe('fact');
    });

    it('should format as JSON with metadata', () => {
      const memories = [createMemory('1', 'Test content', 0.7)];

      const result = formatContext(memories, {
        format: 'json',
        includeMetadata: true,
      });

      const parsed = JSON.parse(result);
      expect(parsed[0].age).toBeDefined();
      expect(parsed[0].importance).toBe(0.7);
      expect(parsed[0].accessed).toBe(0);
    });

    it('should use custom header', () => {
      const memories = [createMemory('1', 'Test')];

      const result = formatContext(memories, {
        format: 'bullets',
        header: 'Custom header:',
      });

      expect(result).toContain('Custom header:');
      expect(result).not.toContain('Relevant memories:');
    });

    it('should return empty string for no memories', () => {
      const result = formatContext([], { format: 'bullets' });
      expect(result).toBe('');
    });

    it('should escape XML special characters', () => {
      const memories = [createMemory('1', 'Test <tag> & "quotes"')];

      const result = formatContext(memories, { format: 'xml' });

      expect(result).toContain('&lt;tag&gt;');
      expect(result).toContain('&amp;');
      expect(result).toContain('&quot;');
    });
  });

  describe('applyTokenBudget()', () => {
    it('should select memories within budget', () => {
      const memories = [
        createMemory('1', 'Short memory', 0.9),
        createMemory('2', 'This is a medium length memory content that has more words', 0.7),
        createMemory('3', 'This is a very long memory content that takes many many tokens to represent and should be excluded when budget is tight', 0.5),
        createMemory('4', 'Another long memory with lots of text that will consume the token budget quickly', 0.4),
      ];

      // Small budget should only include highest importance
      const selected = applyTokenBudget(memories, 40, 'bullets', false, 'Header:');

      expect(selected.length).toBeGreaterThan(0);
      expect(selected.length).toBeLessThanOrEqual(memories.length);
      // Should prioritize high importance
      if (selected.length > 1) {
        expect(selected[0].importance).toBeGreaterThanOrEqual(selected[selected.length - 1]?.importance ?? 0);
      }
    });

    it('should respect decayed importance', () => {
      const memories = [
        { ...createMemory('1', 'Old but important', 0.9), decayedImportance: 0.3 },
        { ...createMemory('2', 'Recent less important', 0.5), decayedImportance: 0.5 },
      ];

      const selected = applyTokenBudget(memories, 30, 'bullets', false, '');

      // Should select based on decayed importance (0.5 > 0.3)
      expect(selected[0].id).toBe('2');
    });

    it('should return empty array for zero budget', () => {
      const memories = [createMemory('1', 'Test')];
      const selected = applyTokenBudget(memories, 0, 'bullets', false, '');
      expect(selected).toHaveLength(0);
    });

    it('should include all memories if budget allows', () => {
      const memories = [
        createMemory('1', 'A'),
        createMemory('2', 'B'),
      ];

      const selected = applyTokenBudget(memories, 10000, 'bullets', false, '');
      expect(selected).toHaveLength(2);
    });
  });

  describe('Token budgeting with formats', () => {
    it('should work with prose format', () => {
      const memories = [
        createMemory('1', 'Test 1', 0.9),
        createMemory('2', 'Test 2', 0.8),
      ];

      const result = formatContext(memories, {
        format: 'prose',
        maxTokens: 20,
      });

      expect(result).toContain('Based on previous interactions:');
    });

    it('should work with XML format', () => {
      const memories = [
        createMemory('1', 'Test 1', 0.9),
        createMemory('2', 'Test 2', 0.8),
      ];

      const result = formatContext(memories, {
        format: 'xml',
        maxTokens: 50,
      });

      expect(result).toContain('<memories>');
      // May not include all memories due to token limit
    });

    it('should work with JSON format', () => {
      const memories = [
        createMemory('1', 'Test content here', 0.9),
        createMemory('2', 'More test content', 0.8),
        createMemory('3', 'Even more content', 0.7),
      ];

      const result = formatContext(memories, {
        format: 'json',
        maxTokens: 50,
        includeMetadata: true,
      });

      const parsed = JSON.parse(result);
      expect(parsed.length).toBeGreaterThan(0);
      expect(parsed.length).toBeLessThanOrEqual(3);
    });
  });
});
