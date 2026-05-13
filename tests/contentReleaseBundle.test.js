const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { buildReleaseBundle } = require("../scripts/content-release/buildReleaseBundle");

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
