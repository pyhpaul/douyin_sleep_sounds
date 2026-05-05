const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { transformTtss } = require("./transform-ttss");
const { getSoundGroups } = require("../miniprogram/services/soundSourceService");

const ROOT_DIR = path.resolve(__dirname, "..");
const PREVIEW_DIR = path.join(ROOT_DIR, "dev-preview");
const PORT = Number(process.env.PORT) || 5173;
const REQUIRED_PREVIEW_CLASSES = [
  ".page",
  ".hero",
  ".now-card",
  ".sound-card",
  ".sound-card-active",
  ".controls",
  ".primary-control",
  ".timer-chip"
];

function createServer() {
  return http.createServer(async (request, response) => {
    try {
      await handleRequest(request, response);
    } catch (error) {
      sendText(response, 500, "Internal Server Error\n" + error.message);
    }
  });
}

async function handleRequest(request, response) {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);

  if (requestUrl.pathname === "/") {
    sendFile(response, path.join(PREVIEW_DIR, "index.html"), "text/html; charset=utf-8");
    return;
  }

  if (requestUrl.pathname === "/preview.js") {
    sendFile(response, path.join(PREVIEW_DIR, "preview.js"), "application/javascript; charset=utf-8");
    return;
  }

  if (requestUrl.pathname === "/preview.css") {
    sendText(response, 200, getPreviewCss(), "text/css; charset=utf-8");
    return;
  }

  if (requestUrl.pathname === "/api/sounds") {
    const soundGroups = await getSoundGroups();
    sendJson(response, 200, soundGroups);
    return;
  }

  sendText(response, 404, "Not Found");
}

function getPreviewCss() {
  const appTtss = fs.readFileSync(path.join(ROOT_DIR, "miniprogram", "app.ttss"), "utf8");
  const pageTtss = fs.readFileSync(
    path.join(ROOT_DIR, "miniprogram", "pages", "index", "index.ttss"),
    "utf8"
  );
  const source = `${appTtss}\n${pageTtss}`;
  assertRequiredClasses(source);

  return [
    "html, body { margin: 0; min-height: 100%; background: #07111f; }",
    "body { max-width: 480px; margin: 0 auto; }",
    "button { font: inherit; cursor: pointer; }",
    ".preview-banner, .preview-message, .preview-loading { margin-bottom: 16px; color: rgba(247, 251, 255, 0.72); font-size: 13px; line-height: 1.5; text-align: center; }",
    ".preview-switch { display: flex; align-items: center; gap: 8px; color: #d9e6ff; }",
    transformTtss(source)
  ].join("\n");
}

function assertRequiredClasses(source) {
  const missingClasses = REQUIRED_PREVIEW_CLASSES.filter((className) => !source.includes(className));
  if (missingClasses.length) {
    throw new Error(`Missing preview classes in TTSS: ${missingClasses.join(", ")}`);
  }
}

function sendFile(response, filePath, contentType) {
  sendText(response, 200, fs.readFileSync(filePath, "utf8"), contentType);
}

function sendJson(response, statusCode, payload) {
  sendText(response, statusCode, JSON.stringify(payload), "application/json; charset=utf-8");
}

function sendText(response, statusCode, body, contentType = "text/plain; charset=utf-8") {
  response.writeHead(statusCode, { "content-type": contentType });
  response.end(body);
}

if (require.main === module) {
  const server = createServer();
  server.listen(PORT, () => {
    console.log(`Preview server running at http://localhost:${PORT}`);
  });
}

module.exports = {
  createServer,
  getPreviewCss,
  REQUIRED_PREVIEW_CLASSES
};
