const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildLocalSoundsModule,
  buildCloudSeed
} = require("../content/catalogAdapter");

const fixtureCatalog = {
  version: "2026-05-06T00:00:00Z",
  defaultGroupId: "rain",
  featuredGroupIds: ["rain", "ambient"],
  groups: [
    {
      id: "rain",
      title: "雨声",
      subtitle: "细密雨声，适合放松和屏蔽环境噪声。",
      sort: 10
    },
    {
      id: "ambient",
      title: "环境",
      subtitle: "轻柔背景音，适合专注和入睡。",
      sort: 20
    }
  ],
  sounds: [
    {
      id: "rain_night",
      groupId: "rain",
      title: "夜雨",
      category: "自然",
      description: "细密雨声，适合放松和屏蔽环境噪声。",
      unlockLabel: "免费",
      audioAssetKey: "audio/rain_night.mp3",
      coverAssetKey: "covers/rain_night.jpg",
      sort: 10
    },
    {
      id: "deep_ambient",
      groupId: "ambient",
      title: "深度环境音",
      category: "环境",
      description: "低频、平稳、适合冥想和专注。",
      unlockLabel: "免费",
      audioAssetKey: "audio/deep_ambient.mp3",
      coverAssetKey: "covers/deep_ambient.jpg",
      sort: 20
    }
  ]
};

test("buildLocalSoundsModule keeps the current local catalog contract", () => {
  const localModule = buildLocalSoundsModule(fixtureCatalog);

  assert.equal(localModule.MOCK_AUDIO_HOST, "sf1-ttcdn-tos.pstatp.com");
  assert.equal(localModule.COVER_BASE_PATH, "../../debug/covers");
  assert.equal(localModule.soundGroups.length, 2);
  assert.equal(localModule.soundGroups[0].thumbnail, "../../debug/covers/rain_night.jpg");
  assert.equal(localModule.soundGroups[0].sounds[0].unlockLabel, "免费");
  assert.match(localModule.soundGroups[0].sounds[0].url, /^https:\/\//);
});

test("buildCloudSeed maps the catalog into the cloud seed shape", () => {
  const seed = buildCloudSeed(fixtureCatalog, {
    cdnBaseUrl: "https://cdn.sleep.test"
  });

  assert.equal(seed.appConfig.defaultGroupId, "rain");
  assert.deepEqual(seed.appConfig.featuredGroupIds, ["rain", "ambient"]);
  assert.equal(seed.groups[0].groupId, "rain");
  assert.equal(seed.sounds[0].soundId, "rain_night");
  assert.equal(seed.sounds[0].unlockLabel, "免费");
  assert.equal(
    seed.sounds[0].audioUrl,
    "https://cdn.sleep.test/sleep-sounds/audio/rain_night.mp3"
  );
});
