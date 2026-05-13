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
