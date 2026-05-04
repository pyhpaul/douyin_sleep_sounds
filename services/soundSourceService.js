const { soundGroups } = require("../data/sounds");

async function getSoundGroups() {
  return soundGroups.map((group) => ({
    ...group,
    sounds: group.sounds.map((sound) => ({ ...sound }))
  }));
}

module.exports = {
  getSoundGroups
};
