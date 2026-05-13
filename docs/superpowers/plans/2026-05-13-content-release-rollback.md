# Content Release Rollback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-class rollback command that restores content from a backup directory derived from `releaseId` and verifies the live service afterward.

**Architecture:** Reuse the existing release env loading pattern, split remote restore and verification into dedicated modules, and keep `rollback.js` as a thin orchestrator similar to `publish.js`.

**Tech Stack:** Node.js built-in `path`, `child_process`, `node:test`; existing content release env files and verification strategy.

---

## File Structure / Ownership Map

### New implementation files

- `scripts/content-release/loadRollbackConfig.js`
- `scripts/content-release/rollbackRelease.js`
- `scripts/content-release/verifyRollback.js`
- `scripts/content-release/rollback.js`

### Existing files to modify

- `package.json`
- `scripts/check-syntax.js`
- `deployment/content-release/README.md`
- `deployment/content-release/RUNBOOK.md`

### New tests

- `tests/contentReleaseRollback.test.js`

---

### Task 1: Add failing rollback tests

**Files:**
- Create: `tests/contentReleaseRollback.test.js`

- [ ] Add tests for config parsing, rollback SSH command construction, rollback verification calls, and orchestrator JSON output.
- [ ] Run: `node --test tests/contentReleaseRollback.test.js`
- [ ] Confirm the tests fail before implementation.

### Task 2: Implement rollback modules

**Files:**
- Create: `scripts/content-release/loadRollbackConfig.js`
- Create: `scripts/content-release/rollbackRelease.js`
- Create: `scripts/content-release/verifyRollback.js`
- Create: `scripts/content-release/rollback.js`

- [ ] Implement the config loader with required `releaseId`.
- [ ] Implement remote restore from `<remoteBackupsDir>/<releaseId>`.
- [ ] Implement rollback verification against internal/public health and bootstrap endpoints.
- [ ] Implement the rollback orchestrator and JSON success output.
- [ ] Run: `node --test tests/contentReleaseRollback.test.js`
- [ ] Confirm rollback tests pass.

### Task 3: Update docs and command wiring

**Files:**
- Modify: `package.json`
- Modify: `scripts/check-syntax.js`
- Modify: `deployment/content-release/README.md`
- Modify: `deployment/content-release/RUNBOOK.md`

- [ ] Add `rollback:content` npm script.
- [ ] Add syntax coverage for new rollback scripts.
- [ ] Document the rollback command and expected inputs.
- [ ] Re-run rollback tests after doc/command wiring changes.

### Task 4: Regression checks and commit

**Files:**
- All files above

- [ ] Run: `node --test tests/contentReleaseRollback.test.js`
- [ ] Run: `node scripts/check-syntax.js`
- [ ] Run: `npm test`
- [ ] Review `git diff --stat`.
- [ ] Commit with a focused message.
