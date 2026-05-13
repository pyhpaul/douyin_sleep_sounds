const { MongoClient } = require("mongodb");

const DATABASE_NAME = process.env.SLEEP_SOUNDS_MONGO_DB || "sleep_sounds";
let clientPromise = null;

function getMongoUri() {
  const mongoUri = process.env.SLEEP_SOUNDS_MONGO_URI;

  if (!mongoUri) {
    throw new Error("SLEEP_SOUNDS_MONGO_URI is required");
  }

  return mongoUri;
}

async function getDatabase() {
  if (!clientPromise) {
    clientPromise = MongoClient.connect(getMongoUri(), {
      maxPoolSize: 5
    });
  }

  let client;

  try {
    client = await clientPromise;
  } catch (error) {
    clientPromise = null;
    throw error;
  }

  return client.db(DATABASE_NAME);
}

async function getPublishedContentDocuments() {
  const database = await getDatabase();

  const [groups, sounds, appConfig] = await Promise.all([
    database.collection("sound_groups").find({ status: "published" }).toArray(),
    database.collection("sounds").find({ status: "published" }).toArray(),
    database.collection("app_configs").findOne({ _id: "content-bootstrap" })
  ]);

  return {
    groups,
    sounds,
    appConfig: appConfig || {}
  };
}

module.exports = {
  getPublishedContentDocuments,
  getMongoUri
};
