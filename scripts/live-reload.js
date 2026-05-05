const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_EXTENSIONS = new Set([
  ".html",
  ".js",
  ".json",
  ".ttml",
  ".ttss",
  ".css"
]);

function createLiveReload(options = {}) {
  const clients = new Set();
  const watchers = [];
  const debounceMs = options.debounceMs === undefined ? 120 : options.debounceMs;
  const extensions = new Set(options.extensions || DEFAULT_EXTENSIONS);
  let reloadTimer = null;

  for (const watchPath of options.watchPaths || []) {
    watchers.push(...watchPathChanges(watchPath, (fileName) => {
      if (shouldReload(fileName, extensions)) {
        scheduleReload();
      }
    }));
  }

  function handleEventStream(request, response) {
    response.writeHead(200, {
      "cache-control": "no-cache",
      "connection": "keep-alive",
      "content-type": "text/event-stream; charset=utf-8"
    });
    response.write(": connected\n\n");

    clients.add(response);
    request.on("close", () => {
      clients.delete(response);
    });
  }

  function scheduleReload() {
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => {
      broadcastReload();
    }, debounceMs);
  }

  function broadcastReload() {
    const payload = `event: reload\ndata: ${Date.now()}\n\n`;

    for (const client of clients) {
      client.write(payload);
    }
  }

  function close() {
    clearTimeout(reloadTimer);
    for (const watcher of watchers) {
      watcher.close();
    }
    for (const client of clients) {
      client.end();
    }
    watchers.length = 0;
    clients.clear();
  }

  return {
    broadcastReload,
    close,
    handleEventStream
  };
}

function watchPathChanges(watchPath, onChange) {
  const resolvedPath = path.resolve(watchPath);
  if (!fs.existsSync(resolvedPath)) {
    return [];
  }

  const stat = fs.statSync(resolvedPath);
  if (stat.isDirectory()) {
    return watchDirectory(resolvedPath, onChange);
  }

  return [fs.watch(resolvedPath, (_, fileName) => {
    onChange(fileName || resolvedPath);
  })];
}

function watchDirectory(directoryPath, onChange) {
  try {
    return [fs.watch(directoryPath, { recursive: true }, (_, fileName) => {
      onChange(fileName || directoryPath);
    })];
  } catch (error) {
    return collectDirectories(directoryPath).map((dir) => fs.watch(dir, (_, fileName) => {
      onChange(fileName || dir);
    }));
  }
}

function collectDirectories(rootDir) {
  const directories = [rootDir];
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      directories.push(...collectDirectories(path.join(rootDir, entry.name)));
    }
  }
  return directories;
}

function shouldReload(fileName, extensions) {
  if (!fileName) {
    return true;
  }

  return extensions.has(path.extname(String(fileName)).toLowerCase());
}

module.exports = {
  createLiveReload,
  shouldReload
};
