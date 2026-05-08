const http = require("node:http");

function writeJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(`${JSON.stringify(body)}\n`);
}

function createContentHttpApp({ contentService }) {
  if (!contentService || typeof contentService.getContentBootstrap !== "function") {
    throw new Error("contentService.getContentBootstrap is required");
  }

  return http.createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/healthz") {
      writeJson(response, 200, { ok: true });
      return;
    }

    if (request.method !== "GET" || request.url !== "/content/bootstrap") {
      writeJson(response, 404, { error: "Not Found" });
      return;
    }

    try {
      const payload = await contentService.getContentBootstrap();
      writeJson(response, 200, payload);
    } catch (error) {
      writeJson(response, 500, {
        error: "bootstrap failed",
        message: error.message
      });
    }
  });
}

module.exports = {
  createContentHttpApp,
  writeJson
};
