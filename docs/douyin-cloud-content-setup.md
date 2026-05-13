# Douyin Cloud Content Setup

## 1. Open cloud resources

In the Douyin Cloud console for this mini app:

1. Create a function service in `dev`.
2. Enable MongoDB in the component center.
3. Enable object storage and configure a CDN domain for audio and cover assets.

## 2. Prepare service env vars

Configure these env vars on the function service:

- `SLEEP_SOUNDS_MONGO_URI`
- `SLEEP_SOUNDS_MONGO_DB=sleep_sounds`

## 3. Upload media assets

Upload files that match the asset keys in `content/catalog.json` (current catalog: 8 sounds / 8 covers):

- `sleep-sounds/audio/rain_night.mp3`
- `sleep-sounds/audio/ocean_slow.mp3`
- `sleep-sounds/audio/forest_breeze.mp3`
- `sleep-sounds/audio/fireplace_room.mp3`
- `sleep-sounds/audio/creek_soft.mp3`
- `sleep-sounds/audio/soft_wind.mp3`
- `sleep-sounds/audio/nap_white_noise.mp3`
- `sleep-sounds/audio/deep_ambient.mp3`
- `sleep-sounds/cover/rain_night.jpg`
- `sleep-sounds/cover/ocean_slow.jpg`
- `sleep-sounds/cover/forest_breeze.jpg`
- `sleep-sounds/cover/fireplace_room.jpg`
- `sleep-sounds/cover/creek_soft.jpg`
- `sleep-sounds/cover/soft_wind.jpg`
- `sleep-sounds/cover/nap_white_noise.jpg`
- `sleep-sounds/cover/deep_ambient.jpg`

Before seeding, generate the seed from the catalog with your real CDN base URL:

```powershell
$env:CLOUD_CONTENT_CDN_BASE_URL="https://cdn.your-domain.com"
npm run sync:content
```

This refreshes `cloud/seed/content.seed.json`. You no longer need to hand-edit CDN URLs inside the seed file.

## 4. Seed content

Set env vars locally, then run:

```powershell
$env:SLEEP_SOUNDS_MONGO_URI="your-mongo-uri"
$env:SLEEP_SOUNDS_MONGO_DB="sleep_sounds"
npm run seed:cloud-content
```

Expected output:

```text
Seeded Douyin Cloud content collections
```

## 5. Deploy function

Deploy `cloud/functions/contentBootstrap/index.js` as the handler for:

`GET /content/bootstrap`

## 6. Point the mini app at Douyin Cloud content

Update `miniprogram/config/contentSourceConfig.js` with the target environment and service:

```js
const contentSourceConfig = {
  provider: "douyinCloud",
  httpBaseUrl: "",
  envId: "your-env-id",
  serviceId: "your-service-id",
  bootstrapPath: "/content/bootstrap",
  timeoutMs: 5000
};
```

## 7. Recommended execution order

Run in this order:

1. Open Douyin Cloud `dev` resources.
2. Upload audio and cover assets.
3. Set `CLOUD_CONTENT_CDN_BASE_URL` and run `npm run sync:content` to refresh `cloud/seed/content.seed.json`.
4. Seed MongoDB with `npm run seed:cloud-content`.
5. Deploy the function route `GET /content/bootstrap`.
6. Keep `miniprogram/config/contentSourceConfig.js` on the local provider and verify local fallback first.
7. Switch `provider` to `"douyinCloud"`, fill real `envId` and `serviceId`, then verify the cloud path.
8. After the first successful `dev` verification, append a verification note at the end of this file.

## 8. Local fallback verification

Before enabling cloud access, confirm the mini app still works with local mock data.

Keep:

```js
const contentSourceConfig = {
  provider: "local",
  httpBaseUrl: "",
  envId: "",
  serviceId: "",
  bootstrapPath: "/content/bootstrap",
  timeoutMs: 5000
};
```

Then verify in DevTools Lite:

1. Open the mini app.
2. Confirm the page still shows 7 groups / 8 sounds.
3. Confirm channel tab switching still works.
4. Confirm player tab switching still works.
5. Confirm playback, pause, loop, and timer behavior are unchanged.

If this step fails, stop here. Do not start cloud verification before local fallback is confirmed.

## 9. Cloud path verification in `dev`

After local fallback is confirmed and cloud resources are ready, switch to the real cloud config:

```js
const contentSourceConfig = {
  provider: "douyinCloud",
  httpBaseUrl: "",
  envId: "your-env-id",
  serviceId: "your-service-id",
  bootstrapPath: "/content/bootstrap",
  timeoutMs: 5000
};
```

Then verify in DevTools Lite:

1. Reload the mini app.
2. Confirm the page still renders the same `soundGroups` shape.
3. Confirm a cloud-backed title change is reflected after reload:
   - pick one sound in MongoDB, for example `rain_night`
   - temporarily change its `title`
   - reload the mini app
   - confirm the changed title appears
   - revert the title after verification
4. Confirm playback still starts with the cloud-returned `url`.
5. Confirm a malformed or unreachable cloud response falls back to local mock instead of breaking the page.

Recommended quick checks when debugging:

- If seeding fails:
  - confirm `SLEEP_SOUNDS_MONGO_URI`
  - re-run `npm run sync:content` with `CLOUD_CONTENT_CDN_BASE_URL`
  - confirm all `audioUrl` and `coverUrl` entries no longer use `cdn.example.com`
- If the mini app still shows old data:
  - confirm `provider` is `"douyinCloud"`
  - confirm `envId` and `serviceId` are correct
  - confirm the function route is exactly `GET /content/bootstrap`
- If the page becomes empty:
  - inspect function response shape
  - confirm `groups[].id/title/sounds[]` and `sounds[].id/title/url` are present

## 10. Verification log

After the first successful `dev` dry run, append a log like this:

```md
## Verification Log

- 2026-05-06: `GET /content/bootstrap` reachable from DevTools Lite `dev`.
- 2026-05-06: cloud content title edit reflected in mini app after reload.
```

Do not skip this step. It is the minimal record proving the cloud path has been exercised end to end.
