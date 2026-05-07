const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const { buildPublishedContentDocuments } = require("../../../content/catalogAdapter");
const {
  buildContentBootstrapResponse
} = require("../../../cloud/functions/shared/contentBootstrapBuilder");

function writeJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(`${JSON.stringify(body)}\n`);
}

function loadCatalog(catalogPath) {
  return JSON.parse(fs.readFileSync(catalogPath, "utf8"));
}

function trimTrailingSlashes(value) {
  return String(value || "").replace(/\/+$/, "");
}

function buildStaticAssetUrl(baseUrl, category, assetKey) {
  return `${trimTrailingSlashes(baseUrl)}/${category}/${String(assetKey || "").replace(/^\/+/, "")}`;
}

function createServer(options = {}) {
  const catalogPath =
    options.catalogPath || path.resolve(__dirname, "./catalog.json");
  const staticBaseUrl = options.staticBaseUrl || process.env.STATIC_BASE_URL || "";

  return http.createServer((request, response) => {
    if (request.method !== "GET" || request.url !== "/content/bootstrap") {
      writeJson(response, 404, { error: "Not Found" });
      return;
    }

    try {
      const catalog = loadCatalog(catalogPath);
      const documents = buildPublishedContentDocuments(catalog, {
        resolveAudioUrl: (sound) =>
          buildStaticAssetUrl(staticBaseUrl, "audio", sound.audioAssetKey),
        resolveCoverUrl: (sound) =>
          buildStaticAssetUrl(staticBaseUrl, "covers", sound.coverAssetKey)
      });
      const payload = buildContentBootstrapResponse(documents);
      writeJson(response, 200, payload);
    } catch (error) {
      writeJson(response, 500, {
        error: "bootstrap failed",
        message: error.message
      });
    }
  });
}

if (require.main === module) {
  const port = Number.parseInt(process.env.PORT || "3000", 10);
  const server = createServer();
  server.listen(port, "127.0.0.1", () => {
    console.log(`Sleep Sounds API listening on http://127.0.0.1:${port}`);
  });
}

module.exports = {
  createServer
};
