# Content Release Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically append each successful dry-run or verified content publish summary to a local JSONL release log under `artifacts/content-release/`.

**Architecture:** Reuse the already normalized release summary payload and keep log writing as a tiny append-only helper. The summary writer remains the main persistence entrypoint and delegates the JSONL append so publish orchestration does not gain extra responsibilities.

**Tech Stack:** Node.js built-in `fs`, `path`, `node:test`; existing content release scripts and docs.

---

## File Structure / Ownership Map

### New implementation file

- `scripts/content-release/appendReleaseLog.js`
  - Append one JSON line to the shared local release log.

### Existing files to modify

- `scripts/content-release/writeReleaseSummary.js`
  - Call the append-only log helper after writing the per-release summary.
- `deployment/content-release/README.md`
  - Mention the shared local release log.
- `deployment/content-release/RUNBOOK.md`
  - Clarify the log is a local-only operator timeline.

### Existing tests to modify

- `tests/contentReleaseBundle.test.js`
  - Add coverage for JSONL append behavior.
- `tests/contentReleaseDocs.test.js`
  - Require mention of the local release log.

---

### Task 1: Add failing tests for JSONL append behavior

**Files:**
- Modify: `tests/contentReleaseBundle.test.js`
- Modify: `tests/contentReleaseDocs.test.js`

- [ ] Add a failing test that expects `artifacts/content-release/release-log.jsonl` to receive a new line after writing a summary.
- [ ] Add a failing docs assertion for `release-log.jsonl`.
- [ ] Run: `node --test tests/contentReleaseBundle.test.js tests/contentReleaseDocs.test.js`
- [ ] Confirm the new expectations fail before implementation.

### Task 2: Implement append-only local release log

**Files:**
- Create: `scripts/content-release/appendReleaseLog.js`
- Modify: `scripts/content-release/writeReleaseSummary.js`

- [ ] Implement a helper that appends a newline-delimited JSON record to `artifacts/content-release/release-log.jsonl`.
- [ ] Update the summary writer to call it after the per-release file is written.
- [ ] Run: `node --test tests/contentReleaseBundle.test.js`
- [ ] Confirm append behavior passes.

### Task 3: Update docs and run focused validation

**Files:**
- Modify: `deployment/content-release/README.md`
- Modify: `deployment/content-release/RUNBOOK.md`
- Modify: `tests/contentReleaseDocs.test.js`

- [ ] Document the local release log and mark it as local-only runtime evidence.
- [ ] Run: `node --test tests/contentReleaseDocs.test.js`
- [ ] Confirm docs tests pass.

### Task 4: Run regression checks and commit

**Files:**
- Create: `scripts/content-release/appendReleaseLog.js`
- Modify: `scripts/content-release/writeReleaseSummary.js`
- Modify: `deployment/content-release/README.md`
- Modify: `deployment/content-release/RUNBOOK.md`
- Modify: `tests/contentReleaseBundle.test.js`
- Modify: `tests/contentReleaseDocs.test.js`

- [ ] Run: `node --test tests/contentReleaseBundle.test.js tests/contentReleaseDocs.test.js`
- [ ] Run: `npm test`
- [ ] Review `git diff --stat`.
- [ ] Commit with a focused message.
