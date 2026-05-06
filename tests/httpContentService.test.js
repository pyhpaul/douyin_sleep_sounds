const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const configPath = path.resolve(__dirname, "../miniprogram/config/contentSourceConfig.js");
const servicePath = path.resolve(__dirname, "../miniprogram/services/httpContentService.js");
let originalTt;
let hadOriginalTt = false;
let contentSourceConfigRef;
let originalContentSourceConfig;

function clearModule(modulePath) {
  try {
    delete require.cache[require.resolve(modulePath)];
  } catch {}
}

function loadHttpContentService(ttMock) {
  clearModule(configPath);
  clearModule(servicePath);

  hadOriginalTt = Object.prototype.hasOwnProperty.call(global, "tt");
  originalTt = global.tt;
  global.tt = ttMock;

  const { contentSourceConfig } = require(configPath);
  contentSourceConfigRef = contentSourceConfig;
  originalContentSourceConfig = {
    provider: contentSourceConfig.provider,
    httpBaseUrl: contentSourceConfig.httpBaseUrl,
    bootstrapPath: contentSourceConfig.bootstrapPath,
    timeoutMs: contentSourceConfig.timeoutMs
  };
  contentSourceConfig.provider = "http";
  contentSourceConfig.httpBaseUrl = "https://api.sleep.test";
  contentSourceConfig.bootstrapPath = "/content/bootstrap";
  contentSourceConfig.timeoutMs = 5000;

  return require(servicePath);
}

function cleanupHttpContentService() {
  if (contentSourceConfigRef && originalContentSourceConfig) {
    contentSourceConfigRef.provider = originalContentSourceConfig.provider;
    contentSourceConfigRef.httpBaseUrl = originalContentSourceConfig.httpBaseUrl;
    contentSourceConfigRef.bootstrapPath = originalContentSourceConfig.bootstrapPath;
    contentSourceConfigRef.timeoutMs = originalContentSourceConfig.timeoutMs;
  }
  clearModule(configPath);
  clearModule(servicePath);
  if (hadOriginalTt) {
    global.tt = originalTt;
  } else {
    delete global.tt;
  }
  originalTt = undefined;
  hadOriginalTt = false;
  contentSourceConfigRef = undefined;
  originalContentSourceConfig = undefined;
}

test.afterEach(() => {
  cleanupHttpContentService();
});

test("returns bootstrap data when tt.request succeeds", async () => {
  const service = loadHttpContentService({
    request({ url, method, success }) {
      assert.equal(url, "https://api.sleep.test/content/bootstrap");
      assert.equal(method, "GET");
      success({
        data: {
          version: "2026-05-06T16:00:00Z",
          groups: []
        }
      });
    }
  });

  const payload = await service.getContentBootstrap();

  assert.deepEqual(payload, {
    version: "2026-05-06T16:00:00Z",
    groups: []
  });
});

test("throws when tt.request is unavailable", async () => {
  const service = loadHttpContentService({});

  await assert.rejects(service.getContentBootstrap(), /tt\.request is unavailable/);
});

test("rejects when request fails", async () => {
  const service = loadHttpContentService({
    request({ fail }) {
      fail(new Error("request failed"));
    }
  });

  await assert.rejects(service.getContentBootstrap(), /request failed/);
});
