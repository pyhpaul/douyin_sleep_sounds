# Douyin Cloud Content Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move read-only content loading from local mock data toward Douyin Cloud while keeping the current player runtime state fully local.

**Architecture:** Keep `miniprogram/services/soundSourceService.js` as the page-facing data boundary. Add a cloud content client plus mapper on the mini app side, and add a repo-hosted Douyin Cloud function + MongoDB seed path on the backend side. If cloud access is disabled or fails, fall back to the existing local mock data.

**Tech Stack:** Native Douyin mini app JavaScript, Node built-in tests, Douyin Cloud `tt.createCloud` / `cloud.callContainer`, MongoDB Node driver.

---

## File Structure

- Create: `miniprogram/config/cloudContentConfig.js`
  - Owns cloud feature flag, env ID, service ID, path, and timeout.
- Create: `miniprogram/services/cloudContentService.js`
  - Owns `tt.createCloud` initialization and `callContainer` invocation.
- Create: `miniprogram/services/contentMapper.js`
  - Owns backend DTO -> current `soundGroups` mapping.
- Modify: `miniprogram/services/soundSourceService.js`
  - Keeps page-facing `getSoundGroups()` stable and adds cloud + fallback orchestration.
- Modify: `scripts/check-syntax.js`
  - Includes newly added JavaScript files.
- Modify: `package.json`
  - Adds MongoDB dependency and a seed script.
- Create: `cloud/functions/shared/contentBootstrapBuilder.js`
  - Pure function for shaping MongoDB documents into the bootstrap response.
- Create: `cloud/functions/shared/contentRepository.js`
  - Owns MongoDB reads for published groups, sounds, and app config.
- Create: `cloud/functions/contentBootstrap/index.js`
  - Thin Douyin Cloud function entry for `GET /content/bootstrap`.
- Create: `cloud/scripts/seedContent.js`
  - Upserts initial content seed into MongoDB.
- Create: `cloud/seed/content.seed.json`
  - First version of backend seed data, mirroring the current 3 groups / 6 sounds.
- Create: `docs/douyin-cloud-content-setup.md`
  - Manual resource checklist: MongoDB, object storage/CDN, function route, seed command.
- Create: `tests/contentMapper.test.js`
  - Covers DTO -> `soundGroups` mapping.
- Create: `tests/cloudContentService.test.js`
  - Covers lazy cloud init and `callContainer` response normalization.
- Create: `tests/soundSourceService.test.js`
  - Covers disabled cloud, successful cloud fetch, and fallback behavior.
- Create: `tests/contentBootstrapBuilder.test.js`
  - Covers backend response shaping from published content documents.

## Task 1: Lock the frontend cloud contract with failing tests

**Files:**
- Create: `tests/contentMapper.test.js`
- Create: `tests/cloudContentService.test.js`
- Create: `tests/soundSourceService.test.js`

- [ ] **Step 1: Write the mapper test**

Create `tests/contentMapper.test.js`:

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
```

- [ ] **Step 2: Write the cloud client test**

Create `tests/cloudContentService.test.js`:

```js
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

function loadCloudContentService(ttMock) {
  const configPath = path.resolve(__dirname, "../miniprogram/config/cloudContentConfig.js");
  const servicePath = path.resolve(__dirname, "../miniprogram/services/cloudContentService.js");

  delete require.cache[require.resolve(configPath)];
  delete require.cache[require.resolve(servicePath)];

  global.tt = ttMock;
  const { cloudContentConfig } = require(configPath);
  cloudContentConfig.enabled = true;
  cloudContentConfig.envId = "env-test";
  cloudContentConfig.serviceId = "service-test";
  cloudContentConfig.bootstrapPath = "/content/bootstrap";
  cloudContentConfig.timeoutMs = 5000;

  return require(servicePath);
}

test("initializes tt.createCloud once and returns response data", async () => {
  let initCalls = 0;
  let callContainerCalls = 0;

  const service = loadCloudContentService({
    createCloud() {
      return {
        init({ success }) {
          initCalls += 1;
          success();
        },
        callContainer({ path, init, success }) {
          callContainerCalls += 1;
          assert.equal(path, "/content/bootstrap");
          assert.equal(init.method, "GET");
          success({
            data: {
              version: "2026-05-06T16:00:00Z",
              groups: []
            }
          });
        }
      };
    }
  });

  const first = await service.getContentBootstrap();
  const second = await service.getContentBootstrap();

  assert.equal(initCalls, 1);
  assert.equal(callContainerCalls, 2);
  assert.deepEqual(first, { version: "2026-05-06T16:00:00Z", groups: [] });
  assert.deepEqual(second, { version: "2026-05-06T16:00:00Z", groups: [] });

  delete global.tt;
});

test("throws when tt.createCloud is unavailable", async () => {
  const service = loadCloudContentService({});

  await assert.rejects(
    service.getContentBootstrap(),
    /tt\.createCloud is unavailable/
  );

  delete global.tt;
});
```

- [ ] **Step 3: Write the source service test**

Create `tests/soundSourceService.test.js`:

```js
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

function loadSoundSourceService({ enabled, cloudResponse, cloudError }) {
  const configPath = path.resolve(__dirname, "../miniprogram/config/cloudContentConfig.js");
  const cloudPath = path.resolve(__dirname, "../miniprogram/services/cloudContentService.js");
  const sourcePath = path.resolve(__dirname, "../miniprogram/services/soundSourceService.js");

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

test("returns cloned local sounds when cloud is disabled", async () => {
  const service = loadSoundSourceService({ enabled: false });
  const first = await service.getSoundGroups();
  const second = await service.getSoundGroups();

  assert.equal(first[0].title, "自然");
  assert.notEqual(first, second);
  assert.notEqual(first[0], second[0]);
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
});

test("falls back to local sounds when cloud fetch fails", async () => {
  const service = loadSoundSourceService({
    enabled: true,
    cloudError: new Error("cloud unavailable")
  });

  const groups = await service.getSoundGroups();
  assert.equal(groups[0].id, "nature");
});
```

- [ ] **Step 4: Run the new tests to verify they fail**

Run:

```powershell
npm test tests/contentMapper.test.js tests/cloudContentService.test.js tests/soundSourceService.test.js
```

Expected: FAIL because the new config file and service files do not exist yet.

## Task 2: Implement the mini app cloud adapter and mapper

**Files:**
- Create: `miniprogram/config/cloudContentConfig.js`
- Create: `miniprogram/services/contentMapper.js`
- Create: `miniprogram/services/cloudContentService.js`

- [ ] **Step 1: Add the runtime config file**

Create `miniprogram/config/cloudContentConfig.js`:

```js
const cloudContentConfig = {
  enabled: false,
  envId: "",
  serviceId: "",
  bootstrapPath: "/content/bootstrap",
  timeoutMs: 5000
};

module.exports = {
  cloudContentConfig
};
```

- [ ] **Step 2: Add the DTO mapper**

Create `miniprogram/services/contentMapper.js`:

```js
function mapBootstrapToSoundGroups(payload) {
  const groups = Array.isArray(payload && payload.groups) ? payload.groups : [];

  return groups.map((group) => ({
    id: group.id,
    title: group.title,
    subtitle: group.subtitle || "",
    sounds: Array.isArray(group.sounds)
      ? group.sounds.map((sound) => ({
          id: sound.id,
          title: sound.title,
          category: sound.category || "",
          description: sound.description || "",
          url: sound.url || "",
          cover: sound.cover || ""
        }))
      : []
  }));
}

module.exports = {
  mapBootstrapToSoundGroups
};
```

- [ ] **Step 3: Add the cloud content client**

Create `miniprogram/services/cloudContentService.js`:

```js
const { cloudContentConfig } = require("../config/cloudContentConfig");

let cloudPromise = null;

function createCloudInstance() {
  if (typeof tt === "undefined" || typeof tt.createCloud !== "function") {
    throw new Error("tt.createCloud is unavailable");
  }

  return tt.createCloud({
    envID: cloudContentConfig.envId,
    serviceID: cloudContentConfig.serviceId
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
      path: cloudContentConfig.bootstrapPath,
      init: {
        method: "GET",
        header: {
          "content-type": "application/json"
        },
        timeout: cloudContentConfig.timeoutMs
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

- [ ] **Step 4: Run the focused tests**

Run:

```powershell
npm test tests/contentMapper.test.js tests/cloudContentService.test.js
```

Expected: PASS.

## Task 3: Keep `soundSourceService` stable while adding cloud + fallback behavior

**Files:**
- Modify: `miniprogram/services/soundSourceService.js`
- Modify: `scripts/check-syntax.js`

- [ ] **Step 1: Replace `soundSourceService.js` with cloud-aware orchestration**

Replace `miniprogram/services/soundSourceService.js` with:

```js
const { soundGroups: localSoundGroups } = require("../data/sounds");
const { cloudContentConfig } = require("../config/cloudContentConfig");
const cloudContentService = require("./cloudContentService");
const { mapBootstrapToSoundGroups } = require("./contentMapper");

function cloneLocalSoundGroups() {
  return localSoundGroups.map((group) => ({
    ...group,
    sounds: group.sounds.map((sound) => ({ ...sound }))
  }));
}

async function getSoundGroups() {
  if (!cloudContentConfig.enabled) {
    return cloneLocalSoundGroups();
  }

  try {
    const payload = await cloudContentService.getContentBootstrap();
    return mapBootstrapToSoundGroups(payload);
  } catch (error) {
    return cloneLocalSoundGroups();
  }
}

module.exports = {
  getSoundGroups
};
```

- [ ] **Step 2: Extend the syntax check list**

Replace `scripts/check-syntax.js` with:

```js
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");

const files = [
  "miniprogram/app.js",
  "miniprogram/pages/index/index.js",
  "miniprogram/utils/timer.js",
  "miniprogram/utils/playbackState.js",
  "miniprogram/config/cloudContentConfig.js",
  "miniprogram/services/contentMapper.js",
  "miniprogram/services/cloudContentService.js",
  "miniprogram/services/soundSourceService.js",
  "cloud/functions/shared/contentBootstrapBuilder.js",
  "cloud/functions/shared/contentRepository.js",
  "cloud/functions/contentBootstrap/index.js",
  "cloud/scripts/seedContent.js",
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

- [ ] **Step 3: Run the service test and syntax check**

Run:

```powershell
npm test tests/soundSourceService.test.js
npm run check
```

Expected: PASS. `check` should report the expanded file count once backend files are added in later tasks; before that it should still pass with the files that exist.

- [ ] **Step 4: Commit the frontend cloud adapter**

Run:

```powershell
git add miniprogram/config/cloudContentConfig.js miniprogram/services/contentMapper.js miniprogram/services/cloudContentService.js miniprogram/services/soundSourceService.js scripts/check-syntax.js tests/contentMapper.test.js tests/cloudContentService.test.js tests/soundSourceService.test.js
git commit -m "feat: add cloud content source adapter"
```

Expected: one commit containing only the mini app cloud-adapter and its tests.

## Task 4: Build and test the backend bootstrap response logic

**Files:**
- Create: `cloud/functions/shared/contentBootstrapBuilder.js`
- Create: `tests/contentBootstrapBuilder.test.js`

- [ ] **Step 1: Write the backend response builder test**

Create `tests/contentBootstrapBuilder.test.js`:

```js
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
        soundId: "wave",
        groupId: "nature",
        title: "海浪",
        category: "自然",
        description: "轻缓海浪声，适合睡前稳定呼吸节奏。",
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
```

- [ ] **Step 2: Implement the pure builder**

Create `cloud/functions/shared/contentBootstrapBuilder.js`:

```js
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

function buildContentBootstrapResponse({ groups, sounds, appConfig }) {
  const publishedGroups = sortBySortThenId(
    (groups || []).filter((group) => group.status === "published"),
    "groupId"
  );
  const publishedSounds = sortBySortThenId(
    (sounds || []).filter((sound) => sound.status === "published"),
    "soundId"
  );

  const groupMap = new Map(
    publishedGroups.map((group) => [
      group.groupId,
      {
        id: group.groupId,
        title: group.title,
        subtitle: group.subtitle || "",
        sounds: []
      }
    ])
  );

  for (const sound of publishedSounds) {
    const group = groupMap.get(sound.groupId);
    if (!group) {
      continue;
    }

    group.sounds.push({
      id: sound.soundId,
      title: sound.title,
      category: sound.category || "",
      description: sound.description || "",
      url: sound.audioUrl || "",
      cover: sound.coverUrl || ""
    });
  }

  const resultGroups = publishedGroups
    .map((group) => groupMap.get(group.groupId))
    .filter((group) => group && group.sounds.length > 0);

  return {
    version: appConfig && appConfig.contentVersion ? appConfig.contentVersion : "",
    featuredGroupIds:
      appConfig && Array.isArray(appConfig.featuredGroupIds) ? appConfig.featuredGroupIds : [],
    defaultGroupId:
      appConfig && appConfig.defaultGroupId ? appConfig.defaultGroupId : resultGroups[0]?.id || "",
    groups: resultGroups
  };
}

module.exports = {
  buildContentBootstrapResponse
};
```

- [ ] **Step 3: Run the builder test**

Run:

```powershell
npm test tests/contentBootstrapBuilder.test.js
```

Expected: PASS.

## Task 5: Add the MongoDB-backed cloud function, seed data, and setup doc

**Files:**
- Create: `cloud/functions/shared/contentRepository.js`
- Create: `cloud/functions/contentBootstrap/index.js`
- Create: `cloud/scripts/seedContent.js`
- Create: `cloud/seed/content.seed.json`
- Create: `docs/douyin-cloud-content-setup.md`
- Modify: `package.json`

- [ ] **Step 1: Add the MongoDB repository**

Create `cloud/functions/shared/contentRepository.js`:

```js
const { MongoClient } = require("mongodb");

const DATABASE_NAME = process.env.SLEEP_SOUNDS_MONGO_DB || "sleep_sounds";
let clientPromise = null;

function getMongoUri() {
  const mongoUri = process.env.SLEEP_SOUNDS_MONGO_URI;

  if (!mongoUri) {
    throw new Error("SLEEP_SOUNDS_MONGO_URI is required");
  }

  return mongoUri;
}

async function getDatabase() {
  if (!clientPromise) {
    clientPromise = MongoClient.connect(getMongoUri(), {
      maxPoolSize: 5
    });
  }

  const client = await clientPromise;
  return client.db(DATABASE_NAME);
}

async function getPublishedContentDocuments() {
  const database = await getDatabase();

  const [groups, sounds, appConfig] = await Promise.all([
    database.collection("sound_groups").find({ status: "published" }).toArray(),
    database.collection("sounds").find({ status: "published" }).toArray(),
    database.collection("app_configs").findOne({ _id: "content-bootstrap" })
  ]);

  return {
    groups,
    sounds,
    appConfig: appConfig || {}
  };
}

module.exports = {
  getPublishedContentDocuments,
  getMongoUri
};
```

- [ ] **Step 2: Add the cloud function entry**

Create `cloud/functions/contentBootstrap/index.js`:

```js
const {
  buildContentBootstrapResponse
} = require("../shared/contentBootstrapBuilder");
const {
  getPublishedContentDocuments
} = require("../shared/contentRepository");

module.exports = async function contentBootstrap() {
  const documents = await getPublishedContentDocuments();
  return buildContentBootstrapResponse(documents);
};
```

- [ ] **Step 3: Add the seed file**

Create `cloud/seed/content.seed.json`:

```json
{
  "appConfig": {
    "_id": "content-bootstrap",
    "featuredGroupIds": ["nature", "white-noise"],
    "defaultGroupId": "nature",
    "contentVersion": "2026-05-06T16:00:00Z"
  },
  "groups": [
    {
      "groupId": "nature",
      "title": "自然",
      "subtitle": "把自然声放慢，留给入睡前的几分钟。",
      "sort": 10,
      "status": "published"
    },
    {
      "groupId": "white-noise",
      "title": "白噪音",
      "subtitle": "持续、柔和、低干扰的背景声音。",
      "sort": 20,
      "status": "published"
    },
    {
      "groupId": "relax",
      "title": "放松冥想",
      "subtitle": "更轻的旋律和呼吸引导，适合准备入睡。",
      "sort": 30,
      "status": "published"
    }
  ],
  "sounds": [
    {
      "soundId": "rain",
      "groupId": "nature",
      "title": "雨声",
      "category": "自然",
      "description": "细密雨声，适合放松和屏蔽环境噪声。",
      "audioAssetKey": "sleep-sounds/audio/rain-v1.mp3",
      "audioUrl": "https://cdn.example.com/sleep-sounds/audio/rain-v1.mp3",
      "coverAssetKey": "sleep-sounds/cover/rain-v1.jpg",
      "coverUrl": "https://cdn.example.com/sleep-sounds/cover/rain-v1.jpg",
      "durationSec": 0,
      "tags": ["sleep", "nature"],
      "sort": 10,
      "status": "published"
    },
    {
      "soundId": "wave",
      "groupId": "nature",
      "title": "海浪",
      "category": "自然",
      "description": "轻缓海浪声，适合睡前稳定呼吸节奏。",
      "audioAssetKey": "sleep-sounds/audio/wave-v1.mp3",
      "audioUrl": "https://cdn.example.com/sleep-sounds/audio/wave-v1.mp3",
      "coverAssetKey": "sleep-sounds/cover/wave-v1.jpg",
      "coverUrl": "https://cdn.example.com/sleep-sounds/cover/wave-v1.jpg",
      "durationSec": 0,
      "tags": ["sleep", "nature"],
      "sort": 20,
      "status": "published"
    },
    {
      "soundId": "fire",
      "groupId": "white-noise",
      "title": "篝火",
      "category": "白噪音",
      "description": "温暖的火焰声，适合夜间阅读后入睡。",
      "audioAssetKey": "sleep-sounds/audio/fire-v1.mp3",
      "audioUrl": "https://cdn.example.com/sleep-sounds/audio/fire-v1.mp3",
      "coverAssetKey": "sleep-sounds/cover/fire-v1.jpg",
      "coverUrl": "https://cdn.example.com/sleep-sounds/cover/fire-v1.jpg",
      "durationSec": 0,
      "tags": ["sleep", "white-noise"],
      "sort": 10,
      "status": "published"
    },
    {
      "soundId": "wind",
      "groupId": "white-noise",
      "title": "风声",
      "category": "白噪音",
      "description": "平稳风声，减少突兀环境声带来的打扰。",
      "audioAssetKey": "sleep-sounds/audio/wind-v1.mp3",
      "audioUrl": "https://cdn.example.com/sleep-sounds/audio/wind-v1.mp3",
      "coverAssetKey": "sleep-sounds/cover/wind-v1.jpg",
      "coverUrl": "https://cdn.example.com/sleep-sounds/cover/wind-v1.jpg",
      "durationSec": 0,
      "tags": ["sleep", "white-noise"],
      "sort": 20,
      "status": "published"
    },
    {
      "soundId": "soft-music",
      "groupId": "relax",
      "title": "轻音乐",
      "category": "放松冥想",
      "description": "柔和旋律，帮助从工作状态切换到休息状态。",
      "audioAssetKey": "sleep-sounds/audio/soft-music-v1.mp3",
      "audioUrl": "https://cdn.example.com/sleep-sounds/audio/soft-music-v1.mp3",
      "coverAssetKey": "sleep-sounds/cover/soft-music-v1.jpg",
      "coverUrl": "https://cdn.example.com/sleep-sounds/cover/soft-music-v1.jpg",
      "durationSec": 0,
      "tags": ["sleep", "relax"],
      "sort": 10,
      "status": "published"
    },
    {
      "soundId": "deep-breath",
      "groupId": "relax",
      "title": "深呼吸",
      "category": "放松冥想",
      "description": "慢节奏呼吸感声音，适合睡前冥想练习。",
      "audioAssetKey": "sleep-sounds/audio/deep-breath-v1.mp3",
      "audioUrl": "https://cdn.example.com/sleep-sounds/audio/deep-breath-v1.mp3",
      "coverAssetKey": "sleep-sounds/cover/deep-breath-v1.jpg",
      "coverUrl": "https://cdn.example.com/sleep-sounds/cover/deep-breath-v1.jpg",
      "durationSec": 0,
      "tags": ["sleep", "relax"],
      "sort": 20,
      "status": "published"
    }
  ]
}
```

- [ ] **Step 4: Add the seed script**

Create `cloud/scripts/seedContent.js`:

```js
const fs = require("node:fs");
const path = require("node:path");
const { MongoClient } = require("mongodb");

const seedPath = path.resolve(__dirname, "../seed/content.seed.json");
const databaseName = process.env.SLEEP_SOUNDS_MONGO_DB || "sleep_sounds";
const mongoUri = process.env.SLEEP_SOUNDS_MONGO_URI;

if (!mongoUri) {
  throw new Error("SLEEP_SOUNDS_MONGO_URI is required");
}

async function main() {
  const seed = JSON.parse(fs.readFileSync(seedPath, "utf8"));
  const client = await MongoClient.connect(mongoUri);

  try {
    const database = client.db(databaseName);

    await Promise.all(
      seed.groups.map((group) =>
        database.collection("sound_groups").updateOne(
          { groupId: group.groupId },
          { $set: group },
          { upsert: true }
        )
      )
    );

    await Promise.all(
      seed.sounds.map((sound) =>
        database.collection("sounds").updateOne(
          { soundId: sound.soundId },
          { $set: sound },
          { upsert: true }
        )
      )
    );

    await database.collection("app_configs").updateOne(
      { _id: "content-bootstrap" },
      { $set: seed.appConfig },
      { upsert: true }
    );

    console.log("Seeded Douyin Cloud content collections");
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 5: Update `package.json`**

Update `package.json` to:

```json
{
  "name": "douyin-sleep-sounds",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "test": "node -e \"const fs=require('fs');const path=require('path');const {spawnSync}=require('child_process');const dir='tests';const args=process.argv.slice(1);const files=args.length?args:(fs.existsSync(dir)?fs.readdirSync(dir).filter((file)=>file.endsWith('.test.js')).map((file)=>path.join(dir,file)):[]);if(!files.length){console.log('No test files found; skipping node --test');process.exit(0);}const result=spawnSync(process.execPath,['--test',...files],{stdio:'inherit'});process.exit(result.status);\"",
    "check": "node scripts/check-syntax.js",
    "debug:page": "node --test tests/pageRuntime.test.js",
    "seed:cloud-content": "node cloud/scripts/seedContent.js"
  },
  "dependencies": {
    "mongodb": "^6.7.0"
  }
}
```

- [ ] **Step 6: Add the setup doc**

Create `docs/douyin-cloud-content-setup.md`:

```md
# Douyin Cloud Content Setup

## 1. Open cloud resources

In the Douyin Cloud console for this mini app:

1. Create a **function service** in `dev`.
2. Enable **MongoDB** in the component center.
3. Enable **object storage** and configure a CDN domain for audio and cover assets.

## 2. Prepare service env vars

Configure these env vars on the function service:

- `SLEEP_SOUNDS_MONGO_URI`
- `SLEEP_SOUNDS_MONGO_DB=sleep_sounds`

## 3. Upload media assets

Upload files that match the keys used in `cloud/seed/content.seed.json`:

- `sleep-sounds/audio/rain-v1.mp3`
- `sleep-sounds/audio/wave-v1.mp3`
- `sleep-sounds/audio/fire-v1.mp3`
- `sleep-sounds/audio/wind-v1.mp3`
- `sleep-sounds/audio/soft-music-v1.mp3`
- `sleep-sounds/audio/deep-breath-v1.mp3`
- `sleep-sounds/cover/rain-v1.jpg`
- `sleep-sounds/cover/wave-v1.jpg`
- `sleep-sounds/cover/fire-v1.jpg`
- `sleep-sounds/cover/wind-v1.jpg`
- `sleep-sounds/cover/soft-music-v1.jpg`
- `sleep-sounds/cover/deep-breath-v1.jpg`

After the CDN domain is ready, replace the `cdn.example.com` URLs inside `cloud/seed/content.seed.json` with the real CDN domain before seeding.

## 4. Seed MongoDB

Run:

```powershell
$env:SLEEP_SOUNDS_MONGO_URI="your-mongo-uri"
$env:SLEEP_SOUNDS_MONGO_DB="sleep_sounds"
npm run seed:cloud-content
```

Expected output:

```text
Seeded Douyin Cloud content collections
```

## 5. Bind the function path

Deploy `cloud/functions/contentBootstrap/index.js` as the handler for:

```text
GET /content/bootstrap
```

## 6. Enable mini app cloud access

Set `miniprogram/config/cloudContentConfig.js` to the target environment and service:

```js
const cloudContentConfig = {
  enabled: true,
  envId: "your-env-id",
  serviceId: "your-service-id",
  bootstrapPath: "/content/bootstrap",
  timeoutMs: 5000
};
```
```

- [ ] **Step 7: Install the dependency and run focused validation**

Run:

```powershell
npm install
npm test tests/contentBootstrapBuilder.test.js
npm run check
```

Expected: PASS and `mongodb` added to `package-lock.json`.

- [ ] **Step 8: Commit the backend scaffold**

Run:

```powershell
git add package.json package-lock.json cloud/functions/shared/contentBootstrapBuilder.js cloud/functions/shared/contentRepository.js cloud/functions/contentBootstrap/index.js cloud/scripts/seedContent.js cloud/seed/content.seed.json docs/douyin-cloud-content-setup.md tests/contentBootstrapBuilder.test.js
git commit -m "feat: scaffold douyin cloud content backend"
```

Expected: one commit containing only backend bootstrap code, seed data, docs, and backend tests.

## Task 6: Verify regression safety and do the first cloud dry run

**Files:**
- Read: `miniprogram/services/soundSourceService.js`
- Read: `docs/douyin-cloud-content-setup.md`
- Read: `miniprogram/config/cloudContentConfig.js`

- [ ] **Step 1: Run the full local suite**

Run:

```powershell
npm run check
npm run debug:page
npm test
```

Expected:

- `check`: PASS
- `debug:page`: PASS
- `npm test`: PASS

- [ ] **Step 2: Verify local fallback path manually**

Keep `miniprogram/config/cloudContentConfig.js` disabled:

```js
const cloudContentConfig = {
  enabled: false,
  envId: "",
  serviceId: "",
  bootstrapPath: "/content/bootstrap",
  timeoutMs: 5000
};
```

In DevTools Lite:

1. Open the mini app.
2. Confirm the page still loads the existing 3 groups / 6 sounds.
3. Confirm playback, loop, timer, channel tabs, and player tab behavior are unchanged.

- [ ] **Step 3: Verify the cloud path manually in `dev`**

After seeding the Douyin Cloud `dev` environment:

1. Set real `envId` and `serviceId` in `miniprogram/config/cloudContentConfig.js`.
2. Switch `enabled` to `true`.
3. Open the mini app in DevTools Lite with a `dev` cloud-capable environment.
4. Confirm the page still renders the same group and sound list shape.
5. Temporarily edit one cloud record title in MongoDB and confirm the mini app reflects the changed title on reload.
6. Revert the title after the check.

- [ ] **Step 4: Record the first live verification**

Append a short note to `docs/douyin-cloud-content-setup.md` after the first successful `dev` verification:

```md
## Verification Log

- 2026-05-06: `GET /content/bootstrap` reachable from DevTools Lite `dev` flow.
- 2026-05-06: cloud content title edit reflected in mini app after reload.
```

- [ ] **Step 5: Commit the verification note**

Run:

```powershell
git add docs/douyin-cloud-content-setup.md
git commit -m "docs: record douyin cloud content verification"
```

Expected: one docs-only commit after the first real cloud dry run succeeds.

## Self-Review

- Spec coverage:
  - First-stage content-only backend: covered by Tasks 2-5.
  - `soundSourceService` remains the page boundary: covered by Task 3.
  - Local fallback stays available: covered by Task 3 and Task 6.
  - MongoDB + object storage/CDN setup path: covered by Task 5.
  - No login / favorites / history in this milestone: intentionally excluded from all tasks.

- Placeholder scan:
  - No `TODO` / `TBD` placeholders remain.
  - CDN URLs inside the seed file intentionally use `cdn.example.com` as a replace-before-seed value; the replacement step is explicit in `docs/douyin-cloud-content-setup.md`.

- Type consistency:
  - Frontend cloud response uses `groups[].sounds[]`.
  - Backend builder emits exactly that shape.
  - Frontend mapper consumes exactly that shape.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-06-douyin-cloud-content-backend.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
