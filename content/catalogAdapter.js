const MOCK_AUDIO_HOST = "sf1-ttcdn-tos.pstatp.com";
const DEMO_AUDIO_URL = `https://${MOCK_AUDIO_HOST}/obj/developer/sdk/0000-0001.mp3`;
const COVER_BASE_PATH = "../../debug/covers";
const DEFAULT_CLOUD_CDN_BASE_URL = "https://cdn.example.com";

function sortBySortThenId(items, idField) {
  return [...(Array.isArray(items) ? items : [])].sort((left, right) => {
    const leftSort = Number(left && left.sort ? left.sort : 0);
    const rightSort = Number(right && right.sort ? right.sort : 0);

    if (leftSort !== rightSort) {
      return leftSort - rightSort;
    }

    return String((left && left[idField]) || "").localeCompare(String((right && right[idField]) || ""));
  });
}

function normalizeCatalog(catalog) {
  return {
    version: catalog && catalog.version ? catalog.version : "",
    defaultGroupId: catalog && catalog.defaultGroupId ? catalog.defaultGroupId : "",
    featuredGroupIds:
      catalog && Array.isArray(catalog.featuredGroupIds) ? [...catalog.featuredGroupIds] : [],
    groups: sortBySortThenId(catalog && catalog.groups, "id"),
    sounds: sortBySortThenId(catalog && catalog.sounds, "id")
  };
}

function getLocalCoverPath(soundId) {
  return `${COVER_BASE_PATH}/${soundId}.jpg`;
}

function buildLocalSoundsModule(catalog) {
  const normalized = normalizeCatalog(catalog);
  const soundsByGroupId = new Map();

  for (const sound of normalized.sounds) {
    const groupSounds = soundsByGroupId.get(sound.groupId) || [];
    groupSounds.push({
      id: sound.id,
      title: sound.title || "",
      category: sound.category || "",
      description: sound.description || "",
      unlockLabel: sound.unlockLabel || "",
      url: DEMO_AUDIO_URL,
      cover: getLocalCoverPath(sound.id)
    });
    soundsByGroupId.set(sound.groupId, groupSounds);
  }

  const soundGroups = normalized.groups
    .map((group) => {
      const sounds = soundsByGroupId.get(group.id) || [];

      return {
        id: group.id,
        title: group.title || "",
        subtitle: group.subtitle || "",
        thumbnail: sounds[0] ? sounds[0].cover : "",
        sounds
      };
    })
    .filter((group) => group.sounds.length > 0);

  return {
    MOCK_AUDIO_HOST,
    COVER_BASE_PATH,
    soundGroups
  };
}

function trimTrailingSlashes(value) {
  return String(value || "").replace(/\/+$/, "");
}

function buildAssetUrl(baseUrl, assetKey) {
  return `${trimTrailingSlashes(baseUrl)}/${String(assetKey || "").replace(/^\/+/, "")}`;
}

function buildPublishedContentDocuments(catalog, options = {}) {
  const normalized = normalizeCatalog(catalog);
  const resolveAudioUrl =
    typeof options.resolveAudioUrl === "function" ? options.resolveAudioUrl : () => DEMO_AUDIO_URL;
  const resolveCoverUrl =
    typeof options.resolveCoverUrl === "function"
      ? options.resolveCoverUrl
      : (sound) => getLocalCoverPath(sound.id);

  const groups = normalized.groups.map((group) => ({
    groupId: group.id,
    title: group.title || "",
    subtitle: group.subtitle || "",
    sort: Number(group.sort || 0),
    status: "published"
  }));

  const sounds = normalized.sounds.map((sound) => ({
    soundId: sound.id,
    groupId: sound.groupId || "",
    title: sound.title || "",
    category: sound.category || "",
    description: sound.description || "",
    unlockLabel: sound.unlockLabel || "",
    audioAssetKey: sound.audioAssetKey || "",
    audioUrl: resolveAudioUrl(sound, normalized),
    coverAssetKey: sound.coverAssetKey || "",
    coverUrl: resolveCoverUrl(sound, normalized),
    durationSec: Number(sound.durationSec || 0),
    tags: Array.isArray(sound.tags) ? [...sound.tags] : [],
    sort: Number(sound.sort || 0),
    status: "published"
  }));

  return {
    groups,
    sounds,
    appConfig: {
      featuredGroupIds: normalized.featuredGroupIds,
      defaultGroupId: normalized.defaultGroupId,
      contentVersion: normalized.version
    }
  };
}

function buildCloudSeed(catalog, { cdnBaseUrl = DEFAULT_CLOUD_CDN_BASE_URL } = {}) {
  const documents = buildPublishedContentDocuments(catalog, {
    resolveAudioUrl: (sound) => buildAssetUrl(cdnBaseUrl, sound.audioAssetKey),
    resolveCoverUrl: (sound) => buildAssetUrl(cdnBaseUrl, sound.coverAssetKey)
  });

  return {
    appConfig: {
      _id: "content-bootstrap",
      ...documents.appConfig
    },
    groups: documents.groups,
    sounds: documents.sounds
  };
}

module.exports = {
  MOCK_AUDIO_HOST,
  DEMO_AUDIO_URL,
  COVER_BASE_PATH,
  DEFAULT_CLOUD_CDN_BASE_URL,
  getLocalCoverPath,
  buildLocalSoundsModule,
  buildCloudSeed,
  buildPublishedContentDocuments
};
