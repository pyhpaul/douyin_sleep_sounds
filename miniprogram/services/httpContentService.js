const { contentSourceConfig } = require("../config/contentSourceConfig");

function buildRequestUrl() {
  if (!contentSourceConfig.httpBaseUrl) {
    throw new Error("contentSourceConfig.httpBaseUrl is required");
  }

  return `${contentSourceConfig.httpBaseUrl}${contentSourceConfig.bootstrapPath}`;
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
        resolve(response?.data ?? response);
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
