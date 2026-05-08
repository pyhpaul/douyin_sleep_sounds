const MOCK_AUDIO_HOST = "sf1-ttcdn-tos.pstatp.com";
const DEMO_AUDIO_URL = `https://${MOCK_AUDIO_HOST}/obj/developer/sdk/0000-0001.mp3`;
const COVER_BASE_PATH = "http://127.0.0.1:8787/debug/covers";
const AUDIO_BASE_URL = "http://127.0.0.1:8787/debug/audio";

const categoryDefinitions = [
  {
    id: "rain",
    title: "雨声",
    subtitle: "更聚焦的雨滴与空气层次，适合想快速静下来的时候。"
  },
  {
    id: "water",
    title: "水流",
    subtitle: "海浪和溪流节奏更平缓，适合长时间持续播放。"
  },
  {
    id: "forest",
    title: "森林",
    subtitle: "树叶、微风和远处虫鸣，营造自然包裹感。"
  },
  {
    id: "room",
    title: "室内",
    subtitle: "更靠近生活空间的安全感，适合夜晚放松。"
  },
  {
    id: "wind",
    title: "风声",
    subtitle: "低刺激的空气流动感，适合需要极简背景音时。"
  },
  {
    id: "noise",
    title: "白噪",
    subtitle: "更稳定的宽频背景声，适合午休和专注隔噪。"
  },
  {
    id: "ambient",
    title: "氛围",
    subtitle: "空间感更强的抽象音景，适合冥想与沉浸。"
  }
];

const scenes = [
  {
    id: "rain_night",
    title: "雨夜白噪音",
    subtitle: "稳定雨声和远处空气感",
    groupId: "rain",
    categoryLabel: "雨声",
    unlockLabel: "免费"
  },
  {
    id: "ocean_slow",
    title: "深夜海浪",
    subtitle: "慢速海浪，适合睡前放松",
    groupId: "water",
    categoryLabel: "海浪",
    unlockLabel: "免费"
  },
  {
    id: "forest_breeze",
    title: "森林微风",
    subtitle: "轻风和远景虫鸣",
    groupId: "forest",
    categoryLabel: "森林",
    unlockLabel: "免费"
  },
  {
    id: "fireplace_room",
    title: "壁炉小屋",
    subtitle: "暖色木柴声，播放前解锁",
    groupId: "room",
    categoryLabel: "壁炉",
    unlockLabel: "免费"
  },
  {
    id: "creek_soft",
    title: "溪流入眠",
    subtitle: "连续水流，无明显突变",
    groupId: "water",
    categoryLabel: "溪流",
    unlockLabel: "免费"
  },
  {
    id: "soft_wind",
    title: "夜风低语",
    subtitle: "极简风声和低频空气感",
    groupId: "wind",
    categoryLabel: "风声",
    unlockLabel: "免费"
  },
  {
    id: "nap_white_noise",
    title: "午休白噪音",
    subtitle: "干净宽频噪音",
    groupId: "noise",
    categoryLabel: "午休",
    unlockLabel: "免费"
  },
  {
    id: "deep_ambient",
    title: "深夜冥想音景",
    subtitle: "极轻 ambient，无明显旋律",
    groupId: "ambient",
    categoryLabel: "冥想",
    unlockLabel: "免费"
  }
];

function getLocalAudioExtension(sceneId) {
  const debugAssetExtensions = {
    rain_night: "ogg",
    ocean_slow: "ogg",
    forest_breeze: "ogg",
    fireplace_room: "ogg",
    creek_soft: "ogg",
    soft_wind: "ogg",
    nap_white_noise: "mp3",
    deep_ambient: "mp3"
  };

  return debugAssetExtensions[sceneId] || "mp3";
}

const scenesWithAssets = scenes.map((scene) => ({
  ...scene,
  cover: `${COVER_BASE_PATH}/${scene.id}.jpg`,
  url: `${AUDIO_BASE_URL}/${scene.id}.${getLocalAudioExtension(scene.id)}`
}));

const categoryMap = categoryDefinitions.reduce((result, definition) => {
  result[definition.id] = definition;
  return result;
}, {});

const soundGroups = categoryDefinitions.map((definition) => {
  const sounds = scenesWithAssets
    .filter((scene) => scene.groupId === definition.id)
    .map((scene) => ({
      id: scene.id,
      title: scene.title,
      category: scene.categoryLabel,
      description: scene.subtitle,
      url: scene.url,
      cover: scene.cover,
      unlockLabel: scene.unlockLabel
    }));

  return {
    id: definition.id,
    title: definition.title,
    subtitle: definition.subtitle,
    thumbnail: sounds[0] ? sounds[0].cover : "",
    sounds
  };
}).filter((group) => group.sounds.length > 0);

module.exports = {
  MOCK_AUDIO_HOST,
  COVER_BASE_PATH,
  AUDIO_BASE_URL,
  soundGroups,
  scenes: scenesWithAssets,
  categoryMap
};
