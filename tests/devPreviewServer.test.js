const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { createServer } = require("../scripts/dev-preview-server");

test("serves live reload client from the preview page", async (t) => {
  const server = createServer();
  const baseUrl = await listen(server);

  t.after(() => {
    server.close();
  });

  const html = await (await fetch(`${baseUrl}/`)).text();
  const client = await fetch(`${baseUrl}/live-reload.js`);
  const clientSource = await client.text();

  assert.match(html, /\/live-reload\.js/);
  assert.equal(client.status, 200);
  assert.match(clientSource, /EventSource/);
  assert.match(clientSource, /__live-reload/);
});

test("broadcasts a reload event when a watched file changes", async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "douyin-live-reload-"));
  const watchedFile = path.join(tempDir, "index.ttss");
  fs.writeFileSync(watchedFile, ".x { color: blue; }\n");

  const server = createServer({
    liveReload: {
      debounceMs: 20,
      watchPaths: [tempDir]
    }
  });
  const baseUrl = await listen(server);

  t.after(() => {
    server.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const response = await fetch(`${baseUrl}/__live-reload`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /^text\/event-stream/);

  const reader = response.body.getReader();
  await readUntil(reader, ": connected", 1000);

  fs.writeFileSync(watchedFile, ".x { color: red; }\n");
  const eventText = await readUntil(reader, "event: reload", 3000);

  assert.match(eventText, /data: /);
  await reader.cancel();
});

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, () => {
      const address = server.address();
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

async function readUntil(reader, expectedText, timeoutMs) {
  const decoder = new TextDecoder();
  let collected = "";
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const result = await readWithTimeout(reader, deadline - Date.now());
    if (result.done) {
      break;
    }

    collected += decoder.decode(result.value, { stream: true });
    if (collected.includes(expectedText)) {
      return collected;
    }
  }

  throw new Error(`Timed out waiting for ${expectedText}. Received: ${collected}`);
}

function readWithTimeout(reader, timeoutMs) {
  let timeoutId = null;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("Timed out reading stream")), timeoutMs);
  });

  return Promise.race([
    reader.read(),
    timeout
  ]).finally(() => {
    clearTimeout(timeoutId);
  });
}
