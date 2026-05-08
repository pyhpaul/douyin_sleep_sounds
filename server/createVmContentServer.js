const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const {
  DEMO_AUDIO_URL,
  getLocalCoverPath,
  getLocalAudioUrl
} = require("../content/catalogAdapter");
const {
  createContentBootstrapService
} = require("./contentService/createContentBootstrapService");
const {
  createJsonCatalogRepository
} = require("./contentService/repositories/jsonCatalogRepository");
const {
  writeJson
} = require("./contentService/createContentHttpApp");

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || "").trim().replace(/\/+$/, "");
}

function buildAssetUrl(baseUrl, assetKey, fallbackUrl) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const normalizedAssetKey = String(assetKey || "").replace(/^\/+/, "");

  if (!normalizedBaseUrl || !normalizedAssetKey) {
    return fallbackUrl;
  }

  return `${normalizedBaseUrl}/${normalizedAssetKey}`;
}

function writeFile(response, filePath) {
  if (!fs.existsSync(filePath)) {
    writeJson(response, 404, { error: "Not Found" });
    return;
  }

  const extension = path.extname(filePath).toLowerCase();
  const contentTypeByExtension = {
    ".mp3": "audio/mpeg",
    ".ogg": "audio/ogg",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg"
  };

  const stream = fs.createReadStream(filePath);
  stream.on("error", () => {
    if (response.headersSent) {
      response.destroy();
      return;
    }

    writeJson(response, 500, { error: "file read failed" });
  });

  stream.once("open", () => {
    response.writeHead(200, {
      "content-type": contentTypeByExtension[extension] || "application/octet-stream",
      "cache-control": "no-store"
    });
    stream.pipe(response);
  });
}

function getRequestPathname(requestUrl) {
  try {
    return new URL(requestUrl || "", "http://127.0.0.1").pathname;
  } catch (error) {
    return "";
  }
}

function getDebugFileName(pathname, routePrefix) {
  try {
    return decodeURIComponent(String(pathname || "").replace(routePrefix, ""));
  } catch (error) {
    return "";
  }
}

function resolveDebugAudioPath(pathname) {
  const fileName = getDebugFileName(pathname, "/debug/audio/");
  if (!fileName || fileName.includes("..") || fileName.includes("/") || fileName.includes("\\")) {
    return "";
  }

  return path.resolve(__dirname, "../debug/audio", fileName);
}

function resolveDebugCoverPath(pathname) {
  const fileName = getDebugFileName(pathname, "/debug/covers/");
  if (!fileName || fileName.includes("..") || fileName.includes("/") || fileName.includes("\\")) {
    return "";
  }

  return path.resolve(__dirname, "../debug/covers", fileName);
}

function createVmAssetResolver({ audioBaseUrl, coverBaseUrl }) {
  return {
    resolveAudioUrl(sound) {
      return audioBaseUrl
        ? buildAssetUrl(audioBaseUrl, sound.audioAssetKey, DEMO_AUDIO_URL)
        : getLocalAudioUrl(sound);
    },
    resolveCoverUrl(sound) {
      return buildAssetUrl(coverBaseUrl, sound.coverAssetKey, getLocalCoverPath(sound.id));
    }
  };
}

function createVmContentServer(options = {}) {
  const catalogPath = options.catalogPath || path.resolve(__dirname, "../content/catalog.json");
  const audioBaseUrl = options.audioBaseUrl || "";
  const coverBaseUrl = options.coverBaseUrl || "";
  const contentService = createContentBootstrapService({
    repository: createJsonCatalogRepository({ catalogPath }),
    assetResolver: createVmAssetResolver({ audioBaseUrl, coverBaseUrl })
  });

  return http.createServer(async (request, response) => {
    const pathname = getRequestPathname(request.url);

    if (request.method === "GET" && pathname.startsWith("/debug/audio/")) {
      const audioPath = resolveDebugAudioPath(pathname);
      if (!audioPath) {
        writeJson(response, 404, { error: "Not Found" });
        return;
      }

      writeFile(response, audioPath);
      return;
    }

    if (request.method === "GET" && pathname.startsWith("/debug/covers/")) {
      const coverPath = resolveDebugCoverPath(pathname);
      if (!coverPath) {
        writeJson(response, 404, { error: "Not Found" });
        return;
      }

      writeFile(response, coverPath);
      return;
    }

    if (request.method !== "GET" || pathname !== "/content/bootstrap") {
      writeJson(response, 404, { error: "Not Found" });
      return;
    }

    try {
      writeJson(response, 200, await contentService.getContentBootstrap());
    } catch (error) {
      writeJson(response, 500, {
        error: "content bootstrap failed",
        message: error.message
      });
    }
  });
}

module.exports = {
  createVmContentServer,
  createVmAssetResolver
};
