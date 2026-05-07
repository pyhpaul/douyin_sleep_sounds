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
