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
