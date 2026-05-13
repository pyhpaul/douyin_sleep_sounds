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

async function verifyRollback({ config, runCommand = runDefaultCommand }) {
  const sshTarget = `${config.sshUser}@${config.sshHost}`;

  runCommand("ssh", [
    "-i",
    config.sshKey,
    sshTarget,
    `curl -fsS ${config.internalBaseUrl}/healthz && curl -fsS ${config.internalBaseUrl}/content/bootstrap`
  ]);
  runCommand("curl", ["-fsS", `${config.publicBaseUrl}/healthz`]);
  runCommand("curl", ["-fsS", `${config.publicBaseUrl}/content/bootstrap`]);
}

module.exports = {
  verifyRollback
};
