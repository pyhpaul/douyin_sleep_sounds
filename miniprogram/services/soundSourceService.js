const { soundGroups: localSoundGroups } = require("../data/sounds");
const { cloudContentConfig } = require("../config/cloudContentConfig");
const cloudContentService = require("./cloudContentService");
const { mapBootstrapToSoundGroups } = require("./contentMapper");

function cloneLocalSoundGroups() {
  return localSoundGroups.map((group) => ({
    ...group,
    sounds: group.sounds.map((sound) => ({ ...sound }))
  }));
}

function isValidBootstrapPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  if (payload.groups === undefined) {
    return true;
  }

  return Array.isArray(payload.groups);
}

async function getSoundGroups() {
  if (!cloudContentConfig.enabled) {
    return cloneLocalSoundGroups();
  }

  try {
    const payload = await cloudContentService.getContentBootstrap();
    if (!isValidBootstrapPayload(payload)) {
      console.warn("cloud content response is invalid; falling back to local mock");
      return cloneLocalSoundGroups();
    }

    return mapBootstrapToSoundGroups(payload);
  } catch (error) {
    const message = error && error.message ? error.message : error;
    const isResponseProblem =
      typeof message === "string" &&
      (message.includes("Invalid cloud content") || message.includes("response is invalid"));

    console.warn(
      isResponseProblem
        ? "cloud content payload is malformed; falling back to local mock"
        : "cloud content fetch failed; falling back to local mock",
      error
    );
    return cloneLocalSoundGroups();
  }
}

module.exports = {
  getSoundGroups
};
