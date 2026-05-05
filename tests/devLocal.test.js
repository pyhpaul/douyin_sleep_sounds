const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const {
  buildChildProcessEnv,
  getValidationSteps,
  startPreviewServer
} = require("../scripts/dev-local");

test("opens browser only after preview server starts listening", async (t) => {
  const openedUrls = [];
  const server = await startPreviewServer({
    port: 0,
    log() {},
    openBrowser(url) {
      openedUrls.push(url);
    }
  });

  t.after(() => {
    server.close();
  });

  assert.equal(openedUrls.length, 1);
  assert.match(openedUrls[0], /^http:\/\/localhost:\d+$/);
});

test("removes VS Code debugger injection from child process environment", () => {
  const env = buildChildProcessEnv({
    NODE_OPTIONS: "--require C:/vscode/js-debug/bootloader.js",
    VSCODE_INSPECTOR_OPTIONS: "{\"inspectorIpc\":\"test\"}",
    OTHER_ENV: "kept"
  });

  assert.equal(env.NODE_OPTIONS, undefined);
  assert.equal(env.VSCODE_INSPECTOR_OPTIONS, undefined);
  assert.equal(env.OTHER_ENV, "kept");
});

test("npm dev entry clears debugger environment before starting node", () => {
  const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const devScript = packageJson.scripts.dev;

  assert.match(devScript, /^powershell\b/);
  assert.match(devScript, /scripts\/dev-local\.ps1/);

  const wrapper = fs.readFileSync("scripts/dev-local.ps1", "utf8");
  assert.match(wrapper, /Remove-Item Env:NODE_OPTIONS/);
  assert.match(wrapper, /Remove-Item Env:VSCODE_INSPECTOR_OPTIONS/);
  assert.match(wrapper, /node/);
  assert.match(wrapper, /dev-local\.js/);
});

test("validation steps run node directly instead of nested npm commands", () => {
  const steps = getValidationSteps();

  assert.deepEqual(
    steps.map((step) => step.command),
    [process.execPath, process.execPath]
  );
  assert.deepEqual(steps[0].args, ["scripts/check-syntax.js"]);
  assert.deepEqual(steps[1].args, ["--test", "tests/pageRuntime.test.js"]);
});
