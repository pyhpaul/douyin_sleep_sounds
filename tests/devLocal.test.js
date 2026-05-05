const assert = require("node:assert/strict");
const test = require("node:test");

const { startPreviewServer } = require("../scripts/dev-local");

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
