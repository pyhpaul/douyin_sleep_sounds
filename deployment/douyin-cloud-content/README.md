# Douyin Cloud-compatible content deployment

This template keeps the current lightweight ECS content service aligned with a future Douyin Cloud deployment shape. It uses the same content HTTP contract and explicit lightweight adapters:

- `CONTENT_REPOSITORY=jsonCatalog`
- `CONTENT_ASSET_RESOLVER=staticBaseUrl`
- `STATIC_BASE_URL=https://sleep.zhenweiai.com`

## Service contract

The content service must expose:

- `GET /healthz` returns JSON with `ok: true`.
- `GET /content/bootstrap` returns the mini app bootstrap payload, including `groups` and sound metadata.

Production smoke checks:

```sh
curl -fsS https://sleep.zhenweiai.com/healthz
curl -fsS https://sleep.zhenweiai.com/content/bootstrap
```

## ECS lightweight environment

Use `ecs-lite.env.example` for the current ECS-like host deployment:

```env
NODE_ENV=production
HOST=127.0.0.1
PORT=3000
CONTENT_REPOSITORY=jsonCatalog
CONTENT_ASSET_RESOLVER=staticBaseUrl
CONTENT_CATALOG_PATH=/srv/sleep-sounds/api/catalog.json
STATIC_BASE_URL=https://sleep.zhenweiai.com
```

Run locally with:

```sh
npm install
npm start
```

or from the repository root:

```sh
node deployment/cloud-http-content/api/app.js
```

Then verify:

```powershell
powershell -ExecutionPolicy Bypass -File deployment/douyin-cloud-content/scripts/verify-local.ps1 -BaseUrl http://127.0.0.1:3000
```

## Douyin Cloud-compatible environment

Use `douyin-cloud.env.example` when packaging for a Douyin Cloud-compatible service runtime:

```env
NODE_ENV=production
HOST=0.0.0.0
PORT=3000
CONTENT_REPOSITORY=jsonCatalog
CONTENT_ASSET_RESOLVER=staticBaseUrl
CONTENT_CATALOG_PATH=./catalog.json
STATIC_BASE_URL=https://sleep.zhenweiai.com
```

The package metadata starts the same compatible HTTP service:

```sh
npm start
```

## Mini app provider switch

For the existing HTTPS endpoint, configure the mini app with the `http` provider:

```js
module.exports = {
  content: {
    provider: "http",
    baseUrl: "https://sleep.zhenweiai.com"
  }
};
```

For Douyin Cloud, switch the provider and set the cloud service identifiers:

```js
module.exports = {
  content: {
    provider: "douyinCloud",
    envId: "your-env-id",
    serviceId: "your-service-id"
  }
};
```

## Verification commands

Before deploying or switching providers, run:

```sh
npm run check
npm test
npm run debug:page
```

For service-level verification against production:

```sh
curl -fsS https://sleep.zhenweiai.com/healthz
curl -fsS https://sleep.zhenweiai.com/content/bootstrap
```
