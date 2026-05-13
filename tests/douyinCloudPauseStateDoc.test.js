const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

test("douyin cloud pause-state spec records the environment gate and old worktree disposition", () => {
  const filePath = "docs/superpowers/specs/2026-05-13-douyin-cloud-pause-state.md";
  assert.equal(fs.existsSync(filePath), true, `${filePath} should exist`);

  const doc = fs.readFileSync(filePath, "utf8");

  assert.match(doc, /真实抖音云 `dev` 环境/);
  assert.match(doc, /不进行 fake 接入验收/);
  assert.match(doc, /当前正式验收主链路仍是 `http`/);
  assert.match(doc, /task\/douyin-cloud-content-backend/);
  assert.match(doc, /不继续基于该 worktree 开发/);
  assert.match(doc, /从当前 `main` 重新开新分支/);
});
