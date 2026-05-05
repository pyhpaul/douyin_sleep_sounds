const assert = require("node:assert/strict");
const test = require("node:test");

const {
  flattenSoundGroups,
  findSoundById,
  selectInitialSoundId,
  selectSoundId,
  isCurrentSound,
  getCurrentSound,
  buildSoundGroupsViewModel
} = require("../miniprogram/utils/playbackState");

const soundGroups = [
  {
    id: "nature",
    title: "自然",
    sounds: [
      { id: "rain", title: "雨声", category: "自然" },
      { id: "wave", title: "海浪", category: "自然" }
    ]
  },
  {
    id: "white-noise",
    title: "白噪音",
    sounds: [
      { id: "fire", title: "篝火", category: "白噪音" }
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

test("builds a view model with active sound flags without mutating input", () => {
  const viewGroups = buildSoundGroupsViewModel(soundGroups, "wave");

  assert.equal(viewGroups[0].sounds[0].isActive, false);
  assert.equal(viewGroups[0].sounds[1].isActive, true);
  assert.equal(soundGroups[0].sounds[1].isActive, undefined);
  assert.notEqual(viewGroups, soundGroups);
});
