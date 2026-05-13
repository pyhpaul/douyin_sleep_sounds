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
    const pathname = new URL(request.url, "http://127.0.0.1").pathname;

    if (request.method === "GET" && pathname === "/healthz") {
      writeJson(response, 200, { ok: true });
      return;
    }

    if (request.method !== "GET" || pathname !== "/content/bootstrap") {
      writeJson(response, 404, { error: "Not Found" });
      return;
    }

    try {
      const payload = await contentService.getContentBootstrap();
      writeJson(response, 200, payload);
    } catch (error) {
      writeJson(response, 500, {
        error: "bootstrap failed",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });
}

module.exports = {
  createContentHttpApp,
  writeJson
};
