const fs = require("node:fs");
const path = require("node:path");
const { MongoClient } = require("mongodb");

const seedPath = path.resolve(__dirname, "../seed/content.seed.json");
const databaseName = process.env.SLEEP_SOUNDS_MONGO_DB || "sleep_sounds";
const mongoUri = process.env.SLEEP_SOUNDS_MONGO_URI;
const PLACEHOLDER_CDN_HOST = "cdn.example.com";

if (!mongoUri) {
  throw new Error("SLEEP_SOUNDS_MONGO_URI is required");
}

function assertUniqueIds(items, idField, collectionName) {
  const seen = new Set();

  for (const item of items) {
    const id = item && item[idField];
    if (!id) {
      throw new Error(`${collectionName} entry is missing required field "${idField}"`);
    }

    if (seen.has(id)) {
      throw new Error(`${collectionName} contains duplicate ${idField}: ${id}`);
    }

    seen.add(id);
  }
}

function assertNoPlaceholderCdn(seed) {
  const placeholderSound = (seed.sounds || []).find((sound) =>
    [sound.audioUrl, sound.coverUrl].some(
      (value) => typeof value === "string" && value.includes(PLACEHOLDER_CDN_HOST)
    )
  );

  if (placeholderSound) {
    throw new Error(
      `Seed contains placeholder CDN URL for sound "${placeholderSound.soundId}". Replace ${PLACEHOLDER_CDN_HOST} first.`
    );
  }
}

function validateSeed(seed) {
  if (!seed || typeof seed !== "object") {
    throw new Error("Seed file must contain an object");
  }

  if (!seed.appConfig || typeof seed.appConfig !== "object") {
    throw new Error("Seed file is missing appConfig");
  }

  assertUniqueIds(seed.groups || [], "groupId", "groups");
  assertUniqueIds(seed.sounds || [], "soundId", "sounds");
  assertNoPlaceholderCdn(seed);
}

function buildAppConfigUpdate(appConfig) {
  const { _id, ...appConfigWithoutId } = appConfig || {};
  return appConfigWithoutId;
}

async function archiveSeedDrift(database, seed) {
  const groupIds = (seed.groups || []).map((group) => group.groupId);
  const soundIds = (seed.sounds || []).map((sound) => sound.soundId);

  await Promise.all([
    database.collection("sound_groups").updateMany(
      {
        status: "published",
        groupId: { $nin: groupIds }
      },
      {
        $set: { status: "archived" }
      }
    ),
    database.collection("sounds").updateMany(
      {
        status: "published",
        soundId: { $nin: soundIds }
      },
      {
        $set: { status: "archived" }
      }
    )
  ]);
}

async function main() {
  const seed = JSON.parse(fs.readFileSync(seedPath, "utf8"));
  validateSeed(seed);
  const client = await MongoClient.connect(mongoUri);

  try {
    const database = client.db(databaseName);

    await Promise.all(
      seed.groups.map((group) =>
        database.collection("sound_groups").updateOne(
          { groupId: group.groupId },
          { $set: group },
          { upsert: true }
        )
      )
    );

    await Promise.all(
      seed.sounds.map((sound) =>
        database.collection("sounds").updateOne(
          { soundId: sound.soundId },
          { $set: sound },
          { upsert: true }
        )
      )
    );

    await archiveSeedDrift(database, seed);

    await database.collection("app_configs").updateOne(
      { _id: "content-bootstrap" },
      { $set: buildAppConfigUpdate(seed.appConfig) },
      { upsert: true }
    );

    console.log("Seeded Douyin Cloud content collections");
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
