const path = require("node:path");

const repoRoot = path.resolve(__dirname, "../..");

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

async function rollbackRelease({ config, runCommand = runDefaultCommand }) {
  const sshTarget = `${config.sshUser}@${config.sshHost}`;

  runCommand("ssh", [
    "-i",
    config.sshKey,
    sshTarget,
    [
      "set -e",
      `cp ${config.backupDir}/api/catalog.json ${config.remoteApiDir}/catalog.json`,
      `cp -r ${config.backupDir}/covers/. ${config.remoteStaticDir}/covers/`,
      `if [ -d ${config.backupDir}/audio ]; then cp -r ${config.backupDir}/audio/. ${config.remoteStaticDir}/audio/; fi`
    ].join("; ")
  ]);

  return {
    backupDir: config.backupDir
  };
}

module.exports = {
  rollbackRelease
};
