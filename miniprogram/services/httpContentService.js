const { contentSourceConfig } = require("../config/contentSourceConfig");

function buildRequestUrl() {
  if (!contentSourceConfig.httpBaseUrl) {
    throw new Error("contentSourceConfig.httpBaseUrl is required");
  }

  return `${contentSourceConfig.httpBaseUrl}${contentSourceConfig.bootstrapPath}`;
}

function assertSuccessfulResponse(response) {
  const statusCode = response?.statusCode;
  if (statusCode === undefined) {
    return;
  }

  if (statusCode < 200 || statusCode >= 300) {
    throw new Error(`http content request failed with status ${statusCode}`);
  }
}

async function getContentBootstrap() {
  if (typeof tt === "undefined" || typeof tt.request !== "function") {
    throw new Error("tt.request is unavailable");
  }

  return new Promise((resolve, reject) => {
    tt.request({
      url: buildRequestUrl(),
      method: "GET",
      header: {
        "content-type": "application/json"
      },
      timeout: contentSourceConfig.timeoutMs,
      success(response) {
        try {
          assertSuccessfulResponse(response);
          resolve(response?.data ?? response);
        } catch (error) {
          reject(error);
        }
      },
      fail(error) {
        reject(error);
      }
    });
  });
}

module.exports = {
  getContentBootstrap
};
