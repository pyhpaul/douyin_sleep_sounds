const fs = require("node:fs");
const path = require("node:path");

const catalog = require("../content/catalog.json");
const {
  DEMO_AUDIO_URL,
  DEFAULT_CLOUD_CDN_BASE_URL,
  buildCloudSeed,
  buildHttpDeploymentCatalog,
  buildLocalSoundsModule
} = require("../content/catalogAdapter");

const generatedSoundsPath = path.resolve(__dirname, "../miniprogram/generated/sounds.js");
const cloudSeedPath = path.resolve(__dirname, "../cloud/seed/content.seed.json");
const deploymentCatalogPath = path.resolve(__dirname, "../deployment/cloud-http-content/api/catalog.json");
const cdnBaseUrl = process.env.CLOUD_CONTENT_CDN_BASE_URL || DEFAULT_CLOUD_CDN_BASE_URL;

function ensureParentDirectory(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function writeFile(filePath, content) {
  ensureParentDirectory(filePath);
  fs.writeFileSync(filePath, content);
}

function main() {
  const localModule = buildLocalSoundsModule(catalog);
  const cloudSeed = buildCloudSeed(catalog, { cdnBaseUrl });
  const deploymentCatalog = buildHttpDeploymentCatalog(catalog);

  writeFile(
    generatedSoundsPath,
    `module.exports = ${JSON.stringify(
      {
        ...localModule,
        DEMO_AUDIO_URL
      },
      null,
      2
    )};\n`
  );
  writeFile(`${cloudSeedPath}`, `${JSON.stringify(cloudSeed, null, 2)}\n`);
  writeFile(deploymentCatalogPath, `${JSON.stringify(deploymentCatalog, null, 2)}\n`);

  console.log(
    [
      "Synced content artifacts:",
      generatedSoundsPath,
      cloudSeedPath,
      deploymentCatalogPath
    ].join("\n")
  );
}

main();
