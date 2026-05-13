const {
  buildContentBootstrapResponse
} = require("../shared/contentBootstrapBuilder");
const {
  getPublishedContentDocuments
} = require("../shared/contentRepository");

module.exports = async function contentBootstrap() {
  try {
    const documents = await getPublishedContentDocuments();
    return buildContentBootstrapResponse(documents);
  } catch (error) {
    throw new Error(`contentBootstrap failed to load published content: ${error.message}`, {
      cause: error
    });
  }
};
