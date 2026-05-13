const { buildReleaseBundle } = require("./buildReleaseBundle");
const { deployRelease } = require("./deployRelease");
const { loadReleaseConfig } = require("./loadReleaseConfig");
const { prepareRelease } = require("./prepareRelease");
const { printRollbackHint } = require("./printRollbackHint");
const { verifyRelease } = require("./verifyRelease");
const { writeReleaseSummary } = require("./writeReleaseSummary");

function createVerificationTargets(config, bundle) {
  const targets = [`${config.publicBaseUrl}/healthz`, `${config.publicBaseUrl}/content/bootstrap`];
  const coverFile = (bundle.manifest.files || []).find((file) => file.relativePath.startsWith("covers/"));
  const audioFile = (bundle.manifest.files || []).find((file) => file.relativePath.startsWith("audio/"));

  if (coverFile) {
    targets.push(`${config.publicBaseUrl}/${coverFile.relativePath}`);
  }

  if (audioFile) {
    targets.push(`${config.publicBaseUrl}/${audioFile.relativePath}`);
  }

  return targets;
}

async function runPublish({
  loadConfig = loadReleaseConfig,
  prepare = prepareRelease,
  buildBundle = buildReleaseBundle,
  deploy = deployRelease,
  verify = verifyRelease,
  writeSummary = writeReleaseSummary,
  printRollback = printRollbackHint,
  logger = console
} = {}) {
  const config = loadConfig();
  const prepared = await prepare({ config });
  const bundle = buildBundle({ config, prepared });

  if (config.dryRun) {
    writeSummary({
      bundle,
      result: {
        ok: true,
        dryRun: true,
        envName: config.envName,
        assetMode: config.assetMode,
        backupDir: "",
        publicBaseUrl: config.publicBaseUrl,
        verifiedAt: "",
        verificationTargets: createVerificationTargets(config, bundle)
      }
    });
    logger.log(JSON.stringify({ releaseId: bundle.releaseId, bundleDir: bundle.bundleDir }, null, 2));
    return;
  }

  let deployment;

  try {
    deployment = await deploy({ config, bundle });
    await verify({ config, bundle, deployment });
    writeSummary({
      bundle,
      result: {
        ok: true,
        dryRun: false,
        envName: config.envName,
        assetMode: config.assetMode,
        backupDir: deployment.backupDir,
        publicBaseUrl: config.publicBaseUrl,
        verifiedAt: new Date().toISOString(),
        verificationTargets: createVerificationTargets(config, bundle)
      }
    });
    logger.log(
      JSON.stringify(
        {
          ok: true,
          releaseId: bundle.releaseId,
          envName: config.envName,
          assetMode: config.assetMode,
          backupDir: deployment.backupDir
        },
        null,
        2
      )
    );
  } catch (error) {
    if (deployment) {
      printRollback({
        config,
        releaseId: bundle.releaseId,
        backupDir: deployment.backupDir
      });
    }
    throw error;
  }
}

if (require.main === module) {
  runPublish().catch((error) => {
    console.error(error && error.stack ? error.stack : String(error));
    process.exit(1);
  });
}

module.exports = {
  runPublish,
  createVerificationTargets
};
