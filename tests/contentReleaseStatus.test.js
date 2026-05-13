const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  getContentStatus,
  loadStatusConfig,
  runContentStatus
} = require("../scripts/content-release/status");

function writeEnvFile(lines) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "content-status-env-"));
  const envDir = path.join(tempDir, "deployment", "content-release");
  fs.mkdirSync(envDir, { recursive: true });
  const envPath = path.join(envDir, "prod.env");
  fs.writeFileSync(envPath, lines.join("\n"));
  return { tempDir, envPath };
}

test("getContentStatus reports ok when local, deployment, and remote versions all match", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "content-status-ok-"));
  const localCatalogPath = path.join(tempDir, "content.catalog.json");
  const deploymentCatalogPath = path.join(tempDir, "deployment.catalog.json");

  const localCatalog = {
    version: "2026-05-13T00:00:00Z",
    groups: [{ id: "rain" }, { id: "water" }],
    sounds: [{ id: "rain_night" }, { id: "ocean_slow" }, { id: "creek_soft" }]
  };
  const deploymentCatalog = {
    version: "2026-05-13T00:00:00Z",
    groups: [{ groupId: "rain" }, { groupId: "water" }],
    sounds: [{ soundId: "rain_night" }, { soundId: "ocean_slow" }, { soundId: "creek_soft" }]
  };

  fs.writeFileSync(localCatalogPath, JSON.stringify(localCatalog, null, 2));
  fs.writeFileSync(deploymentCatalogPath, JSON.stringify(deploymentCatalog, null, 2));

  const result = await getContentStatus({
    config: {
      publicBaseUrl: "https://sleep.zhenwei1.cn"
    },
    localCatalogPath,
    deploymentCatalogPath,
    runCommand(command, args) {
      if (
        command === "curl" &&
        args[0] === "-fsS" &&
        args[1] === "https://sleep.zhenwei1.cn/content/bootstrap"
      ) {
        return {
          status: 0,
          stdout: JSON.stringify({
            version: "2026-05-13T00:00:00Z",
            groups: [
              { id: "rain", sounds: [{ id: "rain_night" }] },
              { id: "water", sounds: [{ id: "ocean_slow" }, { id: "creek_soft" }] }
            ]
          })
        };
      }

      throw new Error(`Unexpected command: ${command} ${args.join(" ")}`);
    }
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.drift, []);
  assert.equal(result.local.version, "2026-05-13T00:00:00Z");
  assert.equal(result.deployment.version, "2026-05-13T00:00:00Z");
  assert.equal(result.remote.version, "2026-05-13T00:00:00Z");
  assert.equal(result.local.groupCount, 2);
  assert.equal(result.remote.soundCount, 3);
});

test("getContentStatus reports drift when remote version does not match deployment version", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "content-status-drift-"));
  const localCatalogPath = path.join(tempDir, "content.catalog.json");
  const deploymentCatalogPath = path.join(tempDir, "deployment.catalog.json");

  fs.writeFileSync(
    localCatalogPath,
    JSON.stringify({ version: "2026-05-13T00:00:00Z", groups: [], sounds: [] }, null, 2)
  );
  fs.writeFileSync(
    deploymentCatalogPath,
    JSON.stringify({ version: "2026-05-13T00:00:00Z", groups: [], sounds: [] }, null, 2)
  );

  const result = await getContentStatus({
    config: {
      publicBaseUrl: "https://sleep.zhenwei1.cn"
    },
    localCatalogPath,
    deploymentCatalogPath,
    runCommand(command, args) {
      if (
        command === "curl" &&
        args[0] === "-fsS" &&
        args[1] === "https://sleep.zhenwei1.cn/content/bootstrap"
      ) {
        return {
          status: 0,
          stdout: JSON.stringify({
            version: "2026-05-12T00:00:00Z",
            groups: []
          })
        };
      }

      throw new Error(`Unexpected command: ${command} ${args.join(" ")}`);
    }
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.drift, ["deployment-vs-remote-version"]);
});

test("runContentStatus prints structured JSON", async () => {
  const stdout = [];

  await runContentStatus({
    config: {
      publicBaseUrl: "https://sleep.zhenwei1.cn"
    },
    getStatus: async () => ({
      ok: true,
      drift: [],
      local: { version: "2026-05-13T00:00:00Z", groupCount: 7, soundCount: 8 },
      deployment: { version: "2026-05-13T00:00:00Z", groupCount: 7, soundCount: 8 },
      remote: { version: "2026-05-13T00:00:00Z", groupCount: 7, soundCount: 8 }
    }),
    stdout: {
      write(value) {
        stdout.push(value);
      }
    }
  });

  const payload = JSON.parse(stdout.join(""));
  assert.equal(payload.ok, true);
  assert.equal(payload.remote.version, "2026-05-13T00:00:00Z");
});

test("runContentStatus sets exit code when drift is detected", async () => {
  const exitCodes = [];

  await runContentStatus({
    config: {
      publicBaseUrl: "https://sleep.zhenwei1.cn"
    },
    getStatus: async () => ({
      ok: false,
      drift: ["deployment-vs-remote-version"],
      local: { version: "2026-05-13T00:00:00Z", groupCount: 7, soundCount: 8 },
      deployment: { version: "2026-05-13T00:00:00Z", groupCount: 7, soundCount: 8 },
      remote: { version: "2026-05-12T00:00:00Z", groupCount: 7, soundCount: 8 }
    }),
    stdout: {
      write() {}
    },
    setExitCode(value) {
      exitCodes.push(value);
    }
  });

  assert.deepEqual(exitCodes, [1]);
});

test("loadStatusConfig falls back to the main worktree env file when current worktree env is missing", () => {
  const { tempDir, envPath } = writeEnvFile([
    "CONTENT_RELEASE_ENV=prod",
    "CONTENT_RELEASE_PUBLIC_BASE_URL=https://sleep.zhenwei1.cn/"
  ]);

  try {
    const config = loadStatusConfig({
      args: ["--env", "prod"],
      env: {},
      cwd: path.join(tempDir, ".worktrees", "codex-content-status"),
      resolveMainWorktreeRoot() {
        return tempDir;
      }
    });

    assert.equal(config.envName, "prod");
    assert.equal(config.envFile, envPath);
    assert.equal(config.publicBaseUrl, "https://sleep.zhenwei1.cn");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
