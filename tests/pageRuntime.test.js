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
  assert.equal(page.data.activeGroupId, "nature");
  assert.equal(page.data.soundGroupTabs[0].isActive, true);
  assert.equal(page.data.activeSoundGroup.title, "自然");
  assert.equal(page.data.currentSoundTitle, "雨声");
  assert.equal(page.data.isPlaying, false);
  assert.equal(runtime.audio.src, "");

  runtime.restore();
});

test("channel tab switches visible group without starting playback", async () => {
  const runtime = createMiniAppRuntime();
  const page = runtime.loadPage("../miniprogram/pages/index/index.js");

  await page.call("onLoad");
  await runtime.flushAsync();

  page.call("handleGroupTabTap", runtime.groupTabEvent("white-noise"));

  assert.equal(page.data.activeGroupId, "white-noise");
  assert.equal(page.data.activeSoundGroup.title, "白噪音");
  assert.equal(page.data.currentSoundTitle, "雨声");
  assert.equal(runtime.audio.playCalls, 0);

  runtime.restore();
});

test("choosing a sound syncs the active channel tab", async () => {
  const runtime = createMiniAppRuntime();
  const page = runtime.loadPage("../miniprogram/pages/index/index.js");

  await page.call("onLoad");
  await runtime.flushAsync();
  page.call("handleSoundTap", runtime.tapEvent("fire"));

  assert.equal(page.data.currentSoundTitle, "篝火");
  assert.equal(page.data.activeGroupId, "white-noise");
  assert.equal(page.data.activeSoundGroup.title, "白噪音");
  assert.equal(runtime.audio.playCalls, 1);

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

test("clicking a sound starts background audio and confirms on play", async () => {
  const runtime = createMiniAppRuntime();
  const page = runtime.loadPage("../miniprogram/pages/index/index.js");

  await page.call("onLoad");
  await runtime.flushAsync();
  page.call("handleSoundTap", runtime.tapEvent("wave"));
  runtime.audio.emit("play");

  assert.equal(page.data.currentSoundTitle, "海浪");
  assert.equal(page.data.isPlaying, true);
  assert.match(runtime.audio.src, /^https:\/\//);

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
