const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

function formatReleaseTimestamp(date = new Date()) {
  const isoValue = date.toISOString();
  return isoValue.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function createReleaseId(envName) {
  return `${envName}-${formatReleaseTimestamp()}`;
}

function ensureDirectory(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

function hashFile(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function copyFileIntoBundle({ sourcePath, targetPath, relativePath }) {
  ensureDirectory(path.dirname(targetPath));
  fs.copyFileSync(sourcePath, targetPath);

  return {
    relativePath,
    size: fs.statSync(targetPath).size,
    sha256: hashFile(targetPath)
  };
}

function buildReleaseBundle({
  config,
  prepared,
  releaseRoot = path.resolve("artifacts/content-release")
}) {
  const releaseId = createReleaseId(config.envName);
  const bundleDir = path.join(releaseRoot, releaseId);

  ensureDirectory(bundleDir);

  const files = [];
  const catalogTargetPath = path.join(bundleDir, "catalog.json");
  fs.writeFileSync(catalogTargetPath, `${JSON.stringify(prepared.deploymentCatalog, null, 2)}\n`);
  files.push({
    relativePath: "catalog.json",
    size: fs.statSync(catalogTargetPath).size,
    sha256: hashFile(catalogTargetPath)
  });

  for (const coverFile of prepared.coverFiles || []) {
    files.push(
      copyFileIntoBundle({
        sourcePath: coverFile.sourcePath,
        targetPath: path.join(bundleDir, coverFile.relativePath),
        relativePath: coverFile.relativePath
      })
    );
  }

  for (const audioFile of prepared.audioFiles || []) {
    files.push(
      copyFileIntoBundle({
        sourcePath: audioFile.sourcePath,
        targetPath: path.join(bundleDir, audioFile.relativePath),
        relativePath: audioFile.relativePath
      })
    );
  }

  const manifest = {
    releaseId,
    envName: config.envName,
    assetMode: config.assetMode,
    contentVersion: prepared.deploymentCatalog.version || "",
    generatedAt: new Date().toISOString(),
    files
  };

  fs.writeFileSync(path.join(bundleDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  return {
    releaseId,
    bundleDir,
    manifest
  };
}

module.exports = {
  buildReleaseBundle,
  createReleaseId
};
