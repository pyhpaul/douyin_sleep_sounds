const assert = require("node:assert/strict");
const test = require("node:test");

const { getSoundGroups } = require("../services/soundSourceService");

test("returns three sound groups with six total sounds", () => {
  const groups = getSoundGroups();
  const sounds = groups.flatMap((group) => group.sounds);

  assert.equal(groups.length, 3);
  assert.equal(sounds.length, 6);
  assert.deepEqual(
    groups.map((group) => group.title),
    ["自然", "白噪音", "放松冥想"]
  );
});

test("returns required playback metadata for every sound", () => {
  const sounds = getSoundGroups().flatMap((group) => group.sounds);

  for (const sound of sounds) {
    assert.equal(typeof sound.id, "string");
    assert.equal(typeof sound.title, "string");
    assert.equal(typeof sound.category, "string");
    assert.equal(typeof sound.description, "string");
    assert.equal(typeof sound.url, "string");
    assert.equal(typeof sound.cover, "string");
    assert.match(sound.url, /^https:\/\//);
  }
});

test("uses unique sound ids", () => {
  const soundIds = getSoundGroups().flatMap((group) => group.sounds.map((sound) => sound.id));

  assert.equal(new Set(soundIds).size, soundIds.length);
});

test("returns copies so callers cannot mutate source data", () => {
  const firstRead = getSoundGroups();
  firstRead[0].sounds[0].title = "changed";

  const secondRead = getSoundGroups();
  assert.equal(secondRead[0].sounds[0].title, "雨声");
});
