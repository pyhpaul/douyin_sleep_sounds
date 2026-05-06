const { spawnSync } = require("node:child_process");
const fs = require("node:fs");

const files = [
  "miniprogram/app.js",
  "miniprogram/pages/index/index.js",
  "miniprogram/utils/timer.js",
  "miniprogram/utils/playbackState.js",
  "miniprogram/config/contentSourceConfig.js",
  "miniprogram/config/cloudContentConfig.js",
  "miniprogram/services/contentMapper.js",
  "miniprogram/services/cloudContentService.js",
  "miniprogram/services/httpContentService.js",
  "miniprogram/services/soundSourceService.js",
  "content/catalogAdapter.js",
  "server/createVmContentServer.js",
  "server/index.js",
  "cloud/functions/shared/contentBootstrapBuilder.js",
  "cloud/functions/shared/contentRepository.js",
  "cloud/functions/contentBootstrap/index.js",
  "cloud/scripts/seedContent.js",
  "scripts/sync-content-artifacts.js",
  "scripts/check-syntax.js"
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
