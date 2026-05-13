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
