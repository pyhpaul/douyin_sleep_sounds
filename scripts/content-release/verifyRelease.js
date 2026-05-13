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
  const publicBootstrap = runCommand("curl", ["-fsS", `${config.publicBaseUrl}/content/bootstrap`]);
  const payload = JSON.parse(publicBootstrap.stdout);

  if (payload.version !== bundle.manifest.contentVersion) {
    throw new Error(
      `Published bootstrap version mismatch: expected ${bundle.manifest.contentVersion}, received ${payload.version}`
    );
  }

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
