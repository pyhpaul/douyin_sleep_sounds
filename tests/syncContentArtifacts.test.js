const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("sync-content-artifacts refreshes the ECS deployment catalog from content/catalog.json", () => {
  const deploymentCatalogPath = path.resolve(
    __dirname,
    "../deployment/cloud-http-content/api/catalog.json"
  );
  const before = fs.readFileSync(deploymentCatalogPath, "utf8");

  try {
    fs.writeFileSync(deploymentCatalogPath, JSON.stringify({ broken: true }, null, 2));

    const result = childProcess.spawnSync(process.execPath, ["scripts/sync-content-artifacts.js"], {
      cwd: path.resolve(__dirname, ".."),
      encoding: "utf8"
    });

    assert.equal(result.status, 0, result.stdout + result.stderr);

    const deploymentCatalog = JSON.parse(fs.readFileSync(deploymentCatalogPath, "utf8"));
    assert.equal(Array.isArray(deploymentCatalog.groups), true);
    assert.equal(Array.isArray(deploymentCatalog.sounds), true);
    assert.equal(deploymentCatalog.sounds[0].audioAssetKey.endsWith(".mp3"), true);
    assert.equal(deploymentCatalog.sounds[0].coverAssetKey.endsWith(".jpg"), true);
    assert.notEqual(fs.readFileSync(deploymentCatalogPath, "utf8").length, 0);
    assert.notEqual(before.length, 0);
  } finally {
    fs.writeFileSync(deploymentCatalogPath, before);
  }
});
