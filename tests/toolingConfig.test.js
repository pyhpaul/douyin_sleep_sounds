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
    "player-backdrop",
    "player-shell-content",
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

test("index page uses scenic player backdrop with a lower translucent text panel", () => {
  const ttml = fs.readFileSync("miniprogram/pages/index/index.ttml", "utf8");
  const ttss = fs.readFileSync("miniprogram/pages/index/index.ttss", "utf8");

  assert.match(ttml, /class="player-backdrop-image"[\s\S]*src="\{\{currentSoundCover\}\}"/);
  assert.match(ttml, /class="player-control-stack"/);
  assert.match(ttml, /class="player-copy-panel"/);
  assert.match(ttml, /class="mini-cover" src="\{\{currentSoundCover\}\}"/);
  assert.doesNotMatch(ttml, /bindchange="handleLoopChange"/);

  for (const pattern of [
    /\.player-backdrop-image\b/,
    /\.player-backdrop-shade\b/,
    /\.player-shell-content\b/,
    /\.player-control-stack\b/,
    /\.player-copy-panel\b/,
    /\.mini-cover\b/,
    /\.timer-chip\b/
  ]) {
    assert.match(ttss, pattern);
  }
});

test("index page only binds sound playback to the play button", () => {
  const ttml = fs.readFileSync("miniprogram/pages/index/index.ttml", "utf8");

  assert.match(ttml, /class="station-card [^"]*"[\s\S]*bindtap="handleSoundTap"/);
  assert.match(ttml, /class="station-play"[\s\S]*bindtap="handleSoundPlayTap"/);
});

test("index page renders category thumbs, scene thumbs, player backdrop, and mini player cover", () => {
  const ttml = fs.readFileSync("miniprogram/pages/index/index.ttml", "utf8");
  const ttss = fs.readFileSync("miniprogram/pages/index/index.ttss", "utf8");

  for (const pattern of [
    /class="channel-tab-thumb"/,
    /class="group-count"/,
    /class="station-icon" src="\{\{sound\.cover\}\}"/,
    /class="sound-chip-row"/,
    /class="sound-unlock"/,
    /class="sound-status \{\{sound\.isPlayingItem \? 'sound-status-playing' : ''\}\}"/,
    /class="player-backdrop-image"[\s\S]*src="\{\{currentSoundCover\}\}"/,
    /class="mini-cover" src="\{\{currentSoundCover\}\}"/,
    /class="timer-chip \{\{item\.isActive \? 'timer-chip-active' : ''\}\}"/
  ]) {
    assert.match(ttml, pattern);
  }

  assert.match(ttml, /class="option-card[^"]*"/);

  for (const selector of [
    /\.channel-tab-thumb\b/,
    /\.group-count\b/,
    /\.sound-chip-row\b/,
    /\.sound-unlock\b/,
    /\.sound-status-playing\b/,
    /\.player-backdrop-image\b/,
    /\.player-control-stack\b/,
    /\.mini-cover\b/,
    /\.timer-chip\b/,
    /\.player-shell-content\b/
  ]) {
    assert.match(ttss, selector);
  }
});

test("player timer options stay on a single row", () => {
  const ttss = fs.readFileSync("miniprogram/pages/index/index.ttss", "utf8");

  assert.match(ttss, /\.timer-options\s*\{[^}]*flex-wrap:\s*nowrap/);
  assert.match(ttss, /\.timer-chip\s*\{[^}]*flex:\s*1/);
});

test("player embeds the primary play button inside the copy panel", () => {
  const ttml = fs.readFileSync("miniprogram/pages/index/index.ttml", "utf8");
  const ttss = fs.readFileSync("miniprogram/pages/index/index.ttss", "utf8");

  assert.match(
    ttml,
    /class="option-card timer-section"[\s\S]*class="transport-row"[\s\S]*class="primary-control"/
  );
  assert.match(
    ttml,
    /class="player-copy-panel"[\s\S]*class="now-meta"[\s\S]*<\/view>\s*<\/view>\s*<view class="player-options"/
  );
  assert.match(ttss, /\.option-card\b/);
  assert.match(ttss, /\.transport-row\b/);
});

test("player copy panel aligns copy content to the left to save horizontal space", () => {
  const ttss = fs.readFileSync("miniprogram/pages/index/index.ttss", "utf8");

  assert.match(ttss, /\.player-copy-panel\s*\{[^}]*text-align:\s*left/);
  assert.match(ttss, /\.now-meta\s*\{[^}]*justify-content:\s*flex-start/);
});

test("player copy panel uses a lighter translucent surface to reveal more backdrop", () => {
  const ttss = fs.readFileSync("miniprogram/pages/index/index.ttss", "utf8");

  assert.match(ttss, /\.player-copy-panel\s*\{[^}]*border:\s*1rpx solid rgba\(255,\s*255,\s*255,\s*0\.08\)/);
  assert.match(
    ttss,
    /\.player-copy-panel\s*\{[^}]*background:\s*linear-gradient\(180deg,\s*rgba\(12,\s*16,\s*25,\s*0\.18\),\s*rgba\(12,\s*16,\s*25,\s*0\.56\)\)/
  );
  assert.match(ttss, /\.player-copy-panel\s*\{[^}]*box-shadow:\s*0 24rpx 80rpx rgba\(0,\s*0,\s*0,\s*0\.16\)/);
});

test("player copy panel keeps title crisp while softening description and meta tiers", () => {
  const ttss = fs.readFileSync("miniprogram/pages/index/index.ttss", "utf8");

  assert.match(ttss, /\.now-title\s*\{[^}]*text-shadow:\s*0 10rpx 32rpx rgba\(0,\s*0,\s*0,\s*0\.28\)/);
  assert.match(ttss, /\.now-desc\s*\{[^}]*color:\s*rgba\(255,\s*248,\s*234,\s*0\.64\)/);
  assert.match(ttss, /\.pill\s*\{[^}]*background:\s*rgba\(244,\s*199,\s*122,\s*0\.10\)/);
  assert.match(ttss, /\.pill\s*\{[^}]*color:\s*rgba\(255,\s*248,\s*234,\s*0\.74\)/);
});
