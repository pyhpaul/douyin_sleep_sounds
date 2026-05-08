const {
  buildPublishedContentDocuments
} = require("../../content/catalogAdapter");
const {
  buildContentBootstrapResponse
} = require("../../cloud/functions/shared/contentBootstrapBuilder");

function createContentBootstrapService({ repository, assetResolver }) {
  if (!repository || typeof repository.getCatalog !== "function") {
    throw new Error("repository.getCatalog is required");
  }

  if (
    !assetResolver ||
    typeof assetResolver.resolveAudioUrl !== "function" ||
    typeof assetResolver.resolveCoverUrl !== "function"
  ) {
    throw new Error("assetResolver.resolveAudioUrl and resolveCoverUrl are required");
  }

  return {
    async getContentBootstrap() {
      const catalog = await repository.getCatalog();
      const documents = buildPublishedContentDocuments(catalog, {
        resolveAudioUrl: assetResolver.resolveAudioUrl,
        resolveCoverUrl: assetResolver.resolveCoverUrl
      });

      return buildContentBootstrapResponse(documents);
    }
  };
}

module.exports = {
  createContentBootstrapService
};
