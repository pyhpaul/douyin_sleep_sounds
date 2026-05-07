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
