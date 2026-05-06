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

Upload files that match the keys used in `cloud/seed/content.seed.json`:

- `sleep-sounds/audio/rain-v1.mp3`
- `sleep-sounds/audio/wave-v1.mp3`
- `sleep-sounds/audio/fire-v1.mp3`
- `sleep-sounds/audio/wind-v1.mp3`
- `sleep-sounds/audio/soft-music-v1.mp3`
- `sleep-sounds/audio/deep-breath-v1.mp3`
- `sleep-sounds/cover/rain-v1.jpg`
- `sleep-sounds/cover/wave-v1.jpg`
- `sleep-sounds/cover/fire-v1.jpg`
- `sleep-sounds/cover/wind-v1.jpg`
- `sleep-sounds/cover/soft-music-v1.jpg`
- `sleep-sounds/cover/deep-breath-v1.jpg`

Replace the `cdn.example.com` URLs in `cloud/seed/content.seed.json` with your real CDN domain before seeding.

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

## 6. Enable mini app cloud access

Update `miniprogram/config/cloudContentConfig.js` with the target environment and service:

```js
const cloudContentConfig = {
  enabled: true,
  envId: "your-env-id",
  serviceId: "your-service-id",
  bootstrapPath: "/content/bootstrap",
  timeoutMs: 5000
};
```
