const assert = require("node:assert/strict");
const test = require("node:test");

const { MOCK_AUDIO_HOST } = require("../data/sounds");
const { getSoundGroups } = require("../services/soundSourceService");

test("returns three sound groups with six total sounds", async () => {
  const groupsResult = getSoundGroups();
  assert.equal(typeof groupsResult.then, "function");

  const groups = await groupsResult;
  const sounds = groups.flatMap((group) => group.sounds);

  assert.equal(groups.length, 3);
  assert.equal(sounds.length, 6);
  assert.deepEqual(
    groups.map((group) => group.title),
    ["自然", "白噪音", "放松冥想"]
  );
});

test("returns required playback metadata for every sound", async () => {
  const sounds = (await getSoundGroups()).flatMap((group) => group.sounds);

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

test("uses mock mp3 urls from the allowed host", async () => {
  const sounds = (await getSoundGroups()).flatMap((group) => group.sounds);

  assert.equal(MOCK_AUDIO_HOST, "sf1-ttcdn-tos.pstatp.com");

  for (const sound of sounds) {
    const url = new URL(sound.url);

    assert.equal(url.host, MOCK_AUDIO_HOST);
    assert.equal(url.pathname.endsWith(".mp3"), true);
  }
});

test("uses unique sound ids", async () => {
  const soundIds = (await getSoundGroups()).flatMap((group) => group.sounds.map((sound) => sound.id));

  assert.equal(new Set(soundIds).size, soundIds.length);
});

test("returns copies so callers cannot mutate source data", async () => {
  const firstRead = await getSoundGroups();
  firstRead[0].sounds[0].title = "changed";

  const secondRead = await getSoundGroups();
  assert.equal(secondRead[0].sounds[0].title, "雨声");
});
