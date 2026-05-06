const { cloudContentConfig } = require("../config/cloudContentConfig");

let cloudPromise = null;

function createCloudInstance() {
  if (typeof tt === "undefined" || typeof tt.createCloud !== "function") {
    throw new Error("tt.createCloud is unavailable");
  }

  return tt.createCloud({
    envID: cloudContentConfig.envId,
    serviceID: cloudContentConfig.serviceId
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
      path: cloudContentConfig.bootstrapPath,
      init: {
        method: "GET",
        header: {
          "content-type": "application/json"
        },
        timeout: cloudContentConfig.timeoutMs
      },
      success(response) {
        resolve(response && response.data ? response.data : response);
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
