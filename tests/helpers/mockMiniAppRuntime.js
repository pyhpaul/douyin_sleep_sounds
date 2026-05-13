const path = require("node:path");
const localSounds = require("../../miniprogram/data/sounds");

function createMiniAppRuntime(options = {}) {
  const originalPage = global.Page;
  const originalTt = global.tt;
  const storage = new Map();
  const audio = createAudioManagerMock();
  const toasts = [];
  let pageConfig = null;

  global.Page = (config) => {
    pageConfig = config;
  };

  global.tt = {
    getBackgroundAudioManager() {
      return audio;
    },
    getStorageSync(key) {
      return storage.get(key);
    },
    setStorageSync(key, value) {
      storage.set(key, value);
    },
    showToast(options) {
      toasts.push(options);
    }
  };
  global.tt.request =
    typeof options.request === "function"
      ? options.request
      : ({ success }) => {
          success({
            statusCode: 200,
            data: createDefaultBootstrapPayload()
          });
        };

  function loadPage(modulePath) {
    const resolvedPath = path.resolve(__dirname, "..", modulePath);
    delete require.cache[require.resolve(resolvedPath)];
    require(resolvedPath);

    if (!pageConfig) {
      throw new Error("Page config was not registered");
    }

    return createPageInstance(pageConfig);
  }

  function restore() {
    global.Page = originalPage;
    global.tt = originalTt;
  }

  return {
    audio,
    storage,
    toasts,
    loadPage,
    restore,
    tapEvent(id) {
      return {
        currentTarget: {
          dataset: { id }
        }
      };
    },
    switchEvent(value) {
      return {
        detail: { value }
      };
    },
    timerEvent(minutes) {
      return {
        currentTarget: {
          dataset: { minutes }
        }
      };
    },
    groupTabEvent(id) {
      return {
        currentTarget: {
          dataset: { id }
        }
      };
    },
    mainTabEvent(mode) {
      return {
        currentTarget: {
          dataset: { mode }
        }
      };
    },
    async flushAsync() {
      await Promise.resolve();
      await Promise.resolve();
    }
  };
}

function createDefaultBootstrapPayload() {
  return {
    version: "2026-05-06T00:00:00Z",
    featuredGroupIds: ["rain", "water", "ambient"],
    defaultGroupId: "rain",
    groups: localSounds.soundGroups
  };
}

function createPageInstance(config) {
  const page = {
    ...config,
    data: clone(config.data || {}),
    setData(patch) {
      this.data = {
        ...this.data,
        ...clone(patch)
      };
    },
    call(methodName, ...args) {
      if (typeof this[methodName] !== "function") {
        throw new Error(`Page method not found: ${methodName}`);
      }
      return this[methodName](...args);
    }
  };

  return page;
}

function createAudioManagerMock() {
  const listeners = new Map();

  const audio = {
    title: "",
    epname: "",
    singer: "",
    coverImgUrl: "",
    src: "",
    playCalls: 0,
    pauseCalls: 0,
    stopCalls: 0,
    seekCalls: [],
    play() {
      this.playCalls += 1;
    },
    pause() {
      this.pauseCalls += 1;
      this.emit("pause");
    },
    stop() {
      this.stopCalls += 1;
      this.emit("stop");
    },
    seek(position) {
      this.seekCalls.push(position);
    },
    onPlay(listener) {
      addListener(listeners, "play", listener);
    },
    onPause(listener) {
      addListener(listeners, "pause", listener);
    },
    onStop(listener) {
      addListener(listeners, "stop", listener);
    },
    onEnded(listener) {
      addListener(listeners, "ended", listener);
    },
    onError(listener) {
      addListener(listeners, "error", listener);
    },
    offPlay(listener) {
      removeListener(listeners, "play", listener);
    },
    offPause(listener) {
      removeListener(listeners, "pause", listener);
    },
    offStop(listener) {
      removeListener(listeners, "stop", listener);
    },
    offEnded(listener) {
      removeListener(listeners, "ended", listener);
    },
    offError(listener) {
      removeListener(listeners, "error", listener);
    },
    emit(eventName) {
      for (const listener of listeners.get(eventName) || []) {
        listener();
      }
    },
    listenerCount(eventName) {
      return (listeners.get(eventName) || []).length;
    }
  };

  return audio;
}

function addListener(listeners, eventName, listener) {
  if (!listeners.has(eventName)) {
    listeners.set(eventName, []);
  }
  listeners.get(eventName).push(listener);
}

function removeListener(listeners, eventName, listener) {
  const eventListeners = listeners.get(eventName) || [];
  listeners.set(
    eventName,
    eventListeners.filter((registeredListener) => registeredListener !== listener)
  );
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

module.exports = {
  createMiniAppRuntime
};
