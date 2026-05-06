const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const {
  DEMO_AUDIO_URL,
  getLocalCoverPath,
  buildPublishedContentDocuments
} = require("../content/catalogAdapter");
const {
  buildContentBootstrapResponse
} = require("../cloud/functions/shared/contentBootstrapBuilder");

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

function loadCatalog(catalogPath) {
  return JSON.parse(fs.readFileSync(catalogPath, "utf8"));
}

function writeJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(`${JSON.stringify(body)}\n`);
}

function createVmContentServer(options = {}) {
  const catalogPath = options.catalogPath || path.resolve(__dirname, "../content/catalog.json");
  const audioBaseUrl = options.audioBaseUrl || "";
  const coverBaseUrl = options.coverBaseUrl || "";

  return http.createServer((request, response) => {
    if (request.method !== "GET" || request.url !== "/content/bootstrap") {
      writeJson(response, 404, { error: "Not Found" });
      return;
    }

    try {
      const catalog = loadCatalog(catalogPath);
      const documents = buildPublishedContentDocuments(catalog, {
        resolveAudioUrl(sound) {
          return buildAssetUrl(audioBaseUrl, sound.audioAssetKey, DEMO_AUDIO_URL);
        },
        resolveCoverUrl(sound) {
          return buildAssetUrl(coverBaseUrl, sound.coverAssetKey, getLocalCoverPath(sound.id));
        }
      });
      const payload = buildContentBootstrapResponse(documents);

      writeJson(response, 200, payload);
    } catch (error) {
      writeJson(response, 500, {
        error: "content bootstrap failed",
        message: error.message
      });
    }
  });
}

module.exports = {
  createVmContentServer
};
