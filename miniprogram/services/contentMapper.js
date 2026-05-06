function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

function assertValidSound(sound, groupId) {
  if (
    !sound ||
    !isNonEmptyString(sound.id) ||
    !isNonEmptyString(sound.title) ||
    !isNonEmptyString(sound.url)
  ) {
    throw new Error(`Invalid cloud content sound in group ${groupId || "unknown"}`);
  }
}

function assertValidGroup(group) {
  if (
    !group ||
    !isNonEmptyString(group.id) ||
    !isNonEmptyString(group.title) ||
    !Array.isArray(group.sounds)
  ) {
    throw new Error("Invalid cloud content group");
  }
}

function mapBootstrapToSoundGroups(payload) {
  const groups = Array.isArray(payload && payload.groups) ? payload.groups : [];

  return groups.map((group) => {
    assertValidGroup(group);

    return {
      id: group.id,
      title: group.title,
      subtitle: group.subtitle || "",
      sounds: group.sounds.map((sound) => {
        assertValidSound(sound, group.id);

        return {
          id: sound.id,
          title: sound.title,
          category: sound.category || "",
          description: sound.description || "",
          url: sound.url,
          cover: sound.cover || ""
        };
      })
    };
  });
}

module.exports = {
  mapBootstrapToSoundGroups
};
