function trimTrailingSlashes(value) {
  return String(value || "").replace(/\/+$/, "");
}

function trimSlashes(value) {
  return String(value || "").replace(/^\/+|\/+$/g, "");
}

function buildStaticAssetUrl(baseUrl, category, assetKey) {
  const normalizedBaseUrl = trimTrailingSlashes(baseUrl);
  const normalizedCategory = trimSlashes(category);
  const normalizedAssetKey = String(assetKey || "").replace(/^\/+/, "");

  if (!normalizedBaseUrl || !normalizedCategory || !normalizedAssetKey) {
    return "";
  }

  return `${normalizedBaseUrl}/${normalizedCategory}/${normalizedAssetKey}`;
}

function createStaticBaseUrlResolver({ staticBaseUrl }) {
  return {
    resolveAudioUrl(sound) {
      return buildStaticAssetUrl(staticBaseUrl, "audio", sound.audioAssetKey);
    },
    resolveCoverUrl(sound) {
      return buildStaticAssetUrl(staticBaseUrl, "covers", sound.coverAssetKey);
    }
  };
}

module.exports = {
  buildStaticAssetUrl,
  createStaticBaseUrlResolver
};
