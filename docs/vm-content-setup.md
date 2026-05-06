# VM Content Setup

## 1. Sync content artifacts

Run:

```powershell
npm run sync:content
```

Expected output:

```text
Synced content artifacts
```

## 2. Start the VM content server

Run:

```powershell
npm run serve:vm-content
```

Default endpoint:

```text
http://127.0.0.1:8787/content/bootstrap
```

## 3. Optional CDN base URLs

If your VM should return uploaded asset URLs instead of the local demo audio URL / local cover path:

```powershell
$env:VM_CONTENT_AUDIO_BASE_URL="https://static.example.com"
$env:VM_CONTENT_COVER_BASE_URL="https://static.example.com"
npm run serve:vm-content
```

## 4. Switch the mini app to HTTP content

Update `miniprogram/config/contentSourceConfig.js`:

```js
const contentSourceConfig = {
  provider: "http",
  httpBaseUrl: "http://127.0.0.1:8787",
  envId: "",
  serviceId: "",
  bootstrapPath: "/content/bootstrap",
  timeoutMs: 5000
};
```

## 5. Verify in DevTools Lite

With the VM server running:

1. Reload the mini app.
2. Confirm it still renders 7 groups / 8 sounds.
3. Confirm playback still starts normally.
4. Confirm tab switching and timer behavior do not regress.

Then stop the VM server and reload:

1. Confirm the mini app falls back to local content.
2. Confirm the page still renders and the player remains usable.
