# Douyin Cloud Compatible Content Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Douyin Cloud-compatible content service framework while keeping the current ECS server on the lightweight `catalog.json + static HTTPS assets` implementation.

**Architecture:** Extract the bootstrap business logic into a reusable content service with repository and asset resolver adapters. The current cloud HTTP API and local VM content server both call the shared service; ECS keeps Nginx + Node + `catalog.json`, while Douyin Cloud migration can switch runtime/config without changing `/content/bootstrap`.

**Tech Stack:** Node.js built-in `http`, `fs`, `node:test`, existing `content/catalogAdapter.js`, existing `cloud/functions/shared/contentBootstrapBuilder.js`, PowerShell verification scripts, Linux systemd/Nginx deployment.

---

## File Structure / Ownership Map

### New service framework files

- `server/contentService/createContentBootstrapService.js`
  - Shared business service. Reads catalog data through a repository and maps it through an asset resolver into the existing bootstrap response.
- `server/contentService/createContentHttpApp.js`
  - Node HTTP runtime wrapper. Exposes `GET /healthz` and `GET /content/bootstrap`.
- `server/contentService/env.js`
  - Parses service runtime configuration from environment variables and normalizes defaults.
- `server/contentService/repositories/jsonCatalogRepository.js`
  - Reads a JSON catalog from disk.
- `server/contentService/assetResolvers/staticBaseUrlResolver.js`
  - Builds public `/audio/<file>` and `/covers/<file>` URLs from `STATIC_BASE_URL`.

### New deployment compatibility files

- `deployment/douyin-cloud-content/README.md`
  - Operator guide for ECS-lite and Douyin Cloud-compatible service modes.
- `deployment/douyin-cloud-content/package.json`
  - Small package manifest for running the compatible service from the repo deployment bundle.
- `deployment/douyin-cloud-content/ecs-lite.env.example`
  - Current ECS lightweight environment template.
- `deployment/douyin-cloud-content/douyin-cloud.env.example`
  - Douyin Cloud-compatible environment template using the same lightweight adapters.
- `deployment/douyin-cloud-content/scripts/verify-local.ps1`
  - Local verification helper for `/healthz` and `/content/bootstrap`.

### Existing files to modify

- `deployment/cloud-http-content/api/app.js`
  - Replace direct catalog/bootstrap logic with the shared HTTP app.
- `server/createVmContentServer.js`
  - Keep debug static routes, but reuse `createContentBootstrapService` for `/content/bootstrap`.
- `scripts/check-syntax.js`
  - Add the new service framework and deployment files to syntax checking.
- `tests/cloudHttpApiServer.test.js`
  - Add `/healthz` coverage and update deployed layout test to include `server/contentService`.
- `tests/vmContentServer.test.js`
  - Existing tests should continue to pass after VM server reuses the shared service.

### New tests

- `tests/contentService.test.js`
  - Unit coverage for repository, resolver, env parser, bootstrap service, and HTTP app.
- `tests/douyinCloudContentDeploymentDocs.test.js`
  - Ensures Douyin Cloud compatibility docs and env templates exist and contain the required switches.

---

## Task 1: Add the shared content service core

**Files:**
- Create: `tests/contentService.test.js`
- Create: `server/contentService/repositories/jsonCatalogRepository.js`
- Create: `server/contentService/assetResolvers/staticBaseUrlResolver.js`
- Create: `server/contentService/createContentBootstrapService.js`
- Create: `server/contentService/env.js`
- Test: `npm test -- tests/contentService.test.js`

- [ ] **Step 1: Write the failing content service test**

Create `tests/contentService.test.js` with this exact content:

```js
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```powershell
npm test -- tests/contentService.test.js
```

Expected: FAIL with `Cannot find module '../server/contentService/createContentBootstrapService'`.

- [ ] **Step 3: Create the JSON catalog repository**

Create `server/contentService/repositories/jsonCatalogRepository.js`:

```js
const fs = require("node:fs");

function createJsonCatalogRepository({ catalogPath }) {
  if (!catalogPath) {
    throw new Error("catalogPath is required");
  }

  return {
    async getCatalog() {
      return JSON.parse(fs.readFileSync(catalogPath, "utf8"));
    }
  };
}

module.exports = {
  createJsonCatalogRepository
};
```

- [ ] **Step 4: Create the static asset resolver**

Create `server/contentService/assetResolvers/staticBaseUrlResolver.js`:

```js
function trimTrailingSlashes(value) {
  return String(value || "").replace(/\/+$/, "");
}

function trimSlashes(value) {
  return String(value || "").replace(/^\/+|\/+$/g, "");
}

function buildStaticAssetUrl(baseUrl, category, assetKey) {
  const normalizedBaseUrl = trimTrailingSlashes(baseUrl);
  const normalizedCategory = trimSlashes(category);
  const normalizedAssetKey = String(assetKey || "").replace(/^\/+/, "");

  if (!normalizedBaseUrl || !normalizedCategory || !normalizedAssetKey) {
    return "";
  }

  return `${normalizedBaseUrl}/${normalizedCategory}/${normalizedAssetKey}`;
}

function createStaticBaseUrlResolver({ staticBaseUrl }) {
  return {
    resolveAudioUrl(sound) {
      return buildStaticAssetUrl(staticBaseUrl, "audio", sound.audioAssetKey);
    },
    resolveCoverUrl(sound) {
      return buildStaticAssetUrl(staticBaseUrl, "covers", sound.coverAssetKey);
    }
  };
}

module.exports = {
  buildStaticAssetUrl,
  createStaticBaseUrlResolver
};
```

- [ ] **Step 5: Create the bootstrap service**

Create `server/contentService/createContentBootstrapService.js`:

```js
const {
  buildPublishedContentDocuments
} = require("../../content/catalogAdapter");
const {
  buildContentBootstrapResponse
} = require("../../cloud/functions/shared/contentBootstrapBuilder");

function createContentBootstrapService({ repository, assetResolver }) {
  if (!repository || typeof repository.getCatalog !== "function") {
    throw new Error("repository.getCatalog is required");
  }

  if (
    !assetResolver ||
    typeof assetResolver.resolveAudioUrl !== "function" ||
    typeof assetResolver.resolveCoverUrl !== "function"
  ) {
    throw new Error("assetResolver.resolveAudioUrl and resolveCoverUrl are required");
  }

  return {
    async getContentBootstrap() {
      const catalog = await repository.getCatalog();
      const documents = buildPublishedContentDocuments(catalog, {
        resolveAudioUrl: assetResolver.resolveAudioUrl,
        resolveCoverUrl: assetResolver.resolveCoverUrl
      });

      return buildContentBootstrapResponse(documents);
    }
  };
}

module.exports = {
  createContentBootstrapService
};
```

- [ ] **Step 6: Create the HTTP app runtime**

Create `server/contentService/createContentHttpApp.js`:

```js
const http = require("node:http");

function writeJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(`${JSON.stringify(body)}\n`);
}

function createContentHttpApp({ contentService }) {
  if (!contentService || typeof contentService.getContentBootstrap !== "function") {
    throw new Error("contentService.getContentBootstrap is required");
  }

  return http.createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/healthz") {
      writeJson(response, 200, { ok: true });
      return;
    }

    if (request.method !== "GET" || request.url !== "/content/bootstrap") {
      writeJson(response, 404, { error: "Not Found" });
      return;
    }

    try {
      const payload = await contentService.getContentBootstrap();
      writeJson(response, 200, payload);
    } catch (error) {
      writeJson(response, 500, {
        error: "bootstrap failed",
        message: error.message
      });
    }
  });
}

module.exports = {
  createContentHttpApp,
  writeJson
};
```

- [ ] **Step 7: Create the environment parser**

Create `server/contentService/env.js`:

```js
const SUPPORTED_REPOSITORIES = new Set(["jsonCatalog"]);
const SUPPORTED_ASSET_RESOLVERS = new Set(["staticBaseUrl"]);

function normalizeBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function parsePort(value, fallback) {
  const port = Number.parseInt(value || "", 10);
  return Number.isInteger(port) && port > 0 ? port : fallback;
}

function parseContentServiceEnv(rawEnv = process.env) {
  const repositoryType = rawEnv.CONTENT_REPOSITORY || "jsonCatalog";
  const assetResolverType = rawEnv.CONTENT_ASSET_RESOLVER || "staticBaseUrl";

  if (!SUPPORTED_REPOSITORIES.has(repositoryType)) {
    throw new Error(`Unsupported CONTENT_REPOSITORY: ${repositoryType}`);
  }

  if (!SUPPORTED_ASSET_RESOLVERS.has(assetResolverType)) {
    throw new Error(`Unsupported CONTENT_ASSET_RESOLVER: ${assetResolverType}`);
  }

  return {
    repositoryType,
    assetResolverType,
    catalogPath: rawEnv.CONTENT_CATALOG_PATH || "",
    staticBaseUrl: normalizeBaseUrl(rawEnv.STATIC_BASE_URL),
    host: rawEnv.HOST || "127.0.0.1",
    port: parsePort(rawEnv.PORT, 3000)
  };
}

module.exports = {
  parseContentServiceEnv
};
```

- [ ] **Step 8: Run the test to verify it passes**

Run:

```powershell
npm test -- tests/contentService.test.js
```

Expected: PASS with 7 tests.

- [ ] **Step 9: Commit Task 1**

Run:

```powershell
git add tests/contentService.test.js server/contentService
git commit -m "feat(content): add shared bootstrap service framework" -m "Why:" -m "- Provide a runtime-neutral content bootstrap service for ECS and future Douyin Cloud deployment." -m "What:" -m "- Add JSON catalog repository, static asset resolver, HTTP app runtime, and env parsing." -m "- Cover the shared service with focused unit tests." -m "Test:" -m "- npm test -- tests/contentService.test.js"
```

---

## Task 2: Route the cloud HTTP API through the shared service

**Files:**
- Modify: `deployment/cloud-http-content/api/app.js`
- Modify: `tests/cloudHttpApiServer.test.js`
- Test: `npm test -- tests/cloudHttpApiServer.test.js`

- [ ] **Step 1: Add failing `/healthz` and deployed-layout tests**

Modify `tests/cloudHttpApiServer.test.js`:

1. Add this test after `request()`:

```js
test("cloud HTTP API serves healthz", async () => {
  const server = createServer({
    catalogPath: path.resolve(__dirname, "../deployment/cloud-http-content/api/catalog.json"),
    staticBaseUrl: "https://sleep.zhenweiai.com"
  });

  try {
    const address = await listen(server);
    const response = await request(address, "/healthz");

    assert.equal(response.statusCode, 200);
    assert.deepEqual(JSON.parse(response.body), { ok: true });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
```

2. In `cloud HTTP API can run from the remote server directory layout`, add these constants after `sharedDir`:

```js
  const serviceDir = path.join(tempDir, "server/contentService");
  const repositoryDir = path.join(serviceDir, "repositories");
  const resolverDir = path.join(serviceDir, "assetResolvers");
```

3. Add these directory creations after the existing `fs.mkdirSync(sharedDir, { recursive: true });`:

```js
  fs.mkdirSync(repositoryDir, { recursive: true });
  fs.mkdirSync(resolverDir, { recursive: true });
```

4. Add these copies before `const appPath = path.join(apiDir, "app.js");`:

```js
  for (const fileName of [
    "createContentBootstrapService.js",
    "createContentHttpApp.js",
    "env.js"
  ]) {
    fs.copyFileSync(
      path.resolve(__dirname, `../server/contentService/${fileName}`),
      path.join(serviceDir, fileName)
    );
  }
  fs.copyFileSync(
    path.resolve(__dirname, "../server/contentService/repositories/jsonCatalogRepository.js"),
    path.join(repositoryDir, "jsonCatalogRepository.js")
  );
  fs.copyFileSync(
    path.resolve(__dirname, "../server/contentService/assetResolvers/staticBaseUrlResolver.js"),
    path.join(resolverDir, "staticBaseUrlResolver.js")
  );
```

- [ ] **Step 2: Run the cloud HTTP API test to verify it fails**

Run:

```powershell
npm test -- tests/cloudHttpApiServer.test.js
```

Expected: FAIL because `/healthz` currently returns 404.

- [ ] **Step 3: Replace the cloud HTTP API app implementation**

Replace `deployment/cloud-http-content/api/app.js` with this exact content:

```js
const path = require("node:path");

function requireFirst(candidatePaths) {
  for (const candidatePath of candidatePaths) {
    try {
      return require(candidatePath);
    } catch (error) {
      if (error.code !== "MODULE_NOT_FOUND") {
        throw error;
      }
    }
  }

  throw new Error(`Unable to load module from: ${candidatePaths.join(", ")}`);
}

const {
  createContentBootstrapService
} = requireFirst([
  path.resolve(__dirname, "../../../server/contentService/createContentBootstrapService"),
  path.resolve(__dirname, "../server/contentService/createContentBootstrapService")
]);
const {
  createContentHttpApp
} = requireFirst([
  path.resolve(__dirname, "../../../server/contentService/createContentHttpApp"),
  path.resolve(__dirname, "../server/contentService/createContentHttpApp")
]);
const {
  parseContentServiceEnv
} = requireFirst([
  path.resolve(__dirname, "../../../server/contentService/env"),
  path.resolve(__dirname, "../server/contentService/env")
]);
const {
  createJsonCatalogRepository
} = requireFirst([
  path.resolve(__dirname, "../../../server/contentService/repositories/jsonCatalogRepository"),
  path.resolve(__dirname, "../server/contentService/repositories/jsonCatalogRepository")
]);
const {
  createStaticBaseUrlResolver
} = requireFirst([
  path.resolve(__dirname, "../../../server/contentService/assetResolvers/staticBaseUrlResolver"),
  path.resolve(__dirname, "../server/contentService/assetResolvers/staticBaseUrlResolver")
]);

function createServer(options = {}) {
  const env = parseContentServiceEnv(
    Object.assign({}, process.env, {
      CONTENT_CATALOG_PATH:
        options.catalogPath ||
        process.env.CONTENT_CATALOG_PATH ||
        path.resolve(__dirname, "./catalog.json"),
      STATIC_BASE_URL:
        options.staticBaseUrl !== undefined ? options.staticBaseUrl : process.env.STATIC_BASE_URL
    })
  );
  const repository = createJsonCatalogRepository({
    catalogPath: env.catalogPath
  });
  const assetResolver = createStaticBaseUrlResolver({
    staticBaseUrl: env.staticBaseUrl
  });
  const contentService = createContentBootstrapService({
    repository,
    assetResolver
  });

  return createContentHttpApp({ contentService });
}

if (require.main === module) {
  const env = parseContentServiceEnv(
    Object.assign({}, process.env, {
      CONTENT_CATALOG_PATH: process.env.CONTENT_CATALOG_PATH || path.resolve(__dirname, "./catalog.json")
    })
  );
  const server = createServer();

  server.listen(env.port, env.host, () => {
    console.log(`Sleep Sounds API listening on http://${env.host}:${env.port}`);
  });
}

module.exports = {
  createServer
};
```

- [ ] **Step 4: Run the cloud HTTP API test to verify it passes**

Run:

```powershell
npm test -- tests/cloudHttpApiServer.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit Task 2**

Run:

```powershell
git add deployment/cloud-http-content/api/app.js tests/cloudHttpApiServer.test.js
git commit -m "refactor(content): run cloud HTTP API through shared service" -m "Why:" -m "- Keep the current ECS API aligned with the future Douyin Cloud service framework." -m "What:" -m "- Route the deployment API through shared repository, resolver, service, and HTTP runtime modules." -m "- Add health check and deployed-layout coverage." -m "Test:" -m "- npm test -- tests/cloudHttpApiServer.test.js"
```

---

## Task 3: Reuse the shared service in the local VM content server

**Files:**
- Modify: `server/createVmContentServer.js`
- Test: `npm test -- tests/vmContentServer.test.js`

- [ ] **Step 1: Run existing VM tests before editing**

Run:

```powershell
npm test -- tests/vmContentServer.test.js
```

Expected: PASS before refactor.

- [ ] **Step 2: Replace the VM server implementation**

Replace `server/createVmContentServer.js` with this exact content:

```js
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const {
  DEMO_AUDIO_URL,
  getLocalCoverPath,
  getLocalAudioUrl
} = require("../content/catalogAdapter");
const {
  createContentBootstrapService
} = require("./contentService/createContentBootstrapService");
const {
  createJsonCatalogRepository
} = require("./contentService/repositories/jsonCatalogRepository");
const {
  writeJson
} = require("./contentService/createContentHttpApp");

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || "").trim().replace(/\/+$/, "");
}

function buildAssetUrl(baseUrl, assetKey, fallbackUrl) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const normalizedAssetKey = String(assetKey || "").replace(/^\/+/, "");

  if (!normalizedBaseUrl || !normalizedAssetKey) {
    return fallbackUrl;
  }

  return `${normalizedBaseUrl}/${normalizedAssetKey}`;
}

function writeFile(response, filePath) {
  if (!fs.existsSync(filePath)) {
    writeJson(response, 404, { error: "Not Found" });
    return;
  }

  const extension = path.extname(filePath).toLowerCase();
  const contentTypeByExtension = {
    ".mp3": "audio/mpeg",
    ".ogg": "audio/ogg",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg"
  };

  response.writeHead(200, {
    "content-type": contentTypeByExtension[extension] || "application/octet-stream",
    "cache-control": "no-store"
  });
  fs.createReadStream(filePath).pipe(response);
}

function resolveDebugAudioPath(requestPath) {
  const fileName = decodeURIComponent(String(requestPath || "").replace("/debug/audio/", ""));
  if (!fileName || fileName.includes("..") || fileName.includes("/") || fileName.includes("\\")) {
    return "";
  }

  return path.resolve(__dirname, "../debug/audio", fileName);
}

function resolveDebugCoverPath(requestPath) {
  const fileName = decodeURIComponent(String(requestPath || "").replace("/debug/covers/", ""));
  if (!fileName || fileName.includes("..") || fileName.includes("/") || fileName.includes("\\")) {
    return "";
  }

  return path.resolve(__dirname, "../debug/covers", fileName);
}

function createVmAssetResolver({ audioBaseUrl, coverBaseUrl }) {
  return {
    resolveAudioUrl(sound) {
      return audioBaseUrl
        ? buildAssetUrl(audioBaseUrl, sound.audioAssetKey, DEMO_AUDIO_URL)
        : getLocalAudioUrl(sound);
    },
    resolveCoverUrl(sound) {
      return buildAssetUrl(coverBaseUrl, sound.coverAssetKey, getLocalCoverPath(sound.id));
    }
  };
}

function createVmContentServer(options = {}) {
  const catalogPath = options.catalogPath || path.resolve(__dirname, "../content/catalog.json");
  const audioBaseUrl = options.audioBaseUrl || "";
  const coverBaseUrl = options.coverBaseUrl || "";
  const contentService = createContentBootstrapService({
    repository: createJsonCatalogRepository({ catalogPath }),
    assetResolver: createVmAssetResolver({ audioBaseUrl, coverBaseUrl })
  });

  return http.createServer(async (request, response) => {
    if (request.method === "GET" && String(request.url || "").startsWith("/debug/audio/")) {
      const audioPath = resolveDebugAudioPath(request.url);
      if (!audioPath) {
        writeJson(response, 404, { error: "Not Found" });
        return;
      }

      writeFile(response, audioPath);
      return;
    }

    if (request.method === "GET" && String(request.url || "").startsWith("/debug/covers/")) {
      const coverPath = resolveDebugCoverPath(request.url);
      if (!coverPath) {
        writeJson(response, 404, { error: "Not Found" });
        return;
      }

      writeFile(response, coverPath);
      return;
    }

    if (request.method !== "GET" || request.url !== "/content/bootstrap") {
      writeJson(response, 404, { error: "Not Found" });
      return;
    }

    try {
      writeJson(response, 200, await contentService.getContentBootstrap());
    } catch (error) {
      writeJson(response, 500, {
        error: "content bootstrap failed",
        message: error.message
      });
    }
  });
}

module.exports = {
  createVmContentServer,
  createVmAssetResolver
};
```

- [ ] **Step 3: Run VM tests to verify behavior is unchanged**

Run:

```powershell
npm test -- tests/vmContentServer.test.js
```

Expected: PASS.

- [ ] **Step 4: Commit Task 3**

Run:

```powershell
git add server/createVmContentServer.js
git commit -m "refactor(content): share bootstrap service with VM server" -m "Why:" -m "- Keep local VM debug serving aligned with the cloud-compatible content service." -m "What:" -m "- Reuse the shared bootstrap service while preserving debug audio and cover routes." -m "Test:" -m "- npm test -- tests/vmContentServer.test.js"
```

---

## Task 4: Add Douyin Cloud-compatible deployment templates

**Files:**
- Create: `tests/douyinCloudContentDeploymentDocs.test.js`
- Create: `deployment/douyin-cloud-content/README.md`
- Create: `deployment/douyin-cloud-content/package.json`
- Create: `deployment/douyin-cloud-content/ecs-lite.env.example`
- Create: `deployment/douyin-cloud-content/douyin-cloud.env.example`
- Create: `deployment/douyin-cloud-content/scripts/verify-local.ps1`
- Test: `npm test -- tests/douyinCloudContentDeploymentDocs.test.js`

- [ ] **Step 1: Write the failing deployment docs test**

Create `tests/douyinCloudContentDeploymentDocs.test.js`:

```js
const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

test("douyin cloud compatible deployment files exist", () => {
  for (const filePath of [
    "deployment/douyin-cloud-content/README.md",
    "deployment/douyin-cloud-content/package.json",
    "deployment/douyin-cloud-content/ecs-lite.env.example",
    "deployment/douyin-cloud-content/douyin-cloud.env.example",
    "deployment/douyin-cloud-content/scripts/verify-local.ps1"
  ]) {
    assert.equal(fs.existsSync(filePath), true, `${filePath} should exist`);
  }
});

test("douyin cloud compatible env templates keep the lightweight adapters explicit", () => {
  const ecsEnv = fs.readFileSync("deployment/douyin-cloud-content/ecs-lite.env.example", "utf8");
  const douyinEnv = fs.readFileSync("deployment/douyin-cloud-content/douyin-cloud.env.example", "utf8");

  for (const content of [ecsEnv, douyinEnv]) {
    assert.match(content, /CONTENT_REPOSITORY=jsonCatalog/);
    assert.match(content, /CONTENT_ASSET_RESOLVER=staticBaseUrl/);
    assert.match(content, /STATIC_BASE_URL=https:\/\/sleep\.zhenweiai\.com/);
    assert.match(content, /CONTENT_CATALOG_PATH=/);
  }
  assert.match(ecsEnv, /HOST=127\.0\.0\.1/);
  assert.match(douyinEnv, /HOST=0\.0\.0\.0/);
});

test("douyin cloud compatible README documents switch and verification commands", () => {
  const readme = fs.readFileSync("deployment/douyin-cloud-content/README.md", "utf8");

  assert.match(readme, /provider: "douyinCloud"/);
  assert.match(readme, /envId/);
  assert.match(readme, /serviceId/);
  assert.match(readme, /\/content\/bootstrap/);
  assert.match(readme, /\/healthz/);
  assert.match(readme, /npm run check/);
  assert.match(readme, /npm test/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```powershell
npm test -- tests/douyinCloudContentDeploymentDocs.test.js
```

Expected: FAIL because the `deployment/douyin-cloud-content` files do not exist.

- [ ] **Step 3: Create the package manifest**

Create `deployment/douyin-cloud-content/package.json`:

```json
{
  "name": "sleep-sounds-douyin-cloud-compatible-content",
  "private": true,
  "version": "0.1.0",
  "scripts": {
    "start": "node ../cloud-http-content/api/app.js"
  }
}
```

- [ ] **Step 4: Create the ECS lightweight env template**

Create `deployment/douyin-cloud-content/ecs-lite.env.example`:

```env
NODE_ENV=production
HOST=127.0.0.1
PORT=3000
CONTENT_REPOSITORY=jsonCatalog
CONTENT_ASSET_RESOLVER=staticBaseUrl
CONTENT_CATALOG_PATH=/srv/sleep-sounds/api/catalog.json
STATIC_BASE_URL=https://sleep.zhenweiai.com
```

- [ ] **Step 5: Create the Douyin Cloud-compatible env template**

Create `deployment/douyin-cloud-content/douyin-cloud.env.example`:

```env
NODE_ENV=production
HOST=0.0.0.0
PORT=3000
CONTENT_REPOSITORY=jsonCatalog
CONTENT_ASSET_RESOLVER=staticBaseUrl
CONTENT_CATALOG_PATH=./catalog.json
STATIC_BASE_URL=https://sleep.zhenweiai.com
```

- [ ] **Step 6: Create the local verification script**

Create `deployment/douyin-cloud-content/scripts/verify-local.ps1`:

```powershell
param(
  [string]$BaseUrl = "http://127.0.0.1:3000"
)

$ErrorActionPreference = "Stop"

Write-Host "Checking healthz"
$health = curl.exe -s "$BaseUrl/healthz" | ConvertFrom-Json
if ($health.ok -ne $true) {
  throw "healthz did not return ok=true"
}

Write-Host "Checking bootstrap"
$bootstrap = curl.exe -s "$BaseUrl/content/bootstrap" | ConvertFrom-Json
if (-not $bootstrap.groups -or $bootstrap.groups.Count -lt 1) {
  throw "bootstrap did not return groups"
}

$soundCount = 0
foreach ($group in $bootstrap.groups) {
  $soundCount += $group.sounds.Count
}

Write-Host "groups=$($bootstrap.groups.Count) sounds=$soundCount"
```

- [ ] **Step 7: Create the deployment README**

Create `deployment/douyin-cloud-content/README.md`:

````md
# Douyin Cloud Compatible Content Service

This directory documents the service shape used to migrate the current Sleep Sounds content API from ECS to Douyin Cloud without changing the mini app content contract.

## Service contract

The service exposes:

```text
GET /healthz
GET /content/bootstrap
```

`/content/bootstrap` returns the same payload shape consumed by:

```text
miniprogram/services/soundSourceService.js
miniprogram/services/httpContentService.js
miniprogram/services/cloudContentService.js
```

## Current ECS lightweight mode

Use:

```text
deployment/douyin-cloud-content/ecs-lite.env.example
```

Runtime values:

```env
HOST=127.0.0.1
PORT=3000
CONTENT_REPOSITORY=jsonCatalog
CONTENT_ASSET_RESOLVER=staticBaseUrl
CONTENT_CATALOG_PATH=/srv/sleep-sounds/api/catalog.json
STATIC_BASE_URL=https://sleep.zhenweiai.com
```

In this mode, Nginx exposes HTTPS and static files:

```text
https://sleep.zhenweiai.com/content/bootstrap
https://sleep.zhenweiai.com/covers/rain_night.jpg
https://sleep.zhenweiai.com/audio/rain_night.mp3
```

## Douyin Cloud-compatible lightweight mode

Use:

```text
deployment/douyin-cloud-content/douyin-cloud.env.example
```

Runtime values:

```env
HOST=0.0.0.0
PORT=3000
CONTENT_REPOSITORY=jsonCatalog
CONTENT_ASSET_RESOLVER=staticBaseUrl
CONTENT_CATALOG_PATH=./catalog.json
STATIC_BASE_URL=https://sleep.zhenweiai.com
```

This keeps the same lightweight content source and static asset domain while changing the service host binding for cloud runtime compatibility.

## Mini app switch

Current HTTP provider:

```js
const contentSourceConfig = {
  provider: "http",
  httpBaseUrl: "https://sleep.zhenweiai.com",
  envId: "",
  serviceId: "",
  bootstrapPath: "/content/bootstrap",
  timeoutMs: 5000
};
```

Douyin Cloud provider:

```js
const contentSourceConfig = {
  provider: "douyinCloud",
  httpBaseUrl: "",
  envId: "douyin-cloud-env-id-from-console",
  serviceId: "douyin-cloud-service-id-from-console",
  bootstrapPath: "/content/bootstrap",
  timeoutMs: 5000
};
```

Do not remove `local`, `http`, or `douyinCloud` provider support.

## Local verification

Run syntax and unit checks:

```powershell
npm run check
npm test
npm run debug:page
```

Run the service locally:

```powershell
$env:HOST = "127.0.0.1"
$env:PORT = "3000"
$env:CONTENT_REPOSITORY = "jsonCatalog"
$env:CONTENT_ASSET_RESOLVER = "staticBaseUrl"
$env:CONTENT_CATALOG_PATH = "deployment/cloud-http-content/api/catalog.json"
$env:STATIC_BASE_URL = "https://sleep.zhenweiai.com"
node deployment/cloud-http-content/api/app.js
```

Verify:

```powershell
deployment/douyin-cloud-content/scripts/verify-local.ps1 -BaseUrl "http://127.0.0.1:3000"
```

Expected:

```text
healthz ok=true
bootstrap contains groups and sounds
```

## Production verification

On ECS:

```bash
systemctl status sleep-sounds-api
curl -s http://127.0.0.1:3000/healthz
curl -s https://sleep.zhenweiai.com/content/bootstrap
curl -I https://sleep.zhenweiai.com/covers/rain_night.jpg
curl -I https://sleep.zhenweiai.com/audio/rain_night.mp3
```

If Nginx does not proxy `/healthz`, verify `/healthz` only through `http://127.0.0.1:3000/healthz` on the server.
````

- [ ] **Step 8: Run deployment docs test to verify it passes**

Run:

```powershell
npm test -- tests/douyinCloudContentDeploymentDocs.test.js
```

Expected: PASS.

- [ ] **Step 9: Commit Task 4**

Run:

```powershell
git add tests/douyinCloudContentDeploymentDocs.test.js deployment/douyin-cloud-content
git commit -m "docs(deploy): add douyin cloud compatible content templates" -m "Why:" -m "- Make the current ECS lightweight service match the future Douyin Cloud deployment shape." -m "What:" -m "- Add env templates, package metadata, verification script, and operator docs." -m "Test:" -m "- npm test -- tests/douyinCloudContentDeploymentDocs.test.js"
```

---

## Task 5: Wire syntax checks and run full local verification

**Files:**
- Modify: `scripts/check-syntax.js`
- Test: `npm run check`
- Test: `npm test`
- Test: `npm run debug:page`

- [ ] **Step 1: Add new JavaScript files to syntax checking**

Modify the `files` array in `scripts/check-syntax.js` so it includes these entries after `"server/index.js"`:

```js
  "server/contentService/createContentBootstrapService.js",
  "server/contentService/createContentHttpApp.js",
  "server/contentService/env.js",
  "server/contentService/repositories/jsonCatalogRepository.js",
  "server/contentService/assetResolvers/staticBaseUrlResolver.js",
```

Also include this entry after `"cloud/scripts/seedContent.js"`:

```js
  "deployment/cloud-http-content/api/app.js",
```

- [ ] **Step 2: Run syntax check**

Run:

```powershell
npm run check
```

Expected: PASS and the checked file count increases from 19.

- [ ] **Step 3: Run full test suite**

Run:

```powershell
npm test
```

Expected: PASS. The suite should include the new content service tests and Douyin Cloud deployment docs tests.

- [ ] **Step 4: Run page runtime verification**

Run:

```powershell
npm run debug:page
```

Expected: PASS with 15 tests.

- [ ] **Step 5: Commit Task 5**

Run:

```powershell
git add scripts/check-syntax.js
git commit -m "chore: include content service files in syntax checks" -m "Why:" -m "- Ensure the shared content service framework is covered by the project syntax check." -m "What:" -m "- Add new service framework and deployment API files to scripts/check-syntax.js." -m "Test:" -m "- npm run check" -m "- npm test" -m "- npm run debug:page"
```

---

## Task 6: Deploy the shared-service lightweight implementation to ECS

**Files:**
- Server write: `/srv/sleep-sounds/api/app.js`
- Server write: `/srv/sleep-sounds/server/contentService/*`
- Server write: `/etc/systemd/system/sleep-sounds-api.service`
- Server read: `/etc/nginx/sites-available/sleep-sounds.conf`
- Test: local curl and public HTTPS curl

- [ ] **Step 1: Confirm local worktree is clean before deployment**

Run:

```powershell
git status --short
```

Expected: no output.

- [ ] **Step 2: Verify local commands before deploying**

Run:

```powershell
npm run check
npm test
npm run debug:page
```

Expected:

```text
npm run check passes
npm test passes
npm run debug:page passes
```

- [ ] **Step 3: Create server-side backup**

Run:

```powershell
ssh -i .ssh/id_ed25519_aliyun root@8.138.108.110 "set -e; backup_dir=/srv/sleep-sounds/backups/content-service-$(date +%Y%m%d%H%M%S); mkdir -p $backup_dir; cp -a /srv/sleep-sounds/api $backup_dir/api; if [ -d /srv/sleep-sounds/server ]; then cp -a /srv/sleep-sounds/server $backup_dir/server; fi; cp -a /etc/systemd/system/sleep-sounds-api.service $backup_dir/sleep-sounds-api.service; echo $backup_dir"
```

Expected: prints the created backup directory path under `/srv/sleep-sounds/backups/`.

- [ ] **Step 4: Upload updated API and shared service files**

Run:

```powershell
ssh -i .ssh/id_ed25519_aliyun root@8.138.108.110 "set -e; mkdir -p /srv/sleep-sounds/server/contentService/repositories /srv/sleep-sounds/server/contentService/assetResolvers"
scp -i .ssh/id_ed25519_aliyun deployment/cloud-http-content/api/app.js root@8.138.108.110:/srv/sleep-sounds/api/app.js
scp -i .ssh/id_ed25519_aliyun server/contentService/createContentBootstrapService.js root@8.138.108.110:/srv/sleep-sounds/server/contentService/createContentBootstrapService.js
scp -i .ssh/id_ed25519_aliyun server/contentService/createContentHttpApp.js root@8.138.108.110:/srv/sleep-sounds/server/contentService/createContentHttpApp.js
scp -i .ssh/id_ed25519_aliyun server/contentService/env.js root@8.138.108.110:/srv/sleep-sounds/server/contentService/env.js
scp -i .ssh/id_ed25519_aliyun server/contentService/repositories/jsonCatalogRepository.js root@8.138.108.110:/srv/sleep-sounds/server/contentService/repositories/jsonCatalogRepository.js
scp -i .ssh/id_ed25519_aliyun server/contentService/assetResolvers/staticBaseUrlResolver.js root@8.138.108.110:/srv/sleep-sounds/server/contentService/assetResolvers/staticBaseUrlResolver.js
```

Expected: all commands exit with code 0.

- [ ] **Step 5: Update the systemd environment**

Run:

```powershell
ssh -i .ssh/id_ed25519_aliyun root@8.138.108.110 "cat > /etc/systemd/system/sleep-sounds-api.service <<'EOF'
[Unit]
Description=Sleep Sounds Bootstrap API
After=network.target

[Service]
Type=simple
WorkingDirectory=/srv/sleep-sounds/api
ExecStart=/usr/bin/node /srv/sleep-sounds/api/app.js
Restart=always
RestartSec=3
Environment=NODE_ENV=production
Environment=HOST=127.0.0.1
Environment=PORT=3000
Environment=CONTENT_REPOSITORY=jsonCatalog
Environment=CONTENT_ASSET_RESOLVER=staticBaseUrl
Environment=CONTENT_CATALOG_PATH=/srv/sleep-sounds/api/catalog.json
Environment=STATIC_BASE_URL=https://sleep.zhenweiai.com

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl restart sleep-sounds-api
systemctl status sleep-sounds-api --no-pager"
```

Expected: service status is `active (running)`.

- [ ] **Step 6: Verify internal health and bootstrap on the server**

Run:

```powershell
ssh -i .ssh/id_ed25519_aliyun root@8.138.108.110 "set -e; curl -s http://127.0.0.1:3000/healthz; echo; curl -s http://127.0.0.1:3000/content/bootstrap | node -e \"let data='';process.stdin.on('data',c=>data+=c);process.stdin.on('end',()=>{const payload=JSON.parse(data);const sounds=payload.groups.flatMap(group=>group.sounds);console.log('groups='+payload.groups.length+' sounds='+sounds.length);console.log(sounds[0].url);console.log(sounds[0].cover);});\""
```

Expected output includes:

```text
{"ok":true}
groups=7 sounds=8
https://sleep.zhenweiai.com/audio/rain_night.mp3
https://sleep.zhenweiai.com/covers/rain_night.jpg
```

- [ ] **Step 7: Verify public HTTPS API and static assets**

Run:

```powershell
curl.exe -s https://sleep.zhenweiai.com/content/bootstrap
curl.exe -I https://sleep.zhenweiai.com/covers/rain_night.jpg
curl.exe -I https://sleep.zhenweiai.com/audio/rain_night.mp3
```

Expected:

```text
/content/bootstrap returns JSON with 7 groups and 8 sounds
/covers/rain_night.jpg returns HTTP 200
/audio/rain_night.mp3 returns HTTP 200
```

- [ ] **Step 8: Record deployment verification in the final implementation report**

Include these items in the final report:

```text
Changed files
Server config
Domain whitelist items
npm run check result
npm test result
npm run debug:page result
Internal curl result
Public curl result
Current provider remains provider: "http" unless the user explicitly requests switching to "douyinCloud"
```

No commit is required for server-only deployment verification unless repo files changed during this task.
