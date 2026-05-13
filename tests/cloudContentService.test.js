const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

function loadCloudContentService(ttMock) {
  const configPath = path.resolve(__dirname, "../miniprogram/config/cloudContentConfig.js");
  const servicePath = path.resolve(__dirname, "../miniprogram/services/cloudContentService.js");

  delete require.cache[require.resolve(configPath)];
  delete require.cache[require.resolve(servicePath)];

  global.tt = ttMock;
  const { cloudContentConfig } = require(configPath);
  cloudContentConfig.enabled = true;
  cloudContentConfig.envId = "env-test";
  cloudContentConfig.serviceId = "service-test";
  cloudContentConfig.bootstrapPath = "/content/bootstrap";
  cloudContentConfig.timeoutMs = 5000;

  return require(servicePath);
}

function cleanupCloudContentService() {
  const configPath = path.resolve(__dirname, "../miniprogram/config/cloudContentConfig.js");
  const servicePath = path.resolve(__dirname, "../miniprogram/services/cloudContentService.js");

  delete require.cache[require.resolve(configPath)];
  delete require.cache[require.resolve(servicePath)];
  delete global.tt;
}

test.afterEach(() => {
  cleanupCloudContentService();
});

test("initializes tt.createCloud once and returns response data", async () => {
  let initCalls = 0;
  let callContainerCalls = 0;

  const service = loadCloudContentService({
    createCloud() {
      return {
        init({ success }) {
          initCalls += 1;
          success();
        },
        callContainer({ path, init, success }) {
          callContainerCalls += 1;
          assert.equal(path, "/content/bootstrap");
          assert.equal(init.method, "GET");
          success({
            data: {
              version: "2026-05-06T16:00:00Z",
              groups: []
            }
          });
        }
      };
    }
  });

  const first = await service.getContentBootstrap();
  const second = await service.getContentBootstrap();

  assert.equal(initCalls, 1);
  assert.equal(callContainerCalls, 2);
  assert.deepEqual(first, { version: "2026-05-06T16:00:00Z", groups: [] });
  assert.deepEqual(second, { version: "2026-05-06T16:00:00Z", groups: [] });
});

test("throws when tt.createCloud is unavailable", async () => {
  const service = loadCloudContentService({});

  await assert.rejects(
    service.getContentBootstrap(),
    /tt\.createCloud is unavailable/
  );
});

test("rejects when cloud.init fails", async () => {
  const service = loadCloudContentService({
    createCloud() {
      return {
        init({ fail }) {
          fail(new Error("init failed"));
        }
      };
    }
  });

  await assert.rejects(service.getContentBootstrap(), /init failed/);
});

test("rejects when callContainer fails", async () => {
  const service = loadCloudContentService({
    createCloud() {
      return {
        init({ success }) {
          success();
        },
        callContainer({ fail }) {
          fail(new Error("request failed"));
        }
      };
    }
  });

  await assert.rejects(service.getContentBootstrap(), /request failed/);
});

test("returns raw response when callContainer does not wrap data", async () => {
  const service = loadCloudContentService({
    createCloud() {
      return {
        init({ success }) {
          success();
        },
        callContainer({ success }) {
          success({
            version: "2026-05-06T16:00:00Z",
            groups: []
          });
        }
      };
    }
  });

  const payload = await service.getContentBootstrap();
  assert.deepEqual(payload, {
    version: "2026-05-06T16:00:00Z",
    groups: []
  });
});
