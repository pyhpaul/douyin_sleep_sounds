const { loadRollbackConfig } = require("./loadRollbackConfig");
const { rollbackRelease } = require("./rollbackRelease");
const { verifyRollback } = require("./verifyRollback");

async function runRollback({
  loadConfig = loadRollbackConfig,
  rollback = rollbackRelease,
  verify = verifyRollback,
  logger = console
} = {}) {
  const config = loadConfig();
  const restored = await rollback({ config });
  await verify({ config, restored });

  logger.log(
    JSON.stringify(
      {
        ok: true,
        releaseId: config.releaseId,
        envName: config.envName,
        backupDir: restored.backupDir
      },
      null,
      2
    )
  );
}

if (require.main === module) {
  runRollback().catch((error) => {
    console.error(error && error.stack ? error.stack : String(error));
    process.exit(1);
  });
}

module.exports = {
  runRollback
};
