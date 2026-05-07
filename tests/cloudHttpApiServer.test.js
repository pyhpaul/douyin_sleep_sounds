const assert = require("node:assert/strict");
const http = require("node:http");
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
