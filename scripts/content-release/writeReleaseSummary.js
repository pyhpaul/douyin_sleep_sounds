const fs = require("node:fs");
const path = require("node:path");
const { appendReleaseLog } = require("./appendReleaseLog");

function writeReleaseSummary({ bundle, result }) {
  if (!bundle || !bundle.bundleDir) {
    throw new Error("bundle.bundleDir is required");
  }

  if (!bundle.releaseId) {
    throw new Error("bundle.releaseId is required");
  }

  const summary = {
    ok: Boolean(result && result.ok),
    dryRun: Boolean(result && result.dryRun),
    releaseId: bundle.releaseId,
    envName: result && result.envName ? result.envName : "",
    assetMode: result && result.assetMode ? result.assetMode : "",
    contentVersion:
      bundle && bundle.manifest && bundle.manifest.contentVersion
        ? bundle.manifest.contentVersion
        : "",
    bundleDir: bundle.bundleDir,
    backupDir: result && result.backupDir ? result.backupDir : "",
    publicBaseUrl: result && result.publicBaseUrl ? result.publicBaseUrl : "",
    verifiedAt: result && result.verifiedAt ? result.verifiedAt : "",
    verificationTargets:
      result && Array.isArray(result.verificationTargets) ? result.verificationTargets : []
  };

  const summaryPath = path.join(bundle.bundleDir, "release-summary.json");
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  appendReleaseLog({
    bundleDir: bundle.bundleDir,
    summary
  });
  return summaryPath;
}

module.exports = {
  writeReleaseSummary
};
