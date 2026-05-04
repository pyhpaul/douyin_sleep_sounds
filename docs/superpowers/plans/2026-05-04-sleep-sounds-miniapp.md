# Sleep Sounds Miniapp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a native Douyin mini app in `E:/douyinProj/test` for sleep-aid background sounds with background playback, timer stop, and loop playback.

**Architecture:** Use a single native mini app page backed by local sound data and a service boundary. Keep pure logic in `utils/` with Node tests, and keep Douyin runtime calls inside `pages/index/index.js`.

**Tech Stack:** Douyin native mini app (`TTML`, `TTSS`, JavaScript), `tt.getBackgroundAudioManager()`, Node built-in `node:test`.

---

## File Structure

Create and maintain these files:

- `package.json` - local scripts for Node logic tests and syntax checks.
- `project.config.json` - Douyin developer tool project metadata.
- `app.js` - mini app bootstrap.
- `app.json` - page registration and navigation bar styling.
- `app.ttss` - global page styles.
- `data/sounds.js` - local sound catalog with 3 groups and 6 sounds.
- `services/soundSourceService.js` - data source boundary for current local catalog and future remote API.
- `utils/timer.js` - pure timer option, conversion, and formatting helpers.
- `utils/playbackState.js` - pure sound selection and view-model helpers.
- `pages/index/index.json` - page-level config.
- `pages/index/index.ttml` - page markup.
- `pages/index/index.ttss` - page styling.
- `pages/index/index.js` - page orchestration and Douyin background audio integration.
- `tests/timer.test.js` - tests for `utils/timer.js`.
- `tests/playbackState.test.js` - tests for `utils/playbackState.js`.
- `tests/soundSourceService.test.js` - tests for `services/soundSourceService.js`.

Official API reference used for implementation: Douyin mini app `BackgroundAudioManager` supports background audio playback and events such as play, pause, stop, ended, and error.

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `project.config.json`
- Create: `app.js`
- Create: `app.json`
- Create: `app.ttss`
- Create: `pages/index/index.json`

- [ ] **Step 1: Create project directories**

Run:

```powershell
New-Item -ItemType Directory -Force -Path 'E:\douyinProj\test\pages\index','E:\douyinProj\test\data','E:\douyinProj\test\services','E:\douyinProj\test\utils','E:\douyinProj\test\tests' | Out-Null
```

Expected: command exits successfully.

- [ ] **Step 2: Create scaffold files**

Create `package.json`:

```json
{
  "name": "douyin-sleep-sounds",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "test": "node --test tests",
    "check": "node --check app.js && node --check pages/index/index.js && node --check utils/timer.js && node --check utils/playbackState.js && node --check services/soundSourceService.js"
  }
}
```

Create `project.config.json`:

```json
{
  "appid": "touristappid",
  "projectname": "sleep-sounds",
  "miniprogramRoot": "./",
  "setting": {
    "urlCheck": false,
    "es6": true,
    "postcss": true,
    "minified": false
  }
}
```

Create `app.js`:

```js
App({
  onLaunch() {}
});
```

Create `app.json`:

```json
{
  "pages": [
    "pages/index/index"
  ],
  "window": {
    "navigationBarTitleText": "晚安声音",
    "navigationBarBackgroundColor": "#07111f",
    "navigationBarTextStyle": "white",
    "backgroundColor": "#07111f"
  }
}
```

Create `app.ttss`:

```css
page {
  min-height: 100%;
  background: #07111f;
  color: #f7fbff;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

button {
  margin: 0;
  padding: 0;
  border-radius: 0;
  background: transparent;
  color: inherit;
  line-height: normal;
}

button::after {
  border: 0;
}
```

Create `pages/index/index.json`:

```json
{
  "navigationBarTitleText": "晚安声音",
  "navigationBarBackgroundColor": "#07111f",
  "navigationBarTextStyle": "white"
}
```

- [ ] **Step 3: Validate JSON and JavaScript syntax**

Run:

```powershell
node -e "for (const file of ['package.json','project.config.json','app.json','pages/index/index.json']) JSON.parse(require('fs').readFileSync(file, 'utf8')); console.log('json ok')"
node --check app.js
```

Expected:

```text
json ok
```

and `node --check app.js` exits with code `0`.

- [ ] **Step 4: Commit scaffold**

Run:

```powershell
git add -- package.json project.config.json app.js app.json app.ttss pages/index/index.json
git commit -m "chore: scaffold douyin miniapp"
```

Expected: commit succeeds.

---

### Task 2: Timer Utility

**Files:**
- Create: `tests/timer.test.js`
- Create: `utils/timer.js`

- [ ] **Step 1: Write failing timer tests**

Create `tests/timer.test.js`:

```js
const assert = require("node:assert/strict");
const test = require("node:test");

const {
  getTimerOptions,
  minutesToMs,
  getTimerEndAt,
  formatRemaining,
  isTimerExpired
} = require("../utils/timer");

test("returns the supported timer options in display order", () => {
  assert.deepEqual(getTimerOptions(), [
    { label: "关闭", minutes: 0 },
    { label: "15 分钟", minutes: 15 },
    { label: "30 分钟", minutes: 30 },
    { label: "45 分钟", minutes: 45 },
    { label: "60 分钟", minutes: 60 }
  ]);
});

test("converts positive minutes to milliseconds", () => {
  assert.equal(minutesToMs(15), 900000);
  assert.equal(minutesToMs(60), 3600000);
});

test("treats invalid or negative minutes as zero milliseconds", () => {
  assert.equal(minutesToMs(-1), 0);
  assert.equal(minutesToMs("abc"), 0);
});

test("returns zero end time when timer is disabled", () => {
  assert.equal(getTimerEndAt(1000, 0), 0);
});

test("calculates timer end time from a start timestamp", () => {
  assert.equal(getTimerEndAt(1000, 15), 901000);
});

test("formats active remaining time as MM:SS", () => {
  assert.equal(formatRemaining(66000, 1000), "01:05");
});

test("formats disabled timer as not enabled", () => {
  assert.equal(formatRemaining(0, 1000), "未开启");
});

test("formats expired timer as 00:00", () => {
  assert.equal(formatRemaining(60000, 60000), "00:00");
  assert.equal(formatRemaining(60000, 61000), "00:00");
});

test("detects expired active timer", () => {
  assert.equal(isTimerExpired(60000, 59999), false);
  assert.equal(isTimerExpired(60000, 60000), true);
  assert.equal(isTimerExpired(0, 60000), false);
});
```

- [ ] **Step 2: Run timer tests and verify RED**

Run:

```powershell
npm test -- tests/timer.test.js
```

Expected: FAIL with a module load error for `../utils/timer`.

- [ ] **Step 3: Implement timer utility**

Create `utils/timer.js`:

```js
const TIMER_OPTIONS = [
  { label: "关闭", minutes: 0 },
  { label: "15 分钟", minutes: 15 },
  { label: "30 分钟", minutes: 30 },
  { label: "45 分钟", minutes: 45 },
  { label: "60 分钟", minutes: 60 }
];

function getTimerOptions() {
  return TIMER_OPTIONS.map((option) => ({ ...option }));
}

function minutesToMs(minutes) {
  const value = Number(minutes);
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return value * 60 * 1000;
}

function getTimerEndAt(startAtMs, minutes) {
  const durationMs = minutesToMs(minutes);
  if (durationMs === 0) {
    return 0;
  }
  return startAtMs + durationMs;
}

function formatRemaining(endAtMs, nowMs) {
  if (!endAtMs) {
    return "未开启";
  }

  const remainingMs = Math.max(0, endAtMs - nowMs);
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${pad2(minutes)}:${pad2(seconds)}`;
}

function isTimerExpired(endAtMs, nowMs) {
  return Boolean(endAtMs) && nowMs >= endAtMs;
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

module.exports = {
  getTimerOptions,
  minutesToMs,
  getTimerEndAt,
  formatRemaining,
  isTimerExpired
};
```

- [ ] **Step 4: Run timer tests and verify GREEN**

Run:

```powershell
npm test -- tests/timer.test.js
```

Expected: all tests in `tests/timer.test.js` pass.

- [ ] **Step 5: Commit timer utility**

Run:

```powershell
git add -- tests/timer.test.js utils/timer.js
git commit -m "feat: add timer utilities"
```

Expected: commit succeeds.

---

### Task 3: Playback State Utility

**Files:**
- Create: `tests/playbackState.test.js`
- Create: `utils/playbackState.js`

- [ ] **Step 1: Write failing playback state tests**

Create `tests/playbackState.test.js`:

```js
const assert = require("node:assert/strict");
const test = require("node:test");

const {
  flattenSoundGroups,
  findSoundById,
  selectInitialSoundId,
  selectSoundId,
  isCurrentSound,
  getCurrentSound,
  buildSoundGroupsViewModel
} = require("../utils/playbackState");

const soundGroups = [
  {
    id: "nature",
    title: "自然",
    sounds: [
      { id: "rain", title: "雨声", category: "自然" },
      { id: "wave", title: "海浪", category: "自然" }
    ]
  },
  {
    id: "white-noise",
    title: "白噪音",
    sounds: [
      { id: "fire", title: "篝火", category: "白噪音" }
    ]
  }
];

test("flattens grouped sounds while preserving order", () => {
  assert.deepEqual(
    flattenSoundGroups(soundGroups).map((sound) => sound.id),
    ["rain", "wave", "fire"]
  );
});

test("finds a sound by id across all groups", () => {
  assert.equal(findSoundById(soundGroups, "wave").title, "海浪");
  assert.equal(findSoundById(soundGroups, "missing"), null);
});

test("selects stored sound when it exists", () => {
  assert.equal(selectInitialSoundId(soundGroups, "wave"), "wave");
});

test("falls back to first sound when stored sound is missing", () => {
  assert.equal(selectInitialSoundId(soundGroups, "missing"), "rain");
});

test("returns empty selection for empty groups", () => {
  assert.equal(selectInitialSoundId([], "rain"), "");
  assert.equal(selectInitialSoundId(null, "rain"), "");
});

test("selects requested sound or keeps current sound when requested id is invalid", () => {
  assert.equal(selectSoundId(soundGroups, "fire", "rain"), "fire");
  assert.equal(selectSoundId(soundGroups, "missing", "wave"), "wave");
});

test("falls back to first sound when requested and current ids are invalid", () => {
  assert.equal(selectSoundId(soundGroups, "missing", "also-missing"), "rain");
});

test("detects whether a sound is current", () => {
  assert.equal(isCurrentSound("rain", "rain"), true);
  assert.equal(isCurrentSound("rain", "wave"), false);
  assert.equal(isCurrentSound("", "wave"), false);
});

test("returns the current sound object", () => {
  assert.equal(getCurrentSound(soundGroups, "fire").title, "篝火");
  assert.equal(getCurrentSound(soundGroups, "missing"), null);
});

test("builds a view model with active sound flags without mutating input", () => {
  const viewGroups = buildSoundGroupsViewModel(soundGroups, "wave");

  assert.equal(viewGroups[0].sounds[0].isActive, false);
  assert.equal(viewGroups[0].sounds[1].isActive, true);
  assert.equal(soundGroups[0].sounds[1].isActive, undefined);
  assert.notEqual(viewGroups, soundGroups);
});
```

- [ ] **Step 2: Run playback state tests and verify RED**

Run:

```powershell
npm test -- tests/playbackState.test.js
```

Expected: FAIL with a module load error for `../utils/playbackState`.

- [ ] **Step 3: Implement playback state utility**

Create `utils/playbackState.js`:

```js
function flattenSoundGroups(soundGroups) {
  if (!Array.isArray(soundGroups)) {
    return [];
  }

  return soundGroups.reduce((allSounds, group) => {
    const sounds = Array.isArray(group.sounds) ? group.sounds : [];
    return allSounds.concat(sounds);
  }, []);
}

function findSoundById(soundGroups, soundId) {
  if (!soundId) {
    return null;
  }

  return flattenSoundGroups(soundGroups).find((sound) => sound.id === soundId) || null;
}

function selectInitialSoundId(soundGroups, storedSoundId) {
  const storedSound = findSoundById(soundGroups, storedSoundId);
  if (storedSound) {
    return storedSound.id;
  }

  const firstSound = flattenSoundGroups(soundGroups)[0];
  return firstSound ? firstSound.id : "";
}

function selectSoundId(soundGroups, requestedSoundId, currentSoundId) {
  const requestedSound = findSoundById(soundGroups, requestedSoundId);
  if (requestedSound) {
    return requestedSound.id;
  }

  const currentSound = findSoundById(soundGroups, currentSoundId);
  if (currentSound) {
    return currentSound.id;
  }

  return selectInitialSoundId(soundGroups, "");
}

function isCurrentSound(soundId, currentSoundId) {
  return Boolean(soundId) && soundId === currentSoundId;
}

function getCurrentSound(soundGroups, currentSoundId) {
  return findSoundById(soundGroups, currentSoundId);
}

function buildSoundGroupsViewModel(soundGroups, currentSoundId) {
  if (!Array.isArray(soundGroups)) {
    return [];
  }

  return soundGroups.map((group) => ({
    ...group,
    sounds: Array.isArray(group.sounds)
      ? group.sounds.map((sound) => ({
          ...sound,
          isActive: isCurrentSound(sound.id, currentSoundId)
        }))
      : []
  }));
}

module.exports = {
  flattenSoundGroups,
  findSoundById,
  selectInitialSoundId,
  selectSoundId,
  isCurrentSound,
  getCurrentSound,
  buildSoundGroupsViewModel
};
```

- [ ] **Step 4: Run playback state tests and verify GREEN**

Run:

```powershell
npm test -- tests/playbackState.test.js
```

Expected: all tests in `tests/playbackState.test.js` pass.

- [ ] **Step 5: Commit playback state utility**

Run:

```powershell
git add -- tests/playbackState.test.js utils/playbackState.js
git commit -m "feat: add playback state utilities"
```

Expected: commit succeeds.

---

### Task 4: Sound Source Service

**Files:**
- Create: `tests/soundSourceService.test.js`
- Create: `data/sounds.js`
- Create: `services/soundSourceService.js`

- [ ] **Step 1: Write failing sound source service tests**

Create `tests/soundSourceService.test.js`:

```js
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
```

- [ ] **Step 2: Run sound source service tests and verify RED**

Run:

```powershell
npm test -- tests/soundSourceService.test.js
```

Expected: FAIL with a module load error for `../services/soundSourceService`.

- [ ] **Step 3: Add local sound data**

Create `data/sounds.js`:

```js
const DEMO_AUDIO_URL = "https://sf1-ttcdn-tos.pstatp.com/obj/developer/sdk/0000-0001.mp3";

const soundGroups = [
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
        url: DEMO_AUDIO_URL,
        cover: ""
      },
      {
        id: "wave",
        title: "海浪",
        category: "自然",
        description: "轻缓海浪声，适合睡前稳定呼吸节奏。",
        url: DEMO_AUDIO_URL,
        cover: ""
      }
    ]
  },
  {
    id: "white-noise",
    title: "白噪音",
    subtitle: "持续、柔和、低干扰的背景声音。",
    sounds: [
      {
        id: "fire",
        title: "篝火",
        category: "白噪音",
        description: "温暖的火焰声，适合夜间阅读后入睡。",
        url: DEMO_AUDIO_URL,
        cover: ""
      },
      {
        id: "wind",
        title: "风声",
        category: "白噪音",
        description: "平稳风声，减少突兀环境声带来的打扰。",
        url: DEMO_AUDIO_URL,
        cover: ""
      }
    ]
  },
  {
    id: "relax",
    title: "放松冥想",
    subtitle: "更轻的旋律和呼吸引导，适合准备入睡。",
    sounds: [
      {
        id: "soft-music",
        title: "轻音乐",
        category: "放松冥想",
        description: "柔和旋律，帮助从工作状态切换到休息状态。",
        url: DEMO_AUDIO_URL,
        cover: ""
      },
      {
        id: "deep-breath",
        title: "深呼吸",
        category: "放松冥想",
        description: "慢节奏呼吸感声音，适合睡前冥想练习。",
        url: DEMO_AUDIO_URL,
        cover: ""
      }
    ]
  }
];

module.exports = {
  soundGroups
};
```

- [ ] **Step 4: Implement sound source service**

Create `services/soundSourceService.js`:

```js
const { soundGroups } = require("../data/sounds");

function getSoundGroups() {
  return soundGroups.map((group) => ({
    ...group,
    sounds: group.sounds.map((sound) => ({ ...sound }))
  }));
}

module.exports = {
  getSoundGroups
};
```

- [ ] **Step 5: Run sound source service tests and verify GREEN**

Run:

```powershell
npm test -- tests/soundSourceService.test.js
```

Expected: all tests in `tests/soundSourceService.test.js` pass.

- [ ] **Step 6: Run all logic tests**

Run:

```powershell
npm test
```

Expected: all test files pass.

- [ ] **Step 7: Commit sound source service**

Run:

```powershell
git add -- tests/soundSourceService.test.js data/sounds.js services/soundSourceService.js
git commit -m "feat: add local sound source service"
```

Expected: commit succeeds.

---

### Task 5: Main Page Markup and Styles

**Files:**
- Create: `pages/index/index.ttml`
- Create: `pages/index/index.ttss`
- Modify: `app.ttss`

- [ ] **Step 1: Add page markup**

Create `pages/index/index.ttml`:

```xml
<view class="page">
  <view class="hero">
    <view class="eyebrow">SLEEP SOUNDS</view>
    <view class="title">晚安声音</view>
    <view class="subtitle">选择一段声音，慢慢入睡</view>
  </view>

  <view class="now-card">
    <view class="now-label">当前播放</view>
    <view class="now-title">{{currentSoundTitle}}</view>
    <view class="now-meta">
      <text class="pill">{{currentSoundCategory || "未选择"}}</text>
      <text class="pill">{{playbackText}}</text>
      <text class="pill">{{remainingText}}</text>
    </view>
  </view>

  <view tt:if="{{hasSounds}}" class="sound-list">
    <view
      tt:for="{{soundGroups}}"
      tt:for-item="group"
      tt:key="id"
      class="sound-group"
    >
      <view class="group-header">
        <view class="group-title">{{group.title}}</view>
        <view class="group-subtitle">{{group.subtitle}}</view>
      </view>

      <view class="sound-grid">
        <view
          tt:for="{{group.sounds}}"
          tt:for-item="sound"
          tt:key="id"
          class="sound-card {{sound.isActive ? 'sound-card-active' : ''}}"
          data-id="{{sound.id}}"
          bindtap="handleSoundTap"
        >
          <view class="sound-title">{{sound.title}}</view>
          <view class="sound-desc">{{sound.description}}</view>
        </view>
      </view>
    </view>
  </view>

  <view tt:else class="empty-card">暂无可播放声音</view>

  <view class="controls">
    <button class="primary-control" bindtap="handlePlayToggle">
      {{isPlaying ? "暂停" : "播放"}}
    </button>

    <view class="loop-row">
      <view>
        <view class="loop-title">循环播放</view>
        <view class="loop-desc">开启后当前声音结束会自动重播</view>
      </view>
      <switch checked="{{isLooping}}" bindchange="handleLoopChange" color="#8fb7ff" />
    </view>

    <view class="timer-section">
      <view class="timer-title">定时停止</view>
      <view class="timer-options">
        <button
          tt:for="{{timerOptions}}"
          tt:key="minutes"
          class="timer-chip {{selectedTimerMinutes === item.minutes ? 'timer-chip-active' : ''}}"
          data-minutes="{{item.minutes}}"
          bindtap="handleTimerTap"
        >
          {{item.label}}
        </button>
      </view>
    </view>
  </view>

  <view class="footer-note">
    当前声音源来自本地配置；上线前请替换为授权音频资源。
  </view>
</view>
```

- [ ] **Step 2: Add page styles**

Create `pages/index/index.ttss`:

```css
.page {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 48rpx 32rpx 64rpx;
  background:
    radial-gradient(circle at 20% 0%, rgba(89, 126, 255, 0.24), transparent 34%),
    radial-gradient(circle at 90% 12%, rgba(114, 210, 255, 0.16), transparent 30%),
    linear-gradient(180deg, #07111f 0%, #0c1728 52%, #080d17 100%);
}

.hero {
  margin-bottom: 32rpx;
}

.eyebrow {
  margin-bottom: 12rpx;
  color: #8fb7ff;
  font-size: 22rpx;
  letter-spacing: 4rpx;
}

.title {
  color: #f7fbff;
  font-size: 56rpx;
  font-weight: 700;
}

.subtitle {
  margin-top: 10rpx;
  color: rgba(247, 251, 255, 0.66);
  font-size: 28rpx;
}

.now-card,
.empty-card,
.controls {
  border: 1rpx solid rgba(255, 255, 255, 0.08);
  border-radius: 32rpx;
  background: rgba(255, 255, 255, 0.08);
  box-shadow: 0 24rpx 80rpx rgba(0, 0, 0, 0.22);
  backdrop-filter: blur(12rpx);
}

.now-card {
  padding: 32rpx;
}

.now-label {
  color: rgba(247, 251, 255, 0.56);
  font-size: 24rpx;
}

.now-title {
  margin-top: 14rpx;
  color: #ffffff;
  font-size: 42rpx;
  font-weight: 650;
}

.now-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 20rpx;
}

.pill {
  padding: 10rpx 18rpx;
  border-radius: 999rpx;
  background: rgba(143, 183, 255, 0.16);
  color: #d9e6ff;
  font-size: 24rpx;
}

.sound-list {
  margin-top: 36rpx;
}

.sound-group {
  margin-top: 36rpx;
}

.group-header {
  margin-bottom: 18rpx;
}

.group-title {
  color: #f7fbff;
  font-size: 34rpx;
  font-weight: 650;
}

.group-subtitle {
  margin-top: 6rpx;
  color: rgba(247, 251, 255, 0.56);
  font-size: 24rpx;
}

.sound-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18rpx;
}

.sound-card {
  min-height: 156rpx;
  box-sizing: border-box;
  padding: 24rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.08);
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.07);
}

.sound-card-active {
  border-color: rgba(143, 183, 255, 0.88);
  background: linear-gradient(135deg, rgba(143, 183, 255, 0.32), rgba(83, 118, 211, 0.18));
}

.sound-title {
  color: #ffffff;
  font-size: 30rpx;
  font-weight: 650;
}

.sound-desc {
  margin-top: 12rpx;
  color: rgba(247, 251, 255, 0.58);
  font-size: 23rpx;
  line-height: 1.45;
}

.empty-card {
  margin-top: 36rpx;
  padding: 40rpx;
  color: rgba(247, 251, 255, 0.72);
  text-align: center;
}

.controls {
  margin-top: 42rpx;
  padding: 28rpx;
}

.primary-control {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 96rpx;
  border-radius: 999rpx;
  background: linear-gradient(135deg, #8fb7ff, #6178ff);
  color: #08111f;
  font-size: 32rpx;
  font-weight: 700;
}

.loop-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 30rpx;
  padding: 8rpx 4rpx;
}

.loop-title,
.timer-title {
  color: #f7fbff;
  font-size: 30rpx;
  font-weight: 650;
}

.loop-desc {
  margin-top: 8rpx;
  color: rgba(247, 251, 255, 0.52);
  font-size: 24rpx;
}

.timer-section {
  margin-top: 30rpx;
}

.timer-options {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
  margin-top: 18rpx;
}

.timer-chip {
  min-width: 128rpx;
  padding: 18rpx 22rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(247, 251, 255, 0.72);
  font-size: 25rpx;
}

.timer-chip-active {
  background: rgba(143, 183, 255, 0.24);
  color: #ffffff;
}

.footer-note {
  margin-top: 32rpx;
  color: rgba(247, 251, 255, 0.42);
  font-size: 22rpx;
  line-height: 1.5;
  text-align: center;
}
```

- [ ] **Step 3: Confirm global styles remain in place**

Ensure `app.ttss` still contains:

```css
page {
  min-height: 100%;
  background: #07111f;
  color: #f7fbff;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

button {
  margin: 0;
  padding: 0;
  border-radius: 0;
  background: transparent;
  color: inherit;
  line-height: normal;
}

button::after {
  border: 0;
}
```

- [ ] **Step 4: Commit markup and styles**

Run:

```powershell
git add -- pages/index/index.ttml pages/index/index.ttss app.ttss
git commit -m "feat: add sleep sounds page UI"
```

Expected: commit succeeds.

---

### Task 6: Page Logic and Background Audio

**Files:**
- Create: `pages/index/index.js`

- [ ] **Step 1: Add page orchestration**

Create `pages/index/index.js`:

```js
const { getSoundGroups } = require("../../services/soundSourceService");
const {
  getTimerOptions,
  getTimerEndAt,
  formatRemaining,
  isTimerExpired
} = require("../../utils/timer");
const {
  selectInitialSoundId,
  selectSoundId,
  getCurrentSound,
  buildSoundGroupsViewModel
} = require("../../utils/playbackState");

const STORAGE_KEYS = {
  CURRENT_SOUND_ID: "sleepSounds.currentSoundId",
  IS_LOOPING: "sleepSounds.isLooping",
  TIMER_MINUTES: "sleepSounds.timerMinutes"
};

const TIMER_TICK_MS = 1000;
const DEFAULT_REMAINING_TEXT = "未开启";

function showToast(title) {
  if (typeof tt !== "undefined" && tt.showToast) {
    tt.showToast({ title, icon: "none" });
  }
}

Page({
  data: {
    soundGroups: [],
    timerOptions: getTimerOptions(),
    currentSoundId: "",
    currentSoundTitle: "未选择声音",
    currentSoundCategory: "",
    playbackText: "未选择",
    isPlaying: false,
    isLooping: false,
    selectedTimerMinutes: 0,
    remainingText: DEFAULT_REMAINING_TEXT,
    hasSounds: false
  },

  onLoad() {
    this.rawSoundGroups = [];
    this.audioManager = null;
    this.audioListeners = null;
    this.timerInterval = null;
    this.timerEndAt = 0;

    this.initAudioManager();
    this.loadInitialState();
  },

  onUnload() {
    this.clearTimerTicker();
    this.removeAudioListeners();
  },

  loadInitialState() {
    this.rawSoundGroups = getSoundGroups();

    const storedSoundId = this.readStorage(STORAGE_KEYS.CURRENT_SOUND_ID, "");
    const currentSoundId = selectInitialSoundId(this.rawSoundGroups, storedSoundId);
    const isLooping = Boolean(this.readStorage(STORAGE_KEYS.IS_LOOPING, false));
    const selectedTimerMinutes = Number(this.readStorage(STORAGE_KEYS.TIMER_MINUTES, 0)) || 0;

    this.refreshView({
      currentSoundId,
      isLooping,
      selectedTimerMinutes,
      remainingText: this.getArmedTimerText(selectedTimerMinutes),
      hasSounds: Boolean(currentSoundId)
    });
  },

  initAudioManager() {
    if (typeof tt === "undefined" || !tt.getBackgroundAudioManager) {
      return;
    }

    const audio = tt.getBackgroundAudioManager();
    this.audioManager = audio;
    this.audioListeners = {
      play: () => this.refreshView({ isPlaying: true }),
      pause: () => this.refreshView({ isPlaying: false }),
      stop: () => this.refreshView({ isPlaying: false }),
      ended: () => this.handleAudioEnded(),
      error: () => {
        this.refreshView({ isPlaying: false });
        showToast("声音暂时无法播放，请稍后再试");
      }
    };

    audio.onPlay(this.audioListeners.play);
    audio.onPause(this.audioListeners.pause);
    audio.onStop(this.audioListeners.stop);
    audio.onEnded(this.audioListeners.ended);
    audio.onError(this.audioListeners.error);
  },

  removeAudioListeners() {
    const audio = this.audioManager;
    const listeners = this.audioListeners;
    if (!audio || !listeners) {
      return;
    }

    this.offAudioEvent(audio, "offPlay", listeners.play);
    this.offAudioEvent(audio, "offPause", listeners.pause);
    this.offAudioEvent(audio, "offStop", listeners.stop);
    this.offAudioEvent(audio, "offEnded", listeners.ended);
    this.offAudioEvent(audio, "offError", listeners.error);
  },

  offAudioEvent(audio, methodName, listener) {
    if (typeof audio[methodName] === "function") {
      audio[methodName](listener);
    }
  },

  handleSoundTap(event) {
    const requestedSoundId = event.currentTarget.dataset.id;
    const nextSoundId = selectSoundId(
      this.rawSoundGroups,
      requestedSoundId,
      this.data.currentSoundId
    );

    if (!nextSoundId) {
      showToast("暂无可播放声音");
      return;
    }

    if (nextSoundId === this.data.currentSoundId && this.data.isPlaying) {
      return;
    }

    this.writeStorage(STORAGE_KEYS.CURRENT_SOUND_ID, nextSoundId);
    this.refreshView({ currentSoundId: nextSoundId });
    this.playCurrentSound(nextSoundId);
  },

  handlePlayToggle() {
    if (this.data.isPlaying) {
      this.pauseCurrentSound();
      return;
    }

    const nextSoundId = selectSoundId(
      this.rawSoundGroups,
      this.data.currentSoundId,
      this.data.currentSoundId
    );

    if (!nextSoundId) {
      showToast("暂无可播放声音");
      return;
    }

    this.writeStorage(STORAGE_KEYS.CURRENT_SOUND_ID, nextSoundId);
    this.refreshView({ currentSoundId: nextSoundId });
    this.playCurrentSound(nextSoundId);
  },

  handleLoopChange(event) {
    const isLooping = Boolean(event.detail.value);
    this.writeStorage(STORAGE_KEYS.IS_LOOPING, isLooping);
    this.refreshView({ isLooping });
  },

  handleTimerTap(event) {
    const minutes = Number(event.currentTarget.dataset.minutes) || 0;
    this.writeStorage(STORAGE_KEYS.TIMER_MINUTES, minutes);

    if (minutes <= 0) {
      this.timerEndAt = 0;
      this.clearTimerTicker();
      this.refreshView({
        selectedTimerMinutes: 0,
        remainingText: DEFAULT_REMAINING_TEXT
      });
      return;
    }

    this.startTimer(minutes);
  },

  playCurrentSound(soundId) {
    const sound = getCurrentSound(this.rawSoundGroups, soundId);
    if (!sound) {
      showToast("暂无可播放声音");
      return;
    }

    const audio = this.audioManager;
    if (!audio) {
      showToast("当前环境不支持后台音频播放");
      return;
    }

    audio.title = sound.title;
    audio.epname = sound.category;
    audio.singer = "晚安声音";
    audio.coverImgUrl = sound.cover || "";
    audio.audioPage = { path: "pages/index/index" };

    if (audio.src === sound.url && typeof audio.play === "function") {
      audio.play();
    } else {
      audio.src = sound.url;
    }

    this.refreshView({ currentSoundId: soundId, isPlaying: true });

    if (this.data.selectedTimerMinutes > 0 && !this.timerEndAt) {
      this.startTimer(this.data.selectedTimerMinutes);
    }
  },

  pauseCurrentSound() {
    if (this.audioManager && typeof this.audioManager.pause === "function") {
      this.audioManager.pause();
    }
    this.refreshView({ isPlaying: false });
  },

  handleAudioEnded() {
    if (this.data.isLooping && !isTimerExpired(this.timerEndAt, Date.now())) {
      this.replayCurrentSound();
      return;
    }

    this.refreshView({ isPlaying: false });
  },

  replayCurrentSound() {
    const audio = this.audioManager;
    if (!audio) {
      return;
    }

    if (typeof audio.seek === "function") {
      audio.seek(0);
    }
    if (typeof audio.play === "function") {
      audio.play();
    }
    this.refreshView({ isPlaying: true });
  },

  startTimer(minutes) {
    const now = Date.now();
    this.timerEndAt = getTimerEndAt(now, minutes);
    this.clearTimerTicker();
    this.refreshView({
      selectedTimerMinutes: minutes,
      remainingText: formatRemaining(this.timerEndAt, now)
    });

    this.timerInterval = setInterval(() => {
      this.updateTimerRemaining();
    }, TIMER_TICK_MS);
  },

  updateTimerRemaining() {
    const now = Date.now();
    if (isTimerExpired(this.timerEndAt, now)) {
      this.stopForTimerEnd();
      return;
    }

    this.refreshView({
      remainingText: formatRemaining(this.timerEndAt, now)
    });
  },

  stopForTimerEnd() {
    this.timerEndAt = 0;
    this.clearTimerTicker();
    this.writeStorage(STORAGE_KEYS.TIMER_MINUTES, 0);

    if (this.audioManager && typeof this.audioManager.stop === "function") {
      this.audioManager.stop();
    }

    this.refreshView({
      isPlaying: false,
      selectedTimerMinutes: 0,
      remainingText: DEFAULT_REMAINING_TEXT
    });
    showToast("定时已结束");
  },

  clearTimerTicker() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  },

  refreshView(patch) {
    const nextData = {
      ...this.data,
      ...patch
    };
    const currentSound = getCurrentSound(this.rawSoundGroups, nextData.currentSoundId);

    this.setData({
      ...patch,
      soundGroups: buildSoundGroupsViewModel(this.rawSoundGroups, nextData.currentSoundId),
      currentSoundTitle: currentSound ? currentSound.title : "未选择声音",
      currentSoundCategory: currentSound ? currentSound.category : "",
      playbackText: this.getPlaybackText(nextData.isPlaying, currentSound),
      hasSounds: Boolean(selectInitialSoundId(this.rawSoundGroups, ""))
    });
  },

  getPlaybackText(isPlaying, currentSound) {
    if (!currentSound) {
      return "未选择";
    }
    return isPlaying ? "播放中" : "已暂停";
  },

  getArmedTimerText(minutes) {
    if (!minutes) {
      return DEFAULT_REMAINING_TEXT;
    }
    return formatRemaining(getTimerEndAt(Date.now(), minutes), Date.now());
  },

  readStorage(key, fallbackValue) {
    if (typeof tt === "undefined" || !tt.getStorageSync) {
      return fallbackValue;
    }

    try {
      const value = tt.getStorageSync(key);
      return value === undefined || value === null || value === "" ? fallbackValue : value;
    } catch (error) {
      return fallbackValue;
    }
  },

  writeStorage(key, value) {
    if (typeof tt === "undefined" || !tt.setStorageSync) {
      return;
    }

    try {
      tt.setStorageSync(key, value);
    } catch (error) {
      showToast("本地状态保存失败");
    }
  }
});
```

- [ ] **Step 2: Run JavaScript syntax checks**

Run:

```powershell
npm run check
```

Expected: all `node --check` commands exit with code `0`.

- [ ] **Step 3: Run all logic tests**

Run:

```powershell
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit page logic**

Run:

```powershell
git add -- pages/index/index.js
git commit -m "feat: wire sleep sounds playback page"
```

Expected: commit succeeds.

---

### Task 7: Final Verification and Douyin IDE Handoff

**Files:**
- Modify only if verification reveals a concrete issue in files from earlier tasks.

- [ ] **Step 1: Run full local verification**

Run:

```powershell
npm test
npm run check
git status --short
```

Expected:

- `npm test` passes.
- `npm run check` passes.
- `git status --short` shows no uncommitted implementation changes.

- [ ] **Step 2: Open the project in Douyin Developer Tools**

If `tt-ide-cli` is installed and authenticated, run:

```powershell
tma open E:\douyinProj\test
```

If the CLI is unavailable, manually open Douyin Developer Tools and import:

```text
E:/douyinProj/test
```

Expected: the developer tool opens the native mini app project.

- [ ] **Step 3: Compile in Douyin Developer Tools**

Use the developer tool compile button.

Expected:

- The page renders with dark sleep-themed UI.
- Three groups render: 自然、白噪音、放松冥想。
- Six sounds render: 雨声、海浪、篝火、风声、轻音乐、深呼吸。

- [ ] **Step 4: Validate playback behavior in the simulator**

Manual actions:

```text
1. Click 雨声.
2. Confirm 当前播放 shows 雨声 and 播放中.
3. Click 暂停.
4. Confirm 当前播放 shows 已暂停.
5. Click 播放.
6. Confirm playback returns to 播放中.
7. Click 海浪.
8. Confirm active card moves to 海浪.
```

Expected: state and highlighted sound update correctly.

- [ ] **Step 5: Validate loop and timer behavior**

Manual actions:

```text
1. Enable 循环播放.
2. Choose 15 分钟.
3. Confirm remaining time starts near 15:00.
4. Choose 关闭.
5. Confirm remaining text returns to 未开启.
```

Expected: loop switch and timer UI update correctly.

- [ ] **Step 6: Validate background playback**

Manual actions:

```text
1. Start any sound.
2. Send the mini app to background from the developer tool or test device.
3. Confirm audio continues playing.
```

Expected: audio continues because the page uses `tt.getBackgroundAudioManager()`.

- [ ] **Step 7: Record any runtime gaps**

If Douyin Developer Tools reports an API or markup compatibility issue, make the smallest targeted fix, then rerun:

```powershell
npm test
npm run check
```

Commit a concrete fix:

```powershell
git add -- <changed-files>
git commit -m "fix: resolve douyin runtime compatibility"
```

Expected: the fix is committed only after local verification and IDE recheck pass.
