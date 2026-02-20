# Publishing Engram to npm

This guide walks you through publishing Engram v0.2.0 to npm.

## ✅ Pre-Publishing Checklist

### Already Complete ✓

- [x] **All tests passing**: 150 tests pass (8 test files)
- [x] **Build successful**: TypeScript compiles without errors
- [x] **README.md**: 650 lines, comprehensive documentation
- [x] **LICENSE**: MIT license included
- [x] **package.json**: Properly configured with `files` field
- [x] **Zero dependencies**: No runtime dependencies (better-sqlite3 is optional)
- [x] **Version**: 0.2.0 (Phase 2 complete)

### To Complete Before Publishing

- [ ] **Add author information** to package.json
- [ ] **Add repository URL** to package.json (after creating GitHub repo)
- [ ] **Create GitHub repository**
- [ ] **Initialize git and commit code**
- [ ] **Push to GitHub**
- [ ] **Verify npm account** (login if needed)
- [ ] **Test with dry-run**
- [ ] **Publish to npm**
- [ ] **Create GitHub release**

---

## Step-by-Step Publishing Process

### Step 1: Update package.json

Add your author information and repository URL:

```json
{
  "author": "Your Name <your.email@example.com>",
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/engram.git"
  },
  "bugs": {
    "url": "https://github.com/yourusername/engram/issues"
  },
  "homepage": "https://github.com/yourusername/engram#readme"
}
```

### Step 2: Create GitHub Repository

1. Go to https://github.com/new
2. Repository name: `engram`
3. Description: "Plug-and-play memory engine for AI agents"
4. Public repository
5. **Do NOT initialize with README** (we already have one)
6. Click "Create repository"

### Step 3: Initialize Git and Push

```bash
cd /Users/vaisakhma/Documents/my-projects/engram

# Initialize git (if not already)
git init

# Add all files
git add .

# Create initial commit
git commit -m "chore: initial release v0.2.0

- Phase 1: Core memory engine (remember, store, recall, forget)
- Phase 2: Smart recall with context(), merge(), SqliteStore
- 150 tests passing
- Zero runtime dependencies
- Full TypeScript types
- Comprehensive documentation"

# Add remote (replace with your GitHub URL)
git remote add origin https://github.com/yourusername/engram.git

# Push to GitHub
git branch -M main
git push -u origin main

# Tag the release
git tag v0.2.0
git push --tags
```

### Step 4: Verify npm Login

```bash
# Check if you're logged in
npm whoami

# If not logged in, login to npm
npm login
```

You'll need:
- npm username
- npm password
- npm email
- 2FA code (if enabled)

### Step 5: Test Publishing (Dry Run)

```bash
# Run prepublishOnly script (builds TypeScript)
npm run prepublishOnly

# Test what will be published
npm publish --dry-run
```

This will show:
- Files that will be included in the package
- Package size
- Any warnings or errors

**Review the output carefully!** Make sure:
- Only `dist/`, `README.md`, `LICENSE` are included
- No test files or dev files are included
- Package size is reasonable (~100-200KB)

### Step 6: Publish to npm

```bash
# Publish to npm (public)
npm publish --access public
```

**Note**: First-time publishing requires `--access public` for scoped packages.

You'll see output like:
```
npm notice
npm notice 📦  engram@0.2.0
npm notice === Tarball Contents ===
npm notice 1.1kB  LICENSE
npm notice 18.5kB README.md
npm notice 200kB  dist/
npm notice === Tarball Details ===
npm notice name:          engram
npm notice version:       0.2.0
npm notice filename:      engram-0.2.0.tgz
npm notice package size:  50.2 kB
npm notice unpacked size: 219.6 kB
npm notice total files:   54
npm notice
+ engram@0.2.0
```

### Step 7: Create GitHub Release

1. Go to your GitHub repository
2. Click "Releases" → "Create a new release"
3. Tag: `v0.2.0` (should already exist from git tag)
4. Release title: `v0.2.0 - Phase 2: Smart Recall & Context`
5. Description:

```markdown
# Engram v0.2.0 - Phase 2 Complete 🎉

Engram is now **production-ready** with smart recall, context injection, and memory merging!

## What's New in Phase 2

### ✨ New Features

- **`context()` method**: Format memories for system prompts
  - 4 formats: bullets, prose, XML, JSON
  - Token budgeting (automatically fits within token limits)
  - Perfect for injecting relevant context into your prompts

- **`merge()` method**: Consolidate duplicate/similar memories
  - Cosine similarity (with embeddings) or Jaccard (keyword-based)
  - Configurable similarity threshold (default: 0.85)
  - Dry-run mode for safety

- **SqliteStore**: Production-grade persistent storage
  - Full-text search indices
  - WAL mode for performance
  - Handles millions of memories
  - Optional dependency (better-sqlite3)

### 📊 Stats

- **150 tests passing** (8 test suites)
- **Zero runtime dependencies** (all optional)
- **650-line README** with comprehensive docs
- **100% TypeScript** with full type safety

### 🚀 Real-World Testing

Tested with **Ollama (100% local, $0 cost)**:
- ✅ Semantic search working perfectly
- ✅ Typo tolerance (found "containerization" from "containr tecnology")
- ✅ Related concepts (found "TypeScript" from "programming languages" query)
- ✅ Duplicate detection (84.1% cosine similarity)
- ✅ Performance: <10ms for all operations

See [COMPLETE_TEST_SUMMARY.md](./COMPLETE_TEST_SUMMARY.md) for full results.

## Quick Start

```bash
npm install engram
```

```typescript
import { Engram } from 'engram';

// Bring your own LLM (works with any provider!)
const mem = new Engram({ llm, embed });

// Extract memories from conversations
await mem.remember([
  { role: 'user', content: 'I prefer TypeScript' }
]);

// Recall relevant memories
const memories = await mem.recall('coding preferences');

// Format for system prompt (NEW in Phase 2!)
const context = await mem.context('user preferences', {
  format: 'bullets',
  maxTokens: 300,
});

// Use in your prompt
const systemPrompt = `You are a helpful assistant.\n\n${context}`;
```

## Documentation

- [README.md](./README.md) - Full API documentation
- [WHY_ENGRAM.md](./WHY_ENGRAM.md) - Why use Engram?
- [ZERO_DEPS.md](./ZERO_DEPS.md) - Zero dependencies guide
- [OLLAMA_TEST_RESULTS.md](./OLLAMA_TEST_RESULTS.md) - Test results (no embeddings)
- [EMBEDDINGS_TEST_RESULTS.md](./EMBEDDINGS_TEST_RESULTS.md) - Test results (with embeddings)

## What's Next?

**Phase 3**: Multi-Agent & Namespaces (coming soon)
- Shared memory pools
- Cross-namespace recall
- Permission system

---

**Built with ❤️ for the AI agent community**

**License**: MIT
**Cost**: $0 (works with local models!)
**Setup time**: 5 minutes
```

6. Click "Publish release"

### Step 8: Verify Published Package

```bash
# Check if package is available
npm view engram

# Test installing in a new directory
cd /tmp
mkdir test-engram
cd test-engram
npm init -y
npm install engram

# Verify it works
node -e "import('engram').then(m => console.log('✅ Engram loaded:', Object.keys(m)))"
```

---

## Post-Publishing Tasks

### Announce the Release

1. **Twitter/X**: Share the npm link
2. **Reddit**: Post to r/programming, r/typescript, r/LocalLLaMA
3. **Hacker News**: Submit as "Show HN: Engram - Memory Engine for AI Agents"
4. **Dev.to**: Write a blog post about building Engram
5. **LinkedIn**: Professional announcement

### Update Documentation

1. Add npm badge to README:
```markdown
[![npm version](https://badge.fury.io/js/engram.svg)](https://www.npmjs.com/package/engram)
[![Downloads](https://img.shields.io/npm/dm/engram.svg)](https://www.npmjs.com/package/engram)
```

2. Update homepage with npm install instructions

### Monitor

1. Watch GitHub issues for bug reports
2. Monitor npm downloads: https://www.npmjs.com/package/engram
3. Check for security vulnerabilities: `npm audit`

---

## Troubleshooting

### "You must be logged in to publish packages"

```bash
npm login
```

### "Package name already taken"

If `engram` is taken, you might need to:
1. Use a scoped package: `@yourusername/engram`
2. Choose a different name: `engram-memory`, `engram-ai`, etc.

Check availability:
```bash
npm view engram  # If this returns 404, the name is available
```

### "Package already published"

You can't re-publish the same version. Bump the version:
```bash
npm version patch  # 0.2.0 → 0.2.1
npm version minor  # 0.2.0 → 0.3.0
npm version major  # 0.2.0 → 1.0.0
```

### "Failed to publish: 402 Payment Required"

Your npm account might need email verification. Check your email.

---

## What Gets Published?

Based on `package.json` `files` field:

```
engram-0.2.0.tgz
├── package.json
├── README.md
├── LICENSE
└── dist/
    ├── index.js
    ├── index.d.ts
    ├── index.js.map
    ├── index.d.ts.map
    ├── (all compiled TypeScript files)
    └── (type definitions)
```

**NOT included** (because of `files` field):
- `src/` (source TypeScript)
- `test/` (test files)
- `node_modules/`
- `*.md` files (except README.md)
- Test scripts
- Dev dependencies

---

## Version History

- **v0.2.0** (Current) - Phase 2: Smart Recall & Context
- **v0.1.0** - Phase 1: Core Memory Engine

---

## Next Steps After Publishing

1. ✅ Verify package on npm: https://www.npmjs.com/package/engram
2. ✅ Test installation: `npm install engram`
3. ✅ Create GitHub release
4. ✅ Announce on social media
5. 🚀 Start working on Phase 3!

---

**Ready to publish?** Follow the steps above in order. Good luck! 🎉
