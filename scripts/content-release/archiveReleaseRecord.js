const fs = require("node:fs");

function readJsonLines(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const raw = fs.readFileSync(filePath, "utf8").trim();
  if (!raw) {
    return [];
  }

  return raw
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function archiveReleaseRecord({ releaseId, runtimeLogPath, archivePath }) {
  if (!releaseId) {
    throw new Error("releaseId is required");
  }

  const runtimeRecords = readJsonLines(runtimeLogPath);
  const archiveRecords = readJsonLines(archivePath);
  const matchedRecord = runtimeRecords.find((record) => record.releaseId === releaseId);

  if (!matchedRecord) {
    throw new Error(`Release record not found in runtime log: ${releaseId}`);
  }

  if (archiveRecords.some((record) => record.releaseId === releaseId)) {
    throw new Error(`Release record already archived: ${releaseId}`);
  }

  fs.appendFileSync(archivePath, `${JSON.stringify(matchedRecord)}\n`);

  return {
    releaseId,
    archivePath
  };
}

module.exports = {
  archiveReleaseRecord
};
