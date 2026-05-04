const {
  getTimerOptions,
  getTimerEndAt,
  formatRemaining,
  isTimerExpired
} = require("../../utils/timer");
const { getSoundGroups } = require("../../services/soundSourceService");
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

function buildTimerOptionsViewModel(selectedTimerMinutes) {
  return getTimerOptions().map((option) => ({
    ...option,
    isActive: option.minutes === selectedTimerMinutes
  }));
}

Page({
  data: {
    soundGroups: [],
    timerOptions: buildTimerOptionsViewModel(0),
    currentSoundId: "",
    currentSoundTitle: "未选择声音",
    currentSoundCategory: "",
    currentSoundCategoryText: "未选择",
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

  async loadInitialState() {
    try {
      this.rawSoundGroups = await getSoundGroups();
    } catch (error) {
      this.rawSoundGroups = [];
      showToast("声音列表加载失败");
    }

    const storedSoundId = this.readStorage(STORAGE_KEYS.CURRENT_SOUND_ID, "");
    const currentSoundId = selectInitialSoundId(this.rawSoundGroups, storedSoundId);
    const isLooping = Boolean(this.readStorage(STORAGE_KEYS.IS_LOOPING, false));
    const selectedTimerMinutes = Number(this.readStorage(STORAGE_KEYS.TIMER_MINUTES, 0)) || 0;

    this.refreshView({
      currentSoundId,
      isLooping,
      selectedTimerMinutes,
      remainingText: this.getArmedTimerText(selectedTimerMinutes)
    });
  },

  initAudioManager() {
    const audio = this.getAudioManager();
    if (!audio) {
      return;
    }

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

    this.onAudioEvent(audio, "onPlay", this.audioListeners.play);
    this.onAudioEvent(audio, "onPause", this.audioListeners.pause);
    this.onAudioEvent(audio, "onStop", this.audioListeners.stop);
    this.onAudioEvent(audio, "onEnded", this.audioListeners.ended);
    this.onAudioEvent(audio, "onError", this.audioListeners.error);
  },

  getAudioManager() {
    if (this.audioManager) {
      return this.audioManager;
    }

    if (typeof tt === "undefined" || !tt.getBackgroundAudioManager) {
      return null;
    }

    this.audioManager = tt.getBackgroundAudioManager();
    return this.audioManager;
  },

  onAudioEvent(audio, methodName, listener) {
    if (typeof audio[methodName] === "function") {
      audio[methodName](listener);
    }
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
    this.audioListeners = null;
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

    const audio = this.getAudioManager();
    if (!audio) {
      showToast("当前环境不支持后台音频播放");
      return;
    }

    audio.title = sound.title;
    audio.epname = sound.category || "";
    audio.singer = "晚安声音";
    audio.coverImgUrl = sound.cover || "";

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
    const currentSoundCategory = currentSound ? currentSound.category || "" : "";

    this.setData({
      ...patch,
      currentSoundTitle: currentSound ? currentSound.title : "未选择声音",
      currentSoundCategory,
      currentSoundCategoryText: currentSoundCategory || "未选择",
      playbackText: this.getPlaybackText(nextData.isPlaying, currentSound),
      soundGroups: buildSoundGroupsViewModel(this.rawSoundGroups, nextData.currentSoundId),
      timerOptions: buildTimerOptionsViewModel(nextData.selectedTimerMinutes),
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
