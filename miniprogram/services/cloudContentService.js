const { contentSourceConfig } = require("../config/contentSourceConfig");

let cloudPromise = null;

function assertSuccessfulResponse(response) {
  const statusCode = response?.statusCode;
  if (statusCode === undefined) {
    return;
  }

  if (statusCode < 200 || statusCode >= 300) {
    throw new Error(`cloud content request failed with status ${statusCode}`);
  }
}

function createCloudInstance() {
  if (typeof tt === "undefined" || typeof tt.createCloud !== "function") {
    throw new Error("tt.createCloud is unavailable");
  }

  return tt.createCloud({
    envID: contentSourceConfig.envId,
    serviceID: contentSourceConfig.serviceId
  });
}

function getCloud() {
  if (!cloudPromise) {
    const cloud = createCloudInstance();
    cloudPromise = new Promise((resolve, reject) => {
      cloud.init({
        success() {
          resolve(cloud);
        },
        fail(error) {
          cloudPromise = null;
          reject(error);
        }
      });
    });
  }

  return cloudPromise;
}

async function getContentBootstrap() {
  const cloud = await getCloud();

  return new Promise((resolve, reject) => {
    cloud.callContainer({
      path: contentSourceConfig.bootstrapPath,
      init: {
        method: "GET",
        header: {
          "content-type": "application/json"
        },
        timeout: contentSourceConfig.timeoutMs
      },
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
