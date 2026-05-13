# VM Content Source Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate the mini app’s content into a single repo source, add a VM-backed HTTP content provider, and keep the current page/runtime behavior stable.

**Architecture:** Introduce `content/catalog.json` as the only hand-edited content source and generate both the mini app’s local fallback module and the cloud seed file from it. Keep `miniprogram/services/soundSourceService.js` as the page-facing boundary, add a new HTTP provider beside the existing Douyin Cloud provider, and add a small Node VM server that serves the same `/content/bootstrap` contract as the cloud function.

**Tech Stack:** Native Douyin mini app JavaScript, Node built-in `http`, Node built-in tests, existing bootstrap builder, existing Mongo seed path.

---

## File Structure

- Create: `content/catalog.json`
  - Single hand-edited content source for groups, sounds, copy, asset keys, and ordering.
- Create: `content/catalogAdapter.js`
  - Pure transforms from catalog -> local mini app data / cloud seed / published bootstrap documents.
- Create: `scripts/sync-content-artifacts.js`
  - Generates `miniprogram/generated/sounds.js` and `cloud/seed/content.seed.json`.
- Create: `miniprogram/generated/sounds.js`
  - Generated local fallback module committed to the repo.
- Modify: `miniprogram/data/sounds.js`
  - Forward to the generated module instead of `miniprogram/debug/sounds.js`.
- Create: `miniprogram/config/contentSourceConfig.js`
  - Provider selector and shared request settings.
- Modify: `miniprogram/config/cloudContentConfig.js`
  - Temporary compatibility shim that re-exports the new config object.
- Create: `miniprogram/services/httpContentService.js`
  - HTTP `GET /content/bootstrap` client using `tt.request`.
- Modify: `miniprogram/services/cloudContentService.js`
  - Read env/service/path settings from the new config.
- Modify: `miniprogram/services/contentMapper.js`
  - Preserve `unlockLabel` from remote bootstrap payloads.
- Modify: `miniprogram/services/soundSourceService.js`
  - Dispatch by provider and tighten malformed payload fallback.
- Modify: `cloud/functions/shared/contentBootstrapBuilder.js`
  - Preserve `unlockLabel` in the bootstrap response.
- Create: `server/createVmContentServer.js`
  - Builds an in-process Node HTTP server for `/content/bootstrap`.
- Create: `server/index.js`
  - CLI entrypoint for local VM server startup.
- Create: `docs/vm-content-setup.md`
  - Runbook for VM mode and mini app provider switching.
- Modify: `docs/douyin-cloud-content-setup.md`
  - Replace manual seed-file editing with generated-seed workflow.
- Modify: `package.json`
  - Add `sync:content` and `serve:vm-content`.
- Modify: `scripts/check-syntax.js`
  - Check new config, provider, adapter, sync, and server files.
- Create: `tests/catalogAdapter.test.js`
  - Covers catalog -> local fallback and catalog -> cloud seed transforms.
- Create: `tests/httpContentService.test.js`
  - Covers `tt.request` success/failure/unavailable cases.
- Create: `tests/vmContentServer.test.js`
  - Covers the VM `/content/bootstrap` endpoint and route handling.
- Modify: `tests/contentMapper.test.js`
  - Preserve `unlockLabel` during mapping.
- Modify: `tests/contentBootstrapBuilder.test.js`
  - Preserve `unlockLabel` during bootstrap building.
- Modify: `tests/soundSourceService.test.js`
  - Cover `local` / `http` / `douyinCloud` provider dispatch and fallback.

## Task 1: Lock the single-source catalog contract with failing tests

**Files:**
- Create: `tests/catalogAdapter.test.js`
- Modify: `tests/contentMapper.test.js`
- Modify: `tests/contentBootstrapBuilder.test.js`

- [ ] **Step 1: Write the failing catalog adapter test**

Create `tests/catalogAdapter.test.js`:

```js
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
      subtitle: "更聚焦的雨滴与空气层次，适合想快速静下来的时候。",
      sort: 10
    },
    {
      id: "ambient",
      title: "氛围",
      subtitle: "空间感更强的抽象音景，适合冥想与沉浸。",
      sort: 20
    }
  ],
  sounds: [
    {
      id: "rain_night",
      groupId: "rain",
      title: "雨夜白噪音",
      category: "雨声",
      description: "稳定雨声和远处空气感",
      unlockLabel: "免费",
      audioAssetKey: "sleep-sounds/audio/rain_night.mp3",
      coverAssetKey: "sleep-sounds/cover/rain_night.jpg",
      sort: 10
    },
    {
      id: "deep_ambient",
      groupId: "ambient",
      title: "深夜冥想音景",
      category: "冥想",
      description: "极轻 ambient，无明显旋律",
      unlockLabel: "免费",
      audioAssetKey: "sleep-sounds/audio/deep_ambient.mp3",
      coverAssetKey: "sleep-sounds/cover/deep_ambient.jpg",
      sort: 20
    }
  ]
};

test("buildLocalSoundsModule keeps current mini app fallback shape", () => {
  const localModule = buildLocalSoundsModule(fixtureCatalog);

  assert.equal(localModule.MOCK_AUDIO_HOST, "sf1-ttcdn-tos.pstatp.com");
  assert.equal(localModule.COVER_BASE_PATH, "../../debug/covers");
  assert.equal(localModule.soundGroups.length, 2);
  assert.equal(localModule.soundGroups[0].thumbnail, "../../debug/covers/rain_night.jpg");
  assert.equal(localModule.soundGroups[0].sounds[0].unlockLabel, "免费");
  assert.match(localModule.soundGroups[0].sounds[0].url, /^https:\/\//);
});

test("buildCloudSeed maps catalog entries into published seed documents", () => {
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
```

- [ ] **Step 2: Update the mapper test to preserve `unlockLabel`**

Update `tests/contentMapper.test.js`:

```js
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
            unlockLabel: "免费",
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
          unlockLabel: "免费",
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
```

- [ ] **Step 3: Update the bootstrap builder test to preserve `unlockLabel`**

Update the first test block in `tests/contentBootstrapBuilder.test.js`:

```js
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
      },
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
      }
    ],
    appConfig: {
      featuredGroupIds: ["nature"],
      defaultGroupId: "nature",
      contentVersion: "2026-05-06T16:00:00Z"
    }
  });

  assert.equal(response.version, "2026-05-06T16:00:00Z");
  assert.equal(response.groups[0].id, "nature");
  assert.equal(response.groups[0].sounds[0].id, "rain");
  assert.equal(response.groups[0].sounds[0].unlockLabel, "免费");
  assert.deepEqual(response.featuredGroupIds, ["nature"]);
});
```

- [ ] **Step 4: Run the targeted tests to verify they fail**

Run:

```powershell
node --test tests/catalogAdapter.test.js tests/contentMapper.test.js tests/contentBootstrapBuilder.test.js
```

Expected:

- `tests/catalogAdapter.test.js` fails with `Cannot find module '../content/catalogAdapter'`
- mapper / builder assertions fail because `unlockLabel` is not preserved yet

- [ ] **Step 5: Commit the failing tests**

```powershell
git add tests/catalogAdapter.test.js tests/contentMapper.test.js tests/contentBootstrapBuilder.test.js
git commit -m "test: lock vm content catalog contracts"
```

## Task 2: Implement the single-source catalog and artifact sync pipeline

**Files:**
- Create: `content/catalog.json`
- Create: `content/catalogAdapter.js`
- Create: `scripts/sync-content-artifacts.js`
- Create: `miniprogram/generated/sounds.js`
- Modify: `miniprogram/data/sounds.js`
- Modify: `package.json`

- [ ] **Step 1: Add the single hand-edited catalog source**

Create `content/catalog.json`:

```json
{
  "version": "2026-05-06T00:00:00Z",
  "defaultGroupId": "rain",
  "featuredGroupIds": ["rain", "water", "ambient"],
  "groups": [
    {
      "id": "rain",
      "title": "雨声",
      "subtitle": "更聚焦的雨滴与空气层次，适合想快速静下来的时候。",
      "sort": 10
    },
    {
      "id": "water",
      "title": "水流",
      "subtitle": "海浪和溪流节奏更平缓，适合长时间持续播放。",
      "sort": 20
    },
    {
      "id": "forest",
      "title": "森林",
      "subtitle": "树叶、微风和远处虫鸣，营造自然包裹感。",
      "sort": 30
    },
    {
      "id": "room",
      "title": "室内",
      "subtitle": "更靠近生活空间的安全感，适合夜晚放松。",
      "sort": 40
    },
    {
      "id": "wind",
      "title": "风声",
      "subtitle": "低刺激的空气流动感，适合需要极简背景音时。",
      "sort": 50
    },
    {
      "id": "noise",
      "title": "白噪",
      "subtitle": "更稳定的宽频背景声，适合午休和专注隔噪。",
      "sort": 60
    },
    {
      "id": "ambient",
      "title": "氛围",
      "subtitle": "空间感更强的抽象音景，适合冥想与沉浸。",
      "sort": 70
    }
  ],
  "sounds": [
    {
      "id": "rain_night",
      "groupId": "rain",
      "title": "雨夜白噪音",
      "category": "雨声",
      "description": "稳定雨声和远处空气感",
      "unlockLabel": "免费",
      "audioAssetKey": "sleep-sounds/audio/rain_night.mp3",
      "coverAssetKey": "sleep-sounds/cover/rain_night.jpg",
      "sort": 10,
      "tags": ["sleep", "rain"]
    },
    {
      "id": "ocean_slow",
      "groupId": "water",
      "title": "深夜海浪",
      "category": "海浪",
      "description": "慢速海浪，适合睡前放松",
      "unlockLabel": "免费",
      "audioAssetKey": "sleep-sounds/audio/ocean_slow.mp3",
      "coverAssetKey": "sleep-sounds/cover/ocean_slow.jpg",
      "sort": 10,
      "tags": ["sleep", "water"]
    },
    {
      "id": "forest_breeze",
      "groupId": "forest",
      "title": "森林微风",
      "category": "森林",
      "description": "轻风和远景虫鸣",
      "unlockLabel": "免费",
      "audioAssetKey": "sleep-sounds/audio/forest_breeze.mp3",
      "coverAssetKey": "sleep-sounds/cover/forest_breeze.jpg",
      "sort": 10,
      "tags": ["sleep", "forest"]
    },
    {
      "id": "fireplace_room",
      "groupId": "room",
      "title": "壁炉小屋",
      "category": "壁炉",
      "description": "暖色木柴声，播放前解锁",
      "unlockLabel": "免费",
      "audioAssetKey": "sleep-sounds/audio/fireplace_room.mp3",
      "coverAssetKey": "sleep-sounds/cover/fireplace_room.jpg",
      "sort": 10,
      "tags": ["sleep", "room"]
    },
    {
      "id": "creek_soft",
      "groupId": "water",
      "title": "溪流入眠",
      "category": "溪流",
      "description": "连续水流，无明显突变",
      "unlockLabel": "免费",
      "audioAssetKey": "sleep-sounds/audio/creek_soft.mp3",
      "coverAssetKey": "sleep-sounds/cover/creek_soft.jpg",
      "sort": 20,
      "tags": ["sleep", "water"]
    },
    {
      "id": "soft_wind",
      "groupId": "wind",
      "title": "夜风低语",
      "category": "风声",
      "description": "极简风声和低频空气感",
      "unlockLabel": "免费",
      "audioAssetKey": "sleep-sounds/audio/soft_wind.mp3",
      "coverAssetKey": "sleep-sounds/cover/soft_wind.jpg",
      "sort": 10,
      "tags": ["sleep", "wind"]
    },
    {
      "id": "nap_white_noise",
      "groupId": "noise",
      "title": "午休白噪音",
      "category": "午休",
      "description": "干净宽频噪音",
      "unlockLabel": "免费",
      "audioAssetKey": "sleep-sounds/audio/nap_white_noise.mp3",
      "coverAssetKey": "sleep-sounds/cover/nap_white_noise.jpg",
      "sort": 10,
      "tags": ["sleep", "noise"]
    },
    {
      "id": "deep_ambient",
      "groupId": "ambient",
      "title": "深夜冥想音景",
      "category": "冥想",
      "description": "极轻 ambient，无明显旋律",
      "unlockLabel": "免费",
      "audioAssetKey": "sleep-sounds/audio/deep_ambient.mp3",
      "coverAssetKey": "sleep-sounds/cover/deep_ambient.jpg",
      "sort": 10,
      "tags": ["sleep", "ambient"]
    }
  ]
}
```

- [ ] **Step 2: Implement the pure catalog adapter**

Create `content/catalogAdapter.js`:

```js
const MOCK_AUDIO_HOST = "sf1-ttcdn-tos.pstatp.com";
const DEMO_AUDIO_URL = `https://${MOCK_AUDIO_HOST}/obj/developer/sdk/0000-0001.mp3`;
const COVER_BASE_PATH = "../../debug/covers";
const DEFAULT_CLOUD_CDN_BASE_URL = "https://cdn.example.com";

function sortBySortThenId(items, idField) {
  return [...items].sort((left, right) => {
    const leftSort = Number(left.sort || 0);
    const rightSort = Number(right.sort || 0);

    if (leftSort !== rightSort) {
      return leftSort - rightSort;
    }

    return String(left[idField] || "").localeCompare(String(right[idField] || ""));
  });
}

function getLocalCoverPath(soundId) {
  return `${COVER_BASE_PATH}/${soundId}.jpg`;
}

function normalizeBaseUrl(baseUrl, fallback) {
  if (typeof baseUrl !== "string") {
    return fallback;
  }

  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  return trimmed || fallback;
}

function buildLocalSoundGroups(catalog) {
  const groups = sortBySortThenId(catalog.groups || [], "id");
  const sounds = sortBySortThenId(catalog.sounds || [], "id");
  const soundsByGroupId = new Map();

  for (const sound of sounds) {
    const nextSound = {
      id: sound.id,
      title: sound.title,
      category: sound.category || "",
      description: sound.description || "",
      unlockLabel: sound.unlockLabel || "",
      url: DEMO_AUDIO_URL,
      cover: getLocalCoverPath(sound.id)
    };

    const groupSounds = soundsByGroupId.get(sound.groupId) || [];
    groupSounds.push(nextSound);
    soundsByGroupId.set(sound.groupId, groupSounds);
  }

  return groups
    .map((group) => {
      const groupSounds = soundsByGroupId.get(group.id) || [];
      return {
        id: group.id,
        title: group.title,
        subtitle: group.subtitle || "",
        thumbnail: groupSounds[0] ? groupSounds[0].cover : "",
        sounds: groupSounds
      };
    })
    .filter((group) => group.sounds.length > 0);
}

function buildLocalSoundsModule(catalog) {
  return {
    MOCK_AUDIO_HOST,
    COVER_BASE_PATH,
    soundGroups: buildLocalSoundGroups(catalog)
  };
}

function buildCloudSeed(catalog, options = {}) {
  const cdnBaseUrl = normalizeBaseUrl(options.cdnBaseUrl, DEFAULT_CLOUD_CDN_BASE_URL);
  const groups = sortBySortThenId(catalog.groups || [], "id");
  const sounds = sortBySortThenId(catalog.sounds || [], "id");

  return {
    appConfig: {
      _id: "content-bootstrap",
      featuredGroupIds: Array.isArray(catalog.featuredGroupIds) ? catalog.featuredGroupIds : [],
      defaultGroupId: catalog.defaultGroupId || "",
      contentVersion: catalog.version || ""
    },
    groups: groups.map((group) => ({
      groupId: group.id,
      title: group.title,
      subtitle: group.subtitle || "",
      sort: Number(group.sort || 0),
      status: "published"
    })),
    sounds: sounds.map((sound) => ({
      soundId: sound.id,
      groupId: sound.groupId,
      title: sound.title,
      category: sound.category || "",
      description: sound.description || "",
      unlockLabel: sound.unlockLabel || "",
      audioAssetKey: sound.audioAssetKey,
      audioUrl: `${cdnBaseUrl}/${sound.audioAssetKey}`,
      coverAssetKey: sound.coverAssetKey,
      coverUrl: `${cdnBaseUrl}/${sound.coverAssetKey}`,
      durationSec: Number(sound.durationSec || 0),
      tags: Array.isArray(sound.tags) ? sound.tags : [],
      sort: Number(sound.sort || 0),
      status: "published"
    }))
  };
}

function buildPublishedContentDocuments(catalog, options = {}) {
  const resolveAudioUrl =
    typeof options.resolveAudioUrl === "function" ? options.resolveAudioUrl : () => DEMO_AUDIO_URL;
  const resolveCoverUrl =
    typeof options.resolveCoverUrl === "function"
      ? options.resolveCoverUrl
      : (sound) => getLocalCoverPath(sound.id);
  const groups = sortBySortThenId(catalog.groups || [], "id");
  const sounds = sortBySortThenId(catalog.sounds || [], "id");

  return {
    groups: groups.map((group) => ({
      groupId: group.id,
      title: group.title,
      subtitle: group.subtitle || "",
      sort: Number(group.sort || 0),
      status: "published"
    })),
    sounds: sounds.map((sound) => ({
      soundId: sound.id,
      groupId: sound.groupId,
      title: sound.title,
      category: sound.category || "",
      description: sound.description || "",
      unlockLabel: sound.unlockLabel || "",
      audioAssetKey: sound.audioAssetKey,
      audioUrl: resolveAudioUrl(sound),
      coverAssetKey: sound.coverAssetKey,
      coverUrl: resolveCoverUrl(sound),
      durationSec: Number(sound.durationSec || 0),
      tags: Array.isArray(sound.tags) ? sound.tags : [],
      sort: Number(sound.sort || 0),
      status: "published"
    })),
    appConfig: {
      featuredGroupIds: Array.isArray(catalog.featuredGroupIds) ? catalog.featuredGroupIds : [],
      defaultGroupId: catalog.defaultGroupId || "",
      contentVersion: catalog.version || ""
    }
  };
}

module.exports = {
  MOCK_AUDIO_HOST,
  DEMO_AUDIO_URL,
  COVER_BASE_PATH,
  DEFAULT_CLOUD_CDN_BASE_URL,
  getLocalCoverPath,
  buildLocalSoundsModule,
  buildCloudSeed,
  buildPublishedContentDocuments
};
```

- [ ] **Step 3: Add the artifact sync script and switch `data/sounds.js` to the generated module**

Create `scripts/sync-content-artifacts.js`:

```js
const fs = require("node:fs");
const path = require("node:path");

const {
  buildLocalSoundsModule,
  buildCloudSeed
} = require("../content/catalogAdapter");

const catalogPath = path.resolve(__dirname, "../content/catalog.json");
const generatedSoundsPath = path.resolve(__dirname, "../miniprogram/generated/sounds.js");
const generatedSeedPath = path.resolve(__dirname, "../cloud/seed/content.seed.json");

function readCatalog() {
  return JSON.parse(fs.readFileSync(catalogPath, "utf8"));
}

function writeModule(filePath, value) {
  const code = `module.exports = ${JSON.stringify(value, null, 2)};\n`;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, code);
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function main() {
  const catalog = readCatalog();
  const localModule = buildLocalSoundsModule(catalog);
  const seed = buildCloudSeed(catalog, {
    cdnBaseUrl: process.env.CLOUD_CONTENT_CDN_BASE_URL
  });

  writeModule(generatedSoundsPath, localModule);
  writeJson(generatedSeedPath, seed);
  console.log("Synced content artifacts");
}

main();
```

Update `miniprogram/data/sounds.js`:

```js
module.exports = require("../generated/sounds");
```

Update the `scripts` block in `package.json`:

```json
{
  "scripts": {
    "test": "node -e \"const fs=require('fs');const path=require('path');const {spawnSync}=require('child_process');const dir='tests';const args=process.argv.slice(1);const files=args.length?args:(fs.existsSync(dir)?fs.readdirSync(dir).filter((file)=>file.endsWith('.test.js')).map((file)=>path.join(dir,file)):[]);if(!files.length){console.log('No test files found; skipping node --test');process.exit(0);}const result=spawnSync(process.execPath,['--test',...files],{stdio:'inherit'});process.exit(result.status);\"",
    "check": "node scripts/check-syntax.js",
    "debug:page": "node --test tests/pageRuntime.test.js",
    "seed:cloud-content": "node cloud/scripts/seedContent.js",
    "sync:content": "node scripts/sync-content-artifacts.js"
  }
}
```

- [ ] **Step 4: Run the sync script and verify the generated artifacts exist**

Run:

```powershell
npm run sync:content
```

Expected:

```text
Synced content artifacts
```

Then verify:

```powershell
Get-Content miniprogram/generated/sounds.js -TotalCount 40
Get-Content cloud/seed/content.seed.json -TotalCount 40
```

Expected:

- `miniprogram/generated/sounds.js` exports `MOCK_AUDIO_HOST`, `COVER_BASE_PATH`, and `soundGroups`
- `cloud/seed/content.seed.json` now contains the 7 groups / 8 sounds catalog data

- [ ] **Step 5: Run the targeted tests again and ensure the new adapter passes**

Run:

```powershell
node --test tests/catalogAdapter.test.js tests/contentMapper.test.js tests/contentBootstrapBuilder.test.js
```

Expected:

- `tests/catalogAdapter.test.js` now passes
- mapper / builder tests still fail until the runtime code is updated in later tasks

- [ ] **Step 6: Commit the catalog and sync pipeline**

```powershell
git add content/catalog.json content/catalogAdapter.js scripts/sync-content-artifacts.js miniprogram/generated/sounds.js miniprogram/data/sounds.js package.json cloud/seed/content.seed.json
git commit -m "feat: add single-source content catalog"
```

## Task 3: Lock provider dispatch and HTTP content loading with failing tests

**Files:**
- Create: `tests/httpContentService.test.js`
- Modify: `tests/soundSourceService.test.js`

- [ ] **Step 1: Write the failing HTTP service test**

Create `tests/httpContentService.test.js`:

```js
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

function loadHttpContentService(ttMock) {
  const configPath = path.resolve(__dirname, "../miniprogram/config/contentSourceConfig.js");
  const servicePath = path.resolve(__dirname, "../miniprogram/services/httpContentService.js");

  delete require.cache[require.resolve(configPath)];
  delete require.cache[require.resolve(servicePath)];

  global.tt = ttMock;
  const { contentSourceConfig } = require(configPath);
  contentSourceConfig.provider = "http";
  contentSourceConfig.httpBaseUrl = "https://api.sleep.test";
  contentSourceConfig.bootstrapPath = "/content/bootstrap";
  contentSourceConfig.timeoutMs = 5000;

  return require(servicePath);
}

test("requests the bootstrap payload via tt.request", async () => {
  let requestCalls = 0;
  const service = loadHttpContentService({
    request(options) {
      requestCalls += 1;
      assert.equal(options.url, "https://api.sleep.test/content/bootstrap");
      assert.equal(options.method, "GET");
      options.success({
        data: {
          version: "2026-05-06T16:00:00Z",
          groups: []
        }
      });
    }
  });

  const payload = await service.getContentBootstrap();

  assert.equal(requestCalls, 1);
  assert.deepEqual(payload, {
    version: "2026-05-06T16:00:00Z",
    groups: []
  });

  delete global.tt;
});

test("throws when tt.request is unavailable", async () => {
  const service = loadHttpContentService({});

  await assert.rejects(service.getContentBootstrap(), /tt\.request is unavailable/);

  delete global.tt;
});

test("rejects when the request fails", async () => {
  const service = loadHttpContentService({
    request(options) {
      options.fail(new Error("request failed"));
    }
  });

  await assert.rejects(service.getContentBootstrap(), /request failed/);

  delete global.tt;
});
```

- [ ] **Step 2: Update the sound source test for provider dispatch**

Replace `tests/soundSourceService.test.js` with:

```js
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { MOCK_AUDIO_HOST } = require("../miniprogram/data/sounds");

const configPath = path.resolve(__dirname, "../miniprogram/config/contentSourceConfig.js");
const httpPath = path.resolve(__dirname, "../miniprogram/services/httpContentService.js");
const cloudPath = path.resolve(__dirname, "../miniprogram/services/cloudContentService.js");
const sourcePath = path.resolve(__dirname, "../miniprogram/services/soundSourceService.js");

function loadSoundSourceService({
  provider,
  httpResponse,
  httpError,
  cloudResponse,
  cloudError
}) {
  delete require.cache[require.resolve(configPath)];
  delete require.cache[require.resolve(httpPath)];
  delete require.cache[require.resolve(cloudPath)];
  delete require.cache[require.resolve(sourcePath)];

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
  delete require.cache[require.resolve(configPath)];
  delete require.cache[require.resolve(httpPath)];
  delete require.cache[require.resolve(cloudPath)];
  delete require.cache[require.resolve(sourcePath)];
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
          subtitle: "呼吸和空间感。",
          sounds: [
            {
              id: "slow-breath",
              title: "慢呼吸",
              category: "冥想",
              description: "更慢的呼吸节奏。",
              unlockLabel: "免费",
              url: "https://cdn.example.com/audio/slow-breath.mp3",
              cover: "https://cdn.example.com/cover/slow-breath.jpg"
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

test("falls back to local sounds when the remote provider fails", async () => {
  const service = loadSoundSourceService({
    provider: "http",
    httpError: new Error("remote unavailable")
  });

  const groups = await service.getSoundGroups();
  const sounds = groups.flatMap((group) => group.sounds);

  assert.equal(groups[0].id, "rain");
  assert.equal(sounds.length, 8);
});

test("falls back to local sounds when the bootstrap payload is malformed", async () => {
  const service = loadSoundSourceService({
    provider: "http",
    httpResponse: {
      version: "2026-05-06T16:00:00Z"
    }
  });

  const groups = await service.getSoundGroups();

  assert.equal(groups[0].id, "rain");
  assert.equal(groups.length, 7);
});

test("preserves required playback metadata on local fallback", async () => {
  const service = loadSoundSourceService({
    provider: "http",
    httpError: new Error("remote unavailable")
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
```

- [ ] **Step 3: Run the provider tests to verify they fail**

Run:

```powershell
node --test tests/httpContentService.test.js tests/soundSourceService.test.js
```

Expected:

- `tests/httpContentService.test.js` fails with `Cannot find module '../miniprogram/config/contentSourceConfig.js'`
- `tests/soundSourceService.test.js` fails on the same missing config and new provider assertions

- [ ] **Step 4: Commit the failing provider tests**

```powershell
git add tests/httpContentService.test.js tests/soundSourceService.test.js
git commit -m "test: cover multi-provider content loading"
```

## Task 4: Implement multi-provider content loading on the mini app side

**Files:**
- Create: `miniprogram/config/contentSourceConfig.js`
- Modify: `miniprogram/config/cloudContentConfig.js`
- Create: `miniprogram/services/httpContentService.js`
- Modify: `miniprogram/services/cloudContentService.js`
- Modify: `miniprogram/services/contentMapper.js`
- Modify: `miniprogram/services/soundSourceService.js`
- Modify: `cloud/functions/shared/contentBootstrapBuilder.js`

- [ ] **Step 1: Add the new provider config and compatibility shim**

Create `miniprogram/config/contentSourceConfig.js`:

```js
const contentSourceConfig = {
  provider: "local",
  httpBaseUrl: "",
  envId: "",
  serviceId: "",
  bootstrapPath: "/content/bootstrap",
  timeoutMs: 5000
};

module.exports = {
  contentSourceConfig
};
```

Update `miniprogram/config/cloudContentConfig.js`:

```js
const { contentSourceConfig } = require("./contentSourceConfig");

module.exports = {
  cloudContentConfig: contentSourceConfig
};
```

- [ ] **Step 2: Add the HTTP service and move the cloud service onto the shared config**

Create `miniprogram/services/httpContentService.js`:

```js
const { contentSourceConfig } = require("../config/contentSourceConfig");

function buildRequestUrl() {
  const baseUrl = typeof contentSourceConfig.httpBaseUrl === "string"
    ? contentSourceConfig.httpBaseUrl.trim().replace(/\/+$/, "")
    : "";

  if (!baseUrl) {
    throw new Error("contentSourceConfig.httpBaseUrl is required");
  }

  return `${baseUrl}${contentSourceConfig.bootstrapPath}`;
}

async function getContentBootstrap() {
  if (typeof tt === "undefined" || typeof tt.request !== "function") {
    throw new Error("tt.request is unavailable");
  }

  const url = buildRequestUrl();

  return new Promise((resolve, reject) => {
    tt.request({
      url,
      method: "GET",
      timeout: contentSourceConfig.timeoutMs,
      header: {
        "content-type": "application/json"
      },
      success(response) {
        resolve(response && response.data ? response.data : response);
      },
      fail(error) {
        reject(error);
      }
    });
  });
}

module.exports = {
  getContentBootstrap
};
```

Update `miniprogram/services/cloudContentService.js`:

```js
const { contentSourceConfig } = require("../config/contentSourceConfig");

let cloudPromise = null;

function createCloudInstance() {
  if (typeof tt === "undefined" || typeof tt.createCloud !== "function") {
    throw new Error("tt.createCloud is unavailable");
  }

  return tt.createCloud({
    envID: contentSourceConfig.envId,
    serviceID: contentSourceConfig.serviceId
  });
}

function getCloud() {
  if (!cloudPromise) {
    const cloud = createCloudInstance();
    cloudPromise = new Promise((resolve, reject) => {
      cloud.init({
        success() {
          resolve(cloud);
        },
        fail(error) {
          cloudPromise = null;
          reject(error);
        }
      });
    });
  }

  return cloudPromise;
}

async function getContentBootstrap() {
  const cloud = await getCloud();

  return new Promise((resolve, reject) => {
    cloud.callContainer({
      path: contentSourceConfig.bootstrapPath,
      init: {
        method: "GET",
        header: {
          "content-type": "application/json"
        },
        timeout: contentSourceConfig.timeoutMs
      },
      success(response) {
        resolve(response && response.data ? response.data : response);
      },
      fail(error) {
        reject(error);
      }
    });
  });
}

module.exports = {
  getContentBootstrap
};
```

- [ ] **Step 3: Preserve `unlockLabel` and add provider dispatch with strict remote fallback**

Update `miniprogram/services/contentMapper.js`:

```js
function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

function assertValidSound(sound, groupId) {
  if (
    !sound ||
    !isNonEmptyString(sound.id) ||
    !isNonEmptyString(sound.title) ||
    !isNonEmptyString(sound.url)
  ) {
    throw new Error(`Invalid cloud content sound in group ${groupId || "unknown"}`);
  }
}

function assertValidGroup(group) {
  if (
    !group ||
    !isNonEmptyString(group.id) ||
    !isNonEmptyString(group.title) ||
    !Array.isArray(group.sounds)
  ) {
    throw new Error("Invalid cloud content group");
  }
}

function mapBootstrapToSoundGroups(payload) {
  const groups = Array.isArray(payload && payload.groups) ? payload.groups : [];

  return groups.map((group) => {
    assertValidGroup(group);

    return {
      id: group.id,
      title: group.title,
      subtitle: group.subtitle || "",
      sounds: group.sounds.map((sound) => {
        assertValidSound(sound, group.id);

        return {
          id: sound.id,
          title: sound.title,
          category: sound.category || "",
          description: sound.description || "",
          unlockLabel: sound.unlockLabel || "",
          url: sound.url,
          cover: sound.cover || ""
        };
      })
    };
  });
}

module.exports = {
  mapBootstrapToSoundGroups
};
```

Update the sound mapping block in `cloud/functions/shared/contentBootstrapBuilder.js`:

```js
    group.sounds.push({
      id: sound.soundId,
      title: sound.title,
      category: sound.category || "",
      description: sound.description || "",
      unlockLabel: sound.unlockLabel || "",
      url: sound.audioUrl || "",
      cover: sound.coverUrl || ""
    });
```

Update `miniprogram/services/soundSourceService.js`:

```js
const { soundGroups: localSoundGroups } = require("../data/sounds");
const { contentSourceConfig } = require("../config/contentSourceConfig");
const cloudContentService = require("./cloudContentService");
const httpContentService = require("./httpContentService");
const { mapBootstrapToSoundGroups } = require("./contentMapper");

function cloneLocalSoundGroups() {
  return localSoundGroups.map((group) => ({
    ...group,
    sounds: group.sounds.map((sound) => ({ ...sound }))
  }));
}

function getRemoteContentService() {
  switch (contentSourceConfig.provider) {
    case "http":
      return httpContentService;
    case "douyinCloud":
      return cloudContentService;
    default:
      return null;
  }
}

function isValidBootstrapPayload(payload) {
  return Boolean(payload) && typeof payload === "object" && Array.isArray(payload.groups);
}

async function getSoundGroups() {
  const remoteContentService = getRemoteContentService();

  if (!remoteContentService) {
    return cloneLocalSoundGroups();
  }

  try {
    const payload = await remoteContentService.getContentBootstrap();
    if (!isValidBootstrapPayload(payload)) {
      console.warn("remote content response is invalid; falling back to local mock");
      return cloneLocalSoundGroups();
    }

    return mapBootstrapToSoundGroups(payload);
  } catch (error) {
    console.warn("remote content fetch failed; falling back to local mock", error);
    return cloneLocalSoundGroups();
  }
}

module.exports = {
  getSoundGroups
};
```

- [ ] **Step 4: Run the provider and content contract tests**

Run:

```powershell
node --test tests/catalogAdapter.test.js tests/httpContentService.test.js tests/contentMapper.test.js tests/contentBootstrapBuilder.test.js tests/soundSourceService.test.js
```

Expected:

- all five tests pass

- [ ] **Step 5: Commit the multi-provider mini app runtime**

```powershell
git add miniprogram/config/contentSourceConfig.js miniprogram/config/cloudContentConfig.js miniprogram/services/httpContentService.js miniprogram/services/cloudContentService.js miniprogram/services/contentMapper.js miniprogram/services/soundSourceService.js cloud/functions/shared/contentBootstrapBuilder.js
git commit -m "feat: add http content provider"
```

## Task 5: Lock the VM bootstrap server contract with failing tests

**Files:**
- Create: `tests/vmContentServer.test.js`

- [ ] **Step 1: Write the failing VM server test**

Create `tests/vmContentServer.test.js`:

```js
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { createVmContentServer } = require("../server/createVmContentServer");

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server.address()));
  });
}

function request(address, pathname) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: address.address,
        port: address.port,
        path: pathname,
        method: "GET"
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => resolve({ statusCode: res.statusCode, body }));
      }
    );

    req.on("error", reject);
    req.end();
  });
}

test("serves bootstrap payload from catalog.json", async () => {
  const catalogPath = path.join(os.tmpdir(), `vm-content-${Date.now()}.json`);
  fs.writeFileSync(
    catalogPath,
    JSON.stringify(
      {
        version: "2026-05-06T00:00:00Z",
        defaultGroupId: "rain",
        featuredGroupIds: ["rain"],
        groups: [
          {
            id: "rain",
            title: "雨声",
            subtitle: "更聚焦的雨滴与空气层次，适合想快速静下来的时候。",
            sort: 10
          }
        ],
        sounds: [
          {
            id: "rain_night",
            groupId: "rain",
            title: "雨夜白噪音",
            category: "雨声",
            description: "稳定雨声和远处空气感",
            unlockLabel: "免费",
            audioAssetKey: "sleep-sounds/audio/rain_night.mp3",
            coverAssetKey: "sleep-sounds/cover/rain_night.jpg",
            sort: 10
          }
        ]
      },
      null,
      2
    )
  );

  const server = createVmContentServer({
    catalogPath,
    audioBaseUrl: "https://media.sleep.test",
    coverBaseUrl: "https://media.sleep.test"
  });

  try {
    const address = await listen(server);
    const response = await request(address, "/content/bootstrap");
    const payload = JSON.parse(response.body);

    assert.equal(response.statusCode, 200);
    assert.equal(payload.defaultGroupId, "rain");
    assert.equal(payload.groups[0].sounds[0].unlockLabel, "免费");
    assert.equal(
      payload.groups[0].sounds[0].url,
      "https://media.sleep.test/sleep-sounds/audio/rain_night.mp3"
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.unlinkSync(catalogPath);
  }
});

test("returns 404 for unknown routes", async () => {
  const server = createVmContentServer({
    catalogPath: path.resolve(__dirname, "../content/catalog.json")
  });

  try {
    const address = await listen(server);
    const response = await request(address, "/missing");

    assert.equal(response.statusCode, 404);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
```

- [ ] **Step 2: Run the VM server test and confirm it fails**

Run:

```powershell
node --test tests/vmContentServer.test.js
```

Expected:

- fail with `Cannot find module '../server/createVmContentServer'`

- [ ] **Step 3: Commit the failing VM server test**

```powershell
git add tests/vmContentServer.test.js
git commit -m "test: cover vm content bootstrap server"
```

## Task 6: Implement the VM bootstrap server, docs, and tooling updates

**Files:**
- Create: `server/createVmContentServer.js`
- Create: `server/index.js`
- Create: `docs/vm-content-setup.md`
- Modify: `docs/douyin-cloud-content-setup.md`
- Modify: `package.json`
- Modify: `scripts/check-syntax.js`

- [ ] **Step 1: Implement the reusable VM server and CLI entrypoint**

Create `server/createVmContentServer.js`:

```js
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const {
  DEMO_AUDIO_URL,
  getLocalCoverPath,
  buildPublishedContentDocuments
} = require("../content/catalogAdapter");
const {
  buildContentBootstrapResponse
} = require("../cloud/functions/shared/contentBootstrapBuilder");

function normalizeBaseUrl(baseUrl) {
  if (typeof baseUrl !== "string") {
    return "";
  }

  return baseUrl.trim().replace(/\/+$/, "");
}

function buildAssetUrl(baseUrl, assetKey, fallbackUrl) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  if (!normalizedBaseUrl) {
    return fallbackUrl;
  }

  return `${normalizedBaseUrl}/${assetKey}`;
}

function loadCatalog(catalogPath) {
  return JSON.parse(fs.readFileSync(catalogPath, "utf8"));
}

function createVmContentServer(options = {}) {
  const catalogPath = options.catalogPath || path.resolve(__dirname, "../content/catalog.json");
  const audioBaseUrl = options.audioBaseUrl || "";
  const coverBaseUrl = options.coverBaseUrl || "";

  return http.createServer((request, response) => {
    if (request.method !== "GET" || request.url !== "/content/bootstrap") {
      response.writeHead(404, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ error: "Not Found" }));
      return;
    }

    try {
      const catalog = loadCatalog(catalogPath);
      const documents = buildPublishedContentDocuments(catalog, {
        resolveAudioUrl(sound) {
          return buildAssetUrl(audioBaseUrl, sound.audioAssetKey, DEMO_AUDIO_URL);
        },
        resolveCoverUrl(sound) {
          return buildAssetUrl(coverBaseUrl, sound.coverAssetKey, getLocalCoverPath(sound.id));
        }
      });
      const payload = buildContentBootstrapResponse(documents);

      response.writeHead(200, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      });
      response.end(JSON.stringify(payload));
    } catch (error) {
      response.writeHead(500, { "content-type": "application/json; charset=utf-8" });
      response.end(
        JSON.stringify({
          error: "content bootstrap failed",
          message: error.message
        })
      );
    }
  });
}

module.exports = {
  createVmContentServer
};
```

Create `server/index.js`:

```js
const { createVmContentServer } = require("./createVmContentServer");

const port = Number(process.env.VM_CONTENT_PORT || 8787);

const server = createVmContentServer({
  audioBaseUrl: process.env.VM_CONTENT_AUDIO_BASE_URL || "",
  coverBaseUrl: process.env.VM_CONTENT_COVER_BASE_URL || ""
});

server.listen(port, "127.0.0.1", () => {
  console.log(`VM content server listening on http://127.0.0.1:${port}`);
});
```

- [ ] **Step 2: Add the VM runbook and update the cloud runbook**

Create `docs/vm-content-setup.md`:

~~~md
# VM Content Setup

## 1. Sync content artifacts

```powershell
npm run sync:content
```

Expected:

```text
Synced content artifacts
```

## 2. Start the VM content server

Use the default demo-audio + packaged-cover fallback:

```powershell
npm run serve:vm-content
```

Optional: override returned media URLs when the VM already hosts real assets:

```powershell
$env:VM_CONTENT_AUDIO_BASE_URL="https://static.example.com"
$env:VM_CONTENT_COVER_BASE_URL="https://static.example.com"
npm run serve:vm-content
```

## 3. Point the mini app at the VM provider

Update `miniprogram/config/contentSourceConfig.js`:

```js
const contentSourceConfig = {
  provider: "http",
  httpBaseUrl: "http://127.0.0.1:8787",
  envId: "",
  serviceId: "",
  bootstrapPath: "/content/bootstrap",
  timeoutMs: 5000
};
```

## 4. Verify in DevTools Lite

1. Reload the mini app.
2. Confirm the same 7 groups / 8 sounds still render.
3. Confirm playback, tab switching, and timer behavior are unchanged.
4. Stop the VM server and confirm the page falls back to local content instead of breaking.
~~~

Update the seed preparation section in `docs/douyin-cloud-content-setup.md` to remove manual seed edits:

~~~md
## 3. Upload media assets

Upload files that match the keys used in `content/catalog.json` and the generated seed:

- `sleep-sounds/audio/rain_night.mp3`
- `sleep-sounds/audio/ocean_slow.mp3`
- `sleep-sounds/audio/forest_breeze.mp3`
- `sleep-sounds/audio/fireplace_room.mp3`
- `sleep-sounds/audio/creek_soft.mp3`
- `sleep-sounds/audio/soft_wind.mp3`
- `sleep-sounds/audio/nap_white_noise.mp3`
- `sleep-sounds/audio/deep_ambient.mp3`
- `sleep-sounds/cover/rain_night.jpg`
- `sleep-sounds/cover/ocean_slow.jpg`
- `sleep-sounds/cover/forest_breeze.jpg`
- `sleep-sounds/cover/fireplace_room.jpg`
- `sleep-sounds/cover/creek_soft.jpg`
- `sleep-sounds/cover/soft_wind.jpg`
- `sleep-sounds/cover/nap_white_noise.jpg`
- `sleep-sounds/cover/deep_ambient.jpg`

## 4. Generate the cloud seed with the real CDN base URL

```powershell
$env:CLOUD_CONTENT_CDN_BASE_URL="https://cdn.your-domain.com"
npm run sync:content
```

This refreshes `cloud/seed/content.seed.json` with real `audioUrl` and `coverUrl` values, so the seed file no longer needs manual editing.
~~~

- [ ] **Step 3: Add the new scripts and syntax coverage**

Update `package.json`:

```json
{
  "scripts": {
    "test": "node -e \"const fs=require('fs');const path=require('path');const {spawnSync}=require('child_process');const dir='tests';const args=process.argv.slice(1);const files=args.length?args:(fs.existsSync(dir)?fs.readdirSync(dir).filter((file)=>file.endsWith('.test.js')).map((file)=>path.join(dir,file)):[]);if(!files.length){console.log('No test files found; skipping node --test');process.exit(0);}const result=spawnSync(process.execPath,['--test',...files],{stdio:'inherit'});process.exit(result.status);\"",
    "check": "node scripts/check-syntax.js",
    "debug:page": "node --test tests/pageRuntime.test.js",
    "seed:cloud-content": "node cloud/scripts/seedContent.js",
    "sync:content": "node scripts/sync-content-artifacts.js",
    "serve:vm-content": "node server/index.js"
  }
}
```

Update `scripts/check-syntax.js`:

```js
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");

const files = [
  "miniprogram/app.js",
  "miniprogram/pages/index/index.js",
  "miniprogram/utils/timer.js",
  "miniprogram/utils/playbackState.js",
  "miniprogram/config/contentSourceConfig.js",
  "miniprogram/config/cloudContentConfig.js",
  "miniprogram/services/contentMapper.js",
  "miniprogram/services/cloudContentService.js",
  "miniprogram/services/httpContentService.js",
  "miniprogram/services/soundSourceService.js",
  "content/catalogAdapter.js",
  "server/createVmContentServer.js",
  "server/index.js",
  "cloud/functions/shared/contentBootstrapBuilder.js",
  "cloud/functions/shared/contentRepository.js",
  "cloud/functions/contentBootstrap/index.js",
  "cloud/scripts/seedContent.js",
  "scripts/sync-content-artifacts.js",
  "scripts/check-syntax.js"
].filter((file) => fs.existsSync(file));

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], {
    stdio: "inherit"
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

console.log(`checked ${files.length} file(s)`);
```

- [ ] **Step 4: Run content sync, syntax, targeted server tests, and full regression**

Run:

```powershell
npm run sync:content
npm run check
node --test tests/vmContentServer.test.js
npm test
npm run debug:page
```

Expected:

- `Synced content artifacts`
- `checked <n> file(s)`
- `tests/vmContentServer.test.js` passes
- `npm test` passes
- `npm run debug:page` passes

- [ ] **Step 5: Commit the VM server and docs**

```powershell
git add server/createVmContentServer.js server/index.js docs/vm-content-setup.md docs/douyin-cloud-content-setup.md package.json scripts/check-syntax.js tests/vmContentServer.test.js miniprogram/generated/sounds.js cloud/seed/content.seed.json
git commit -m "feat: add vm content bootstrap server"
```

## Self-Review

### Spec coverage

- Single content source from `content/catalog.json`: Task 2
- Generated mini app fallback and cloud seed: Task 2
- Provider-based `local | http | douyinCloud`: Tasks 3-4
- VM `/content/bootstrap` service: Tasks 5-6
- Preserve current UI shape, including `unlockLabel`: Tasks 1 and 4
- Keep cloud path alive but no longer hand-maintained: Tasks 2 and 6

No spec gaps remain.

### Placeholder scan

- No `TODO` / `TBD`
- No “implement later”
- All new code paths have concrete file names, code blocks, commands, and expected results

### Type consistency

- Catalog fields use `id`, `groupId`, `audioAssetKey`, `coverAssetKey`, `unlockLabel` consistently
- Bootstrap response keeps `id`, `title`, `category`, `description`, `unlockLabel`, `url`, `cover`
- Provider names are consistently `local`, `http`, `douyinCloud`
