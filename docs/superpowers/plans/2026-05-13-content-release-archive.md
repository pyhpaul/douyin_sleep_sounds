# Content Release Archive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an explicit archive command that copies one release record from the local runtime log into a repository-tracked JSONL archive.

**Architecture:** Keep archive behavior local and deterministic: one command, one release id, one append-only repo file. Use a focused helper for log lookup and duplicate detection, and keep the CLI wrapper thin.

**Tech Stack:** Node.js built-in `fs`, `path`, `node:test`; existing release log JSONL format.

---

## File Structure / Ownership Map

### New implementation files

- `scripts/content-release/archiveReleaseRecord.js`
- `scripts/content-release/archive.js`

### Existing files to modify

- `package.json`
- `scripts/check-syntax.js`
- `deployment/content-release/README.md`

### New tests

- `tests/contentReleaseArchive.test.js`

### New tracked archive file

- `deployment/content-release/archive.jsonl`

---

### Task 1: Add failing archive tests

**Files:**
- Create: `tests/contentReleaseArchive.test.js`
- Create: `deployment/content-release/archive.jsonl`

- [ ] Add tests for successful archive by `releaseId`, duplicate detection, and orchestrator JSON output.
- [ ] Run: `node --test tests/contentReleaseArchive.test.js`
- [ ] Confirm the tests fail before implementation.

### Task 2: Implement archive helper and CLI

**Files:**
- Create: `scripts/content-release/archiveReleaseRecord.js`
- Create: `scripts/content-release/archive.js`

- [ ] Implement local log lookup by `releaseId`.
- [ ] Implement append-only write to `deployment/content-release/archive.jsonl`.
- [ ] Reject duplicate archive entries.
- [ ] Implement CLI JSON output.
- [ ] Run: `node --test tests/contentReleaseArchive.test.js`
- [ ] Confirm archive tests pass.

### Task 3: Wire command and docs

**Files:**
- Modify: `package.json`
- Modify: `scripts/check-syntax.js`
- Modify: `deployment/content-release/README.md`

- [ ] Add `archive:content` npm script.
- [ ] Add syntax coverage for archive scripts.
- [ ] Document the archive flow and file roles.

### Task 4: Regression checks and commit

**Files:**
- All files above

- [ ] Run: `node --test tests/contentReleaseArchive.test.js`
- [ ] Run: `node scripts/check-syntax.js`
- [ ] Run: `npm test`
- [ ] Review `git diff --stat`.
- [ ] Commit with a focused message.
