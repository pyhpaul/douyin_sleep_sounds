const { spawnSync } = require("node:child_process");
const fs = require("node:fs");

const files = [
  "miniprogram/app.js",
  "miniprogram/pages/index/index.js",
  "miniprogram/utils/timer.js",
  "miniprogram/utils/playbackState.js",
  "miniprogram/services/soundSourceService.js",
  "scripts/check-syntax.js",
  "scripts/transform-ttss.js",
  "scripts/dev-preview-server.js",
  "scripts/dev-local.js",
  "dev-preview/preview.js"
].filter((file) => fs.existsSync(file));

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], {
    stdio: "inherit"
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

console.log(`checked ${files.length} file(s)`);
