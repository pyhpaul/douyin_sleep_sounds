const assert = require("node:assert/strict");
const test = require("node:test");

const { runPreflight } = require("../scripts/content-release/preflight");

test("runPreflight runs sync, status, syntax check, and tests in order", async () => {
  const calls = [];
  const logs = [];

  await runPreflight({
    runStep: async ({ name, command, args }) => {
      calls.push({ name, command, args });
      return { ok: true };
    },
    logger: {
      log(message) {
        logs.push(String(message));
      }
    }
  });

  assert.deepEqual(
    calls.map((call) => call.name),
    ["sync", "status", "syntax", "test"]
  );
  assert.deepEqual(calls[0], {
    name: "sync",
    command: process.execPath,
    args: ["scripts/sync-content-artifacts.js"]
  });
  assert.deepEqual(calls[1], {
    name: "status",
    command: process.execPath,
    args: ["scripts/content-release/status.js", "--env", "prod"]
  });
  assert.deepEqual(calls[2], {
    name: "syntax",
    command: process.execPath,
    args: ["scripts/check-syntax.js"]
  });
  if (process.platform === "win32") {
    assert.deepEqual(calls[3], {
      name: "test",
      command: "cmd.exe",
      args: ["/d", "/s", "/c", "npm test"]
    });
  } else {
    assert.deepEqual(calls[3], {
      name: "test",
      command: "npm",
      args: ["test"]
    });
  }

  const payload = JSON.parse(logs[0]);
  assert.equal(payload.ok, true);
  assert.deepEqual(payload.steps.map((step) => step.name), ["sync", "status", "syntax", "test"]);
});

test("runPreflight passes through env args to status", async () => {
  const calls = [];

  await runPreflight({
    args: ["--env", "staging"],
    runStep: async ({ name, command, args: stepArgs }) => {
      calls.push({ name, command, args: stepArgs });
      return { ok: true };
    },
    logger: {
      log() {}
    }
  });

  assert.deepEqual(calls[1], {
    name: "status",
    command: process.execPath,
    args: ["scripts/content-release/status.js", "--env", "staging"]
  });
});

test("runPreflight stops on the first failing step", async () => {
  const calls = [];

  await assert.rejects(
    () =>
      runPreflight({
        runStep: async ({ name, command, args }) => {
          calls.push({ name, command, args });
          if (name === "status") {
            throw new Error("drift detected");
          }
          return { ok: true };
        },
        logger: {
          log() {}
        }
      }),
    /drift detected/
  );

  assert.deepEqual(
    calls.map((call) => call.name),
    ["sync", "status"]
  );
});
