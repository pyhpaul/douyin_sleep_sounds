const path = require("node:path");
const { archiveReleaseRecord } = require("./archiveReleaseRecord");

function parseArchiveArgs(args) {
  const result = {};

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--release-id") {
      result.releaseId = args[index + 1] || "";
      index += 1;
    }
  }

  return result;
}

function loadArchiveConfig({ args = process.argv.slice(2) } = {}) {
  const parsed = parseArchiveArgs(args);

  if (!parsed.releaseId) {
    throw new Error("Missing required archive argument: --release-id");
  }

  return {
    releaseId: parsed.releaseId,
    runtimeLogPath: path.resolve("artifacts/content-release/release-log.jsonl"),
    archivePath: path.resolve("deployment/content-release/archive.jsonl")
  };
}

async function runArchive({
  loadConfig = loadArchiveConfig,
  archive = archiveReleaseRecord,
  logger = console
} = {}) {
  const config = loadConfig();
  const result = archive(config);

  logger.log(
    JSON.stringify(
      {
        ok: true,
        releaseId: result.releaseId,
        archivePath: result.archivePath
      },
      null,
      2
    )
  );
}

if (require.main === module) {
  runArchive().catch((error) => {
    console.error(error && error.stack ? error.stack : String(error));
    process.exit(1);
  });
}

module.exports = {
  loadArchiveConfig,
  runArchive
};
