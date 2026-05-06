const { soundGroups: localSoundGroups } = require("../data/sounds");
const { contentSourceConfig } = require("../config/contentSourceConfig");
const cloudContentService = require("./cloudContentService");
const httpContentService = require("./httpContentService");
const { mapBootstrapToSoundGroups } = require("./contentMapper");

function cloneLocalSoundGroups() {
  return localSoundGroups.map((group) => ({
    ...group,
    sounds: group.sounds.map((sound) => ({ ...sound }))
  }));
}

function getRemoteContentService() {
  switch (contentSourceConfig.provider) {
    case "http":
      return httpContentService;
    case "douyinCloud":
      return cloudContentService;
    case "local":
    default:
      return null;
  }
}

function isValidBootstrapPayload(payload) {
  return (
    payload !== null &&
    typeof payload === "object" &&
    !Array.isArray(payload) &&
    Array.isArray(payload.groups)
  );
}

async function getSoundGroups() {
  const remoteContentService = getRemoteContentService();
  if (!remoteContentService) {
    return cloneLocalSoundGroups();
  }

  try {
    const payload = await remoteContentService.getContentBootstrap();
    if (!isValidBootstrapPayload(payload)) {
      console.warn("remote content response is invalid; falling back to local mock");
      return cloneLocalSoundGroups();
    }

    return mapBootstrapToSoundGroups(payload);
  } catch (error) {
    console.warn("remote content fetch failed; falling back to local mock", error);
    return cloneLocalSoundGroups();
  }
}

module.exports = {
  getSoundGroups
};
