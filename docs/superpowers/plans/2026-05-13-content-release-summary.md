# Content Release Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically write a local `release-summary.json` file into each content release bundle for both dry-run and successful prod publish paths.

**Architecture:** Keep bundle creation and deployment concerns separate by adding a small summary writer module. `publish.js` remains the orchestrator, `buildReleaseBundle.js` still owns bundle layout, and the new writer only persists the structured outcome after dry-run or successful verification.

**Tech Stack:** Node.js built-in `fs`, `path`, `node:test`; existing content release scripts and docs.

---

## File Structure / Ownership Map

### New implementation file

- `scripts/content-release/writeReleaseSummary.js`
  - Persist structured release outcome to `release-summary.json` in the bundle directory.

### Existing files to modify

- `scripts/content-release/publish.js`
  - Call the summary writer on dry-run and successful publish.
- `deployment/content-release/README.md`
  - Mention the generated summary file.
- `deployment/content-release/RUNBOOK.md`
  - Point operators at `release-summary.json` as the copy source for release records.

### Existing tests to modify

- `tests/contentReleaseBundle.test.js`
  - Add coverage for the summary writer output.
- `tests/contentReleaseDocs.test.js`
  - Require the new summary-file docs.

---

### Task 1: Add the failing tests for release summary output

**Files:**
- Modify: `tests/contentReleaseBundle.test.js`
- Modify: `tests/contentReleaseDocs.test.js`

- [ ] Add a failing test that calls the new summary writer and expects `release-summary.json` to be created.
- [ ] Add a failing docs assertion for `release-summary.json` in README and RUNBOOK.
- [ ] Run: `node --test tests/contentReleaseBundle.test.js tests/contentReleaseDocs.test.js`
- [ ] Confirm the new expectations fail because the summary writer and docs do not exist yet.

### Task 2: Implement the summary writer and wire publish flow

**Files:**
- Create: `scripts/content-release/writeReleaseSummary.js`
- Modify: `scripts/content-release/publish.js`

- [ ] Implement a focused writer that takes a structured payload and writes `release-summary.json` under `bundle.bundleDir`.
- [ ] Update `publish.js` to write summary output for dry-run success and verified publish success.
- [ ] Keep `buildReleaseBundle.js` unchanged except for consuming its existing return shape.
- [ ] Run: `node --test tests/contentReleaseBundle.test.js`
- [ ] Confirm the summary writer test passes.

### Task 3: Update docs and re-run targeted validation

**Files:**
- Modify: `deployment/content-release/README.md`
- Modify: `deployment/content-release/RUNBOOK.md`
- Modify: `tests/contentReleaseDocs.test.js`

- [ ] Document `release-summary.json` in README and RUNBOOK.
- [ ] Run: `node --test tests/contentReleaseDocs.test.js`
- [ ] Confirm docs tests pass.

### Task 4: Run focused regression checks and commit

**Files:**
- Modify: `tests/contentReleaseBundle.test.js`
- Modify: `tests/contentReleaseDocs.test.js`
- Create: `scripts/content-release/writeReleaseSummary.js`
- Modify: `scripts/content-release/publish.js`
- Modify: `deployment/content-release/README.md`
- Modify: `deployment/content-release/RUNBOOK.md`

- [ ] Run: `node --test tests/contentReleaseBundle.test.js tests/contentReleaseDocs.test.js`
- [ ] Run: `npm test`
- [ ] Review `git diff --stat`.
- [ ] Commit with a focused message.
