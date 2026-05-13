const fs = require("node:fs");
const path = require("node:path");

function appendReleaseLog({ bundleDir, summary }) {
  if (!bundleDir) {
    throw new Error("bundleDir is required");
  }

  const releaseRoot = path.dirname(bundleDir);
  fs.mkdirSync(releaseRoot, { recursive: true });

  const logPath = path.join(releaseRoot, "release-log.jsonl");
  fs.appendFileSync(logPath, `${JSON.stringify(summary)}\n`);
  return logPath;
}

module.exports = {
  appendReleaseLog
};
