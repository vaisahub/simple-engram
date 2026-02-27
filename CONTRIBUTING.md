# Contributing to Simple Engram

Thank you for your interest in contributing to Simple Engram! This document provides guidelines and instructions for contributing.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)
- [Project Philosophy](#project-philosophy)
- [What We're Looking For](#what-were-looking-for)
- [What We're NOT Looking For](#what-were-not-looking-for)

---

## Code of Conduct

Be respectful, inclusive, and constructive. We're here to build great software together.

---

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm or pnpm
- Git

### Fork and Clone

```bash
# Fork the repository on GitHub, then:
git clone https://github.com/YOUR_USERNAME/simple-engram.git
cd simple-engram
npm install
```

---

## Development Setup

### Install Dependencies

```bash
npm install
```

### Run Tests

```bash
npm test              # Run tests in watch mode
npm run test:ui       # Run tests with UI
npm run test:coverage # Generate coverage report
```

### Build

```bash
npm run build         # Build once
npm run dev           # Build in watch mode
```

### Code Quality

```bash
npm run lint          # Check for linting errors
npm run format        # Format code with Prettier
npm run format:check  # Check formatting
```

---

## Making Changes

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/issue-number-description
```

### 2. Write Code

- Follow existing code style (TypeScript, ESLint, Prettier)
- Add JSDoc comments for public APIs
- Keep functions small and focused
- Prefer readability over cleverness

### 3. Add Tests

**All new features and bug fixes must include tests.**

```typescript
// test/your-feature.test.ts
import { describe, it, expect } from 'vitest';
import { Engram } from '../src/index.js';

describe('Your Feature', () => {
  it('should do something', async () => {
    const mem = new Engram({ llm: mockLLM });
    // ... test your feature
    expect(result).toBe(expected);
  });
});
```

### 4. Update Documentation

If you add/change public APIs:
- Update `docs/API.md`
- Update `README.md` if user-facing
- Add examples to `docs/EXAMPLES.md`
- Update `CHANGELOG.md` (under `[Unreleased]`)

---

## Testing

### Test Structure

```
test/
├── integration/        # End-to-end tests
├── stores/            # Storage adapter tests
├── benchmark.test.ts  # Performance benchmarks
├── context.test.ts    # Context generation tests
├── decay.test.ts      # Memory decay tests
├── scorer.test.ts     # Surprise scoring tests
└── ...
```

### Writing Good Tests

```typescript
// ✅ Good: Descriptive, isolated, fast
it('should reject duplicate memories with surprise < 0.1', async () => {
  const mem = new Engram({ llm: mockLLM, surpriseThreshold: 0.3 });
  
  await mem.store('User likes Python');
  const result = await mem.remember([
    { role: 'user', content: 'User likes Python' } // Exact duplicate
  ]);
  
  expect(result.stored).toHaveLength(0);
  expect(result.rejected).toHaveLength(1);
  expect(result.rejected[0].surprise).toBeLessThan(0.1);
});

// ❌ Bad: Vague, slow, multiple assertions
it('should work', async () => {
  // Tests too many things at once
  // No clear purpose
  // Slow external API calls
});
```

### Running Specific Tests

```bash
npm test -- scorer.test.ts           # Run one file
npm test -- --grep "surprise"        # Run tests matching pattern
npm test -- --coverage               # With coverage
```

---

## Pull Request Process

### 1. Before Submitting

- [ ] All tests pass (`npm test`)
- [ ] Code builds without errors (`npm run build`)
- [ ] Linting passes (`npm run lint`)
- [ ] Formatting is correct (`npm run format:check`)
- [ ] Documentation is updated
- [ ] CHANGELOG.md is updated

### 2. Commit Messages

Follow conventional commits format:

```bash
feat: add streaming export for large datasets
fix: resolve memory leak in event listeners
docs: add examples for multi-agent systems
chore: update dependencies
test: add coverage for edge cases
perf: optimize tokenization with WeakMap cache
```

### 3. Create Pull Request

**Title**: Clear, concise description
```
feat: add memory compression for storage optimization
```

**Description**: Use this template
```markdown
## Summary
Brief description of what this PR does

## Motivation
Why is this change needed?

## Changes
- Added X
- Modified Y
- Fixed Z

## Testing
- Added tests for X
- All existing tests pass
- Manual testing: [describe what you tested]

## Breaking Changes
None / [Describe breaking changes]

## Checklist
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] All CI checks pass
```

### 4. Review Process

- Maintainers will review within 1-3 days
- Address feedback and update PR
- Once approved, we'll merge!

---

## Project Philosophy

### Keep It Simple

Simple Engram is intentionally **minimal and focused**:

✅ **Core Responsibility**: Memory layer for AI agents
- Extract memories from conversations
- Store with deduplication
- Retrieve relevant memories
- Provide context for prompts

❌ **Not Our Responsibility**:
- Full conversation management
- Agent frameworks
- Built-in LLM providers
- Hosting/cloud services
- UI/dashboards

### Zero Dependencies (Production)

We have **zero runtime dependencies** by design:
- Keep it lightweight
- Reduce supply chain risk
- Work offline
- Fast installs

**Exception**: `better-sqlite3` is **optional** for SqliteStore

### BYOLLM (Bring Your Own LLM)

We don't bundle LLM providers. Users bring their own:
- Keeps library small
- Works with any provider
- No API key management
- Maximum flexibility

---

## What We're Looking For

### ✅ Contributions We Welcome

1. **Bug Fixes**
   - Memory leaks
   - Incorrect behavior
   - Edge cases
   - Performance issues

2. **Performance Improvements**
   - Algorithm optimizations
   - Cache improvements
   - Memory efficiency

3. **Documentation**
   - Better examples
   - Clearer explanations
   - Real-world use cases
   - Tutorials

4. **Tests**
   - Increase coverage
   - Edge case testing
   - Performance benchmarks

5. **Storage Adapters**
   - Redis adapter
   - PostgreSQL adapter
   - Custom backend examples

6. **Examples**
   - LangChain integration
   - Multi-agent systems
   - Production deployments

---

## What We're NOT Looking For

### ❌ Contributions We'll Likely Reject

1. **Built-in LLM Providers**
   - We're BYOLLM by design
   - Keep providers in user code

2. **New Dependencies**
   - Zero runtime dependencies is a core principle
   - DevDependencies are okay

3. **Agent Frameworks**
   - Engram is a memory layer, not an agent framework
   - Keep it focused

4. **UI/Dashboards**
   - Separate project territory
   - Keep Engram headless

5. **Breaking Changes**
   - Must have strong justification
   - Requires major version bump
   - Needs migration guide

6. **Scope Creep**
   - Features unrelated to memory
   - Complex query languages
   - Distributed systems features

---

## Development Guidelines

### Code Style

```typescript
// ✅ Good: Clear, typed, documented
/**
 * Compute surprise score for a memory candidate
 * @param candidate - The memory candidate to score
 * @param existing - All existing memories for comparison
 * @returns Surprise score between 0-1
 */
export async function computeSurprise(
  candidate: MemoryCandidate,
  existing: Memory[],
): Promise<number> {
  // Implementation
}

// ❌ Bad: No docs, unclear, untyped
function score(c, e) {
  // What does this do?
}
```

### Performance Considerations

- Profile before optimizing
- Add benchmarks for performance changes
- Consider memory usage (we're a memory library!)
- Use WeakMap for object-keyed caches

### Error Handling

```typescript
// ✅ Good: Specific errors, helpful messages
if (!this.config.llm) {
  throw new NoLLMError('LLM function is required for memory extraction');
}

// ❌ Bad: Generic errors
throw new Error('Something went wrong');
```

---

## Areas That Need Help

### High Priority

1. **More Storage Adapters**
   - Redis adapter for distributed systems
   - PostgreSQL adapter with pgvector
   - DynamoDB adapter for AWS users

2. **Production Examples**
   - Complete chatbot implementation
   - Multi-user agent system
   - LangChain integration example

3. **Performance Benchmarks**
   - Publish comparison with other memory systems
   - Scaling tests (10k, 100k, 1M memories)
   - Memory usage profiling

### Medium Priority

1. **Test Coverage**
   - Edge cases for merge()
   - Cross-storage adapter tests
   - Concurrent operation tests

2. **Documentation**
   - Video tutorials
   - Blog posts
   - Integration guides

### Low Priority

1. **Nice-to-Haves**
   - Custom similarity functions
   - Memory compression
   - Read-only mode
   - Memory snapshots

---

## Questions?

- Open an issue: https://github.com/vaisahub/simple-engram/issues
- Start a discussion: https://github.com/vaisahub/simple-engram/discussions
- Check existing docs: https://github.com/vaisahub/simple-engram#readme

---

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

## Thank You!

Every contribution makes Simple Engram better. Whether it's a bug report, documentation fix, or new feature - we appreciate your help! 🙏
