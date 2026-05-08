const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  createContentBootstrapService
} = require("../server/contentService/createContentBootstrapService");
const {
  createContentHttpApp
} = require("../server/contentService/createContentHttpApp");
const {
  parseContentServiceEnv
} = require("../server/contentService/env");
const {
  createStaticBaseUrlResolver
} = require("../server/contentService/assetResolvers/staticBaseUrlResolver");
const {
  createJsonCatalogRepository
} = require("../server/contentService/repositories/jsonCatalogRepository");

function writeCatalogFixture() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "content-service-"));
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
        audioAssetKey: "rain_night.mp3",
        coverAssetKey: "rain_night.jpg",
        sort: 10
      }
    ]
  };

  fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));

  return {
    tempDir,
    catalogPath
  };
}

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

test("json catalog repository reads catalog from disk", async () => {
  const { tempDir, catalogPath } = writeCatalogFixture();

  try {
    const repository = createJsonCatalogRepository({ catalogPath });
    const catalog = await repository.getCatalog();

    assert.equal(catalog.defaultGroupId, "rain");
    assert.equal(catalog.sounds[0].id, "rain_night");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("static base url resolver builds public audio and cover urls", () => {
  const resolver = createStaticBaseUrlResolver({
    staticBaseUrl: "https://sleep.zhenweiai.com/"
  });

  assert.equal(
    resolver.resolveAudioUrl({ audioAssetKey: "/rain_night.mp3" }),
    "https://sleep.zhenweiai.com/audio/rain_night.mp3"
  );
  assert.equal(
    resolver.resolveCoverUrl({ coverAssetKey: "rain_night.jpg" }),
    "https://sleep.zhenweiai.com/covers/rain_night.jpg"
  );
});

test("content bootstrap service maps repository data to mini app bootstrap response", async () => {
  const { tempDir, catalogPath } = writeCatalogFixture();

  try {
    const service = createContentBootstrapService({
      repository: createJsonCatalogRepository({ catalogPath }),
      assetResolver: createStaticBaseUrlResolver({
        staticBaseUrl: "https://sleep.zhenweiai.com"
      })
    });

    const payload = await service.getContentBootstrap();

    assert.equal(payload.version, "2026-05-06T00:00:00Z");
    assert.equal(payload.defaultGroupId, "rain");
    assert.equal(payload.groups[0].id, "rain");
    assert.equal(payload.groups[0].sounds[0].url, "https://sleep.zhenweiai.com/audio/rain_night.mp3");
    assert.equal(payload.groups[0].sounds[0].cover, "https://sleep.zhenweiai.com/covers/rain_night.jpg");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("content http app serves healthz and bootstrap", async () => {
  const { tempDir, catalogPath } = writeCatalogFixture();
  const service = createContentBootstrapService({
    repository: createJsonCatalogRepository({ catalogPath }),
    assetResolver: createStaticBaseUrlResolver({
      staticBaseUrl: "https://sleep.zhenweiai.com"
    })
  });
  const server = createContentHttpApp({ contentService: service });

  try {
    const address = await listen(server);
    const health = await request(address, "/healthz");
    const bootstrap = await request(address, "/content/bootstrap");
    const missing = await request(address, "/missing");

    assert.equal(health.statusCode, 200);
    assert.deepEqual(JSON.parse(health.body), { ok: true });
    assert.equal(bootstrap.statusCode, 200);
    assert.equal(JSON.parse(bootstrap.body).groups[0].sounds[0].id, "rain_night");
    assert.equal(missing.statusCode, 404);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("content http app matches bootstrap route by pathname", async () => {
  const server = createContentHttpApp({
    contentService: {
      async getContentBootstrap() {
        return {
          groups: [
            {
              sounds: [
                {
                  id: "rain_night"
                }
              ]
            }
          ]
        };
      }
    }
  });

  try {
    const address = await listen(server);
    const response = await request(address, "/content/bootstrap?x=1");

    assert.equal(response.statusCode, 200);
    assert.equal(JSON.parse(response.body).groups[0].sounds[0].id, "rain_night");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("content http app returns 500 when bootstrap service fails", async () => {
  const server = createContentHttpApp({
    contentService: {
      async getContentBootstrap() {
        throw new Error("catalog missing");
      }
    }
  });

  try {
    const address = await listen(server);
    const response = await request(address, "/content/bootstrap");
    const payload = JSON.parse(response.body);

    assert.equal(response.statusCode, 500);
    assert.equal(payload.error, "bootstrap failed");
    assert.equal(payload.message, "catalog missing");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("content http app returns stringified message for non-error bootstrap failures", async () => {
  const server = createContentHttpApp({
    contentService: {
      async getContentBootstrap() {
        throw "plain failure";
      }
    }
  });

  try {
    const address = await listen(server);
    const response = await request(address, "/content/bootstrap");
    const payload = JSON.parse(response.body);

    assert.equal(response.statusCode, 500);
    assert.equal(payload.error, "bootstrap failed");
    assert.equal(payload.message, "plain failure");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("parseContentServiceEnv normalizes current lightweight defaults", () => {
  const env = parseContentServiceEnv({
    STATIC_BASE_URL: "https://sleep.zhenweiai.com/",
    CONTENT_CATALOG_PATH: "catalog.json",
    PORT: "8787"
  });

  assert.equal(env.repositoryType, "jsonCatalog");
  assert.equal(env.assetResolverType, "staticBaseUrl");
  assert.equal(env.staticBaseUrl, "https://sleep.zhenweiai.com");
  assert.equal(env.catalogPath, "catalog.json");
  assert.equal(env.host, "127.0.0.1");
  assert.equal(env.port, 8787);
});

test("parseContentServiceEnv falls back for non-strict and out-of-range ports", () => {
  assert.equal(parseContentServiceEnv({ PORT: "8787abc" }).port, 3000);
  assert.equal(parseContentServiceEnv({ PORT: "70000" }).port, 3000);
});

test("parseContentServiceEnv defaults port to 3000", () => {
  const env = parseContentServiceEnv({});

  assert.equal(env.port, 3000);
});

test("parseContentServiceEnv rejects unsupported adapters", () => {
  assert.throws(
    () =>
      parseContentServiceEnv({
        CONTENT_REPOSITORY: "douyinCloudMongo"
      }),
    /Unsupported CONTENT_REPOSITORY/
  );
  assert.throws(
    () =>
      parseContentServiceEnv({
        CONTENT_ASSET_RESOLVER: "douyinStorage"
      }),
    /Unsupported CONTENT_ASSET_RESOLVER/
  );
});
