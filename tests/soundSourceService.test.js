const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { MOCK_AUDIO_HOST } = require("../miniprogram/data/sounds");

const configPath = path.resolve(__dirname, "../miniprogram/config/contentSourceConfig.js");
const httpPath = path.resolve(__dirname, "../miniprogram/services/httpContentService.js");
const cloudPath = path.resolve(__dirname, "../miniprogram/services/cloudContentService.js");
const sourcePath = path.resolve(__dirname, "../miniprogram/services/soundSourceService.js");

function clearModule(modulePath) {
  try {
    delete require.cache[require.resolve(modulePath)];
  } catch {}
}

function loadSoundSourceService({ provider, httpResponse, httpError, cloudResponse, cloudError }) {
  clearModule(configPath);
  clearModule(httpPath);
  clearModule(cloudPath);
  clearModule(sourcePath);

  const { contentSourceConfig } = require(configPath);
  contentSourceConfig.provider = provider;

  const httpService = require(httpPath);
  httpService.getContentBootstrap = async () => {
    if (httpError) {
      throw httpError;
    }
    return httpResponse;
  };

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
  clearModule(configPath);
  clearModule(httpPath);
  clearModule(cloudPath);
  clearModule(sourcePath);
  delete global.tt;
}

test.afterEach(() => {
  cleanupSoundSourceModules();
});

test("returns cloned local sounds when provider is local", async () => {
  const service = loadSoundSourceService({ provider: "local" });
  const first = await service.getSoundGroups();
  const second = await service.getSoundGroups();

  assert.equal(first[0].title, "雨声");
  assert.equal(first.length, 7);
  assert.equal(first.flatMap((group) => group.sounds).length, 8);
  assert.equal(first[0].thumbnail, "../../debug/covers/rain_night.jpg");
  assert.notEqual(first, second);
  assert.notEqual(first[0], second[0]);
  assert.equal(typeof service.getSoundGroups().then, "function");
});

test("returns mapped HTTP sounds when provider is http", async () => {
  const service = loadSoundSourceService({
    provider: "http",
    httpResponse: {
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
              unlockLabel: "免费",
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
  assert.equal(groups[0].sounds[0].unlockLabel, "免费");
});

test("returns mapped cloud sounds when provider is douyinCloud", async () => {
  const service = loadSoundSourceService({
    provider: "douyinCloud",
    cloudResponse: {
      version: "2026-05-06T16:00:00Z",
      groups: [
        {
          id: "meditation",
          title: "冥想",
          subtitle: "适合放松呼吸。",
          sounds: [
            {
              id: "breathing-space",
              title: "呼吸空间",
              category: "冥想",
              description: "平稳的冥想背景声。",
              unlockLabel: "免费",
              url: "https://cdn.example.com/audio/breathing-space.mp3",
              cover: "https://cdn.example.com/cover/breathing-space.jpg"
            }
          ]
        }
      ]
    }
  });

  const groups = await service.getSoundGroups();

  assert.equal(groups[0].id, "meditation");
  assert.equal(groups[0].sounds[0].unlockLabel, "免费");
});

test("falls back to local sounds when remote provider fetch fails", async () => {
  const service = loadSoundSourceService({
    provider: "http",
    httpError: new Error("http unavailable")
  });

  const groups = await service.getSoundGroups();
  const sounds = groups.flatMap((group) => group.sounds);

  assert.equal(groups[0].id, "rain");
  assert.equal(sounds.length, 8);
});

test("falls back to local sounds when bootstrap payload is malformed", async () => {
  const service = loadSoundSourceService({
    provider: "douyinCloud",
    cloudResponse: {
      version: "2026-05-06T16:00:00Z"
    }
  });

  const groups = await service.getSoundGroups();

  assert.equal(groups[0].id, "rain");
  assert.equal(groups.length, 7);
});

test("preserves required playback metadata on local fallback", async () => {
  const service = loadSoundSourceService({
    provider: "douyinCloud",
    cloudError: new Error("cloud unavailable")
  });
  const sounds = (await service.getSoundGroups()).flatMap((group) => group.sounds);

  assert.equal(MOCK_AUDIO_HOST, "sf1-ttcdn-tos.pstatp.com");

  for (const sound of sounds) {
    assert.equal(typeof sound.id, "string");
    assert.equal(typeof sound.title, "string");
    assert.equal(typeof sound.category, "string");
    assert.equal(typeof sound.description, "string");
    assert.equal(typeof sound.unlockLabel, "string");
    assert.equal(typeof sound.url, "string");
    assert.equal(typeof sound.cover, "string");
    assert.match(sound.url, /^https:\/\//);

    const url = new URL(sound.url);
    assert.equal(url.host, MOCK_AUDIO_HOST);
    assert.equal(url.pathname.endsWith(".mp3"), true);
  }
});
