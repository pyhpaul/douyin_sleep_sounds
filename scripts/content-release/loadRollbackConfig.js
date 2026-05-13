const { loadReleaseConfig } = require("./loadReleaseConfig");

function parseRollbackArgs(args) {
  const result = {};

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--release-id") {
      result.releaseId = args[index + 1] || "";
      index += 1;
    }
  }

  return result;
}

function loadRollbackConfig({ args = process.argv.slice(2), env = process.env } = {}) {
  const parsedArgs = parseRollbackArgs(args);
  const releaseConfig = loadReleaseConfig({ args, env });

  if (!parsedArgs.releaseId) {
    throw new Error("Missing required rollback argument: --release-id");
  }

  return Object.assign({}, releaseConfig, {
    releaseId: parsedArgs.releaseId,
    backupDir: `${releaseConfig.remoteBackupsDir}/${parsedArgs.releaseId}`
  });
}

module.exports = {
  loadRollbackConfig
};
