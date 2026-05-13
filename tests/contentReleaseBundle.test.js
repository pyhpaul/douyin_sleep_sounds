const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { buildReleaseBundle } = require("../scripts/content-release/buildReleaseBundle");
const { writeReleaseSummary } = require("../scripts/content-release/writeReleaseSummary");

test("buildReleaseBundle writes manifest and staged files under artifacts/content-release", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "content-release-bundle-"));
  const sourceCatalogPath = path.join(tempDir, "catalog.json");
  const coverPath = path.join(tempDir, "rain_night.jpg");

  fs.writeFileSync(sourceCatalogPath, JSON.stringify({ version: "2026-05-13T00:00:00Z" }, null, 2));
  fs.writeFileSync(coverPath, "cover");

  try {
    const result = buildReleaseBundle({
      config: { envName: "prod", assetMode: "remote-only" },
      prepared: {
        deploymentCatalogPath: sourceCatalogPath,
        deploymentCatalog: { version: "2026-05-13T00:00:00Z", groups: [], sounds: [] },
        coverFiles: [{ sourcePath: coverPath, relativePath: "covers/rain_night.jpg" }]
      },
      releaseRoot: tempDir
    });

    assert.match(result.releaseId, /^prod-\d{8}T\d{6}Z$/);
    assert.equal(fs.existsSync(path.join(result.bundleDir, "manifest.json")), true);
    assert.equal(fs.existsSync(path.join(result.bundleDir, "catalog.json")), true);
    assert.equal(fs.existsSync(path.join(result.bundleDir, "covers", "rain_night.jpg")), true);

    const manifest = JSON.parse(fs.readFileSync(path.join(result.bundleDir, "manifest.json"), "utf8"));
    assert.equal(manifest.assetMode, "remote-only");
    assert.equal(manifest.files[0].relativePath, "catalog.json");
    assert.equal(manifest.files[1].relativePath, "covers/rain_night.jpg");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("writeReleaseSummary writes release-summary.json into the bundle directory", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "content-release-summary-"));
  const bundleDir = path.join(tempDir, "prod-20260513T120000Z");
  const bundleDirTwo = path.join(tempDir, "prod-20260513T121000Z");
  fs.mkdirSync(bundleDir, { recursive: true });
  fs.mkdirSync(bundleDirTwo, { recursive: true });
  const releaseRoot = path.dirname(bundleDir);

  try {
    const summaryPath = writeReleaseSummary({
      bundle: {
        bundleDir,
        releaseId: "prod-20260513T120000Z",
        manifest: {
          contentVersion: "2026-05-13T00:00:00Z"
        }
      },
      result: {
        ok: true,
        dryRun: false,
        envName: "prod",
        assetMode: "remote-only",
        backupDir: "/srv/sleep-sounds/backups/content/prod-20260513T120000Z",
        publicBaseUrl: "https://sleep.zhenwei1.cn",
        verifiedAt: "2026-05-13T12:05:00.000Z",
        verificationTargets: [
          "https://sleep.zhenwei1.cn/healthz",
          "https://sleep.zhenwei1.cn/content/bootstrap"
        ]
      }
    });

    assert.equal(summaryPath, path.join(bundleDir, "release-summary.json"));
    assert.equal(fs.existsSync(summaryPath), true);

    const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
    assert.equal(summary.releaseId, "prod-20260513T120000Z");
    assert.equal(summary.contentVersion, "2026-05-13T00:00:00Z");
    assert.equal(summary.backupDir, "/srv/sleep-sounds/backups/content/prod-20260513T120000Z");
    assert.deepEqual(summary.verificationTargets, [
      "https://sleep.zhenwei1.cn/healthz",
      "https://sleep.zhenwei1.cn/content/bootstrap"
    ]);

    writeReleaseSummary({
      bundle: {
        bundleDir: bundleDirTwo,
        releaseId: "prod-20260513T121000Z",
        manifest: {
          contentVersion: "2026-05-13T01:00:00Z"
        }
      },
      result: {
        ok: true,
        dryRun: true,
        envName: "prod",
        assetMode: "remote-only",
        backupDir: "",
        publicBaseUrl: "https://sleep.zhenwei1.cn",
        verifiedAt: "",
        verificationTargets: ["https://sleep.zhenwei1.cn/healthz"]
      }
    });

    const logPath = path.join(releaseRoot, "release-log.jsonl");
    assert.equal(fs.existsSync(logPath), true);
    const lines = fs.readFileSync(logPath, "utf8").trim().split(/\r?\n/);
    assert.equal(lines.length, 2);
    const logEntry = JSON.parse(lines[0]);
    assert.equal(logEntry.releaseId, "prod-20260513T120000Z");
    assert.equal(logEntry.contentVersion, "2026-05-13T00:00:00Z");
    const secondLogEntry = JSON.parse(lines[1]);
    assert.equal(secondLogEntry.releaseId, "prod-20260513T121000Z");
    assert.equal(secondLogEntry.dryRun, true);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
