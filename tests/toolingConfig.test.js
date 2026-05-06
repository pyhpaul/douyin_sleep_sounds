const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

test("tooling does not expose browser preview entrypoints", () => {
  const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));

  assert.equal(packageJson.scripts.preview, undefined);
  assert.equal(packageJson.scripts.dev, undefined);
  assert.equal(fs.existsSync("dev-preview"), false);
  assert.equal(fs.existsSync("scripts/dev-preview-server.js"), false);
  assert.equal(fs.existsSync("scripts/live-reload.js"), false);
  assert.equal(fs.existsSync("scripts/transform-ttss.js"), false);
});

test("index page exposes player and radio layout classes", () => {
  const ttml = fs.readFileSync("miniprogram/pages/index/index.ttml", "utf8");
  const ttss = fs.readFileSync("miniprogram/pages/index/index.ttss", "utf8");

  for (const className of [
    "main-tabs",
    "channel-tabs",
    "player-shell",
    "album-art",
    "playback-panel",
    "transport-row",
    "radio-section",
    "station-card",
    "mini-player"
  ]) {
    assert.match(ttml, new RegExp(`class="[^"]*${className}`));
    assert.match(ttss, new RegExp(`\\.${className}\\b`));
  }
});

test("index page keeps hero compact and only shows mini player on channel mode", () => {
  const ttml = fs.readFileSync("miniprogram/pages/index/index.ttml", "utf8");
  const ttss = fs.readFileSync("miniprogram/pages/index/index.ttss", "utf8");

  assert.match(ttml, /class="page \{\{pageMode === 'player' \? 'page-player' : 'page-channels'\}\}"/);
  assert.match(ttml, /class="hero-row"/);
  assert.match(ttml, /class="hero-note"/);
  assert.match(ttml, /tt:if="\{\{hasSounds && pageMode === 'channels'\}\}" class="mini-player"/);

  for (const className of [
    "page-player",
    "page-channels",
    "hero-row",
    "hero-note",
    "main-tab-label"
  ]) {
    assert.match(ttss, new RegExp(`\\.${className}\\b`));
  }
});

test("index page wires playback state into large and mini disc animation", () => {
  const ttml = fs.readFileSync("miniprogram/pages/index/index.ttml", "utf8");
  const ttss = fs.readFileSync("miniprogram/pages/index/index.ttss", "utf8");

  assert.match(ttml, /class="album-disc \{\{isPlaying \? 'disc-spinning' : 'disc-idle'\}\}"/);
  assert.match(ttml, /class="mini-disc \{\{isPlaying \? 'disc-spinning' : 'disc-idle'\}\}"/);
  assert.match(ttml, /class="album-disc-sheen"/);
  assert.match(ttml, /class="album-disc-rings"/);
  assert.match(ttml, /class="album-disc-label"/);
  assert.match(ttml, /class="mini-disc-sheen"/);
  assert.match(ttml, /class="mini-disc-rings"/);
  assert.match(ttml, /class="mini-disc-label"/);

  for (const pattern of [
    /\.disc-spinning\b/,
    /\.disc-idle\b/,
    /\.album-disc-sheen\b/,
    /\.album-disc-rings\b/,
    /\.album-disc-label\b/,
    /\.mini-disc\b/,
    /\.mini-disc-sheen\b/,
    /\.mini-disc-rings\b/,
    /\.mini-disc-label\b/,
    /\.mini-disc-hole\b/,
    /@keyframes disc-spin/
  ]) {
    assert.match(ttss, pattern);
  }
});
