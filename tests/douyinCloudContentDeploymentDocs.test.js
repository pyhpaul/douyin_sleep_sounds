const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

test("douyin cloud compatible deployment files exist", () => {
  for (const filePath of [
    "deployment/douyin-cloud-content/README.md",
    "deployment/douyin-cloud-content/package.json",
    "deployment/douyin-cloud-content/ecs-lite.env.example",
    "deployment/douyin-cloud-content/douyin-cloud.env.example",
    "deployment/douyin-cloud-content/scripts/verify-local.ps1"
  ]) {
    assert.equal(fs.existsSync(filePath), true, `${filePath} should exist`);
  }
});

test("douyin cloud compatible env templates keep the lightweight adapters explicit", () => {
  const ecsEnv = fs.readFileSync("deployment/douyin-cloud-content/ecs-lite.env.example", "utf8");
  const douyinEnv = fs.readFileSync("deployment/douyin-cloud-content/douyin-cloud.env.example", "utf8");

  for (const content of [ecsEnv, douyinEnv]) {
    assert.match(content, /CONTENT_REPOSITORY=jsonCatalog/);
    assert.match(content, /CONTENT_ASSET_RESOLVER=staticBaseUrl/);
    assert.match(content, /STATIC_BASE_URL=https:\/\/sleep\.zhenweiai\.com/);
    assert.match(content, /CONTENT_CATALOG_PATH=/);
  }
  assert.match(ecsEnv, /HOST=127\.0\.0\.1/);
  assert.match(douyinEnv, /HOST=0\.0\.0\.0/);
});

test("douyin cloud compatible README documents switch and verification commands", () => {
  const readme = fs.readFileSync("deployment/douyin-cloud-content/README.md", "utf8");

  assert.match(readme, /provider: "douyinCloud"/);
  assert.match(readme, /envId/);
  assert.match(readme, /serviceId/);
  assert.match(readme, /\/content\/bootstrap/);
  assert.match(readme, /\/healthz/);
  assert.match(readme, /npm run check/);
  assert.match(readme, /npm test/);
});
