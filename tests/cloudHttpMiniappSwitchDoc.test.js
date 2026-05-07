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
    assert.match(doc, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});
