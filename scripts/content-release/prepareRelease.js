const fs = require("node:fs");
const path = require("node:path");

const catalog = require("../../content/catalog.json");
const { buildHttpDeploymentCatalog } = require("../../content/catalogAdapter");

const repoRoot = path.resolve(__dirname, "../..");

function ensureFileExists(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} does not exist: ${filePath}`);
  }
}

function runDefaultCommand(command, args) {
  const { spawnSync } = require("node:child_process");
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit"
  });

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }
}

async function prepareRelease({ config, runCommand = runDefaultCommand } = {}) {
  if (!config) {
    throw new Error("config is required");
  }

  const deploymentCatalog = buildHttpDeploymentCatalog(catalog);
  const coverPaths = deploymentCatalog.sounds.map((sound) =>
    path.resolve(repoRoot, "miniprogram/assets/covers", sound.coverAssetKey)
  );

  for (const coverPath of coverPaths) {
    ensureFileExists(coverPath, "cover asset");
  }

  if (config.assetMode === "local-assets") {
    if (!config.assetSourcePath || !fs.existsSync(config.assetSourcePath)) {
      throw new Error(`asset source path does not exist: ${config.assetSourcePath}`);
    }
  }

  runCommand(process.execPath, ["scripts/sync-content-artifacts.js"]);
  runCommand(process.execPath, ["scripts/check-syntax.js"]);

  if (!config.skipTests) {
    const testFiles = fs
      .readdirSync(path.resolve(repoRoot, "tests"))
      .map((file) => `tests/${file}`);
    runCommand(process.execPath, ["--test", ...testFiles]);
  }

  return {
    catalog,
    deploymentCatalog,
    deploymentCatalogPath: path.resolve(repoRoot, "deployment/cloud-http-content/api/catalog.json"),
    coverFiles: deploymentCatalog.sounds.map((sound) => ({
      sourcePath: path.resolve(repoRoot, "miniprogram/assets/covers", sound.coverAssetKey),
      relativePath: `covers/${sound.coverAssetKey}`
    })),
    audioFiles:
      config.assetMode === "local-assets"
        ? deploymentCatalog.sounds.map((sound) => ({
            sourcePath: path.resolve(config.assetSourcePath, "audio", sound.audioAssetKey),
            relativePath: `audio/${sound.audioAssetKey}`
          }))
        : [],
    assetMode: config.assetMode,
    assetSourcePath: config.assetSourcePath
  };
}

module.exports = {
  prepareRelease
};
