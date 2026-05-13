const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { runPublish } = require("../scripts/content-release/publish");

test("runPublish writes a dry-run release summary into the bundle directory", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "content-release-publish-dry-run-"));
  const bundleDir = path.join(tempDir, "prod-20260513T120000Z");
  fs.mkdirSync(bundleDir, { recursive: true });

  const logs = [];
  const summaryCalls = [];

  try {
    await runPublish({
      loadConfig() {
        return {
          dryRun: true,
          envName: "prod",
          assetMode: "remote-only",
          publicBaseUrl: "https://sleep.zhenwei1.cn"
        };
      },
      prepare() {
        return {};
      },
      buildBundle() {
        return {
          releaseId: "prod-20260513T120000Z",
          bundleDir,
          manifest: {
            contentVersion: "2026-05-13T00:00:00Z"
          }
        };
      },
      writeSummary(payload) {
        summaryCalls.push(payload);
      },
      logger: {
        log(message) {
          logs.push(String(message));
        }
      }
    });

    const payload = JSON.parse(logs[0]);
    assert.equal(payload.releaseId, "prod-20260513T120000Z");
    assert.equal(payload.bundleDir, bundleDir);
    assert.equal(summaryCalls.length, 1);
    assert.equal(summaryCalls[0].result.dryRun, true);
    assert.equal(summaryCalls[0].result.backupDir, "");
    assert.match(
      summaryCalls[0].result.verificationTargets[0],
      /https:\/\/sleep\.zhenwei1\.cn\/healthz/
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("runPublish writes a verified summary after successful deploy", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "content-release-publish-success-"));
  const bundleDir = path.join(tempDir, "prod-20260513T121000Z");
  fs.mkdirSync(bundleDir, { recursive: true });

  const logs = [];
  const summaryCalls = [];

  try {
    await runPublish({
      loadConfig() {
        return {
          dryRun: false,
          envName: "prod",
          assetMode: "remote-only",
          publicBaseUrl: "https://sleep.zhenwei1.cn"
        };
      },
      prepare() {
        return {};
      },
      buildBundle() {
        return {
          releaseId: "prod-20260513T121000Z",
          bundleDir,
          manifest: {
            contentVersion: "2026-05-13T00:00:00Z",
            files: [{ relativePath: "covers/rain_night.jpg" }]
          }
        };
      },
      deploy() {
        return {
          backupDir: "/srv/sleep-sounds/backups/content/prod-20260513T121000Z"
        };
      },
      verify() {},
      writeSummary(payload) {
        summaryCalls.push(payload);
      },
      logger: {
        log(message) {
          logs.push(String(message));
        }
      }
    });

    const payload = JSON.parse(logs[0]);
    assert.equal(payload.ok, true);
    assert.equal(payload.releaseId, "prod-20260513T121000Z");
    assert.equal(payload.backupDir, "/srv/sleep-sounds/backups/content/prod-20260513T121000Z");
    assert.equal(summaryCalls.length, 1);
    assert.equal(summaryCalls[0].result.dryRun, false);
    assert.equal(summaryCalls[0].result.ok, true);
    assert.equal(
      summaryCalls[0].result.backupDir,
      "/srv/sleep-sounds/backups/content/prod-20260513T121000Z"
    );
    assert.equal(typeof summaryCalls[0].result.verifiedAt, "string");
    assert.equal(summaryCalls[0].result.verificationTargets.length >= 2, true);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
