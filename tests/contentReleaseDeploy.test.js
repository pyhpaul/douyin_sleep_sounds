const assert = require("node:assert/strict");
const test = require("node:test");

const { deployRelease } = require("../scripts/content-release/deployRelease");

test("deployRelease constructs remote backup and upload commands", async () => {
  const calls = [];

  const result = await deployRelease({
    config: {
      sshHost: "8.138.108.110",
      sshUser: "root",
      sshKey: "C:/Users/lxy/.ssh/id_ed25519_aliyun",
      remoteApiDir: "/srv/sleep-sounds/api",
      remoteStaticDir: "/srv/sleep-sounds/static",
      remoteReleasesDir: "/srv/sleep-sounds/releases/content",
      remoteBackupsDir: "/srv/sleep-sounds/backups/content"
    },
    bundle: {
      releaseId: "prod-20260513T120000Z",
      bundleDir: "E:/tmp/release"
    },
    runCommand(command, args) {
      calls.push([command, ...args].join(" "));
      return { status: 0 };
    }
  });

  assert.equal(result.backupDir, "/srv/sleep-sounds/backups/content/prod-20260513T120000Z");
  assert.equal(
    calls.some((call) => call.includes("scp -i C:/Users/lxy/.ssh/id_ed25519_aliyun")),
    true
  );
  assert.equal(
    calls.some((call) =>
      call.includes("/srv/sleep-sounds/releases/content/prod-20260513T120000Z/incoming")
    ),
    true
  );
});
