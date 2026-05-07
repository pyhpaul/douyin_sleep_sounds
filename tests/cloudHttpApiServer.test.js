const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { createServer } = require("../deployment/cloud-http-content/api/app");

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server.address()));
  });
}

function request(address, pathname) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: address.port,
        path: pathname,
        method: "GET"
      },
      (res) => {
        const chunks = [];
        res.setEncoding("utf8");
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode,
            body: chunks.join("")
          });
        });
      }
    );
    req.once("error", reject);
    req.end();
  });
}

test("cloud HTTP API serves bootstrap payload from deployment catalog", async () => {
  const server = createServer({
    catalogPath: path.resolve(__dirname, "../deployment/cloud-http-content/api/catalog.json"),
    staticBaseUrl: "https://static.example.com"
  });

  try {
    const address = await listen(server);
    const response = await request(address, "/content/bootstrap");

    assert.equal(response.statusCode, 200);
    const payload = JSON.parse(response.body);
    assert.equal(Array.isArray(payload.groups), true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("cloud HTTP API can run from the remote server directory layout", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sleep-cloud-http-api-"));
  const apiDir = path.join(tempDir, "api");
  const contentDir = path.join(tempDir, "content");
  const sharedDir = path.join(tempDir, "cloud/functions/shared");

  fs.mkdirSync(apiDir, { recursive: true });
  fs.mkdirSync(contentDir, { recursive: true });
  fs.mkdirSync(sharedDir, { recursive: true });
  fs.copyFileSync(
    path.resolve(__dirname, "../deployment/cloud-http-content/api/app.js"),
    path.join(apiDir, "app.js")
  );
  fs.copyFileSync(
    path.resolve(__dirname, "../deployment/cloud-http-content/api/catalog.json"),
    path.join(apiDir, "catalog.json")
  );
  fs.copyFileSync(
    path.resolve(__dirname, "../content/catalogAdapter.js"),
    path.join(contentDir, "catalogAdapter.js")
  );
  fs.copyFileSync(
    path.resolve(__dirname, "../cloud/functions/shared/contentBootstrapBuilder.js"),
    path.join(sharedDir, "contentBootstrapBuilder.js")
  );

  const appPath = path.join(apiDir, "app.js");
  delete require.cache[appPath];
  const { createServer: createDeployedServer } = require(appPath);
  const server = createDeployedServer({
    catalogPath: path.join(apiDir, "catalog.json"),
    staticBaseUrl: "https://sleep.zhenweiai.com"
  });

  try {
    const address = await listen(server);
    const response = await request(address, "/content/bootstrap");

    assert.equal(response.statusCode, 200);
    const payload = JSON.parse(response.body);
    assert.equal(
      payload.groups[0].sounds[0].url,
      "https://sleep.zhenweiai.com/audio/rain_night.mp3"
    );
    assert.equal(
      payload.groups[0].sounds[0].cover,
      "https://sleep.zhenweiai.com/covers/rain_night.jpg"
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
