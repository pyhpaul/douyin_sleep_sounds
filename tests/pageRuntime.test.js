const assert = require("node:assert/strict");
const test = require("node:test");
const { createMiniAppRuntime } = require("./helpers/mockMiniAppRuntime");

test("loads sounds and selects first sound without auto playing", async () => {
  const runtime = createMiniAppRuntime();
  const page = runtime.loadPage("../miniprogram/pages/index/index.js");

  await page.call("onLoad");
  await runtime.flushAsync();

  assert.equal(page.data.hasSounds, true);
  assert.equal(page.data.currentSoundTitle, "雨声");
  assert.equal(page.data.isPlaying, false);
  assert.equal(runtime.audio.src, "");

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
