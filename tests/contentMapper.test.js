const assert = require("node:assert/strict");
const test = require("node:test");

const { mapBootstrapToSoundGroups } = require("../miniprogram/services/contentMapper");

test("maps bootstrap payload into current soundGroups shape", () => {
  const groups = mapBootstrapToSoundGroups({
    version: "2026-05-06T16:00:00Z",
    groups: [
      {
        id: "nature",
        title: "自然",
        subtitle: "把自然声放慢，留给入睡前的几分钟。",
        sounds: [
          {
            id: "rain",
            title: "雨声",
            category: "自然",
            description: "细密雨声，适合放松和屏蔽环境噪声。",
            url: "https://cdn.example.com/audio/rain.mp3",
            cover: "https://cdn.example.com/cover/rain.jpg"
          }
        ]
      }
    ]
  });

  assert.deepEqual(groups, [
    {
      id: "nature",
      title: "自然",
      subtitle: "把自然声放慢，留给入睡前的几分钟。",
      sounds: [
        {
          id: "rain",
          title: "雨声",
          category: "自然",
          description: "细密雨声，适合放松和屏蔽环境噪声。",
          url: "https://cdn.example.com/audio/rain.mp3",
          cover: "https://cdn.example.com/cover/rain.jpg"
        }
      ]
    }
  ]);
});

test("returns an empty list when payload does not contain groups", () => {
  assert.deepEqual(mapBootstrapToSoundGroups({ version: "2026-05-06T16:00:00Z" }), []);
  assert.deepEqual(mapBootstrapToSoundGroups(null), []);
});

test("throws when a group is missing required fields", () => {
  assert.throws(
    () =>
      mapBootstrapToSoundGroups({
        groups: [
          {
            title: "自然",
            sounds: []
          }
        ]
      }),
    /Invalid cloud content group/
  );
});

test("throws when a sound is missing required fields", () => {
  assert.throws(
    () =>
      mapBootstrapToSoundGroups({
        groups: [
          {
            id: "nature",
            title: "自然",
            sounds: [
              {
                id: "rain",
                title: "雨声"
              }
            ]
          }
        ]
      }),
    /Invalid cloud content sound/
  );
});
