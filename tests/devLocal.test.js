const assert = require("node:assert/strict");
const test = require("node:test");

const { buildChildProcessEnv, startPreviewServer } = require("../scripts/dev-local");

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
