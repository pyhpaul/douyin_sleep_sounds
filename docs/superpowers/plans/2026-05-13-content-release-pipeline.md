# Content Release Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a one-command ECS content release pipeline that turns `content/catalog.json` into validated deployment artifacts, deploys the content bundle to prod, and verifies the live service without mixing in API code deployment.

**Architecture:** Keep `content/catalog.json` as the only content source, extend `sync:content` to also generate the HTTP deployment catalog, and add a Node-based release orchestrator that runs `prepare -> package -> deploy -> verify`. The release pipeline defaults to `remote-only` assets, supports an opt-in external asset directory, writes a local release bundle, applies content updates to ECS through SSH/SCP, and prints rollback hints when deployment or verification fails.

**Tech Stack:** Node.js built-in `fs`, `path`, `crypto`, `child_process`, `node:test`; existing `content/catalogAdapter.js`; existing npm scripts; PowerShell env examples and operator docs; SSH/SCP to the existing ECS host.

---

## File Structure / Ownership Map

### Existing files to modify

- `content/catalogAdapter.js`
  - Add an HTTP deployment catalog builder that converts content facts into the flat filename-based catalog used by `deployment/cloud-http-content/api/catalog.json`.
- `scripts/sync-content-artifacts.js`
  - Extend the sync flow so one command refreshes the mini app module, cloud seed, and HTTP deployment catalog together.
- `scripts/check-syntax.js`
  - Include the new release pipeline scripts in syntax validation.
- `package.json`
  - Add top-level npm entrypoints for content publishing.

### New implementation files

- `scripts/content-release/loadReleaseConfig.js`
  - Parse `--env`, env files, defaults, and required release settings.
- `scripts/content-release/prepareRelease.js`
  - Validate content, assets, and local prereqs; run sync/check/test.
- `scripts/content-release/buildReleaseBundle.js`
  - Build `artifacts/content-release/<releaseId>/` and write `manifest.json`.
- `scripts/content-release/deployRelease.js`
  - Upload bundle, create remote backup, replace target files, and report remote paths.
- `scripts/content-release/verifyRelease.js`
  - Verify internal and public endpoints plus sample assets against the manifest.
- `scripts/content-release/printRollbackHint.js`
  - Render consistent rollback guidance.
- `scripts/content-release/publish.js`
  - Orchestrate all release stages and own exit codes.

### New docs/config files

- `deployment/content-release/README.md`
  - Agent-ready operator guide for prod content publishing.
- `deployment/content-release/prod.env.example`
  - Example release configuration for the current ECS host.

### New tests

- `tests/catalogAdapter.test.js`
  - Extend coverage for the new HTTP deployment catalog builder.
- `tests/syncContentArtifacts.test.js`
  - Prove the sync script now writes the HTTP deployment catalog.
- `tests/contentReleasePrepare.test.js`
  - Cover local validation and asset mode behavior.
- `tests/contentReleaseBundle.test.js`
  - Cover release id creation, manifest shape, and staged file copying.
- `tests/contentReleaseDeploy.test.js`
  - Cover SSH/SCP command construction, backup metadata, and failure surfacing.
- `tests/contentReleaseVerify.test.js`
  - Cover internal/public verification behavior and manifest comparisons.
- `tests/contentReleaseDocs.test.js`
  - Ensure the new operator docs and env example stay aligned with the chosen workflow.

---

## Task 1: Generate the HTTP deployment catalog from the main content source

**Files:**
- Modify: `tests/catalogAdapter.test.js`
- Create: `tests/syncContentArtifacts.test.js`
- Modify: `content/catalogAdapter.js`
- Modify: `scripts/sync-content-artifacts.js`
- Test: `npm test -- tests/catalogAdapter.test.js tests/syncContentArtifacts.test.js`

- [ ] **Step 1: Extend the catalog adapter test with the failing deployment-catalog expectation**

Add this test block to `tests/catalogAdapter.test.js`:

```js
const {
  buildLocalSoundsModule,
  buildCloudSeed,
  buildHttpDeploymentCatalog,
  DEMO_AUDIO_URL,
  getLocalAudioUrl
} = require("../content/catalogAdapter");

test("buildHttpDeploymentCatalog maps content facts into the ECS deployment catalog", () => {
  const deploymentCatalog = buildHttpDeploymentCatalog(fixtureCatalog);

  assert.equal(deploymentCatalog.defaultGroupId, "rain");
  assert.deepEqual(deploymentCatalog.featuredGroupIds, ["rain", "ambient"]);
  assert.deepEqual(
    deploymentCatalog.groups.map((group) => group.id),
    ["rain", "ambient"]
  );
  assert.equal(deploymentCatalog.sounds[0].audioAssetKey, "rain_night.mp3");
  assert.equal(deploymentCatalog.sounds[0].coverAssetKey, "rain_night.jpg");
  assert.equal(deploymentCatalog.sounds[1].audioAssetKey, "deep_ambient.mp3");
  assert.equal(deploymentCatalog.sounds[1].coverAssetKey, "deep_ambient.jpg");
});
```

- [ ] **Step 2: Add a failing sync script test that expects the deployment catalog file to be refreshed**

Create `tests/syncContentArtifacts.test.js` with this exact content:

```js
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
});
```

- [ ] **Step 3: Run the targeted tests to verify they fail before implementation**

Run:

```bash
npm test -- tests/catalogAdapter.test.js tests/syncContentArtifacts.test.js
```

Expected:

- FAIL because `buildHttpDeploymentCatalog` does not exist yet.
- FAIL because `scripts/sync-content-artifacts.js` does not write the deployment catalog file.

- [ ] **Step 4: Add the deployment-catalog builder to `content/catalogAdapter.js`**

Add these helpers near the existing catalog builders:

```js
function toDeploymentAssetFileName(assetKey, fallbackExtension) {
  const assetKeyValue = String(assetKey || "").trim();
  const fileName = assetKeyValue.split("/").filter(Boolean).pop();

  if (fileName) {
    return fileName;
  }

  return fallbackExtension ? `unknown.${fallbackExtension}` : "";
}

function buildHttpDeploymentCatalog(catalog) {
  const normalized = normalizeCatalog(catalog);

  return {
    version: normalized.version,
    defaultGroupId: normalized.defaultGroupId,
    featuredGroupIds: [...normalized.featuredGroupIds],
    groups: normalized.groups.map((group) => ({
      id: group.id,
      title: group.title || "",
      subtitle: group.subtitle || "",
      sort: Number(group.sort || 0)
    })),
    sounds: normalized.sounds.map((sound) => ({
      id: sound.id,
      groupId: sound.groupId || "",
      title: sound.title || "",
      category: sound.category || "",
      description: sound.description || "",
      unlockLabel: sound.unlockLabel || "",
      audioAssetKey: toDeploymentAssetFileName(sound.audioAssetKey, "mp3"),
      coverAssetKey: toDeploymentAssetFileName(sound.coverAssetKey, "jpg"),
      durationSec: sound.durationSec === undefined ? null : sound.durationSec,
      sort: Number(sound.sort || 0),
      tags: Array.isArray(sound.tags) ? [...sound.tags] : []
    }))
  };
}
```

Export it from the same module:

```js
module.exports = {
  MOCK_AUDIO_HOST,
  DEMO_AUDIO_URL,
  COVER_BASE_PATH,
  LOCAL_AUDIO_BASE_URL,
  DEFAULT_CLOUD_CDN_BASE_URL,
  getLocalCoverPath,
  getLocalAudioUrl,
  getLocalAudioExtension,
  buildLocalSoundsModule,
  buildCloudSeed,
  buildHttpDeploymentCatalog,
  buildPublishedContentDocuments
};
```

- [ ] **Step 5: Extend `scripts/sync-content-artifacts.js` to write the deployment catalog**

Change the imports and file path declarations to:

```js
const {
  DEMO_AUDIO_URL,
  DEFAULT_CLOUD_CDN_BASE_URL,
  buildCloudSeed,
  buildHttpDeploymentCatalog,
  buildLocalSoundsModule
} = require("../content/catalogAdapter");

const generatedSoundsPath = path.resolve(__dirname, "../miniprogram/generated/sounds.js");
const cloudSeedPath = path.resolve(__dirname, "../cloud/seed/content.seed.json");
const deploymentCatalogPath = path.resolve(
  __dirname,
  "../deployment/cloud-http-content/api/catalog.json"
);
```

Then write the extra artifact inside `main()`:

```js
  const deploymentCatalog = buildHttpDeploymentCatalog(catalog);

  writeFile(
    deploymentCatalogPath,
    `${JSON.stringify(deploymentCatalog, null, 2)}\n`
  );
```

Update the console summary so it names all generated artifacts:

```js
  console.log(
    [
      "Synced content artifacts:",
      generatedSoundsPath,
      cloudSeedPath,
      deploymentCatalogPath
    ].join("\n")
  );
```

- [ ] **Step 6: Run the targeted tests again and confirm they pass**

Run:

```bash
npm test -- tests/catalogAdapter.test.js tests/syncContentArtifacts.test.js
```

Expected:

- PASS for the new adapter builder test.
- PASS for the sync script coverage.

- [ ] **Step 7: Refresh generated artifacts and review the deployment catalog diff**

Run:

```bash
npm run sync:content
git diff -- deployment/cloud-http-content/api/catalog.json miniprogram/generated/sounds.js cloud/seed/content.seed.json
```

Expected:

- `sync:content` succeeds.
- The deployment catalog diff is either empty or only reflects intentional regeneration.

- [ ] **Step 8: Commit the artifact-generation foundation**

Run:

```bash
git add tests/catalogAdapter.test.js tests/syncContentArtifacts.test.js content/catalogAdapter.js scripts/sync-content-artifacts.js deployment/cloud-http-content/api/catalog.json
git commit -m "feat(content-release): generate deployment catalog from main content source"
```

Expected:

- One commit that makes HTTP deployment content derivable from `content/catalog.json`.

## Task 2: Add release configuration loading and local prepare validation

**Files:**
- Create: `tests/contentReleasePrepare.test.js`
- Create: `scripts/content-release/loadReleaseConfig.js`
- Create: `scripts/content-release/prepareRelease.js`
- Modify: `scripts/check-syntax.js`
- Test: `npm test -- tests/contentReleasePrepare.test.js`

- [ ] **Step 1: Write the failing prepare/config tests**

Create `tests/contentReleasePrepare.test.js` with this exact content:

```js
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { loadReleaseConfig } = require("../scripts/content-release/loadReleaseConfig");
const { prepareRelease } = require("../scripts/content-release/prepareRelease");

function writeEnvFile(lines) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "content-release-env-"));
  const envPath = path.join(tempDir, "prod.env");
  fs.writeFileSync(envPath, lines.join("\n"));
  return { tempDir, envPath };
}

test("loadReleaseConfig reads prod env settings and normalizes trailing slashes", () => {
  const { tempDir, envPath } = writeEnvFile([
    "CONTENT_RELEASE_ENV=prod",
    "CONTENT_RELEASE_SSH_HOST=8.138.108.110",
    "CONTENT_RELEASE_SSH_USER=root",
    "CONTENT_RELEASE_SSH_KEY=C:/Users/lxy/.ssh/id_ed25519_aliyun",
    "CONTENT_RELEASE_PUBLIC_BASE_URL=https://sleep.zhenwei1.cn/",
    "CONTENT_RELEASE_INTERNAL_BASE_URL=http://127.0.0.1:3000/",
    "CONTENT_RELEASE_REMOTE_API_DIR=/srv/sleep-sounds/api/",
    "CONTENT_RELEASE_REMOTE_STATIC_DIR=/srv/sleep-sounds/static/",
    "CONTENT_RELEASE_REMOTE_RELEASES_DIR=/srv/sleep-sounds/releases/content/",
    "CONTENT_RELEASE_REMOTE_BACKUPS_DIR=/srv/sleep-sounds/backups/content/",
    "CONTENT_RELEASE_DEFAULT_ASSET_MODE=remote-only"
  ]);

  try {
    const config = loadReleaseConfig({
      args: ["--env", "prod", "--env-file", envPath]
    });

    assert.equal(config.envName, "prod");
    assert.equal(config.publicBaseUrl, "https://sleep.zhenwei1.cn");
    assert.equal(config.internalBaseUrl, "http://127.0.0.1:3000");
    assert.equal(config.remoteApiDir, "/srv/sleep-sounds/api");
    assert.equal(config.assetMode, "remote-only");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("prepareRelease requires local audio files when asset mode is local-assets", async () => {
  await assert.rejects(
    () =>
      prepareRelease({
        config: {
          assetMode: "local-assets",
          assetSourcePath: path.resolve(__dirname, "../missing-assets")
        },
        runCommand() {
          throw new Error("runCommand should not be called");
        }
      }),
    /asset source path does not exist/i
  );
});
```

- [ ] **Step 2: Run the targeted test to verify it fails**

Run:

```bash
npm test -- tests/contentReleasePrepare.test.js
```

Expected:

- FAIL because the new release config and prepare modules do not exist yet.

- [ ] **Step 3: Implement `loadReleaseConfig.js`**

Create `scripts/content-release/loadReleaseConfig.js` with this exact content:

```js
const fs = require("node:fs");
const path = require("node:path");

function trimTrailingSlashes(value) {
  return String(value || "").replace(/[\\/]+$/, "");
}

function parseArgs(args) {
  const result = {};

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];

    if (token === "--env") {
      result.envName = args[index + 1];
      index += 1;
      continue;
    }

    if (token === "--env-file") {
      result.envFile = args[index + 1];
      index += 1;
      continue;
    }

    if (token === "--asset-source") {
      result.assetSourcePath = args[index + 1];
      index += 1;
      continue;
    }

    if (token === "--dry-run") {
      result.dryRun = true;
      continue;
    }

    if (token === "--skip-tests") {
      result.skipTests = true;
    }
  }

  return result;
}

function readEnvFile(envFile) {
  const env = {};

  if (!envFile || !fs.existsSync(envFile)) {
    return env;
  }

  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    env[key] = value;
  }

  return env;
}

function requireField(source, fieldName) {
  if (!source[fieldName]) {
    throw new Error(`Missing required release config field: ${fieldName}`);
  }

  return source[fieldName];
}

function loadReleaseConfig({ args = process.argv.slice(2), env = process.env } = {}) {
  const parsedArgs = parseArgs(args);
  const envFile =
    parsedArgs.envFile ||
    path.resolve(process.cwd(), `deployment/content-release/${parsedArgs.envName || "prod"}.env`);
  const envFileValues = readEnvFile(envFile);
  const merged = Object.assign({}, envFileValues, env);
  const envName = parsedArgs.envName || merged.CONTENT_RELEASE_ENV || "prod";
  const assetSourcePath = parsedArgs.assetSourcePath
    ? path.resolve(parsedArgs.assetSourcePath)
    : "";
  const assetMode = assetSourcePath
    ? "local-assets"
    : merged.CONTENT_RELEASE_DEFAULT_ASSET_MODE || "remote-only";

  return {
    envName,
    envFile,
    sshHost: requireField(merged, "CONTENT_RELEASE_SSH_HOST"),
    sshUser: requireField(merged, "CONTENT_RELEASE_SSH_USER"),
    sshKey: requireField(merged, "CONTENT_RELEASE_SSH_KEY"),
    publicBaseUrl: trimTrailingSlashes(requireField(merged, "CONTENT_RELEASE_PUBLIC_BASE_URL")),
    internalBaseUrl: trimTrailingSlashes(requireField(merged, "CONTENT_RELEASE_INTERNAL_BASE_URL")),
    remoteApiDir: trimTrailingSlashes(requireField(merged, "CONTENT_RELEASE_REMOTE_API_DIR")),
    remoteStaticDir: trimTrailingSlashes(requireField(merged, "CONTENT_RELEASE_REMOTE_STATIC_DIR")),
    remoteReleasesDir: trimTrailingSlashes(
      requireField(merged, "CONTENT_RELEASE_REMOTE_RELEASES_DIR")
    ),
    remoteBackupsDir: trimTrailingSlashes(
      requireField(merged, "CONTENT_RELEASE_REMOTE_BACKUPS_DIR")
    ),
    assetMode,
    assetSourcePath,
    dryRun: Boolean(parsedArgs.dryRun),
    skipTests: Boolean(parsedArgs.skipTests)
  };
}

module.exports = {
  loadReleaseConfig
};
```

- [ ] **Step 4: Implement `prepareRelease.js`**

Create `scripts/content-release/prepareRelease.js` with this exact content:

```js
const fs = require("node:fs");
const path = require("node:path");

const catalog = require("../../content/catalog.json");
const { buildHttpDeploymentCatalog } = require("../../content/catalogAdapter");

function ensureFileExists(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} does not exist: ${filePath}`);
  }
}

function runDefaultCommand(command, args) {
  const { spawnSync } = require("node:child_process");
  const result = spawnSync(command, args, {
    cwd: path.resolve(__dirname, "../.."),
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
    path.resolve(__dirname, "../../miniprogram/assets/covers", sound.coverAssetKey)
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
    runCommand(process.execPath, ["--test", ...fs.readdirSync("tests").map((file) => `tests/${file}`)]);
  }

  return {
    catalog,
    deploymentCatalog,
    covers: coverPaths,
    assetMode: config.assetMode,
    assetSourcePath: config.assetSourcePath
  };
}

module.exports = {
  prepareRelease
};
```

- [ ] **Step 5: Add the new scripts to syntax checking**

Append these paths to the `files` array in `scripts/check-syntax.js`:

```js
  "scripts/content-release/loadReleaseConfig.js",
  "scripts/content-release/prepareRelease.js",
```

- [ ] **Step 6: Re-run the targeted test and syntax check**

Run:

```bash
npm test -- tests/contentReleasePrepare.test.js
npm run check
```

Expected:

- The prepare/config tests pass.
- Syntax checking includes the new release files.

- [ ] **Step 7: Commit the release configuration and prepare stage**

Run:

```bash
git add tests/contentReleasePrepare.test.js scripts/content-release/loadReleaseConfig.js scripts/content-release/prepareRelease.js scripts/check-syntax.js
git commit -m "feat(content-release): add release config and prepare validation"
```

Expected:

- One commit that introduces the validated release-config entrypoint and local prepare stage.

## Task 3: Build the release bundle and manifest

**Files:**
- Create: `tests/contentReleaseBundle.test.js`
- Create: `scripts/content-release/buildReleaseBundle.js`
- Test: `npm test -- tests/contentReleaseBundle.test.js`

- [ ] **Step 1: Write the failing bundle test**

Create `tests/contentReleaseBundle.test.js` with this exact content:

```js
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
});
```

- [ ] **Step 2: Run the targeted test to verify it fails**

Run:

```bash
npm test -- tests/contentReleaseBundle.test.js
```

Expected:

- FAIL because `buildReleaseBundle.js` does not exist yet.

- [ ] **Step 3: Implement `buildReleaseBundle.js`**

Create `scripts/content-release/buildReleaseBundle.js` with this exact content:

```js
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

function createReleaseId(envName) {
  const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return `${envName}-${timestamp}`;
}

function ensureDirectory(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

function hashFile(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function copyFileIntoBundle(sourcePath, targetPath) {
  ensureDirectory(path.dirname(targetPath));
  fs.copyFileSync(sourcePath, targetPath);
  return {
    relativePath: path.relative(path.dirname(path.dirname(targetPath)), targetPath).replace(/\\/g, "/"),
    size: fs.statSync(targetPath).size,
    sha256: hashFile(targetPath)
  };
}

function buildReleaseBundle({ config, prepared, releaseRoot = path.resolve("artifacts/content-release") }) {
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
      copyFileIntoBundle(coverFile.sourcePath, path.join(bundleDir, coverFile.relativePath))
    );
  }

  for (const audioFile of prepared.audioFiles || []) {
    files.push(
      copyFileIntoBundle(audioFile.sourcePath, path.join(bundleDir, audioFile.relativePath))
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
  buildReleaseBundle
};
```

- [ ] **Step 4: Align `prepareRelease.js` output with the bundle builder**

Update the return object in `scripts/content-release/prepareRelease.js` to include explicit staged file metadata:

```js
  return {
    catalog,
    deploymentCatalog,
    deploymentCatalogPath: path.resolve(
      __dirname,
      "../../deployment/cloud-http-content/api/catalog.json"
    ),
    coverFiles: deploymentCatalog.sounds.map((sound) => ({
      sourcePath: path.resolve(__dirname, "../../miniprogram/assets/covers", sound.coverAssetKey),
      relativePath: `covers/${sound.coverAssetKey}`
    })),
    audioFiles:
      config.assetMode === "local-assets"
        ? deploymentCatalog.sounds.map((sound) => ({
            sourcePath: path.resolve(config.assetSourcePath, "audio", sound.audioAssetKey),
            relativePath: `audio/${sound.audioAssetKey}`
          }))
        : []
  };
```

- [ ] **Step 5: Re-run the bundle test**

Run:

```bash
npm test -- tests/contentReleaseBundle.test.js
```

Expected:

- PASS and the bundle is written under the provided temporary artifacts directory.

- [ ] **Step 6: Commit the bundle stage**

Run:

```bash
git add tests/contentReleaseBundle.test.js scripts/content-release/buildReleaseBundle.js scripts/content-release/prepareRelease.js
git commit -m "feat(content-release): build release bundles with manifests"
```

Expected:

- One commit that produces local, reviewable content release bundles.

## Task 4: Add deploy and verify stages with rollback hints

**Files:**
- Create: `tests/contentReleaseDeploy.test.js`
- Create: `tests/contentReleaseVerify.test.js`
- Create: `scripts/content-release/deployRelease.js`
- Create: `scripts/content-release/verifyRelease.js`
- Create: `scripts/content-release/printRollbackHint.js`
- Test: `npm test -- tests/contentReleaseDeploy.test.js tests/contentReleaseVerify.test.js`

- [ ] **Step 1: Write the failing deploy test**

Create `tests/contentReleaseDeploy.test.js` with this exact content:

```js
const assert = require("node:assert/strict");
const test = require("node:test");

const { deployRelease } = require("../scripts/content-release/deployRelease");

test("deployRelease constructs remote backup and upload commands", async () => {
  const calls = [];

  const result = await deployRelease({
    config: {
      sshHost: "8.138.108.110",
      sshUser: "root",
      sshKey: "C:/Users/lxy/.ssh/id_ed25519_aliyun",
      remoteApiDir: "/srv/sleep-sounds/api",
      remoteStaticDir: "/srv/sleep-sounds/static",
      remoteReleasesDir: "/srv/sleep-sounds/releases/content",
      remoteBackupsDir: "/srv/sleep-sounds/backups/content"
    },
    bundle: {
      releaseId: "prod-20260513T120000Z",
      bundleDir: "E:/tmp/release"
    },
    runCommand(command, args) {
      calls.push([command, ...args].join(" "));
      return { status: 0 };
    }
  });

  assert.equal(result.backupDir, "/srv/sleep-sounds/backups/content/prod-20260513T120000Z");
  assert.equal(calls.some((call) => call.includes("scp -i C:/Users/lxy/.ssh/id_ed25519_aliyun")), true);
  assert.equal(calls.some((call) => call.includes("/srv/sleep-sounds/releases/content/prod-20260513T120000Z/incoming")), true);
});
```

- [ ] **Step 2: Write the failing verify test**

Create `tests/contentReleaseVerify.test.js` with this exact content:

```js
const assert = require("node:assert/strict");
const test = require("node:test");

const { verifyRelease } = require("../scripts/content-release/verifyRelease");

test("verifyRelease checks internal, public, and sample asset URLs", async () => {
  const calls = [];

  await verifyRelease({
    config: {
      sshHost: "8.138.108.110",
      sshUser: "root",
      sshKey: "C:/Users/lxy/.ssh/id_ed25519_aliyun",
      internalBaseUrl: "http://127.0.0.1:3000",
      publicBaseUrl: "https://sleep.zhenwei1.cn"
    },
    bundle: {
      manifest: {
        contentVersion: "2026-05-13T00:00:00Z",
        files: [
          { relativePath: "covers/rain_night.jpg" },
          { relativePath: "audio/rain_night.mp3" }
        ]
      }
    },
    runCommand(command, args) {
      calls.push([command, ...args].join(" "));
      return { status: 0, stdout: '{"ok":true}' };
    }
  });

  assert.equal(calls.some((call) => call.includes("curl -fsS http://127.0.0.1:3000/healthz")), true);
  assert.equal(calls.some((call) => call.includes("curl -fsS https://sleep.zhenwei1.cn/content/bootstrap")), true);
  assert.equal(calls.some((call) => call.includes("curl -I https://sleep.zhenwei1.cn/audio/rain_night.mp3")), true);
});
```

- [ ] **Step 3: Run the targeted tests to verify they fail**

Run:

```bash
npm test -- tests/contentReleaseDeploy.test.js tests/contentReleaseVerify.test.js
```

Expected:

- FAIL because the deploy/verify modules do not exist yet.

- [ ] **Step 4: Implement `printRollbackHint.js`**

Create `scripts/content-release/printRollbackHint.js` with this exact content:

```js
function printRollbackHint({ config, releaseId, backupDir }) {
  const sshTarget = `${config.sshUser}@${config.sshHost}`;
  const commands = [
    `ssh -i ${config.sshKey} ${sshTarget} "cp ${backupDir}/api/catalog.json ${config.remoteApiDir}/catalog.json"`,
    `ssh -i ${config.sshKey} ${sshTarget} "cp -r ${backupDir}/covers/. ${config.remoteStaticDir}/covers/"`,
    `ssh -i ${config.sshKey} ${sshTarget} "if [ -d ${backupDir}/audio ]; then cp -r ${backupDir}/audio/. ${config.remoteStaticDir}/audio/; fi"`
  ];

  console.error(`Rollback hint for ${releaseId}:`);
  for (const command of commands) {
    console.error(command);
  }
}

module.exports = {
  printRollbackHint
};
```

- [ ] **Step 5: Implement `deployRelease.js`**

Create `scripts/content-release/deployRelease.js` with this exact content:

```js
const path = require("node:path");

function runDefaultCommand(command, args) {
  const { spawnSync } = require("node:child_process");
  const result = spawnSync(command, args, {
    cwd: path.resolve(__dirname, "../.."),
    encoding: "utf8"
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `Command failed: ${command}`);
  }

  return result;
}

async function deployRelease({ config, bundle, runCommand = runDefaultCommand }) {
  const sshTarget = `${config.sshUser}@${config.sshHost}`;
  const incomingDir = `${config.remoteReleasesDir}/${bundle.releaseId}/incoming`;
  const backupDir = `${config.remoteBackupsDir}/${bundle.releaseId}`;

  runCommand("ssh", [
    "-i",
    config.sshKey,
    sshTarget,
    `set -e; mkdir -p '${incomingDir}' '${backupDir}/api' '${backupDir}/covers' '${backupDir}/audio'`
  ]);

  runCommand("scp", ["-i", config.sshKey, "-r", `${bundle.bundleDir}/.`, `${sshTarget}:${incomingDir}`]);

  runCommand("ssh", [
    "-i",
    config.sshKey,
    sshTarget,
    [
      "set -e",
      `cp '${config.remoteApiDir}/catalog.json' '${backupDir}/api/catalog.json'`,
      `if [ -d '${config.remoteStaticDir}/covers' ]; then cp -r '${config.remoteStaticDir}/covers/.' '${backupDir}/covers/'; fi`,
      `if [ -d '${config.remoteStaticDir}/audio' ]; then cp -r '${config.remoteStaticDir}/audio/.' '${backupDir}/audio/'; fi`,
      `cp '${incomingDir}/catalog.json' '${config.remoteApiDir}/catalog.json'`,
      `if [ -d '${incomingDir}/covers' ]; then cp -r '${incomingDir}/covers/.' '${config.remoteStaticDir}/covers/'; fi`,
      `if [ -d '${incomingDir}/audio' ]; then cp -r '${incomingDir}/audio/.' '${config.remoteStaticDir}/audio/'; fi`
    ].join("; ")
  ]);

  return {
    incomingDir,
    backupDir
  };
}

module.exports = {
  deployRelease
};
```

- [ ] **Step 6: Implement `verifyRelease.js`**

Create `scripts/content-release/verifyRelease.js` with this exact content:

```js
const path = require("node:path");

function runDefaultCommand(command, args) {
  const { spawnSync } = require("node:child_process");
  const result = spawnSync(command, args, {
    cwd: path.resolve(__dirname, "../.."),
    encoding: "utf8"
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `Command failed: ${command}`);
  }

  return result;
}

function pickFirstFile(files, prefix) {
  return (files || []).find((file) => file.relativePath.startsWith(prefix));
}

async function verifyRelease({ config, bundle, runCommand = runDefaultCommand }) {
  const sshTarget = `${config.sshUser}@${config.sshHost}`;
  const sampleCover = pickFirstFile(bundle.manifest.files, "covers/");
  const sampleAudio = pickFirstFile(bundle.manifest.files, "audio/");

  runCommand("ssh", [
    "-i",
    config.sshKey,
    sshTarget,
    `curl -fsS ${config.internalBaseUrl}/healthz && curl -fsS ${config.internalBaseUrl}/content/bootstrap`
  ]);
  runCommand("curl", ["-fsS", `${config.publicBaseUrl}/healthz`]);
  runCommand("curl", ["-fsS", `${config.publicBaseUrl}/content/bootstrap`]);

  if (sampleCover) {
    runCommand("curl", ["-I", `${config.publicBaseUrl}/${sampleCover.relativePath}`]);
  }

  if (sampleAudio) {
    runCommand("curl", ["-I", `${config.publicBaseUrl}/${sampleAudio.relativePath}`]);
  }
}

module.exports = {
  verifyRelease
};
```

- [ ] **Step 7: Re-run the targeted tests**

Run:

```bash
npm test -- tests/contentReleaseDeploy.test.js tests/contentReleaseVerify.test.js
```

Expected:

- PASS for deploy command construction coverage.
- PASS for verify command construction coverage.

- [ ] **Step 8: Commit the deploy/verify stages**

Run:

```bash
git add tests/contentReleaseDeploy.test.js tests/contentReleaseVerify.test.js scripts/content-release/deployRelease.js scripts/content-release/verifyRelease.js scripts/content-release/printRollbackHint.js
git commit -m "feat(content-release): add deploy and verify stages"
```

Expected:

- One commit that gives the release pipeline remote deployment and verification behavior.

## Task 5: Add the publish orchestrator, npm entrypoint, and operator docs

**Files:**
- Create: `tests/contentReleaseDocs.test.js`
- Create: `scripts/content-release/publish.js`
- Create: `deployment/content-release/prod.env.example`
- Create: `deployment/content-release/README.md`
- Modify: `package.json`
- Modify: `scripts/check-syntax.js`
- Test: `npm test -- tests/contentReleaseDocs.test.js`

- [ ] **Step 1: Write the failing docs test**

Create `tests/contentReleaseDocs.test.js` with this exact content:

```js
const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

test("content release docs and env example exist and mention the agent workflow", () => {
  for (const filePath of [
    "deployment/content-release/README.md",
    "deployment/content-release/prod.env.example"
  ]) {
    assert.equal(fs.existsSync(filePath), true, `${filePath} should exist`);
  }

  const readme = fs.readFileSync("deployment/content-release/README.md", "utf8");
  const envExample = fs.readFileSync("deployment/content-release/prod.env.example", "utf8");

  assert.match(readme, /npm run publish:content -- --env prod/);
  assert.match(readme, /remote-only/);
  assert.match(readme, /local-assets/);
  assert.match(readme, /rollback/);
  assert.match(readme, /真机/);

  assert.match(envExample, /CONTENT_RELEASE_SSH_HOST=/);
  assert.match(envExample, /CONTENT_RELEASE_PUBLIC_BASE_URL=https:\/\/sleep\.zhenwei1\.cn/);
});
```

- [ ] **Step 2: Run the targeted test to verify it fails**

Run:

```bash
npm test -- tests/contentReleaseDocs.test.js
```

Expected:

- FAIL because the new docs/config files do not exist yet.

- [ ] **Step 3: Implement `publish.js`**

Create `scripts/content-release/publish.js` with this exact content:

```js
const { buildReleaseBundle } = require("./buildReleaseBundle");
const { deployRelease } = require("./deployRelease");
const { loadReleaseConfig } = require("./loadReleaseConfig");
const { prepareRelease } = require("./prepareRelease");
const { printRollbackHint } = require("./printRollbackHint");
const { verifyRelease } = require("./verifyRelease");

async function main() {
  const config = loadReleaseConfig();
  const prepared = await prepareRelease({ config });
  const bundle = buildReleaseBundle({ config, prepared });

  if (config.dryRun) {
    console.log(JSON.stringify({ releaseId: bundle.releaseId, bundleDir: bundle.bundleDir }, null, 2));
    return;
  }

  let deployment;

  try {
    deployment = await deployRelease({ config, bundle });
    await verifyRelease({ config, bundle, deployment });
    console.log(
      JSON.stringify(
        {
          ok: true,
          releaseId: bundle.releaseId,
          envName: config.envName,
          assetMode: config.assetMode,
          backupDir: deployment.backupDir
        },
        null,
        2
      )
    );
  } catch (error) {
    if (deployment) {
      printRollbackHint({
        config,
        releaseId: bundle.releaseId,
        backupDir: deployment.backupDir
      });
    }
    throw error;
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
});
```

- [ ] **Step 4: Wire the npm script and syntax list**

Add this script to `package.json`:

```json
    "publish:content": "node scripts/content-release/publish.js",
```

Append these files to the `files` array in `scripts/check-syntax.js`:

```js
  "scripts/content-release/buildReleaseBundle.js",
  "scripts/content-release/deployRelease.js",
  "scripts/content-release/verifyRelease.js",
  "scripts/content-release/printRollbackHint.js",
  "scripts/content-release/publish.js",
```

- [ ] **Step 5: Create the prod env example**

Create `deployment/content-release/prod.env.example` with this exact content:

```env
CONTENT_RELEASE_ENV=prod

CONTENT_RELEASE_SSH_HOST=8.138.108.110
CONTENT_RELEASE_SSH_USER=root
CONTENT_RELEASE_SSH_KEY=C:/Users/lxy/.ssh/id_ed25519_aliyun

CONTENT_RELEASE_PUBLIC_BASE_URL=https://sleep.zhenwei1.cn
CONTENT_RELEASE_INTERNAL_BASE_URL=http://127.0.0.1:3000

CONTENT_RELEASE_REMOTE_API_DIR=/srv/sleep-sounds/api
CONTENT_RELEASE_REMOTE_STATIC_DIR=/srv/sleep-sounds/static
CONTENT_RELEASE_REMOTE_RELEASES_DIR=/srv/sleep-sounds/releases/content
CONTENT_RELEASE_REMOTE_BACKUPS_DIR=/srv/sleep-sounds/backups/content

CONTENT_RELEASE_DEFAULT_ASSET_MODE=remote-only
```

- [ ] **Step 6: Create the operator README**

Create `deployment/content-release/README.md` with this exact content:

```md
# Content Release Pipeline

## Purpose

Use this workflow to publish content changes from `content/catalog.json` to the current ECS production service without mixing in API code deployment.

## Prerequisites

- `prod.env` copied from `deployment/content-release/prod.env.example`
- SSH access to the ECS host
- `npm install` already completed

## Asset modes

- `remote-only` (default): publish `catalog.json` and covers, keep production audio on ECS
- `local-assets`: publish `catalog.json`, covers, and audio from an external asset directory

## Standard publish command

```bash
npm run publish:content -- --env prod
```

## External asset publish command

```bash
npm run publish:content -- --env prod --asset-source D:\sleep-assets\prod
```

## Success result

The command prints:

- `releaseId`
- `envName`
- `assetMode`
- `backupDir`

## Failure result

The command stops on failure and prints rollback guidance. It does not auto-rollback in the current version.

## Rollback

Use the printed rollback commands from `printRollbackHint.js`.

## Optional real-device acceptance

After automated verification passes, optionally do a real-device smoke test:

- open the mini app
- confirm covers render
- confirm at least one track plays
- confirm there is no old cached content
```

- [ ] **Step 7: Re-run the targeted docs test and syntax check**

Run:

```bash
npm test -- tests/contentReleaseDocs.test.js
npm run check
```

Expected:

- PASS for the docs/env test.
- PASS for syntax checking with the full release pipeline.

- [ ] **Step 8: Commit the publish entrypoint and docs**

Run:

```bash
git add tests/contentReleaseDocs.test.js scripts/content-release/publish.js deployment/content-release/prod.env.example deployment/content-release/README.md package.json scripts/check-syntax.js
git commit -m "feat(content-release): add publish entrypoint and operator docs"
```

Expected:

- One commit that exposes the release pipeline through npm and documents the operator workflow.

## Task 6: Run full verification and do one dry-run release

**Files:**
- Modify: `scripts/content-release/prepareRelease.js`
- Modify: `scripts/content-release/verifyRelease.js`
- Test: `npm run check`

- [ ] **Step 1: Tighten `prepareRelease.js` test execution to match the repo’s npm test entrypoint**

Replace the direct `node --test` invocation in `scripts/content-release/prepareRelease.js` with:

```js
  runCommand(process.execPath, ["scripts/check-syntax.js"]);

  if (!config.skipTests) {
    runCommand("npm", ["test"]);
  }
```

This keeps release validation aligned with the standard repo workflow.

- [ ] **Step 2: Tighten `verifyRelease.js` so public bootstrap is checked against the manifest version**

Replace the public bootstrap call with JSON parsing:

```js
  const publicBootstrap = runCommand("curl", ["-fsS", `${config.publicBaseUrl}/content/bootstrap`]);
  const payload = JSON.parse(publicBootstrap.stdout);

  if (payload.version !== bundle.manifest.contentVersion) {
    throw new Error(
      `Published bootstrap version mismatch: expected ${bundle.manifest.contentVersion}, received ${payload.version}`
    );
  }
```

This proves the public endpoint is serving the release just deployed.

- [ ] **Step 3: Run the complete local validation suite**

Run:

```bash
npm run sync:content
npm run check
npm test
```

Expected:

- All generated content artifacts are fresh.
- Syntax validation passes.
- The full test suite passes.

- [ ] **Step 4: Create a dry-run release bundle from the prod config**

Run:

```bash
Copy-Item deployment/content-release/prod.env.example deployment/content-release/prod.env
npm run publish:content -- --env prod --dry-run
```

Expected:

- Prints a `releaseId` and `bundleDir`.
- Does not connect to ECS.
- Writes a local bundle under `artifacts/content-release/<releaseId>/`.

- [ ] **Step 5: Review the dry-run manifest and confirm it matches the intended files**

Run:

```bash
Get-ChildItem artifacts/content-release
Get-Content artifacts/content-release/<releaseId>/manifest.json
```

Expected:

- The manifest lists `catalog.json`.
- The manifest lists the cover files.
- In `remote-only` mode there are no uploaded audio files in the bundle.

- [ ] **Step 6: Commit the final release-pipeline hardening**

Run:

```bash
git add scripts/content-release/prepareRelease.js scripts/content-release/verifyRelease.js
git commit -m "test(content-release): verify dry-run release pipeline"
```

Expected:

- One final commit that proves the pipeline can build a dry-run release bundle locally.
- The generated `artifacts/content-release/<releaseId>/` bundle remains local review evidence and is not committed to git.

## Self-Review Checklist

- Spec coverage:
  - Single-command publish flow: Tasks 2, 4, and 5
  - HTTP deployment catalog derivation: Task 1
  - `remote-only` and `local-assets` modes: Tasks 2, 3, and 5
  - Remote backup and rollback hints: Task 4
  - Agent-ready operator docs: Task 5
  - Dry-run verification path: Task 6
- Placeholder scan:
  - No `TODO`, `TBD`, or “similar to previous task” shortcuts remain.
- Type consistency:
  - `loadReleaseConfig` returns `envName`, `assetMode`, and remote path fields used consistently in later tasks.
  - `prepareRelease` returns `deploymentCatalog`, `coverFiles`, and `audioFiles`, which are consumed by `buildReleaseBundle`.
  - `bundle.manifest.contentVersion` is introduced in Task 3 and used consistently in Task 6.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-13-content-release-pipeline.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
