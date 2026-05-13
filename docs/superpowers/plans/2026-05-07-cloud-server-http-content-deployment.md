# Cloud Server HTTP Content Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the Douyin mini app content service to a standard cloud server with HTTPS API + HTTPS static assets, then switch the mini app from local provider to HTTP provider for real-device validation.

**Architecture:** Keep the current front-end data contract unchanged. Static assets (covers/audio) are served by Nginx from a public HTTPS domain, while a small Node.js bootstrap API reads `catalog.json`, builds full asset URLs, and returns the existing `content/bootstrap` payload shape. The mini app switches from `provider: "local"` to `provider: "http"` only after the cloud endpoints are reachable and whitelisted in Douyin Open Platform.

**Tech Stack:** Linux cloud server, Nginx, Node.js, systemd, HTTPS (Let's Encrypt or equivalent), existing repo `content/catalog.json` + `cloud/functions/shared/contentBootstrapBuilder.js`.

---

## File Structure / Ownership Map

### Existing repo files

- `content/catalog.json`
  - Canonical content catalog. Source of groups/sounds metadata.
- `content/catalogAdapter.js`
  - Existing helpers for building bootstrap-like content documents and cloud seed payloads.
- `cloud/functions/shared/contentBootstrapBuilder.js`
  - Existing canonical builder that maps published groups/sounds into current mini app bootstrap shape.
- `miniprogram/config/contentSourceConfig.js`
  - Current runtime provider switch (`local` / `http` / `douyinCloud`).
- `miniprogram/services/httpContentService.js`
  - Existing HTTP bootstrap client used by mini app when `provider: "http"`.
- `tests/*`
  - Existing local tests; should remain green.

### New repo files to create

- `deployment/cloud-http-content/README.md`
  - Operator-facing deployment guide and command reference.
- `deployment/cloud-http-content/api/package.json`
  - Minimal Node.js bootstrap API package manifest.
- `deployment/cloud-http-content/api/app.js`
  - Minimal bootstrap API server implementation for cloud server.
- `deployment/cloud-http-content/api/catalog.json`
  - Deployment copy or template of content catalog.
- `deployment/cloud-http-content/nginx/api.example.conf`
  - Example Nginx config for `api.<domain>`.
- `deployment/cloud-http-content/nginx/static.example.conf`
  - Example Nginx config for `static.<domain>`.
- `deployment/cloud-http-content/systemd/sleep-sounds-api.service`
  - Example systemd unit for bootstrap API process.
- `deployment/cloud-http-content/scripts/verify-deployment.ps1`
  - Verification helper for Windows operator: curls API and static assets after deployment.

### Remote server paths to provision

- `/srv/sleep-sounds/api/`
  - Deployed Node bootstrap API.
- `/srv/sleep-sounds/static/covers/`
  - Uploaded public cover images.
- `/srv/sleep-sounds/static/audio/`
  - Uploaded public audio assets.
- `/etc/nginx/sites-available/`
  - Nginx server configs.
- `/etc/systemd/system/sleep-sounds-api.service`
  - Installed systemd unit.

---

## Pre-Execution Constraints

- Keep current local provider mode intact until HTTP deployment is verified.
- Do **not** remove `local` or `douyinCloud` support from the repo.
- Do **not** introduce MongoDB, CMS, auth, or unrelated backend complexity in this plan.
- Public resource URLs must use HTTPS domain names, not raw IPs.
- Final API response must remain compatible with the existing mini app bootstrap contract.

---

### Task 1: Create deployment scaffolding inside the repo

**Files:**
- Create: `deployment/cloud-http-content/README.md`
- Create: `deployment/cloud-http-content/api/package.json`
- Create: `deployment/cloud-http-content/api/app.js`
- Create: `deployment/cloud-http-content/api/catalog.json`
- Create: `deployment/cloud-http-content/nginx/api.example.conf`
- Create: `deployment/cloud-http-content/nginx/static.example.conf`
- Create: `deployment/cloud-http-content/systemd/sleep-sounds-api.service`
- Create: `deployment/cloud-http-content/scripts/verify-deployment.ps1`
- Test: `npm run check`

- [ ] **Step 1: Write the failing scaffolding presence test**

Create `tests/cloudHttpDeploymentPlan.test.js`:

```js
const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

test("cloud HTTP deployment scaffolding files exist", () => {
  for (const filePath of [
    "deployment/cloud-http-content/README.md",
    "deployment/cloud-http-content/api/package.json",
    "deployment/cloud-http-content/api/app.js",
    "deployment/cloud-http-content/api/catalog.json",
    "deployment/cloud-http-content/nginx/api.example.conf",
    "deployment/cloud-http-content/nginx/static.example.conf",
    "deployment/cloud-http-content/systemd/sleep-sounds-api.service",
    "deployment/cloud-http-content/scripts/verify-deployment.ps1"
  ]) {
    assert.equal(fs.existsSync(filePath), true, `${filePath} should exist`);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/cloudHttpDeploymentPlan.test.js`

Expected: FAIL because the deployment scaffolding files do not exist yet.

- [ ] **Step 3: Create the deployment scaffolding files**

Use these exact contents.

`deployment/cloud-http-content/api/package.json`

```json
{
  "name": "sleep-sounds-cloud-http-api",
  "private": true,
  "version": "0.1.0",
  "main": "app.js",
  "scripts": {
    "start": "node app.js"
  }
}
```

`deployment/cloud-http-content/api/catalog.json`

```json
{
  "version": "2026-05-06T00:00:00Z",
  "defaultGroupId": "rain",
  "featuredGroupIds": ["rain", "water", "ambient"],
  "groups": [],
  "sounds": []
}
```

`deployment/cloud-http-content/nginx/api.example.conf`

```nginx
server {
    listen 443 ssl http2;
    server_name api.example.com;

    ssl_certificate /etc/letsencrypt/live/api.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.example.com/privkey.pem;

    location /content/bootstrap {
        proxy_pass http://127.0.0.1:3000/content/bootstrap;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

`deployment/cloud-http-content/nginx/static.example.conf`

```nginx
server {
    listen 443 ssl http2;
    server_name static.example.com;

    ssl_certificate /etc/letsencrypt/live/static.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/static.example.com/privkey.pem;

    root /srv/sleep-sounds/static;

    location /covers/ {
        try_files $uri =404;
    }

    location /audio/ {
        try_files $uri =404;
    }
}
```

`deployment/cloud-http-content/systemd/sleep-sounds-api.service`

```ini
[Unit]
Description=Sleep Sounds Bootstrap API
After=network.target

[Service]
Type=simple
WorkingDirectory=/srv/sleep-sounds/api
ExecStart=/usr/bin/node /srv/sleep-sounds/api/app.js
Restart=always
RestartSec=3
Environment=PORT=3000
Environment=STATIC_BASE_URL=https://static.example.com

[Install]
WantedBy=multi-user.target
```

`deployment/cloud-http-content/scripts/verify-deployment.ps1`

```powershell
param(
  [Parameter(Mandatory = $true)][string]$ApiBaseUrl,
  [Parameter(Mandatory = $true)][string]$StaticBaseUrl
)

Write-Host "Checking bootstrap..."
curl.exe -s "$ApiBaseUrl/content/bootstrap"

Write-Host "`nChecking cover..."
curl.exe -I "$StaticBaseUrl/covers/rain_night.jpg"

Write-Host "`nChecking audio..."
curl.exe -I "$StaticBaseUrl/audio/rain_night.mp3"
```

`deployment/cloud-http-content/README.md`

```md
# Cloud HTTP Content Deployment

This folder contains the minimum deployment artifacts for running the Douyin mini app content service on a standard cloud server.

## Domains

- `api.<your-domain>` for `GET /content/bootstrap`
- `static.<your-domain>` for `/covers/*` and `/audio/*`

## Remote directories

- `/srv/sleep-sounds/api`
- `/srv/sleep-sounds/static/covers`
- `/srv/sleep-sounds/static/audio`

## Required services

- Nginx
- Node.js
- systemd
- HTTPS certificates
```

`deployment/cloud-http-content/api/app.js` will be implemented in Task 2, so create it with this placeholder first:

```js
console.log("placeholder");
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/cloudHttpDeploymentPlan.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/cloudHttpDeploymentPlan.test.js deployment/cloud-http-content
git commit -m "docs: add cloud HTTP deployment scaffolding"
```

---

### Task 2: Implement the minimal bootstrap API server

**Files:**
- Modify: `deployment/cloud-http-content/api/app.js`
- Modify: `deployment/cloud-http-content/api/catalog.json`
- Test: `tests/cloudHttpApiServer.test.js`

- [ ] **Step 1: Write the failing API test**

Create `tests/cloudHttpApiServer.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/cloudHttpApiServer.test.js`

Expected: FAIL because `createServer` is not exported yet.

- [ ] **Step 3: Implement the minimal bootstrap API**

Replace `deployment/cloud-http-content/api/app.js` with:

```js
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const { buildPublishedContentDocuments } = require("../../../content/catalogAdapter");
const {
  buildContentBootstrapResponse
} = require("../../../cloud/functions/shared/contentBootstrapBuilder");

function writeJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(`${JSON.stringify(body)}\n`);
}

function loadCatalog(catalogPath) {
  return JSON.parse(fs.readFileSync(catalogPath, "utf8"));
}

function trimTrailingSlashes(value) {
  return String(value || "").replace(/\/+$/, "");
}

function buildStaticAssetUrl(baseUrl, category, assetKey) {
  return `${trimTrailingSlashes(baseUrl)}/${category}/${String(assetKey || "").replace(/^\/+/, "")}`;
}

function createServer(options = {}) {
  const catalogPath =
    options.catalogPath || path.resolve(__dirname, "./catalog.json");
  const staticBaseUrl = options.staticBaseUrl || process.env.STATIC_BASE_URL || "";

  return http.createServer((request, response) => {
    if (request.method !== "GET" || request.url !== "/content/bootstrap") {
      writeJson(response, 404, { error: "Not Found" });
      return;
    }

    try {
      const catalog = loadCatalog(catalogPath);
      const documents = buildPublishedContentDocuments(catalog, {
        resolveAudioUrl: (sound) =>
          buildStaticAssetUrl(staticBaseUrl, "audio", sound.audioAssetKey),
        resolveCoverUrl: (sound) =>
          buildStaticAssetUrl(staticBaseUrl, "covers", sound.coverAssetKey)
      });
      const payload = buildContentBootstrapResponse(documents);
      writeJson(response, 200, payload);
    } catch (error) {
      writeJson(response, 500, {
        error: "bootstrap failed",
        message: error.message
      });
    }
  });
}

if (require.main === module) {
  const port = Number.parseInt(process.env.PORT || "3000", 10);
  const server = createServer();
  server.listen(port, "127.0.0.1", () => {
    console.log(`Sleep Sounds API listening on http://127.0.0.1:${port}`);
  });
}

module.exports = {
  createServer
};
```

Replace `deployment/cloud-http-content/api/catalog.json` with a real starter catalog:

```json
{
  "version": "2026-05-06T00:00:00Z",
  "defaultGroupId": "rain",
  "featuredGroupIds": ["rain", "water", "ambient"],
  "groups": [
    {
      "id": "rain",
      "title": "雨声",
      "subtitle": "更聚焦的雨滴与空气层次，适合想快速静下来的时候。",
      "sort": 10
    },
    {
      "id": "water",
      "title": "水流",
      "subtitle": "海浪和溪流节奏更平缓，适合长时间持续播放。",
      "sort": 20
    },
    {
      "id": "ambient",
      "title": "氛围",
      "subtitle": "空间感更强的抽象音景，适合冥想与沉浸。",
      "sort": 70
    }
  ],
  "sounds": [
    {
      "id": "rain_night",
      "groupId": "rain",
      "title": "雨夜白噪音",
      "category": "雨声",
      "description": "稳定雨声和远处空气感。",
      "unlockLabel": "免费",
      "audioAssetKey": "rain_night.mp3",
      "coverAssetKey": "rain_night.jpg",
      "sort": 10
    },
    {
      "id": "ocean_slow",
      "groupId": "water",
      "title": "深夜海浪",
      "category": "海浪",
      "description": "慢速海浪，适合睡前放松。",
      "unlockLabel": "免费",
      "audioAssetKey": "ocean_slow.mp3",
      "coverAssetKey": "ocean_slow.jpg",
      "sort": 20
    },
    {
      "id": "deep_ambient",
      "groupId": "ambient",
      "title": "深夜冥想音景",
      "category": "冥想",
      "description": "极轻氛围音景，无明显旋律。",
      "unlockLabel": "免费",
      "audioAssetKey": "deep_ambient.mp3",
      "coverAssetKey": "deep_ambient.jpg",
      "sort": 80
    }
  ]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/cloudHttpApiServer.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add deployment/cloud-http-content/api/app.js deployment/cloud-http-content/api/catalog.json tests/cloudHttpApiServer.test.js
git commit -m "feat: add cloud HTTP bootstrap API template"
```

---

### Task 3: Write the operator runbook for server provisioning

**Files:**
- Modify: `deployment/cloud-http-content/README.md`
- Test: `tests/cloudHttpDeploymentDocs.test.js`

- [ ] **Step 1: Write the failing documentation test**

Create `tests/cloudHttpDeploymentDocs.test.js`:

```js
const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

test("cloud deployment README includes required operator sections", () => {
  const readme = fs.readFileSync("deployment/cloud-http-content/README.md", "utf8");

  for (const section of [
    "## Prerequisites",
    "## Remote directories",
    "## Upload static assets",
    "## Start the API",
    "## Nginx setup",
    "## HTTPS",
    "## Douyin domain whitelist",
    "## Verification"
  ]) {
    assert.match(readme, new RegExp(section.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")));
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/cloudHttpDeploymentDocs.test.js`

Expected: FAIL because the README is still too short.

- [ ] **Step 3: Expand the operator README**

Replace `deployment/cloud-http-content/README.md` with:

```md
# Cloud HTTP Content Deployment

This folder contains the minimum deployment artifacts for running the Douyin mini app content service on a standard cloud server.

## Prerequisites

- A Linux cloud server with public network access
- A registered domain with DNS control
- Two subdomains recommended:
  - `api.<your-domain>`
  - `static.<your-domain>`
- HTTPS certificates for both subdomains
- Node.js and Nginx installed on the server

## Remote directories

Create these directories on the server:

```bash
mkdir -p /srv/sleep-sounds/api
mkdir -p /srv/sleep-sounds/static/covers
mkdir -p /srv/sleep-sounds/static/audio
```

## Upload static assets

Upload cover images to:

```bash
/srv/sleep-sounds/static/covers
```

Upload audio files to:

```bash
/srv/sleep-sounds/static/audio
```

The final public URLs should look like:

- `https://static.<your-domain>/covers/rain_night.jpg`
- `https://static.<your-domain>/audio/rain_night.mp3`

## Deploy the API

Copy these files to `/srv/sleep-sounds/api`:

- `deployment/cloud-http-content/api/app.js`
- `deployment/cloud-http-content/api/package.json`
- `deployment/cloud-http-content/api/catalog.json`

Install dependencies if needed:

```bash
cd /srv/sleep-sounds/api
npm install
```

## Start the API

For manual verification:

```bash
cd /srv/sleep-sounds/api
PORT=3000 STATIC_BASE_URL=https://static.<your-domain> node app.js
```

Expected output:

```text
Sleep Sounds API listening on http://127.0.0.1:3000
```

## systemd setup

Copy:

- `deployment/cloud-http-content/systemd/sleep-sounds-api.service`

to:

```bash
/etc/systemd/system/sleep-sounds-api.service
```

Then run:

```bash
sudo systemctl daemon-reload
sudo systemctl enable sleep-sounds-api
sudo systemctl restart sleep-sounds-api
sudo systemctl status sleep-sounds-api
```

## Nginx setup

Copy:

- `deployment/cloud-http-content/nginx/api.example.conf`
- `deployment/cloud-http-content/nginx/static.example.conf`

into your Nginx sites configuration and replace `example.com` with the real domain.

Reload Nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## HTTPS

Use Let's Encrypt or your existing certificate workflow for both subdomains.

The deployment is not valid for Douyin mini app runtime until both:

- `api.<your-domain>`
- `static.<your-domain>`

are reachable via HTTPS.

## Douyin domain whitelist

Add the deployed domains to Douyin Open Platform:

- request domain:
  - `https://api.<your-domain>`
- media / image domain:
  - `https://static.<your-domain>`

Do not use raw IP addresses.

## Verification

From a local operator machine:

```powershell
powershell -File deployment/cloud-http-content/scripts/verify-deployment.ps1 -ApiBaseUrl https://api.<your-domain> -StaticBaseUrl https://static.<your-domain>
```

Expected results:

- bootstrap returns JSON
- cover URL returns `200`
- audio URL returns `200`

Then switch the mini app to HTTP provider and verify:

- covers load on real device
- audio plays on real device
- no `127.0.0.1` dependency remains
- no third-party domain whitelist errors remain
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/cloudHttpDeploymentDocs.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add deployment/cloud-http-content/README.md tests/cloudHttpDeploymentDocs.test.js
git commit -m "docs: add cloud HTTP deployment runbook"
```

---

### Task 4: Add an explicit mini app HTTP switch checklist

**Files:**
- Create: `deployment/cloud-http-content/miniapp-http-switch.md`
- Test: `tests/cloudHttpMiniappSwitchDoc.test.js`

- [ ] **Step 1: Write the failing switch-doc test**

Create `tests/cloudHttpMiniappSwitchDoc.test.js`:

```js
const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

test("mini app HTTP switch doc includes config and whitelist checklist", () => {
  const doc = fs.readFileSync("deployment/cloud-http-content/miniapp-http-switch.md", "utf8");

  for (const phrase of [
    "miniprogram/config/contentSourceConfig.js",
    "provider: \"http\"",
    "httpBaseUrl",
    "Douyin Open Platform",
    "request domain",
    "static domain",
    "real-device verification"
  ]) {
    assert.match(doc, new RegExp(phrase.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")));
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/cloudHttpMiniappSwitchDoc.test.js`

Expected: FAIL because the file does not exist yet.

- [ ] **Step 3: Create the switch checklist doc**

Create `deployment/cloud-http-content/miniapp-http-switch.md`:

```md
# Mini App HTTP Provider Switch Checklist

## Config file to modify

- `miniprogram/config/contentSourceConfig.js`

## Target config

Replace the local provider config with:

```js
const contentSourceConfig = {
  provider: "http",
  httpBaseUrl: "https://api.<your-domain>",
  envId: "",
  serviceId: "",
  bootstrapPath: "/content/bootstrap",
  timeoutMs: 5000
};
```

## Douyin Open Platform checklist

In Douyin Open Platform, configure:

- request domain:
  - `https://api.<your-domain>`
- static domain:
  - `https://static.<your-domain>`

## real-device verification

After the config switch:

1. Rebuild the mini app
2. Open real-device preview
3. Verify cover images load
4. Verify audio starts playback
5. Verify no domain whitelist error appears in console
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/cloudHttpMiniappSwitchDoc.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add deployment/cloud-http-content/miniapp-http-switch.md tests/cloudHttpMiniappSwitchDoc.test.js
git commit -m "docs: add mini app HTTP switch checklist"
```

---

### Task 5: Final validation and handoff packaging

**Files:**
- Modify: `deployment/cloud-http-content/README.md` (only if verification revealed drift)
- Modify: `deployment/cloud-http-content/miniapp-http-switch.md` (only if verification revealed drift)
- Test: `tests/cloudHttpDeploymentPlan.test.js`
- Test: `tests/cloudHttpApiServer.test.js`
- Test: `tests/cloudHttpDeploymentDocs.test.js`
- Test: `tests/cloudHttpMiniappSwitchDoc.test.js`

- [ ] **Step 1: Run deployment-doc test suite**

Run:

```bash
npm test -- tests/cloudHttpDeploymentPlan.test.js tests/cloudHttpApiServer.test.js tests/cloudHttpDeploymentDocs.test.js tests/cloudHttpMiniappSwitchDoc.test.js
```

Expected: all PASS.

- [ ] **Step 2: Run project-wide verification**

Run:

```bash
npm run check
npm test
npm run debug:page
```

Expected:

- `checked 19 file(s)` or current syntax-check success output
- all tests PASS
- page runtime tests PASS

- [ ] **Step 3: Prepare operator handoff notes**

Ensure the execution handoff includes:

- which repo files to copy to the remote server
- which DNS names to create
- which directories to create on the server
- which Douyin Open Platform domains to whitelist
- exact local config file to switch after deployment

- [ ] **Step 4: Commit**

```bash
git add deployment/cloud-http-content tests/cloudHttpDeploymentPlan.test.js tests/cloudHttpApiServer.test.js tests/cloudHttpDeploymentDocs.test.js tests/cloudHttpMiniappSwitchDoc.test.js
git commit -m "docs: finalize cloud HTTP deployment package"
```

---

## Self-Review

### Spec coverage

- Cloud server deployment artifacts: covered by Tasks 1–3.
- Bootstrap API for HTTP provider: covered by Task 2.
- Mini app provider switch checklist: covered by Task 4.
- Validation and operator handoff: covered by Task 5.

### Placeholder scan

- No `TODO`/`TBD` placeholders remain in task steps.
- Each code-writing step contains concrete file content.
- Each validation step contains exact commands.

### Type consistency

- API server exports `createServer`, matching the test.
- Bootstrap route path is consistently `/content/bootstrap`.
- Config switch path consistently references `miniprogram/config/contentSourceConfig.js`.

---

Plan complete and saved to `docs/superpowers/plans/2026-05-07-cloud-server-http-content-deployment.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
