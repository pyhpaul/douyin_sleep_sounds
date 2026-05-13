const assert = require("node:assert/strict");
const test = require("node:test");
const { createMiniAppRuntime } = require("./helpers/mockMiniAppRuntime");

test("loads sounds and selects first sound without auto playing", async () => {
  const runtime = createMiniAppRuntime();
  const page = runtime.loadPage("../miniprogram/pages/index/index.js");

  await page.call("onLoad");
  await runtime.flushAsync();

  assert.equal(page.data.hasSounds, true);
  assert.equal(page.data.pageMode, "channels");
  assert.equal(page.data.activeGroupId, "rain");
  assert.equal(page.data.soundGroupTabs.length, 7);
  assert.equal(page.data.soundGroupTabs[0].isActive, true);
  assert.equal(page.data.soundGroupTabs[0].thumbnail, "/assets/covers/rain_night.jpg");
  assert.equal(page.data.activeSoundGroup.title, "雨声");
  assert.equal(page.data.currentSoundTitle, "雨夜白噪音");
  assert.equal(page.data.currentSoundCover, "/assets/covers/rain_night.jpg");
  assert.equal(page.data.isLooping, true);
  assert.equal(page.data.isPlaying, false);
  assert.equal(runtime.audio.src, "");

  runtime.restore();
});

test("loads sounds from the single-domain HTTP provider on device runtime", async () => {
  const runtime = createMiniAppRuntime({
    request({ url, success }) {
      assert.equal(url, "https://sleep.zhenwei1.cn/content/bootstrap");
      success({
        statusCode: 200,
        data: {
          version: "2026-05-06T16:00:00Z",
          groups: [
            {
              id: "rain",
              title: "云端雨声",
              subtitle: "云端内容。",
              sounds: [
                {
                  id: "rain_night",
                  title: "云端雨夜",
                  category: "雨声",
                  description: "来自 HTTPS 内容服务。",
                  unlockLabel: "免费",
                  url: "https://sleep.zhenwei1.cn/audio/rain_night.mp3",
                  cover: "https://sleep.zhenwei1.cn/covers/rain_night.jpg"
                }
              ]
            }
          ]
        }
      });
    }
  });
  const page = runtime.loadPage("../miniprogram/pages/index/index.js");

  await page.call("onLoad");
  await runtime.flushAsync();

  assert.equal(page.data.activeSoundGroup.title, "云端雨声");
  assert.equal(page.data.currentSoundTitle, "云端雨夜");
  assert.equal(page.data.currentSoundCover, "https://sleep.zhenwei1.cn/covers/rain_night.jpg");

  page.call("handlePlayToggle");
  runtime.audio.emit("play");

  assert.equal(runtime.audio.src, "https://sleep.zhenwei1.cn/audio/rain_night.mp3");

  runtime.restore();
});

test("channel tab switches visible group without starting playback", async () => {
  const runtime = createMiniAppRuntime();
  const page = runtime.loadPage("../miniprogram/pages/index/index.js");

  await page.call("onLoad");
  await runtime.flushAsync();

  page.call("handleGroupTabTap", runtime.groupTabEvent("ambient"));

  assert.equal(page.data.activeGroupId, "ambient");
  assert.equal(page.data.activeSoundGroup.title, "氛围");
  assert.equal(page.data.currentSoundTitle, "雨夜白噪音");
  assert.equal(runtime.audio.playCalls, 0);

  runtime.restore();
});

test("selecting a sound syncs the active channel tab without starting playback", async () => {
  const runtime = createMiniAppRuntime();
  const page = runtime.loadPage("../miniprogram/pages/index/index.js");

  await page.call("onLoad");
  await runtime.flushAsync();
  page.call("handleSoundTap", runtime.tapEvent("deep_ambient"));

  assert.equal(page.data.currentSoundTitle, "深夜冥想音景");
  assert.equal(page.data.currentSoundCover, "/assets/covers/deep_ambient.jpg");
  assert.equal(page.data.activeGroupId, "ambient");
  assert.equal(page.data.activeSoundGroup.title, "氛围");
  assert.equal(runtime.audio.playCalls, 0);

  runtime.restore();
});

test("main tab and mini player can switch to the player view", async () => {
  const runtime = createMiniAppRuntime();
  const page = runtime.loadPage("../miniprogram/pages/index/index.js");

  await page.call("onLoad");
  await runtime.flushAsync();

  page.call("handleMainTabTap", runtime.mainTabEvent("player"));
  assert.equal(page.data.pageMode, "player");

  page.call("handleMainTabTap", runtime.mainTabEvent("channels"));
  assert.equal(page.data.pageMode, "channels");

  page.call("handleMiniPlayerTap");
  assert.equal(page.data.pageMode, "player");

  runtime.restore();
});

test("play button starts background audio for the selected sound and confirms on play", async () => {
  const runtime = createMiniAppRuntime();
  const page = runtime.loadPage("../miniprogram/pages/index/index.js");

  await page.call("onLoad");
  await runtime.flushAsync();
  page.call("handleSoundPlayTap", runtime.tapEvent("ocean_slow"));
  runtime.audio.emit("play");

  assert.equal(page.data.currentSoundTitle, "深夜海浪");
  assert.equal(page.data.currentSoundCover, "/assets/covers/ocean_slow.jpg");
  assert.equal(page.data.isPlaying, true);
  assert.equal(runtime.audio.src, "https://sf1-ttcdn-tos.pstatp.com/obj/developer/sdk/0000-0001.mp3");

  runtime.restore();
});

test("play button keeps deep ambient on the stable demo source", async () => {
  const runtime = createMiniAppRuntime();
  const page = runtime.loadPage("../miniprogram/pages/index/index.js");

  await page.call("onLoad");
  await runtime.flushAsync();
  page.call("handleSoundPlayTap", runtime.tapEvent("deep_ambient"));
  runtime.audio.emit("play");

  assert.equal(runtime.audio.src, "https://sf1-ttcdn-tos.pstatp.com/obj/developer/sdk/0000-0001.mp3");

  runtime.restore();
});

test("selecting another title while audio is playing keeps current playback unchanged", async () => {
  const runtime = createMiniAppRuntime();
  const page = runtime.loadPage("../miniprogram/pages/index/index.js");

  await page.call("onLoad");
  await runtime.flushAsync();
  page.call("handleSoundPlayTap", runtime.tapEvent("rain_night"));
  runtime.audio.emit("play");

  page.call("handleSoundTap", runtime.tapEvent("creek_soft"));

  assert.equal(runtime.audio.playCalls, 1);
  assert.equal(page.data.isPlaying, true);
  assert.equal(page.data.currentSoundTitle, "雨夜白噪音");
  assert.equal(page.data.currentSoundCover, "/assets/covers/rain_night.jpg");
  assert.equal(page.data.activeGroupId, "water");
  assert.equal(page.data.activeSoundGroup.title, "水流");
  assert.equal(page.data.activeSoundGroup.sounds[0].title, "深夜海浪");
  assert.equal(page.data.activeSoundGroup.sounds[1].title, "溪流入眠");
  assert.equal(
    page.data.activeSoundGroup.sounds[1].cover,
    "/assets/covers/creek_soft.jpg"
  );
  assert.equal(page.data.activeSoundGroup.sounds[0].isActive, false);
  assert.equal(page.data.activeSoundGroup.sounds[0].isPlayingItem, false);
  assert.equal(page.data.activeSoundGroup.sounds[1].isActive, true);
  assert.equal(page.data.activeSoundGroup.sounds[1].isPlayingItem, false);

  runtime.restore();
});

test("selected and currently playing sounds stay visually distinguishable in the same group", async () => {
  const runtime = createMiniAppRuntime();
  const page = runtime.loadPage("../miniprogram/pages/index/index.js");

  await page.call("onLoad");
  await runtime.flushAsync();
  page.call("handleSoundPlayTap", runtime.tapEvent("ocean_slow"));
  runtime.audio.emit("play");

  page.call("handleSoundTap", runtime.tapEvent("creek_soft"));

  assert.equal(page.data.activeGroupId, "water");
  assert.equal(page.data.activeSoundGroup.sounds[0].id, "ocean_slow");
  assert.equal(page.data.activeSoundGroup.sounds[0].isPlayingItem, true);
  assert.equal(page.data.activeSoundGroup.sounds[0].isActive, false);
  assert.equal(page.data.activeSoundGroup.sounds[1].id, "creek_soft");
  assert.equal(page.data.activeSoundGroup.sounds[1].isActive, true);
  assert.equal(page.data.activeSoundGroup.sounds[1].isPlayingItem, false);

  runtime.restore();
});

test("play toggle can pause even before onPlay event arrives", async () => {
  const runtime = createMiniAppRuntime();
  const page = runtime.loadPage("../miniprogram/pages/index/index.js");

  await page.call("onLoad");
  await runtime.flushAsync();

  page.call("handlePlayToggle");
  page.call("handlePlayToggle");

  assert.equal(runtime.audio.playCalls, 1);
  assert.equal(runtime.audio.pauseCalls, 1);
  assert.equal(page.data.isPlaying, false);

  runtime.restore();
});

test("timer expiration on show stops audio and clears timer state", async () => {
  const runtime = createMiniAppRuntime();
  runtime.storage.set("sleepSounds.timerMinutes", 15);
  runtime.storage.set("sleepSounds.timerEndAt", Date.now() - 1000);
  const page = runtime.loadPage("../miniprogram/pages/index/index.js");

  await page.call("onLoad");
  await runtime.flushAsync();
  page.call("onShow");

  assert.equal(runtime.audio.stopCalls, 1);
  assert.equal(page.data.selectedTimerMinutes, 0);
  assert.equal(page.data.remainingText, "未开启");
  assert.equal(runtime.storage.get("sleepSounds.timerEndAt"), 0);

  runtime.restore();
});

test("unload cleans listeners without stopping background audio", async () => {
  const runtime = createMiniAppRuntime();
  const page = runtime.loadPage("../miniprogram/pages/index/index.js");

  await page.call("onLoad");
  await runtime.flushAsync();
  page.call("onUnload");

  assert.equal(runtime.audio.stopCalls, 0);
  assert.equal(runtime.audio.listenerCount("play"), 0);

  runtime.restore();
});

test("playback stays in loop mode even if legacy storage disabled it", async () => {
  const runtime = createMiniAppRuntime();
  runtime.storage.set("sleepSounds.isLooping", false);
  const page = runtime.loadPage("../miniprogram/pages/index/index.js");

  await page.call("onLoad");
  await runtime.flushAsync();

  assert.equal(page.data.isLooping, true);
  assert.equal(runtime.storage.get("sleepSounds.isLooping"), true);

  runtime.restore();
});

test("timer selection while paused only arms countdown and waits for playback", async () => {
  const runtime = createMiniAppRuntime();
  const page = runtime.loadPage("../miniprogram/pages/index/index.js");
  const originalNow = Date.now;
  let now = 1_000_000;
  Date.now = () => now;

  try {
    await page.call("onLoad");
    await runtime.flushAsync();

    page.call("handleTimerTap", runtime.timerEvent(30));

    assert.equal(page.data.isPlaying, false);
    assert.equal(page.data.selectedTimerMinutes, 30);
    assert.equal(page.data.remainingText, "播放后开始");
    assert.equal(page.timerEndAt, 0);
    assert.equal(runtime.storage.get("sleepSounds.timerMinutes"), 30);
    assert.equal(runtime.storage.get("sleepSounds.timerEndAt"), 0);

    now += 10 * 60 * 1000;
    page.call("handlePlayToggle");
    runtime.audio.emit("play");

    assert.equal(page.timerEndAt, now + 30 * 60 * 1000);
    assert.notEqual(page.data.remainingText, "播放后开始");
  } finally {
    Date.now = originalNow;
    runtime.restore();
  }
});

test("pausing playback pauses an active timer and resuming continues with remaining time", async () => {
  const runtime = createMiniAppRuntime();
  const page = runtime.loadPage("../miniprogram/pages/index/index.js");
  const originalNow = Date.now;
  let now = 2_000_000;
  Date.now = () => now;

  try {
    await page.call("onLoad");
    await runtime.flushAsync();

    page.call("handlePlayToggle");
    runtime.audio.emit("play");
    page.call("handleTimerTap", runtime.timerEvent(30));

    assert.equal(page.timerEndAt, now + 30 * 60 * 1000);

    now += 5 * 60 * 1000;
    page.call("handlePlayToggle");

    assert.equal(runtime.audio.pauseCalls, 1);
    assert.equal(page.timerEndAt, 0);
    assert.equal(page.data.isPlaying, false);
    assert.equal(page.data.remainingText, "25:00");

    now += 10 * 60 * 1000;
    page.call("handlePlayToggle");
    runtime.audio.emit("play");

    assert.equal(page.timerEndAt, now + 25 * 60 * 1000);
    assert.equal(page.data.isPlaying, true);
  } finally {
    Date.now = originalNow;
    runtime.restore();
  }
});
