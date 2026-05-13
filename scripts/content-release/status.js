const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "../..");

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

function resolveMainWorktreeRoot({ cwd = process.cwd(), runCommand = runDefaultCommand } = {}) {
  const gitCommonDir = runCommand("git", ["rev-parse", "--git-common-dir"]);
  const commonDir = String(gitCommonDir.stdout || "").trim();

  if (!commonDir) {
    return "";
  }

  return path.resolve(cwd, commonDir, "..");
}

function resolveStatusEnvFile({
  envFile,
  envName,
  cwd = process.cwd(),
  resolveMainWorktreeRoot: resolveMainRoot = resolveMainWorktreeRoot
} = {}) {
  if (envFile) {
    return envFile;
  }

  const localEnvFile = path.resolve(cwd, `deployment/content-release/${envName}.env`);
  if (fs.existsSync(localEnvFile)) {
    return localEnvFile;
  }

  const mainWorktreeRoot = resolveMainRoot({ cwd });
  if (mainWorktreeRoot) {
    return path.resolve(mainWorktreeRoot, `deployment/content-release/${envName}.env`);
  }

  return localEnvFile;
}

function requireField(source, fieldName) {
  if (!source[fieldName]) {
    throw new Error(`Missing required status config field: ${fieldName}`);
  }

  return source[fieldName];
}

function loadStatusConfig({
  args = process.argv.slice(2),
  env = process.env,
  cwd = process.cwd(),
  resolveMainWorktreeRoot: resolveMainRoot = resolveMainWorktreeRoot
} = {}) {
  const parsedArgs = parseArgs(args);
  const envName = parsedArgs.envName || env.CONTENT_RELEASE_ENV || "prod";
  const envFile = resolveStatusEnvFile({
    envFile: parsedArgs.envFile,
    envName,
    cwd,
    resolveMainWorktreeRoot: resolveMainRoot
  });
  const envFileValues = readEnvFile(envFile);
  const merged = Object.assign({}, envFileValues, env);
  const resolvedEnvName = parsedArgs.envName || merged.CONTENT_RELEASE_ENV || "prod";

  return {
    envName: resolvedEnvName,
    envFile,
    publicBaseUrl: trimTrailingSlashes(
      requireField(merged, "CONTENT_RELEASE_PUBLIC_BASE_URL")
    )
  };
}

function runDefaultCommand(command, args) {
  const { spawnSync } = require("node:child_process");
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8"
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `Command failed: ${command}`);
  }

  return result;
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function summarizeCatalog(catalog) {
  return {
    version: catalog && catalog.version ? catalog.version : "",
    groupCount: Array.isArray(catalog && catalog.groups) ? catalog.groups.length : 0,
    soundCount: Array.isArray(catalog && catalog.sounds) ? catalog.sounds.length : 0
  };
}

function summarizeRemoteBootstrap(payload) {
  const groups = Array.isArray(payload && payload.groups) ? payload.groups : [];

  return {
    version: payload && payload.version ? payload.version : "",
    groupCount: groups.length,
    soundCount: groups.reduce((total, group) => {
      const sounds = Array.isArray(group && group.sounds) ? group.sounds : [];
      return total + sounds.length;
    }, 0)
  };
}

function collectDrift(status) {
  const metricNames = {
    version: "version",
    groupCount: "group-count",
    soundCount: "sound-count"
  };
  const drift = [];
  const comparisons = [
    ["local", "deployment"],
    ["deployment", "remote"]
  ];

  for (const [leftName, rightName] of comparisons) {
    const left = status[leftName];
    const right = status[rightName];

    for (const [fieldName, metricName] of Object.entries(metricNames)) {
      if (left[fieldName] !== right[fieldName]) {
        drift.push(`${leftName}-vs-${rightName}-${metricName}`);
      }
    }
  }

  return drift;
}

async function getContentStatus({
  config,
  localCatalogPath = path.resolve(repoRoot, "content/catalog.json"),
  deploymentCatalogPath = path.resolve(repoRoot, "deployment/cloud-http-content/api/catalog.json"),
  runCommand = runDefaultCommand
} = {}) {
  if (!config || !config.publicBaseUrl) {
    throw new Error("config.publicBaseUrl is required");
  }

  const localCatalog = readJsonFile(localCatalogPath);
  const deploymentCatalog = readJsonFile(deploymentCatalogPath);
  const remoteBootstrap = runCommand("curl", ["-fsS", `${config.publicBaseUrl}/content/bootstrap`]);
  const remotePayload = JSON.parse(remoteBootstrap.stdout);
  const status = {
    ok: true,
    drift: [],
    local: summarizeCatalog(localCatalog),
    deployment: summarizeCatalog(deploymentCatalog),
    remote: summarizeRemoteBootstrap(remotePayload)
  };

  status.drift = collectDrift(status);
  status.ok = status.drift.length === 0;

  return status;
}

async function runContentStatus({
  config,
  loadConfig = loadStatusConfig,
  getStatus = getContentStatus,
  stdout = process.stdout,
  setExitCode = (value) => {
    process.exitCode = value;
  }
} = {}) {
  const resolvedConfig = config || loadConfig();
  const status = await getStatus({ config: resolvedConfig });

  stdout.write(`${JSON.stringify(status, null, 2)}\n`);

  if (!status.ok) {
    setExitCode(1);
  }

  return status;
}

if (require.main === module) {
  runContentStatus().catch((error) => {
    console.error(error && error.stack ? error.stack : String(error));
    process.exit(1);
  });
}

module.exports = {
  getContentStatus,
  loadStatusConfig,
  resolveMainWorktreeRoot,
  runContentStatus
};
