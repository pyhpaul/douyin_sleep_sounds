const assert = require("node:assert/strict");
const test = require("node:test");

const { loadRollbackConfig } = require("../scripts/content-release/loadRollbackConfig");
const { rollbackRelease } = require("../scripts/content-release/rollbackRelease");
const { verifyRollback } = require("../scripts/content-release/verifyRollback");
const { runRollback } = require("../scripts/content-release/rollback");

test("loadRollbackConfig requires releaseId and derives backupDir", () => {
  const config = loadRollbackConfig({
    args: ["--env", "prod", "--release-id", "prod-20260513T131117Z"],
    env: {
      CONTENT_RELEASE_SSH_HOST: "8.138.108.110",
      CONTENT_RELEASE_SSH_USER: "root",
      CONTENT_RELEASE_SSH_KEY: "C:/Users/lxy/.ssh/id_ed25519_aliyun",
      CONTENT_RELEASE_PUBLIC_BASE_URL: "https://sleep.zhenwei1.cn",
      CONTENT_RELEASE_INTERNAL_BASE_URL: "http://127.0.0.1:3000",
      CONTENT_RELEASE_REMOTE_API_DIR: "/srv/sleep-sounds/api",
      CONTENT_RELEASE_REMOTE_STATIC_DIR: "/srv/sleep-sounds/static",
      CONTENT_RELEASE_REMOTE_RELEASES_DIR: "/srv/sleep-sounds/releases/content",
      CONTENT_RELEASE_REMOTE_BACKUPS_DIR: "/srv/sleep-sounds/backups/content"
    }
  });

  assert.equal(config.releaseId, "prod-20260513T131117Z");
  assert.equal(config.backupDir, "/srv/sleep-sounds/backups/content/prod-20260513T131117Z");
});

test("rollbackRelease restores catalog, covers, and optional audio from backup", async () => {
  const calls = [];

  const result = await rollbackRelease({
    config: {
      sshHost: "8.138.108.110",
      sshUser: "root",
      sshKey: "C:/Users/lxy/.ssh/id_ed25519_aliyun",
      backupDir: "/srv/sleep-sounds/backups/content/prod-20260513T131117Z",
      remoteApiDir: "/srv/sleep-sounds/api",
      remoteStaticDir: "/srv/sleep-sounds/static"
    },
    runCommand(command, args) {
      calls.push([command, ...args].join(" "));
      return { status: 0 };
    }
  });

  assert.equal(result.backupDir, "/srv/sleep-sounds/backups/content/prod-20260513T131117Z");
  assert.equal(calls.some((call) => call.includes("cp /srv/sleep-sounds/backups/content/prod-20260513T131117Z/api/catalog.json /srv/sleep-sounds/api/catalog.json")), true);
  assert.equal(calls.some((call) => call.includes("cp -r /srv/sleep-sounds/backups/content/prod-20260513T131117Z/covers/. /srv/sleep-sounds/static/covers/")), true);
  assert.equal(calls.some((call) => call.includes("if [ -d /srv/sleep-sounds/backups/content/prod-20260513T131117Z/audio ]")), true);
});

test("verifyRollback checks internal and public rollback endpoints", async () => {
  const calls = [];

  await verifyRollback({
    config: {
      sshHost: "8.138.108.110",
      sshUser: "root",
      sshKey: "C:/Users/lxy/.ssh/id_ed25519_aliyun",
      internalBaseUrl: "http://127.0.0.1:3000",
      publicBaseUrl: "https://sleep.zhenwei1.cn"
    },
    runCommand(command, args) {
      calls.push([command, ...args].join(" "));
      return { status: 0, stdout: "{\"ok\":true}" };
    }
  });

  assert.equal(calls.some((call) => call.includes("curl -fsS http://127.0.0.1:3000/healthz")), true);
  assert.equal(calls.some((call) => call.includes("curl -fsS https://sleep.zhenwei1.cn/healthz")), true);
  assert.equal(calls.some((call) => call.includes("curl -fsS https://sleep.zhenwei1.cn/content/bootstrap")), true);
});

test("runRollback prints structured JSON after restore and verification", async () => {
  const logs = [];

  await runRollback({
    loadConfig() {
      return {
        envName: "prod",
        releaseId: "prod-20260513T131117Z",
        backupDir: "/srv/sleep-sounds/backups/content/prod-20260513T131117Z"
      };
    },
    rollback() {
      return {
        backupDir: "/srv/sleep-sounds/backups/content/prod-20260513T131117Z"
      };
    },
    verify() {},
    logger: {
      log(message) {
        logs.push(String(message));
      }
    }
  });

  const payload = JSON.parse(logs[0]);
  assert.equal(payload.ok, true);
  assert.equal(payload.releaseId, "prod-20260513T131117Z");
  assert.equal(payload.backupDir, "/srv/sleep-sounds/backups/content/prod-20260513T131117Z");
});
