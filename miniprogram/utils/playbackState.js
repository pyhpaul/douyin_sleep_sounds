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

function findSoundGroupById(soundGroups, groupId) {
  if (!Array.isArray(soundGroups) || !groupId) {
    return null;
  }

  return soundGroups.find((group) => group.id === groupId) || null;
}

function findSoundGroupBySoundId(soundGroups, soundId) {
  if (!Array.isArray(soundGroups) || !soundId) {
    return null;
  }

  return soundGroups.find((group) => {
    const sounds = Array.isArray(group.sounds) ? group.sounds : [];
    return sounds.some((sound) => sound.id === soundId);
  }) || null;
}

function findSoundGroupIdBySoundId(soundGroups, soundId) {
  const group = findSoundGroupBySoundId(soundGroups, soundId);
  return group ? group.id : "";
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

function selectGroupId(soundGroups, requestedGroupId, currentSoundId) {
  const requestedGroup = findSoundGroupById(soundGroups, requestedGroupId);
  if (requestedGroup) {
    return requestedGroup.id;
  }

  const currentSoundGroupId = findSoundGroupIdBySoundId(soundGroups, currentSoundId);
  if (currentSoundGroupId) {
    return currentSoundGroupId;
  }

  const firstGroup = Array.isArray(soundGroups) ? soundGroups[0] : null;
  return firstGroup ? firstGroup.id : "";
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

function buildSoundGroupTabsViewModel(soundGroups, activeGroupId) {
  if (!Array.isArray(soundGroups)) {
    return [];
  }

  return soundGroups.map((group) => ({
    id: group.id,
    title: group.title,
    isActive: group.id === activeGroupId
  }));
}

function getActiveSoundGroupViewModel(soundGroups, activeGroupId, currentSoundId) {
  const group = findSoundGroupById(soundGroups, activeGroupId);
  if (!group) {
    return {
      id: "",
      title: "",
      subtitle: "",
      sounds: []
    };
  }

  return {
    ...group,
    sounds: Array.isArray(group.sounds)
      ? group.sounds.map((sound) => ({
          ...sound,
          isActive: isCurrentSound(sound.id, currentSoundId)
        }))
      : []
  };
}

module.exports = {
  flattenSoundGroups,
  findSoundById,
  selectInitialSoundId,
  selectSoundId,
  findSoundGroupIdBySoundId,
  selectGroupId,
  isCurrentSound,
  getCurrentSound,
  buildSoundGroupsViewModel,
  buildSoundGroupTabsViewModel,
  getActiveSoundGroupViewModel
};
