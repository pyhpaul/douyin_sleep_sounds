const {
  getTimerOptions,
  minutesToMs,
  getTimerEndAt,
  formatRemaining,
  isTimerExpired
} = require("../../utils/timer");
const { getSoundGroups } = require("../../services/soundSourceService");
const {
  selectInitialSoundId,
  selectSoundId,
  findSoundGroupIdBySoundId,
  selectGroupId,
  getCurrentSound,
  buildSoundGroupsViewModel,
  buildSoundGroupTabsViewModel,
  getActiveSoundGroupViewModel
} = require("../../utils/playbackState");

const STORAGE_KEYS = {
  CURRENT_SOUND_ID: "sleepSounds.currentSoundId",
  IS_LOOPING: "sleepSounds.isLooping",
  TIMER_MINUTES: "sleepSounds.timerMinutes",
  TIMER_END_AT: "sleepSounds.timerEndAt",
  TIMER_REMAINING_MS: "sleepSounds.timerRemainingMs",
  TIMER_STARTS_ON_PLAY: "sleepSounds.timerStartsOnPlay"
};

const TIMER_TICK_MS = 1000;
const DEFAULT_REMAINING_TEXT = "未开启";
const PENDING_TIMER_TEXT = "播放后开始";

function showToast(title) {
  if (typeof tt !== "undefined" && tt.showToast) {
    tt.showToast({ title, icon: "none" });
  }
}

function buildTimerOptionsViewModel(selectedTimerMinutes) {
  return getTimerOptions().map((option) => ({
    ...option,
    shortLabel: option.minutes === 0 ? "关闭" : `${option.minutes}分`,
    isActive: option.minutes === selectedTimerMinutes
  }));
}

Page({
  data: {
    pageMode: "channels",
    activeGroupId: "",
    soundGroups: [],
    soundGroupTabs: [],
    activeSoundGroup: {
      id: "",
      title: "",
      subtitle: "",
      sounds: []
    },
    timerOptions: buildTimerOptionsViewModel(0),
    selectedSoundId: "",
    currentSoundId: "",
    currentSoundTitle: "未选择声音",
    currentSoundCover: "",
    currentSoundDescription: "",
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
    this.isUnloaded = false;
    this.loadVersion = (this.loadVersion || 0) + 1;
    this.rawSoundGroups = [];
    this.audioManager = null;
    this.audioListeners = null;
    this.playingSoundId = "";
    this.pendingPlaySoundId = "";
    this.timerInterval = null;
    this.timerEndAt = 0;
    this.timerRemainingMs = 0;
    this.timerStartsOnPlay = false;

    this.initAudioManager();
    this.loadInitialState(this.loadVersion);
  },

  onShow() {
    if (!this.isUnloaded) {
      this.syncTimerFromStorage();
    }
  },

  onHide() {
    if (this.timerEndAt) {
      this.writeStorage(STORAGE_KEYS.TIMER_END_AT, this.timerEndAt);
    }
  },

  onUnload() {
    this.isUnloaded = true;
    this.clearTimerTicker();
    this.removeAudioListeners();
  },

  async loadInitialState(loadVersion) {
    let soundGroups = [];

    try {
      soundGroups = await getSoundGroups();
    } catch (error) {
      if (!this.isPageActive(loadVersion)) {
        return;
      }

      this.rawSoundGroups = [];
      showToast("声音列表加载失败");
    }

    if (!this.isPageActive(loadVersion)) {
      return;
    }

    if (soundGroups.length) {
      this.rawSoundGroups = soundGroups;
    }

    const storedSoundId = this.readStorage(STORAGE_KEYS.CURRENT_SOUND_ID, "");
    const currentSoundId = selectInitialSoundId(this.rawSoundGroups, storedSoundId);
    const isLooping = true;
    this.writeStorage(STORAGE_KEYS.IS_LOOPING, true);
    const timerState = this.settleStoredTimer(Date.now());

    if (!this.isPageActive(loadVersion)) {
      return;
    }

    this.refreshView({
      selectedSoundId: currentSoundId,
      currentSoundId,
      isLooping,
      isPlaying: timerState.isExpired ? false : this.data.isPlaying,
      selectedTimerMinutes: timerState.selectedTimerMinutes,
      remainingText: timerState.remainingText
    });

    if (timerState.isActive) {
      this.startTimerTicker();
    }
  },

  isPageActive(loadVersion) {
    return !this.isUnloaded && this.loadVersion === loadVersion;
  },

  syncTimerFromStorage() {
    const timerState = this.settleStoredTimer(Date.now());

    if (timerState.isActive) {
      this.refreshView({
        selectedTimerMinutes: timerState.selectedTimerMinutes,
        remainingText: timerState.remainingText
      });
      this.startTimerTicker();
      return;
    }

    if (timerState.isArmed) {
      this.clearTimerTicker();
      this.refreshView({
        selectedTimerMinutes: timerState.selectedTimerMinutes,
        remainingText: timerState.remainingText
      });
      return;
    }

    this.clearTimerTicker();
    this.refreshView({
      isPlaying: timerState.isExpired ? false : this.data.isPlaying,
      selectedTimerMinutes: 0,
      remainingText: DEFAULT_REMAINING_TEXT
    });
  },

  settleStoredTimer(now) {
    const selectedTimerMinutes = Number(this.readStorage(STORAGE_KEYS.TIMER_MINUTES, 0)) || 0;
    const storedTimerEndAt = Number(this.readStorage(STORAGE_KEYS.TIMER_END_AT, 0)) || 0;
    const storedTimerRemainingMs =
      Number(this.readStorage(STORAGE_KEYS.TIMER_REMAINING_MS, 0)) || 0;
    const storedTimerStartsOnPlay = Boolean(
      this.readStorage(STORAGE_KEYS.TIMER_STARTS_ON_PLAY, false)
    );

    if (storedTimerEndAt > now) {
      this.timerEndAt = storedTimerEndAt;
      this.timerRemainingMs = 0;
      this.timerStartsOnPlay = false;
      return {
        isActive: true,
        isArmed: false,
        isExpired: false,
        selectedTimerMinutes,
        remainingText: formatRemaining(storedTimerEndAt, now)
      };
    }

    const fallbackRemainingMs =
      !storedTimerEndAt && !storedTimerRemainingMs && selectedTimerMinutes > 0
        ? minutesToMs(selectedTimerMinutes)
        : storedTimerRemainingMs;

    if (fallbackRemainingMs > 0 && selectedTimerMinutes > 0) {
      this.timerEndAt = 0;
      this.timerRemainingMs = fallbackRemainingMs;
      this.timerStartsOnPlay = storedTimerStartsOnPlay;
      return {
        isActive: false,
        isArmed: true,
        isExpired: false,
        selectedTimerMinutes,
        remainingText: storedTimerStartsOnPlay
          ? PENDING_TIMER_TEXT
          : this.formatDurationRemaining(fallbackRemainingMs)
      };
    }

    this.timerEndAt = 0;
    this.timerRemainingMs = 0;
    this.timerStartsOnPlay = false;
    if (storedTimerEndAt || selectedTimerMinutes > 0) {
      this.clearStoredTimer();
    }
    if (storedTimerEndAt) {
      this.stopAudioForTimerEnd();
    }

    return {
      isActive: false,
      isArmed: false,
      isExpired: Boolean(storedTimerEndAt),
      selectedTimerMinutes: 0,
      remainingText: DEFAULT_REMAINING_TEXT
    };
  },

  initAudioManager() {
    const audio = this.getAudioManager();
    if (!audio) {
      return;
    }

    this.audioListeners = {
      play: () => {
        if (this.isUnloaded) {
          return;
        }

        this.playingSoundId = this.pendingPlaySoundId || this.data.currentSoundId;
        this.pendingPlaySoundId = "";
        this.refreshView({ isPlaying: true });
      },
      pause: () => {
        if (!this.isUnloaded) {
          this.handleAudioPaused();
        }
      },
      stop: () => {
        if (this.isUnloaded) {
          return;
        }

        this.playingSoundId = "";
        this.pendingPlaySoundId = "";
        this.refreshView({ isPlaying: false });
      },
      ended: () => {
        if (!this.isUnloaded) {
          this.handleAudioEnded();
        }
      },
      error: () => {
        if (this.isUnloaded) {
          return;
        }

        this.playingSoundId = "";
        this.pendingPlaySoundId = "";
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

  handleMainTabTap(event) {
    const mode = event.currentTarget.dataset.mode;
    if (mode !== "channels" && mode !== "player") {
      return;
    }

    this.refreshView({ pageMode: mode });
  },

  handleMiniPlayerTap() {
    this.refreshView({ pageMode: "player" });
  },

  handleGroupTabTap(event) {
    const requestedGroupId = event.currentTarget.dataset.id;
    const activeGroupId = selectGroupId(
      this.rawSoundGroups,
      requestedGroupId,
      this.data.selectedSoundId || this.data.currentSoundId
    );

    if (activeGroupId) {
      this.refreshView({ activeGroupId });
    }
  },

  handleSoundTap(event) {
    const requestedSoundId = event.currentTarget.dataset.id;
    const nextSoundId = selectSoundId(
      this.rawSoundGroups,
      requestedSoundId,
      this.data.selectedSoundId || this.data.currentSoundId
    );

    if (!nextSoundId) {
      showToast("暂无可播放声音");
      return;
    }

    this.writeStorage(STORAGE_KEYS.CURRENT_SOUND_ID, nextSoundId);
    this.refreshView({
      selectedSoundId: nextSoundId,
      currentSoundId: this.data.isPlaying ? this.data.currentSoundId : nextSoundId,
      activeGroupId: findSoundGroupIdBySoundId(this.rawSoundGroups, nextSoundId)
    });
  },

  handleSoundPlayTap(event) {
    const requestedSoundId = event.currentTarget.dataset.id;
    const nextSoundId = selectSoundId(
      this.rawSoundGroups,
      requestedSoundId,
      this.data.selectedSoundId || this.data.currentSoundId
    );

    if (!nextSoundId) {
      showToast("暂无可播放声音");
      return;
    }

    const isSamePlayingSound = nextSoundId === this.data.currentSoundId && this.data.isPlaying;

    this.writeStorage(STORAGE_KEYS.CURRENT_SOUND_ID, nextSoundId);
    this.refreshView({
      selectedSoundId: nextSoundId,
      currentSoundId: nextSoundId,
      activeGroupId: findSoundGroupIdBySoundId(this.rawSoundGroups, nextSoundId)
    });

    if (isSamePlayingSound) {
      return;
    }

    this.playCurrentSound(nextSoundId);
  },

  handlePlayToggle() {
    if (this.data.isPlaying) {
      this.pauseCurrentSound();
      return;
    }

    const nextSoundId = selectSoundId(
      this.rawSoundGroups,
      this.data.selectedSoundId || this.data.currentSoundId,
      this.data.currentSoundId
    );

    if (!nextSoundId) {
      showToast("暂无可播放声音");
      return;
    }

    this.writeStorage(STORAGE_KEYS.CURRENT_SOUND_ID, nextSoundId);
    this.refreshView({
      selectedSoundId: nextSoundId,
      currentSoundId: nextSoundId,
      activeGroupId: findSoundGroupIdBySoundId(this.rawSoundGroups, nextSoundId)
    });
    this.playCurrentSound(nextSoundId);
  },

  handleLoopChange(event) {
    const isLooping = Boolean(event.detail.value);
    this.writeStorage(STORAGE_KEYS.IS_LOOPING, isLooping);
    this.refreshView({ isLooping });
  },

  handleTimerTap(event) {
    const minutes = Number(event.currentTarget.dataset.minutes) || 0;

    if (minutes <= 0) {
      this.clearStoredTimer();
      this.refreshView({
        selectedTimerMinutes: 0,
        remainingText: DEFAULT_REMAINING_TEXT
      });
      return;
    }

    if (this.data.isPlaying) {
      this.startTimer(minutes);
      return;
    }

    this.armTimerForPlayback(minutes);
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
    const isNewSound = this.playingSoundId !== soundId;
    const activeGroupId = findSoundGroupIdBySoundId(this.rawSoundGroups, soundId);

    this.pendingPlaySoundId = soundId;
    this.refreshView({
      selectedSoundId: soundId,
      currentSoundId: soundId,
      activeGroupId,
      isPlaying: false
    });

    try {
      this.applyAudioSource(audio, sound, isNewSound);
    } catch (error) {
      this.pendingPlaySoundId = "";
      this.refreshView({ isPlaying: false });
      showToast("声音暂时无法播放，请稍后再试");
      return;
    }

    this.refreshView({
      selectedSoundId: soundId,
      currentSoundId: soundId,
      activeGroupId,
      isPlaying: true
    });

    if (this.data.selectedTimerMinutes > 0 && !this.timerEndAt) {
      this.resumeTimerAfterPlaybackStarts();
    }
  },

  applyAudioSource(audio, sound, shouldReset) {
    if (shouldReset && audio.src === sound.url && typeof audio.seek === "function") {
      audio.seek(0);
    }

    if (shouldReset || audio.src !== sound.url) {
      audio.src = sound.url;
    }

    if (typeof audio.play === "function") {
      audio.play();
    }
  },

  pauseCurrentSound() {
    this.pendingPlaySoundId = "";
    this.pauseTimerIfNeeded();
    this.refreshView({ isPlaying: false });

    if (this.audioManager && typeof this.audioManager.pause === "function") {
      try {
        this.audioManager.pause();
      } catch (error) {
        showToast("暂停失败，请重试");
      }
    } else {
      showToast("当前环境不支持音频暂停");
    }
  },

  handleAudioPaused() {
    this.pauseTimerIfNeeded();
    this.refreshView({ isPlaying: false });
  },

  handleAudioEnded() {
    if (this.data.isLooping && !isTimerExpired(this.timerEndAt, Date.now())) {
      this.replayCurrentSound();
      return;
    }

    this.playingSoundId = "";
    this.pendingPlaySoundId = "";
    this.refreshView({ isPlaying: false });
  },

  replayCurrentSound() {
    const audio = this.audioManager;
    if (!audio) {
      return;
    }

    this.pendingPlaySoundId = this.data.currentSoundId;
    if (typeof audio.seek === "function") {
      audio.seek(0);
    }
    if (typeof audio.play === "function") {
      audio.play();
    }
    this.refreshView({ isPlaying: false });
  },

  startTimer(minutes, remainingMs) {
    const now = Date.now();
    const durationMs = this.resolveTimerDurationMs(minutes, remainingMs);
    if (!durationMs) {
      this.clearStoredTimer();
      this.refreshView({
        selectedTimerMinutes: 0,
        remainingText: DEFAULT_REMAINING_TEXT
      });
      return;
    }

    this.timerEndAt = now + durationMs;
    this.timerRemainingMs = 0;
    this.timerStartsOnPlay = false;
    this.clearTimerTicker();
    this.persistTimerState({
      minutes,
      endAt: this.timerEndAt,
      remainingMs: 0,
      startsOnPlay: false
    });
    this.refreshView({
      selectedTimerMinutes: minutes,
      remainingText: formatRemaining(this.timerEndAt, now)
    });

    this.startTimerTicker();
  },

  startTimerTicker() {
    this.clearTimerTicker();
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
    this.clearStoredTimer();
    this.playingSoundId = "";
    this.pendingPlaySoundId = "";

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

  clearStoredTimer() {
    this.timerEndAt = 0;
    this.timerRemainingMs = 0;
    this.timerStartsOnPlay = false;
    this.clearTimerTicker();
    this.persistTimerState({
      minutes: 0,
      endAt: 0,
      remainingMs: 0,
      startsOnPlay: false
    });
  },

  stopAudioForTimerEnd() {
    this.playingSoundId = "";
    this.pendingPlaySoundId = "";

    const audio = this.getAudioManager();
    if (audio && typeof audio.stop === "function") {
      audio.stop();
    }
  },

  armTimerForPlayback(minutes) {
    const remainingMs = minutesToMs(minutes);
    if (!remainingMs) {
      return;
    }

    this.timerEndAt = 0;
    this.timerRemainingMs = remainingMs;
    this.timerStartsOnPlay = true;
    this.clearTimerTicker();
    this.persistTimerState({
      minutes,
      endAt: 0,
      remainingMs,
      startsOnPlay: true
    });
    this.refreshView({
      selectedTimerMinutes: minutes,
      remainingText: PENDING_TIMER_TEXT
    });
  },

  resumeTimerAfterPlaybackStarts() {
    const minutes = this.data.selectedTimerMinutes;
    const remainingMs = this.timerRemainingMs || minutesToMs(minutes);
    if (!minutes || !remainingMs) {
      return;
    }

    this.startTimer(minutes, remainingMs);
  },

  pauseTimerIfNeeded() {
    if (!this.timerEndAt) {
      return;
    }

    const remainingMs = Math.max(0, this.timerEndAt - Date.now());
    if (!remainingMs || this.data.selectedTimerMinutes <= 0) {
      this.clearStoredTimer();
      return;
    }

    this.timerEndAt = 0;
    this.timerRemainingMs = remainingMs;
    this.timerStartsOnPlay = false;
    this.clearTimerTicker();
    this.persistTimerState({
      minutes: this.data.selectedTimerMinutes,
      endAt: 0,
      remainingMs,
      startsOnPlay: false
    });
    this.refreshView({
      remainingText: this.formatDurationRemaining(remainingMs)
    });
  },

  resolveTimerDurationMs(minutes, remainingMs) {
    const nextDurationMs = Number(remainingMs);
    if (Number.isFinite(nextDurationMs) && nextDurationMs > 0) {
      return nextDurationMs;
    }

    return minutesToMs(minutes);
  },

  persistTimerState({ minutes, endAt, remainingMs, startsOnPlay }) {
    this.writeStorage(STORAGE_KEYS.TIMER_MINUTES, minutes);
    this.writeStorage(STORAGE_KEYS.TIMER_END_AT, endAt);
    this.writeStorage(STORAGE_KEYS.TIMER_REMAINING_MS, remainingMs);
    this.writeStorage(STORAGE_KEYS.TIMER_STARTS_ON_PLAY, startsOnPlay);
  },

  formatDurationRemaining(remainingMs) {
    if (!remainingMs) {
      return DEFAULT_REMAINING_TEXT;
    }

    return formatRemaining(Date.now() + remainingMs, Date.now());
  },

  refreshView(patch) {
    if (this.isUnloaded) {
      return;
    }

    const nextData = {
      ...this.data,
      ...patch
    };
    const currentSound = getCurrentSound(this.rawSoundGroups, nextData.currentSoundId);
    const selectedSoundId = selectSoundId(
      this.rawSoundGroups,
      nextData.selectedSoundId,
      nextData.currentSoundId
    );
    const currentSoundCategory = currentSound ? currentSound.category || "" : "";
    const activeGroupId = selectGroupId(
      this.rawSoundGroups,
      nextData.activeGroupId,
      selectedSoundId
    );

    this.setData({
      ...patch,
      selectedSoundId,
      activeGroupId,
      currentSoundTitle: currentSound ? currentSound.title : "未选择声音",
      currentSoundCover: currentSound ? currentSound.cover || "" : "",
      currentSoundDescription: currentSound ? currentSound.description || "" : "",
      currentSoundCategory,
      currentSoundCategoryText: currentSoundCategory || "未选择",
      playbackText: this.getPlaybackText(nextData.isPlaying, currentSound),
      soundGroups: buildSoundGroupsViewModel(
        this.rawSoundGroups,
        selectedSoundId,
        nextData.currentSoundId,
        nextData.isPlaying
      ),
      soundGroupTabs: buildSoundGroupTabsViewModel(this.rawSoundGroups, activeGroupId),
      activeSoundGroup: getActiveSoundGroupViewModel(
        this.rawSoundGroups,
        activeGroupId,
        selectedSoundId,
        nextData.currentSoundId,
        nextData.isPlaying
      ),
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
