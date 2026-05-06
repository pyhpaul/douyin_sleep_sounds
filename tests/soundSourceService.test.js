const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { MOCK_AUDIO_HOST } = require("../miniprogram/data/sounds");

const configPath = path.resolve(__dirname, "../miniprogram/config/cloudContentConfig.js");
const cloudPath = path.resolve(__dirname, "../miniprogram/services/cloudContentService.js");
const sourcePath = path.resolve(__dirname, "../miniprogram/services/soundSourceService.js");

function loadSoundSourceService({ enabled, cloudResponse, cloudError }) {
  delete require.cache[require.resolve(configPath)];
  delete require.cache[require.resolve(cloudPath)];
  delete require.cache[require.resolve(sourcePath)];

  const { cloudContentConfig } = require(configPath);
  cloudContentConfig.enabled = enabled;

  const cloudService = require(cloudPath);
  cloudService.getContentBootstrap = async () => {
    if (cloudError) {
      throw cloudError;
    }
    return cloudResponse;
  };

  return require(sourcePath);
}

function cleanupSoundSourceModules() {
  delete require.cache[require.resolve(configPath)];
  delete require.cache[require.resolve(cloudPath)];
  delete require.cache[require.resolve(sourcePath)];
  delete global.tt;
}

test.afterEach(() => {
  cleanupSoundSourceModules();
});

test("returns cloned local sounds when cloud is disabled", async () => {
  const service = loadSoundSourceService({ enabled: false });
  const first = await service.getSoundGroups();
  const second = await service.getSoundGroups();

  assert.equal(first[0].title, "自然");
  assert.notEqual(first, second);
  assert.notEqual(first[0], second[0]);
  assert.equal(typeof service.getSoundGroups().then, "function");
});

test("returns mapped cloud sounds when cloud is enabled and fetch succeeds", async () => {
  const service = loadSoundSourceService({
    enabled: true,
    cloudResponse: {
      version: "2026-05-06T16:00:00Z",
      groups: [
        {
          id: "focus",
          title: "专注",
          subtitle: "低干扰环境声。",
          sounds: [
            {
              id: "brown-noise",
              title: "棕噪音",
              category: "专注",
              description: "低频连续噪声。",
              url: "https://cdn.example.com/audio/brown-noise.mp3",
              cover: "https://cdn.example.com/cover/brown-noise.jpg"
            }
          ]
        }
      ]
    }
  });

  const groups = await service.getSoundGroups();

  assert.equal(groups[0].id, "focus");
  assert.equal(groups[0].sounds[0].id, "brown-noise");
  assert.equal(groups[0].sounds[0].category, "专注");
});

test("falls back to local sounds when cloud fetch fails", async () => {
  const service = loadSoundSourceService({
    enabled: true,
    cloudError: new Error("cloud unavailable")
  });

  const groups = await service.getSoundGroups();
  const sounds = groups.flatMap((group) => group.sounds);

  assert.equal(groups[0].id, "nature");
  assert.equal(sounds.length, 6);
});

test("falls back to local sounds when cloud payload is malformed", async () => {
  const service = loadSoundSourceService({
    enabled: true,
    cloudResponse: {
      version: "2026-05-06T16:00:00Z",
      groups: [
        {
          id: "broken",
          title: "损坏分组",
          sounds: [
            {
              id: "missing-url",
              title: "缺链接"
            }
          ]
        }
      ]
    }
  });

  const groups = await service.getSoundGroups();

  assert.equal(groups[0].id, "nature");
  assert.equal(groups.length, 3);
});

test("preserves required playback metadata on local fallback", async () => {
  const service = loadSoundSourceService({
    enabled: true,
    cloudError: new Error("cloud unavailable")
  });
  const sounds = (await service.getSoundGroups()).flatMap((group) => group.sounds);

  assert.equal(MOCK_AUDIO_HOST, "sf1-ttcdn-tos.pstatp.com");

  for (const sound of sounds) {
    assert.equal(typeof sound.id, "string");
    assert.equal(typeof sound.title, "string");
    assert.equal(typeof sound.category, "string");
    assert.equal(typeof sound.description, "string");
    assert.equal(typeof sound.url, "string");
    assert.equal(typeof sound.cover, "string");
    assert.match(sound.url, /^https:\/\//);

    const url = new URL(sound.url);
    assert.equal(url.host, MOCK_AUDIO_HOST);
    assert.equal(url.pathname.endsWith(".mp3"), true);
  }
});
