const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

test("cloud deployment README includes required operator sections", () => {
  const readme = fs.readFileSync("deployment/cloud-http-content/README.md", "utf8");

  for (const section of [
    "## Prerequisites",
    "## Remote directories",
    "## Upload static assets",
    "## Start the API",
    "## Nginx setup",
    "## HTTPS",
    "## Douyin domain whitelist",
    "## Verification"
  ]) {
    assert.match(readme, new RegExp(section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("cloud deployment README documents the single-domain path deployment", () => {
  const readme = fs.readFileSync("deployment/cloud-http-content/README.md", "utf8");

  for (const phrase of [
    "Single-domain deployment",
    "https://sleep.zhenweiai.com/content/bootstrap",
    "https://sleep.zhenweiai.com/covers/rain_night.jpg",
    "https://sleep.zhenweiai.com/audio/rain_night.mp3",
    "STATIC_BASE_URL=https://sleep.zhenweiai.com",
    "deployment/cloud-http-content/nginx/single-domain.example.conf"
  ]) {
    assert.match(readme, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});
