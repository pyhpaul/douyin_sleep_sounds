const { buildReleaseBundle } = require("./buildReleaseBundle");
const { deployRelease } = require("./deployRelease");
const { loadReleaseConfig } = require("./loadReleaseConfig");
const { prepareRelease } = require("./prepareRelease");
const { printRollbackHint } = require("./printRollbackHint");
const { verifyRelease } = require("./verifyRelease");

async function main() {
  const config = loadReleaseConfig();
  const prepared = await prepareRelease({ config });
  const bundle = buildReleaseBundle({ config, prepared });

  if (config.dryRun) {
    console.log(JSON.stringify({ releaseId: bundle.releaseId, bundleDir: bundle.bundleDir }, null, 2));
    return;
  }

  let deployment;

  try {
    deployment = await deployRelease({ config, bundle });
    await verifyRelease({ config, bundle, deployment });
    console.log(
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
      printRollbackHint({
        config,
        releaseId: bundle.releaseId,
        backupDir: deployment.backupDir
      });
    }
    throw error;
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
});
