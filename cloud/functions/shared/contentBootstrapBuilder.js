function sortBySortThenId(items, idField) {
  return [...items].sort((left, right) => {
    const leftSort = Number(left.sort || 0);
    const rightSort = Number(right.sort || 0);

    if (leftSort !== rightSort) {
      return leftSort - rightSort;
    }

    return String(left[idField] || "").localeCompare(String(right[idField] || ""));
  });
}

function toValidGroupIds(candidateIds, validGroupIds) {
  if (!Array.isArray(candidateIds) || validGroupIds.size === 0) {
    return [];
  }

  const seen = new Set();
  const result = [];

  for (const candidateId of candidateIds) {
    if (!validGroupIds.has(candidateId) || seen.has(candidateId)) {
      continue;
    }

    seen.add(candidateId);
    result.push(candidateId);
  }

  return result;
}

function buildContentBootstrapResponse({ groups, sounds, appConfig }) {
  const publishedGroups = sortBySortThenId(
    (groups || []).filter((group) => group.status === "published"),
    "groupId"
  );
  const publishedSounds = sortBySortThenId(
    (sounds || []).filter((sound) => sound.status === "published"),
    "soundId"
  );

  const groupMap = new Map(
    publishedGroups.map((group) => [
      group.groupId,
      {
        id: group.groupId,
        title: group.title,
        subtitle: group.subtitle || "",
        sounds: []
      }
    ])
  );

  for (const sound of publishedSounds) {
    const group = groupMap.get(sound.groupId);
    if (!group) {
      continue;
    }

    group.sounds.push({
      id: sound.soundId,
      title: sound.title,
      category: sound.category || "",
      description: sound.description || "",
      unlockLabel: sound.unlockLabel || "",
      url: sound.audioUrl || "",
      cover: sound.coverUrl || ""
    });
  }

  const resultGroups = publishedGroups
    .map((group) => groupMap.get(group.groupId))
    .filter((group) => group && group.sounds.length > 0);
  const validGroupIds = new Set(resultGroups.map((group) => group.id));
  const featuredGroupIds = toValidGroupIds(
    appConfig && Array.isArray(appConfig.featuredGroupIds) ? appConfig.featuredGroupIds : [],
    validGroupIds
  );
  const defaultGroupId =
    appConfig && validGroupIds.has(appConfig.defaultGroupId)
      ? appConfig.defaultGroupId
      : resultGroups[0]?.id || "";

  return {
    version: appConfig && appConfig.contentVersion ? appConfig.contentVersion : "",
    featuredGroupIds,
    defaultGroupId,
    groups: resultGroups
  };
}

module.exports = {
  buildContentBootstrapResponse
};
