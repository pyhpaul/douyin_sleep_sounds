const assert = require("node:assert/strict");
const test = require("node:test");

const { verifyRelease } = require("../scripts/content-release/verifyRelease");

test("verifyRelease checks internal, public, and sample asset URLs", async () => {
  const calls = [];

  await verifyRelease({
    config: {
      sshHost: "8.138.108.110",
      sshUser: "root",
      sshKey: "C:/Users/lxy/.ssh/id_ed25519_aliyun",
      internalBaseUrl: "http://127.0.0.1:3000",
      publicBaseUrl: "https://sleep.zhenwei1.cn"
    },
    bundle: {
      manifest: {
        contentVersion: "2026-05-13T00:00:00Z",
        files: [
          { relativePath: "covers/rain_night.jpg" },
          { relativePath: "audio/rain_night.mp3" }
        ]
      }
    },
    runCommand(command, args) {
      calls.push([command, ...args].join(" "));
      if (args.includes("https://sleep.zhenwei1.cn/content/bootstrap")) {
        return { status: 0, stdout: '{"version":"2026-05-13T00:00:00Z"}' };
      }
      return { status: 0, stdout: '{"ok":true}' };
    }
  });

  assert.equal(
    calls.some((call) => call.includes("curl -fsS http://127.0.0.1:3000/healthz")),
    true
  );
  assert.equal(
    calls.some((call) => call.includes("curl -fsS https://sleep.zhenwei1.cn/content/bootstrap")),
    true
  );
  assert.equal(
    calls.some((call) => call.includes("curl -I https://sleep.zhenwei1.cn/audio/rain_night.mp3")),
    true
  );
});
