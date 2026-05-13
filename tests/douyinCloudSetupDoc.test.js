const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

test("douyin cloud content setup doc covers seed, provider switch, fallback, and verification log", () => {
  const filePath = "docs/douyin-cloud-content-setup.md";
  assert.equal(fs.existsSync(filePath), true, `${filePath} should exist`);

  const doc = fs.readFileSync(filePath, "utf8");

  assert.match(doc, /SLEEP_SOUNDS_MONGO_URI/);
  assert.match(doc, /npm run seed:cloud-content/);
  assert.match(doc, /CLOUD_CONTENT_CDN_BASE_URL/);
  assert.match(doc, /npm run sync:content/);
  assert.match(doc, /provider: "douyinCloud"/);
  assert.match(doc, /provider: "local"/);
  assert.match(doc, /GET \/content\/bootstrap/);
  assert.match(doc, /7 groups \/ 8 sounds/);
  assert.match(doc, /fallback/i);
  assert.match(doc, /Verification Log/);
  assert.match(doc, /rain_night/);
  assert.match(doc, /未具备真实抖音云.*dev.*环境/i);
  assert.match(doc, /不进行 fake 接入验收/i);
  assert.match(doc, /当前验收以 local\/http 回退与兼容性测试为准/i);
});
