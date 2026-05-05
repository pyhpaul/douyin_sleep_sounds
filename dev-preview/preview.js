(function () {
  const TIMER_OPTIONS = [
    { label: "关闭", minutes: 0 },
    { label: "15 分钟", minutes: 15 },
    { label: "30 分钟", minutes: 30 },
    { label: "45 分钟", minutes: 45 },
    { label: "60 分钟", minutes: 60 }
  ];

  const app = document.getElementById("app");
  const audio = new Audio();
  let soundGroups = [];
  let currentSoundId = "";
  let isPlaying = false;
  let isLooping = false;
  let selectedTimerMinutes = 0;
  let timerEndAt = 0;
  let timerInterval = null;
  let message = "";

  audio.addEventListener("play", () => {
    isPlaying = true;
    render();
  });

  audio.addEventListener("pause", () => {
    isPlaying = false;
    render();
  });

  audio.addEventListener("ended", () => {
    if (isLooping && !isTimerExpired()) {
      replayCurrentSound();
      return;
    }
    isPlaying = false;
    render();
  });

  audio.addEventListener("error", () => {
    isPlaying = false;
    message = "声音暂时无法播放，请稍后再试";
    render();
  });

  init();

  async function init() {
    try {
      const response = await fetch("/api/sounds");
      soundGroups = await response.json();
      currentSoundId = getFirstSoundId();
      render();
    } catch (error) {
      app.innerHTML = '<div class="empty-card">本地预览加载失败</div>';
    }
  }

  function render() {
    const currentSound = getCurrentSound();
    const remainingText = getRemainingText();
    const currentSoundCategoryText = currentSound ? currentSound.category : "未选择";
    const playbackText = currentSound ? (isPlaying ? "播放中" : "已暂停") : "未选择";

    app.innerHTML = `
      <div class="page">
        <div class="preview-banner">
          浏览器预览使用 HTML audio 模拟播放；最终仍需抖音开发者工具验证。
        </div>

        <div class="hero">
          <div class="eyebrow">SLEEP SOUNDS</div>
          <div class="title">晚安声音</div>
          <div class="subtitle">选择一段声音，慢慢入睡</div>
        </div>

        <div class="now-card">
          <div class="now-label">当前播放</div>
          <div class="now-title">${escapeHtml(currentSound ? currentSound.title : "未选择声音")}</div>
          <div class="now-meta">
            <span class="pill">${escapeHtml(currentSoundCategoryText)}</span>
            <span class="pill">${escapeHtml(playbackText)}</span>
            <span class="pill">${escapeHtml(remainingText)}</span>
          </div>
        </div>

        ${renderSoundGroups()}

        <div class="controls">
          <button class="primary-control" data-action="toggle-play">
            ${isPlaying ? "暂停" : "播放"}
          </button>

          <div class="loop-row">
            <div>
              <div class="loop-title">循环播放</div>
              <div class="loop-desc">开启后当前声音结束会自动重播</div>
            </div>
            <label class="preview-switch">
              <input type="checkbox" data-action="toggle-loop" ${isLooping ? "checked" : ""} />
              <span>${isLooping ? "开" : "关"}</span>
            </label>
          </div>

          <div class="timer-section">
            <div class="timer-title">定时停止</div>
            <div class="timer-options">
              ${renderTimerOptions()}
            </div>
          </div>
        </div>

        ${message ? `<div class="preview-message">${escapeHtml(message)}</div>` : ""}

        <div class="footer-note">
          当前声音源来自本地配置；上线前请替换为授权音频资源。
        </div>
      </div>
    `;
  }

  function renderSoundGroups() {
    if (!soundGroups.length) {
      return '<div class="empty-card">暂无可播放声音</div>';
    }

    return `
      <div class="sound-list">
        ${soundGroups.map(renderSoundGroup).join("")}
      </div>
    `;
  }

  function renderSoundGroup(group) {
    return `
      <div class="sound-group">
        <div class="group-header">
          <div class="group-title">${escapeHtml(group.title)}</div>
          <div class="group-subtitle">${escapeHtml(group.subtitle || "")}</div>
        </div>
        <div class="sound-grid">
          ${group.sounds.map(renderSoundCard).join("")}
        </div>
      </div>
    `;
  }

  function renderSoundCard(sound) {
    const activeClass = sound.id === currentSoundId ? " sound-card-active" : "";

    return `
      <div class="sound-card${activeClass}" data-sound-id="${escapeHtml(sound.id)}">
        <div class="sound-title">${escapeHtml(sound.title)}</div>
        <div class="sound-desc">${escapeHtml(sound.description)}</div>
      </div>
    `;
  }

  function renderTimerOptions() {
    return TIMER_OPTIONS.map((option) => {
      const activeClass = option.minutes === selectedTimerMinutes ? " timer-chip-active" : "";

      return `
        <button class="timer-chip${activeClass}" data-timer-minutes="${option.minutes}">
          ${escapeHtml(option.label)}
        </button>
      `;
    }).join("");
  }

  app.addEventListener("click", (event) => {
    const soundCard = event.target.closest("[data-sound-id]");
    if (soundCard) {
      selectSound(soundCard.dataset.soundId);
      return;
    }

    const timerButton = event.target.closest("[data-timer-minutes]");
    if (timerButton) {
      selectTimer(Number(timerButton.dataset.timerMinutes));
      return;
    }

    if (event.target.closest('[data-action="toggle-play"]')) {
      togglePlay();
    }
  });

  app.addEventListener("change", (event) => {
    if (event.target.matches('[data-action="toggle-loop"]')) {
      isLooping = event.target.checked;
      audio.loop = false;
      render();
    }
  });

  function selectSound(soundId) {
    const sound = findSoundById(soundId);
    if (!sound) {
      return;
    }

    currentSoundId = sound.id;
    message = "";
    audio.src = sound.url;
    audio.currentTime = 0;
    playAudio();
    render();
  }

  function togglePlay() {
    if (isPlaying) {
      audio.pause();
      return;
    }

    const sound = getCurrentSound() || findSoundById(getFirstSoundId());
    if (!sound) {
      return;
    }

    currentSoundId = sound.id;
    if (audio.src !== sound.url) {
      audio.src = sound.url;
    }
    playAudio();
    render();
  }

  function playAudio() {
    audio.play().catch(() => {
      isPlaying = false;
      message = "浏览器阻止了播放，请再次点击播放";
      render();
    });
  }

  function replayCurrentSound() {
    audio.currentTime = 0;
    playAudio();
  }

  function selectTimer(minutes) {
    selectedTimerMinutes = minutes;
    clearTimer();

    if (!minutes) {
      timerEndAt = 0;
      render();
      return;
    }

    timerEndAt = Date.now() + minutes * 60 * 1000;
    timerInterval = setInterval(tickTimer, 1000);
    render();
  }

  function tickTimer() {
    if (!isTimerExpired()) {
      render();
      return;
    }

    clearTimer();
    selectedTimerMinutes = 0;
    timerEndAt = 0;
    audio.pause();
    audio.currentTime = 0;
    isPlaying = false;
    message = "定时已结束";
    render();
  }

  function clearTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function isTimerExpired() {
    return Boolean(timerEndAt) && Date.now() >= timerEndAt;
  }

  function getRemainingText() {
    if (!timerEndAt) {
      return "未开启";
    }

    const remainingMs = Math.max(0, timerEndAt - Date.now());
    const totalSeconds = Math.ceil(remainingMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${pad2(minutes)}:${pad2(seconds)}`;
  }

  function getCurrentSound() {
    return findSoundById(currentSoundId);
  }

  function findSoundById(soundId) {
    for (const group of soundGroups) {
      for (const sound of group.sounds || []) {
        if (sound.id === soundId) {
          return sound;
        }
      }
    }
    return null;
  }

  function getFirstSoundId() {
    return soundGroups[0] && soundGroups[0].sounds[0] ? soundGroups[0].sounds[0].id : "";
  }

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
})();
