const assert = require("node:assert/strict");
const test = require("node:test");

const {
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
} = require("../miniprogram/utils/playbackState");

const soundGroups = [
  {
    id: "nature",
    title: "自然",
    thumbnail: "nature.jpg",
    sounds: [
      { id: "rain", title: "雨声", category: "自然", cover: "rain.jpg" },
      { id: "wave", title: "海浪", category: "自然", cover: "wave.jpg" }
    ]
  },
  {
    id: "white-noise",
    title: "白噪音",
    thumbnail: "",
    sounds: [
      { id: "fire", title: "篝火", category: "白噪音", cover: "fire.jpg" }
    ]
  }
];

test("flattens grouped sounds while preserving order", () => {
  assert.deepEqual(
    flattenSoundGroups(soundGroups).map((sound) => sound.id),
    ["rain", "wave", "fire"]
  );
});

test("finds a sound by id across all groups", () => {
  assert.equal(findSoundById(soundGroups, "wave").title, "海浪");
  assert.equal(findSoundById(soundGroups, "missing"), null);
});

test("selects stored sound when it exists", () => {
  assert.equal(selectInitialSoundId(soundGroups, "wave"), "wave");
});

test("falls back to first sound when stored sound is missing", () => {
  assert.equal(selectInitialSoundId(soundGroups, "missing"), "rain");
});

test("returns empty selection for empty groups", () => {
  assert.equal(selectInitialSoundId([], "rain"), "");
  assert.equal(selectInitialSoundId(null, "rain"), "");
});

test("selects requested sound or keeps current sound when requested id is invalid", () => {
  assert.equal(selectSoundId(soundGroups, "fire", "rain"), "fire");
  assert.equal(selectSoundId(soundGroups, "missing", "wave"), "wave");
});

test("falls back to first sound when requested and current ids are invalid", () => {
  assert.equal(selectSoundId(soundGroups, "missing", "also-missing"), "rain");
});

test("detects whether a sound is current", () => {
  assert.equal(isCurrentSound("rain", "rain"), true);
  assert.equal(isCurrentSound("rain", "wave"), false);
  assert.equal(isCurrentSound("", "wave"), false);
});

test("returns the current sound object", () => {
  assert.equal(getCurrentSound(soundGroups, "fire").title, "篝火");
  assert.equal(getCurrentSound(soundGroups, "missing"), null);
});

test("builds a view model with selected and playing flags without mutating input", () => {
  const viewGroups = buildSoundGroupsViewModel(soundGroups, "wave", "rain", true);

  assert.equal(viewGroups[0].sounds[0].isActive, false);
  assert.equal(viewGroups[0].sounds[0].isPlayingItem, true);
  assert.equal(viewGroups[0].sounds[1].isActive, true);
  assert.equal(viewGroups[0].sounds[1].isPlayingItem, false);
  assert.equal(soundGroups[0].sounds[1].isActive, undefined);
  assert.equal(soundGroups[0].sounds[0].isPlayingItem, undefined);
  assert.notEqual(viewGroups, soundGroups);
});

test("finds the group id for a sound", () => {
  assert.equal(findSoundGroupIdBySoundId(soundGroups, "fire"), "white-noise");
  assert.equal(findSoundGroupIdBySoundId(soundGroups, "missing"), "");
});

test("selects requested group or falls back to current sound group then first group", () => {
  assert.equal(selectGroupId(soundGroups, "white-noise", "rain"), "white-noise");
  assert.equal(selectGroupId(soundGroups, "missing", "fire"), "white-noise");
  assert.equal(selectGroupId(soundGroups, "missing", "missing"), "nature");
  assert.equal(selectGroupId([], "missing", "missing"), "");
});

test("builds active group tabs without mutating input", () => {
  const tabs = buildSoundGroupTabsViewModel(soundGroups, "white-noise");

  assert.deepEqual(tabs, [
    { id: "nature", title: "自然", thumbnail: "nature.jpg", isActive: false },
    { id: "white-noise", title: "白噪音", thumbnail: "fire.jpg", isActive: true }
  ]);
  assert.equal(soundGroups[1].isActive, undefined);
});

test("returns active sound group view model with selected and playing flags", () => {
  const activeGroup = getActiveSoundGroupViewModel(soundGroups, "nature", "wave", "rain", true);

  assert.equal(activeGroup.id, "nature");
  assert.equal(activeGroup.sounds[0].isActive, false);
  assert.equal(activeGroup.sounds[0].isPlayingItem, true);
  assert.equal(activeGroup.sounds[1].isActive, true);
  assert.equal(activeGroup.sounds[1].isPlayingItem, false);
  assert.notEqual(activeGroup, soundGroups[0]);
});
