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
