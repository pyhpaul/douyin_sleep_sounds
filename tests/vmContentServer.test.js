const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { createVmContentServer } = require("../server/createVmContentServer");

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      resolve(server.address());
    });
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
        res.on("data", (chunk) => {
          chunks.push(chunk);
        });
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

test("serves bootstrap payload from catalog.json", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "vm-content-server-"));
  const catalogPath = path.join(tempDir, "catalog.json");
  const catalog = {
    version: "2026-05-06T00:00:00Z",
    defaultGroupId: "rain",
    featuredGroupIds: ["rain"],
    groups: [
      {
        id: "rain",
        title: "雨声",
        subtitle: "细密雨声，适合放松和屏蔽环境噪声。",
        sort: 10
      }
    ],
    sounds: [
      {
        id: "rain_night",
        groupId: "rain",
        title: "夜雨",
        category: "自然",
        description: "细密雨声，适合放松和屏蔽环境噪声。",
        unlockLabel: "免费",
        audioAssetKey: "sleep-sounds/audio/rain_night.mp3",
        coverAssetKey: "sleep-sounds/cover/rain_night.jpg",
        sort: 10
      }
    ]
  };

  fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));

  const server = createVmContentServer({
    catalogPath,
    audioBaseUrl: "https://media.sleep.test",
    coverBaseUrl: "https://media.sleep.test"
  });

  try {
    const address = await listen(server);
    const response = await request(address, "/content/bootstrap");

    assert.equal(response.statusCode, 200);
    const payload = JSON.parse(response.body);
    assert.equal(payload.defaultGroupId, "rain");
    assert.equal(payload.groups[0].sounds[0].unlockLabel, "免费");
    assert.equal(
      payload.groups[0].sounds[0].url,
      "https://media.sleep.test/sleep-sounds/audio/rain_night.mp3"
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("returns 404 for unknown routes", async () => {
  const server = createVmContentServer({
    catalogPath: path.resolve(__dirname, "../content/catalog.json"),
    audioBaseUrl: "https://media.sleep.test",
    coverBaseUrl: "https://media.sleep.test"
  });

  try {
    const address = await listen(server);
    const response = await request(address, "/missing");

    assert.equal(response.statusCode, 404);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
