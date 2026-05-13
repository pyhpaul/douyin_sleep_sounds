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

For the single-domain deployment on `sleep.zhenwei1.cn`, use:

```js
const contentSourceConfig = {
  provider: "http",
  httpBaseUrl: "https://sleep.zhenwei1.cn",
  envId: "",
  serviceId: "",
  bootstrapPath: "/content/bootstrap",
  timeoutMs: 5000
};
```

The bootstrap URL becomes:

- `https://sleep.zhenwei1.cn/content/bootstrap`

Static asset URLs become:

- `https://sleep.zhenwei1.cn/covers/rain_night.jpg`
- `https://sleep.zhenwei1.cn/audio/rain_night.mp3`

## Douyin Open Platform checklist

In Douyin Open Platform, configure:

- request domain:
  - `https://api.<your-domain>`
- static domain:
  - `https://static.<your-domain>`

For the single-domain deployment, configure:

- request domain:
  - `https://sleep.zhenwei1.cn`
- downloadFile domain:
  - `https://sleep.zhenwei1.cn`
- static domain:
  - `https://sleep.zhenwei1.cn`

## real-device verification

After the config switch:

1. Rebuild the mini app
2. Open real-device preview
3. Verify cover images load
4. Verify audio starts playback
5. Verify no domain whitelist error appears in console
