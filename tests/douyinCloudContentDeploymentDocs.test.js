const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
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

test("douyin cloud compatible catalog path resolves from template working directory", () => {
  const envPath = "deployment/douyin-cloud-content/douyin-cloud.env.example";
  const douyinEnv = fs.readFileSync(envPath, "utf8");
  const catalogPath = "../cloud-http-content/api/catalog.json";

  assert.match(douyinEnv, /CONTENT_CATALOG_PATH=\.\.\/cloud-http-content\/api\/catalog\.json/);
  assert.equal(
    fs.existsSync(path.resolve(path.dirname(envPath), catalogPath)),
    true,
    `${catalogPath} should resolve from deployment/douyin-cloud-content`
  );
});

test("douyin cloud compatible local verifier exits non-zero when service is unreachable", () => {
  const result = childProcess.spawnSync(
    "powershell",
    [
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      "deployment/douyin-cloud-content/scripts/verify-local.ps1",
      "-BaseUrl",
      "http://127.0.0.1:9"
    ],
    { encoding: "utf8" }
  );

  assert.notEqual(result.status, 0, `verifier should fail for unreachable service: ${result.stdout}${result.stderr}`);
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
  assert.match(readme, /npm run debug:page/);
  assert.match(readme, /node deployment\/cloud-http-content\/api\/app\.js/);
  assert.match(readme, /curl -fsS https:\/\/sleep\.zhenweiai\.com\/healthz/);
  assert.match(readme, /curl -fsS https:\/\/sleep\.zhenweiai\.com\/content\/bootstrap/);
  assert.match(readme, /CONTENT_CATALOG_PATH=\.\.\/cloud-http-content\/api\/catalog\.json/);
  assert.match(readme, /deployment\/douyin-cloud-content/);
  assert.match(readme, /copy catalog/);
  assert.match(readme, /CONTENT_CATALOG_PATH=\.\/catalog\.json/);
});
