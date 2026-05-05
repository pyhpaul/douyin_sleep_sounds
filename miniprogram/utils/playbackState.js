function flattenSoundGroups(soundGroups) {
  if (!Array.isArray(soundGroups)) {
    return [];
  }

  return soundGroups.reduce((allSounds, group) => {
    const sounds = Array.isArray(group.sounds) ? group.sounds : [];
    return allSounds.concat(sounds);
  }, []);
}

function findSoundById(soundGroups, soundId) {
  if (!soundId) {
    return null;
  }

  return flattenSoundGroups(soundGroups).find((sound) => sound.id === soundId) || null;
}

function selectInitialSoundId(soundGroups, storedSoundId) {
  const storedSound = findSoundById(soundGroups, storedSoundId);
  if (storedSound) {
    return storedSound.id;
  }

  const firstSound = flattenSoundGroups(soundGroups)[0];
  return firstSound ? firstSound.id : "";
}

function selectSoundId(soundGroups, requestedSoundId, currentSoundId) {
  const requestedSound = findSoundById(soundGroups, requestedSoundId);
  if (requestedSound) {
    return requestedSound.id;
  }

  const currentSound = findSoundById(soundGroups, currentSoundId);
  if (currentSound) {
    return currentSound.id;
  }

  return selectInitialSoundId(soundGroups, "");
}

function isCurrentSound(soundId, currentSoundId) {
  return Boolean(soundId) && soundId === currentSoundId;
}

function getCurrentSound(soundGroups, currentSoundId) {
  return findSoundById(soundGroups, currentSoundId);
}

function buildSoundGroupsViewModel(soundGroups, currentSoundId) {
  if (!Array.isArray(soundGroups)) {
    return [];
  }

  return soundGroups.map((group) => ({
    ...group,
    sounds: Array.isArray(group.sounds)
      ? group.sounds.map((sound) => ({
          ...sound,
          isActive: isCurrentSound(sound.id, currentSoundId)
        }))
      : []
  }));
}

module.exports = {
  flattenSoundGroups,
  findSoundById,
  selectInitialSoundId,
  selectSoundId,
  isCurrentSound,
  getCurrentSound,
  buildSoundGroupsViewModel
};
