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

  runCommand("scp", [
    "-i",
    config.sshKey,
    "-r",
    `${bundle.bundleDir}/.`,
    `${sshTarget}:${incomingDir}`
  ]);

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
