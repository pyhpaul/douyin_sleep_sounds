const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

test("cloud HTTP deployment scaffolding files exist", () => {
  for (const filePath of [
    "deployment/cloud-http-content/README.md",
    "deployment/cloud-http-content/api/package.json",
    "deployment/cloud-http-content/api/app.js",
    "deployment/cloud-http-content/api/catalog.json",
    "deployment/cloud-http-content/nginx/api.example.conf",
    "deployment/cloud-http-content/nginx/static.example.conf",
    "deployment/cloud-http-content/systemd/sleep-sounds-api.service",
    "deployment/cloud-http-content/scripts/verify-deployment.ps1"
  ]) {
    assert.equal(fs.existsSync(filePath), true, `${filePath} should exist`);
  }
});
