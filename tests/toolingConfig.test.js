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
    "player-shell",
    "album-art",
    "playback-panel",
    "transport-row",
    "radio-section",
    "station-card"
  ]) {
    assert.match(ttml, new RegExp(`class="[^"]*${className}`));
    assert.match(ttss, new RegExp(`\\.${className}\\b`));
  }
});
