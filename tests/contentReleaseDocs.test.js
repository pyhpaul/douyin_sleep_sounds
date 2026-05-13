const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

test("content release docs and env example exist and mention the agent workflow", () => {
  for (const filePath of [
    "deployment/content-release/README.md",
    "deployment/content-release/prod.env.example",
    "deployment/content-release/RUNBOOK.md"
  ]) {
    assert.equal(fs.existsSync(filePath), true, `${filePath} should exist`);
  }

  const readme = fs.readFileSync("deployment/content-release/README.md", "utf8");
  const envExample = fs.readFileSync("deployment/content-release/prod.env.example", "utf8");
  const runbook = fs.readFileSync("deployment/content-release/RUNBOOK.md", "utf8");

  assert.match(readme, /npm run publish:content -- --env prod/);
  assert.match(readme, /RUNBOOK\.md/);
  assert.match(readme, /remote-only/);
  assert.match(readme, /local-assets/);
  assert.match(readme, /rollback/i);
  assert.match(readme, /真机/);
  assert.match(readme, /deployment\/content-release\/prod\.env/);
  assert.match(readme, /artifacts\/content-release/);
  assert.match(readme, /prod-20260513T131117Z/);
  assert.match(readme, /release-summary\.json/);
  assert.match(readme, /release-log\.jsonl/);

  assert.match(envExample, /CONTENT_RELEASE_SSH_HOST=/);
  assert.match(envExample, /CONTENT_RELEASE_PUBLIC_BASE_URL=https:\/\/sleep\.zhenwei1\.cn/);

  assert.match(runbook, /npm run publish:content -- --env prod/);
  assert.match(runbook, /releaseId/);
  assert.match(runbook, /backupDir/);
  assert.match(runbook, /https:\/\/sleep\.zhenwei1\.cn\/content\/bootstrap/);
  assert.match(runbook, /auto-rollback/i);
  assert.match(runbook, /release-summary\.json/);
  assert.match(runbook, /release-log\.jsonl/);
});
