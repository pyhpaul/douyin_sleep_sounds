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

test("serves bootstrap payload when query string is present", async () => {
  const server = createVmContentServer({
    catalogPath: path.resolve(__dirname, "../content/catalog.json")
  });

  try {
    const address = await listen(server);
    const response = await request(address, "/content/bootstrap?x=1");

    assert.equal(response.statusCode, 200);
    const payload = JSON.parse(response.body);
    assert.ok(payload.defaultGroupId);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("uses local debug audio urls when no audio base url is configured", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "vm-content-server-local-audio-"));
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
    catalogPath
  });

  try {
    const address = await listen(server);
    const response = await request(address, "/content/bootstrap");

    assert.equal(response.statusCode, 200);
    const payload = JSON.parse(response.body);
    assert.equal(
      payload.groups[0].sounds[0].url,
      "https://sf1-ttcdn-tos.pstatp.com/obj/developer/sdk/0000-0001.mp3"
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("uses the shared demo audio url for local mp3 debug assets", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "vm-content-server-local-mp3-"));
  const catalogPath = path.join(tempDir, "catalog.json");
  const catalog = {
    version: "2026-05-06T00:00:00Z",
    defaultGroupId: "ambient",
    featuredGroupIds: ["ambient"],
    groups: [
      {
        id: "ambient",
        title: "氛围",
        subtitle: "适合放松和沉浸。",
        sort: 10
      }
    ],
    sounds: [
      {
        id: "deep_ambient",
        groupId: "ambient",
        title: "深夜冥想音景",
        category: "冥想",
        description: "极轻氛围音景，无明显旋律。",
        unlockLabel: "免费",
        audioAssetKey: "sleep-sounds/audio/deep_ambient.mp3",
        coverAssetKey: "sleep-sounds/cover/deep_ambient.jpg",
        sort: 10
      }
    ]
  };

  fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));

  const server = createVmContentServer({
    catalogPath
  });

  try {
    const address = await listen(server);
    const response = await request(address, "/content/bootstrap");

    assert.equal(response.statusCode, 200);
    const payload = JSON.parse(response.body);
    assert.equal(
      payload.groups[0].sounds[0].url,
      "https://sf1-ttcdn-tos.pstatp.com/obj/developer/sdk/0000-0001.mp3"
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

test("serves local debug audio assets from the built-in static route", async () => {
  const server = createVmContentServer({
    catalogPath: path.resolve(__dirname, "../content/catalog.json")
  });

  try {
    const address = await listen(server);
    const response = await request(address, "/debug/audio/deep_ambient.mp3");

    assert.equal(response.statusCode, 200);
    assert.ok(response.body.length > 0);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("serves local debug audio assets when query string is present", async () => {
  const server = createVmContentServer({
    catalogPath: path.resolve(__dirname, "../content/catalog.json")
  });

  try {
    const address = await listen(server);
    const response = await request(address, "/debug/audio/deep_ambient.mp3?v=1");

    assert.equal(response.statusCode, 200);
    assert.ok(response.body.length > 0);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("returns 404 for malformed debug audio encoding", async () => {
  const server = createVmContentServer({
    catalogPath: path.resolve(__dirname, "../content/catalog.json")
  });

  try {
    const address = await listen(server);
    const response = await request(address, "/debug/audio/%E0%A4%A");

    assert.equal(response.statusCode, 404);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("serves local debug cover assets from the built-in static route", async () => {
  const server = createVmContentServer({
    catalogPath: path.resolve(__dirname, "../content/catalog.json")
  });

  try {
    const address = await listen(server);
    const response = await request(address, "/debug/covers/rain_night.jpg");

    assert.equal(response.statusCode, 200);
    assert.ok(response.body.length > 0);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
