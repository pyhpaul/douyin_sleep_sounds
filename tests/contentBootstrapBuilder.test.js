const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildContentBootstrapResponse
} = require("../cloud/functions/shared/contentBootstrapBuilder");

test("groups published sounds under published groups and sorts by sort ascending", () => {
  const response = buildContentBootstrapResponse({
    groups: [
      {
        groupId: "white-noise",
        title: "白噪音",
        subtitle: "持续、柔和、低干扰的背景声音。",
        sort: 20,
        status: "published"
      },
      {
        groupId: "nature",
        title: "自然",
        subtitle: "把自然声放慢，留给入睡前的几分钟。",
        sort: 10,
        status: "published"
      }
    ],
    sounds: [
      {
        soundId: "rain",
        groupId: "nature",
        title: "雨声",
        category: "自然",
        description: "细密雨声，适合放松和屏蔽环境噪声。",
        unlockLabel: "免费",
        audioUrl: "https://cdn.example.com/audio/rain.mp3",
        coverUrl: "https://cdn.example.com/cover/rain.jpg",
        sort: 10,
        status: "published"
      },
      {
        soundId: "wave",
        groupId: "nature",
        title: "海浪",
        category: "自然",
        description: "轻缓海浪声，适合睡前稳定呼吸节奏。",
        unlockLabel: "免费",
        audioUrl: "https://cdn.example.com/audio/wave.mp3",
        coverUrl: "https://cdn.example.com/cover/wave.jpg",
        sort: 20,
        status: "published"
      }
    ],
    appConfig: {
      featuredGroupIds: ["nature"],
      defaultGroupId: "nature",
      contentVersion: "2026-05-06T16:00:00Z"
    }
  });

  assert.equal(response.version, "2026-05-06T16:00:00Z");
  assert.deepEqual(
    response.groups.map((group) => group.id),
    ["nature"]
  );
  assert.deepEqual(
    response.groups[0].sounds.map((sound) => sound.id),
    ["rain", "wave"]
  );
  assert.equal(response.groups[0].sounds[0].unlockLabel, "免费");
  assert.equal(response.groups[0].sounds[0].url, "https://cdn.example.com/audio/rain.mp3");
  assert.equal(response.groups[0].sounds[0].cover, "https://cdn.example.com/cover/rain.jpg");
  assert.deepEqual(response.featuredGroupIds, ["nature"]);
});

test("drops unpublished groups and unpublished sounds", () => {
  const response = buildContentBootstrapResponse({
    groups: [
      {
        groupId: "draft-group",
        title: "草稿",
        subtitle: "",
        sort: 10,
        status: "draft"
      }
    ],
    sounds: [
      {
        soundId: "draft-sound",
        groupId: "draft-group",
        title: "草稿声音",
        category: "草稿",
        description: "",
        audioUrl: "https://cdn.example.com/audio/draft.mp3",
        coverUrl: "https://cdn.example.com/cover/draft.jpg",
        sort: 10,
        status: "draft"
      }
    ],
    appConfig: {}
  });

  assert.deepEqual(response.groups, []);
  assert.equal(response.defaultGroupId, "");
});

test("filters invalid defaultGroupId and featuredGroupIds to returned groups only", () => {
  const response = buildContentBootstrapResponse({
    groups: [
      {
        groupId: "nature",
        title: "自然",
        subtitle: "",
        sort: 10,
        status: "published"
      },
      {
        groupId: "empty-group",
        title: "空分组",
        subtitle: "",
        sort: 20,
        status: "published"
      }
    ],
    sounds: [
      {
        soundId: "rain",
        groupId: "nature",
        title: "雨声",
        category: "自然",
        description: "",
        audioUrl: "https://cdn.example.com/audio/rain.mp3",
        coverUrl: "https://cdn.example.com/cover/rain.jpg",
        sort: 10,
        status: "published"
      }
    ],
    appConfig: {
      featuredGroupIds: ["missing-group", "empty-group", "nature"],
      defaultGroupId: "missing-group"
    }
  });

  assert.deepEqual(
    response.groups.map((group) => group.id),
    ["nature"]
  );
  assert.deepEqual(response.featuredGroupIds, ["nature"]);
  assert.equal(response.defaultGroupId, "nature");
});

test("does not leak orphan sounds or sounds under filtered groups", () => {
  const response = buildContentBootstrapResponse({
    groups: [
      {
        groupId: "nature",
        title: "自然",
        subtitle: "",
        sort: 10,
        status: "published"
      },
      {
        groupId: "draft-group",
        title: "草稿分组",
        subtitle: "",
        sort: 20,
        status: "draft"
      }
    ],
    sounds: [
      {
        soundId: "rain",
        groupId: "nature",
        title: "雨声",
        category: "自然",
        description: "",
        audioUrl: "https://cdn.example.com/audio/rain.mp3",
        coverUrl: "https://cdn.example.com/cover/rain.jpg",
        sort: 10,
        status: "published"
      },
      {
        soundId: "orphan-sound",
        groupId: "missing-group",
        title: "孤儿声音",
        category: "异常",
        description: "",
        audioUrl: "https://cdn.example.com/audio/orphan.mp3",
        coverUrl: "https://cdn.example.com/cover/orphan.jpg",
        sort: 20,
        status: "published"
      },
      {
        soundId: "draft-group-sound",
        groupId: "draft-group",
        title: "草稿分组声音",
        category: "草稿",
        description: "",
        audioUrl: "https://cdn.example.com/audio/draft-group.mp3",
        coverUrl: "https://cdn.example.com/cover/draft-group.jpg",
        sort: 30,
        status: "published"
      }
    ],
    appConfig: {
      defaultGroupId: "nature",
      featuredGroupIds: ["nature", "draft-group", "missing-group"]
    }
  });

  assert.equal(response.groups.length, 1);
  assert.equal(response.groups[0].id, "nature");
  assert.deepEqual(
    response.groups[0].sounds.map((sound) => sound.id),
    ["rain"]
  );
  assert.deepEqual(response.featuredGroupIds, ["nature"]);
});
