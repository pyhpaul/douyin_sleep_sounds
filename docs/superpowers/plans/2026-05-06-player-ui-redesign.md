# Player UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the home screen from a Web-style landing page into a Douyin mini app music-player/radio-style UI.

**Architecture:** Keep all real UI under `miniprogram/pages/index/`. Do not restore Web Preview. Preserve existing page data names and playback behavior unless a view model field is needed for layout.

**Tech Stack:** Native Douyin mini app TTML/TTSS/JavaScript, Node built-in tests.

---

## File Structure

- Modify: `miniprogram/pages/index/index.ttml`
  - Owns the real mini app page structure.
  - Introduces player-centric layout classes.
- Modify: `miniprogram/pages/index/index.ttss`
  - Owns all page visual styling.
  - Replaces Web-card styling with player/radio styling.
- Modify: `tests/toolingConfig.test.js`
  - Adds guard tests for no Web Preview and expected UI structure classes.
- Optional modify: `miniprogram/pages/index/index.js`
  - Only if the UI needs a small view-model field; current plan does not require it.

## Task 1: Lock UI structure expectations

**Files:**
- Modify: `tests/toolingConfig.test.js`
- Read: `miniprogram/pages/index/index.ttml`
- Read: `miniprogram/pages/index/index.ttss`

- [ ] **Step 1: Add failing UI structure test**

Append this test to `tests/toolingConfig.test.js`:

```js
test("index page exposes player and radio layout classes", () => {
  const ttml = fs.readFileSync("miniprogram/pages/index/index.ttml", "utf8");
  const ttss = fs.readFileSync("miniprogram/pages/index/index.ttss", "utf8");

  for (const className of [
    "player-shell",
    "album-art",
    "playback-panel",
    "transport-row",
    "radio-section",
    "station-card"
  ]) {
    assert.match(ttml, new RegExp(`class="[^"]*${className}`));
    assert.match(ttss, new RegExp(`\\.${className}\\b`));
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test tests/toolingConfig.test.js
```

Expected: FAIL because current TTML/TTSS do not contain the new player/radio classes.

- [ ] **Step 3: Commit is not needed yet**

Do not commit the failing test by itself unless work is interrupted.

## Task 2: Replace page TTML with player-first structure

**Files:**
- Modify: `miniprogram/pages/index/index.ttml`

- [ ] **Step 1: Replace TTML structure**

Replace `miniprogram/pages/index/index.ttml` with:

```xml
<view class="page">
  <view class="ambient ambient-one"></view>
  <view class="ambient ambient-two"></view>

  <view class="hero compact-hero">
    <view class="eyebrow">SLEEP RADIO</view>
    <view class="title">晚安声音</view>
    <view class="subtitle">用一段声音，把夜晚慢下来</view>
  </view>

  <view class="player-shell">
    <view class="album-art">
      <view class="album-glow"></view>
      <view class="album-disc">
        <view class="album-hole"></view>
      </view>
    </view>

    <view class="playback-panel">
      <view class="now-label">当前播放</view>
      <view class="now-title">{{currentSoundTitle}}</view>
      <view class="now-meta">
        <text class="pill">{{currentSoundCategoryText}}</text>
        <text class="pill">{{playbackText}}</text>
        <text class="pill">{{remainingText}}</text>
      </view>

      <view class="transport-row">
        <button class="primary-control" bindtap="handlePlayToggle">
          {{isPlaying ? "暂停" : "播放"}}
        </button>
      </view>

      <view class="player-options">
        <view class="loop-row">
          <view>
            <view class="loop-title">循环播放</view>
            <view class="loop-desc">当前声音结束后自动重播</view>
          </view>
          <switch checked="{{isLooping}}" bindchange="handleLoopChange" color="#f4c77a" />
        </view>

        <view class="timer-section">
          <view class="timer-title">定时停止</view>
          <view class="timer-options">
            <button
              tt:for="{{timerOptions}}"
              tt:key="minutes"
              class="timer-chip {{item.isActive ? 'timer-chip-active' : ''}}"
              data-minutes="{{item.minutes}}"
              bindtap="handleTimerTap"
            >
              {{item.label}}
            </button>
          </view>
        </view>
      </view>
    </view>
  </view>

  <view tt:if="{{hasSounds}}" class="radio-section">
    <view class="section-kicker">频道</view>
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

      <view class="station-list">
        <view
          tt:for="{{group.sounds}}"
          tt:for-item="sound"
          tt:key="id"
          class="station-card {{sound.isActive ? 'station-card-active' : ''}}"
          data-id="{{sound.id}}"
          bindtap="handleSoundTap"
        >
          <view class="station-icon"></view>
          <view class="station-body">
            <view class="sound-title">{{sound.title}}</view>
            <view class="sound-desc">{{sound.description}}</view>
          </view>
        </view>
      </view>
    </view>
  </view>

  <view tt:else class="empty-card">暂无可播放声音</view>

  <view class="footer-note">
    当前声音源来自本地配置；上线前请替换为授权音频资源。
  </view>
</view>
```

- [ ] **Step 2: Run syntax check**

Run:

```powershell
npm run check
```

Expected: PASS. TTML is not checked by `node --check`, but this confirms JS scripts remain valid.

## Task 3: Replace TTSS with player/radio visual system

**Files:**
- Modify: `miniprogram/pages/index/index.ttss`

- [ ] **Step 1: Replace TTSS**

Replace `miniprogram/pages/index/index.ttss` with:

```css
.page {
  position: relative;
  min-height: 100vh;
  box-sizing: border-box;
  overflow: hidden;
  padding: 44rpx 32rpx 64rpx;
  background:
    radial-gradient(circle at 50% -12%, rgba(244, 199, 122, 0.22), transparent 34%),
    radial-gradient(circle at 92% 18%, rgba(107, 128, 255, 0.20), transparent 30%),
    linear-gradient(180deg, #080b13 0%, #111827 48%, #070a10 100%);
}

.ambient {
  position: absolute;
  border-radius: 999rpx;
  pointer-events: none;
}

.ambient-one {
  top: 148rpx;
  left: -120rpx;
  width: 300rpx;
  height: 300rpx;
  background: rgba(244, 199, 122, 0.12);
  filter: blur(12rpx);
}

.ambient-two {
  right: -160rpx;
  top: 520rpx;
  width: 360rpx;
  height: 360rpx;
  background: rgba(91, 110, 255, 0.14);
  filter: blur(12rpx);
}

.hero,
.player-shell,
.radio-section,
.empty-card,
.footer-note {
  position: relative;
  z-index: 1;
}

.compact-hero {
  margin-bottom: 28rpx;
}

.eyebrow {
  margin-bottom: 10rpx;
  color: #f4c77a;
  font-size: 21rpx;
  letter-spacing: 5rpx;
}

.title {
  color: #fff8ea;
  font-size: 52rpx;
  font-weight: 700;
}

.subtitle {
  margin-top: 10rpx;
  color: rgba(255, 248, 234, 0.62);
  font-size: 27rpx;
}

.player-shell {
  padding: 30rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.10);
  border-radius: 42rpx;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.13), rgba(255, 255, 255, 0.055));
  box-shadow: 0 34rpx 120rpx rgba(0, 0, 0, 0.36);
}

.album-art {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 430rpx;
  height: 430rpx;
  margin: 8rpx auto 28rpx;
}

.album-glow {
  position: absolute;
  width: 360rpx;
  height: 360rpx;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(244, 199, 122, 0.34), rgba(244, 199, 122, 0));
}

.album-disc {
  position: relative;
  width: 350rpx;
  height: 350rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.20);
  border-radius: 50%;
  background:
    radial-gradient(circle at 50% 50%, #171923 0 16%, transparent 17%),
    conic-gradient(from 120deg, #f4c77a, #7d8dff, #24304b, #f4c77a);
  box-shadow: inset 0 0 54rpx rgba(0, 0, 0, 0.44), 0 26rpx 76rpx rgba(0, 0, 0, 0.34);
}

.album-hole {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 74rpx;
  height: 74rpx;
  margin-top: -37rpx;
  margin-left: -37rpx;
  border-radius: 50%;
  background: #090d16;
  box-shadow: 0 0 0 18rpx rgba(255, 255, 255, 0.10);
}

.playback-panel {
  text-align: center;
}

.now-label {
  color: rgba(255, 248, 234, 0.52);
  font-size: 23rpx;
}

.now-title {
  margin-top: 12rpx;
  color: #ffffff;
  font-size: 46rpx;
  font-weight: 700;
}

.now-meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  margin-top: 20rpx;
}

.pill {
  display: inline-flex;
  margin: 0 8rpx 12rpx;
  padding: 9rpx 18rpx;
  border-radius: 999rpx;
  background: rgba(244, 199, 122, 0.14);
  color: rgba(255, 248, 234, 0.82);
  font-size: 23rpx;
}

.transport-row {
  display: flex;
  justify-content: center;
  margin-top: 18rpx;
}

.primary-control {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 188rpx;
  height: 88rpx;
  border-radius: 999rpx;
  background: linear-gradient(135deg, #ffe1a3, #f4c77a);
  color: #17120a;
  font-size: 31rpx;
  font-weight: 700;
  box-shadow: 0 18rpx 44rpx rgba(244, 199, 122, 0.24);
}

.player-options {
  margin-top: 28rpx;
  padding-top: 24rpx;
  border-top: 1rpx solid rgba(255, 255, 255, 0.08);
  text-align: left;
}

.loop-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.loop-title,
.timer-title {
  color: #fff8ea;
  font-size: 28rpx;
  font-weight: 600;
}

.loop-desc {
  margin-top: 8rpx;
  color: rgba(255, 248, 234, 0.48);
  font-size: 23rpx;
}

.timer-section {
  margin-top: 28rpx;
}

.timer-options {
  display: flex;
  flex-wrap: wrap;
  margin-top: 16rpx;
  margin-right: -12rpx;
  margin-bottom: -12rpx;
}

.timer-chip {
  min-width: 120rpx;
  margin: 0 12rpx 12rpx 0;
  padding: 16rpx 20rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.075);
  color: rgba(255, 248, 234, 0.68);
  font-size: 24rpx;
}

.timer-chip-active {
  background: rgba(244, 199, 122, 0.22);
  color: #ffffff;
}

.radio-section {
  margin-top: 42rpx;
}

.section-kicker {
  margin-bottom: 20rpx;
  color: rgba(255, 248, 234, 0.44);
  font-size: 22rpx;
  letter-spacing: 4rpx;
}

.sound-group {
  margin-top: 34rpx;
}

.group-header {
  margin-bottom: 18rpx;
}

.group-title {
  color: #fff8ea;
  font-size: 33rpx;
  font-weight: 700;
}

.group-subtitle {
  margin-top: 6rpx;
  color: rgba(255, 248, 234, 0.48);
  font-size: 24rpx;
}

.station-list {
  display: flex;
  flex-direction: column;
}

.station-card {
  display: flex;
  align-items: center;
  min-height: 132rpx;
  box-sizing: border-box;
  margin-bottom: 16rpx;
  padding: 20rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.08);
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.06);
}

.station-card-active {
  border-color: rgba(244, 199, 122, 0.70);
  background: linear-gradient(135deg, rgba(244, 199, 122, 0.20), rgba(255, 255, 255, 0.06));
}

.station-icon {
  flex: 0 0 auto;
  width: 76rpx;
  height: 76rpx;
  margin-right: 20rpx;
  border-radius: 24rpx;
  background:
    radial-gradient(circle at 34% 30%, rgba(255, 255, 255, 0.65), transparent 18%),
    linear-gradient(135deg, rgba(244, 199, 122, 0.94), rgba(125, 141, 255, 0.82));
}

.station-body {
  flex: 1;
}

.sound-title {
  color: #ffffff;
  font-size: 29rpx;
  font-weight: 650;
}

.sound-desc {
  margin-top: 8rpx;
  color: rgba(255, 248, 234, 0.52);
  font-size: 23rpx;
  line-height: 1.42;
}

.empty-card {
  margin-top: 36rpx;
  padding: 40rpx;
  border-radius: 30rpx;
  background: rgba(255, 255, 255, 0.07);
  color: rgba(255, 248, 234, 0.70);
  text-align: center;
}

.footer-note {
  margin-top: 34rpx;
  color: rgba(255, 248, 234, 0.34);
  font-size: 22rpx;
  line-height: 1.5;
  text-align: center;
}
```

- [ ] **Step 2: Run UI guard test**

Run:

```powershell
npm test tests/toolingConfig.test.js
```

Expected: PASS.

## Task 4: Regression verification

**Files:**
- Read: `package.json`
- Read: `tests/*.test.js`
- Read: `scripts/check-syntax.js`

- [ ] **Step 1: Run page runtime tests**

Run:

```powershell
npm run debug:page
```

Expected: PASS. Existing playback behavior remains stable.

- [ ] **Step 2: Run syntax checks**

Run:

```powershell
npm run check
```

Expected: PASS.

- [ ] **Step 3: Run full tests**

Run:

```powershell
npm test
```

Expected: PASS with all tests green.

- [ ] **Step 4: Manual validation in Douyin DevTools Lite mode**

Open/import `E:\douyinProj\test` in Douyin DevTools Lite mode and verify:

```text
1. 首页视觉以当前播放为主，像音乐播放器/电台小程序。
2. 当前声音、分类、播放状态、倒计时显示正常。
3. 点击声音可切换并播放。
4. 播放/暂停按钮状态正确。
5. 循环开关可切换。
6. 定时按钮可切换，倒计时正常。
```

- [ ] **Step 5: Commit UI redesign**

Run:

```powershell
git add -- miniprogram/pages/index/index.ttml miniprogram/pages/index/index.ttss tests/toolingConfig.test.js docs/superpowers/plans/2026-05-06-player-ui-redesign.md
git commit -m "feat: redesign home as player interface" -m "Why:" -m "- move the mini app UI toward a player/radio experience" -m "What:" -m "- update TTML/TTSS with player-first layout and radio station list" -m "- add tooling guard for expected UI structure" -m "Test:" -m "- npm run check" -m "- npm run debug:page" -m "- npm test"
```

## Self-Review

- Spec coverage: Milestone 2 calls for player-first UI, current playback as main visual, radio-style categories, DevTools Lite as UI authority, and no Web Preview. Tasks cover all.
- Placeholder scan: no TBD/TODO/fill-in-later placeholders.
- Type/name consistency: class names in tests match TTML and TTSS examples.
