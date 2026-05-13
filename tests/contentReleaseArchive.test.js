const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { archiveReleaseRecord } = require("../scripts/content-release/archiveReleaseRecord");
const { runArchive } = require("../scripts/content-release/archive");

test("archiveReleaseRecord appends one matching release record into archive.jsonl", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "content-release-archive-"));
  const runtimeLogPath = path.join(tempDir, "release-log.jsonl");
  const archivePath = path.join(tempDir, "archive.jsonl");

  fs.writeFileSync(
    runtimeLogPath,
    [
      JSON.stringify({ releaseId: "prod-20260513T131117Z", ok: true, dryRun: false }),
      JSON.stringify({ releaseId: "prod-20260513T140000Z", ok: true, dryRun: true })
    ].join("\n") + "\n"
  );
  fs.writeFileSync(archivePath, "");

  const result = archiveReleaseRecord({
    releaseId: "prod-20260513T131117Z",
    runtimeLogPath,
    archivePath
  });

  assert.equal(result.releaseId, "prod-20260513T131117Z");
  const lines = fs.readFileSync(archivePath, "utf8").trim().split(/\r?\n/);
  assert.equal(lines.length, 1);
  assert.equal(JSON.parse(lines[0]).releaseId, "prod-20260513T131117Z");
});

test("archiveReleaseRecord rejects duplicate releaseId in archive.jsonl", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "content-release-archive-dup-"));
  const runtimeLogPath = path.join(tempDir, "release-log.jsonl");
  const archivePath = path.join(tempDir, "archive.jsonl");

  fs.writeFileSync(
    runtimeLogPath,
    `${JSON.stringify({ releaseId: "prod-20260513T131117Z", ok: true })}\n`
  );
  fs.writeFileSync(
    archivePath,
    `${JSON.stringify({ releaseId: "prod-20260513T131117Z", ok: true })}\n`
  );

  assert.throws(
    () =>
      archiveReleaseRecord({
        releaseId: "prod-20260513T131117Z",
        runtimeLogPath,
        archivePath
      }),
    /already archived/i
  );
});

test("runArchive prints structured JSON for a successful archive", async () => {
  const logs = [];

  await runArchive({
    loadConfig() {
      return {
        releaseId: "prod-20260513T131117Z",
        archivePath: "deployment/content-release/archive.jsonl"
      };
    },
    archive() {
      return {
        releaseId: "prod-20260513T131117Z",
        archivePath: "deployment/content-release/archive.jsonl"
      };
    },
    logger: {
      log(message) {
        logs.push(String(message));
      }
    }
  });

  const payload = JSON.parse(logs[0]);
  assert.equal(payload.ok, true);
  assert.equal(payload.releaseId, "prod-20260513T131117Z");
  assert.equal(payload.archivePath, "deployment/content-release/archive.jsonl");
});
