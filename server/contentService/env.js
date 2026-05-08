const SUPPORTED_REPOSITORIES = new Set(["jsonCatalog"]);
const SUPPORTED_ASSET_RESOLVERS = new Set(["staticBaseUrl"]);

function normalizeBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function parsePort(value, fallback) {
  const port = Number.parseInt(value || "", 10);
  return Number.isInteger(port) && port > 0 ? port : fallback;
}

function parseContentServiceEnv(rawEnv = process.env) {
  const repositoryType = rawEnv.CONTENT_REPOSITORY || "jsonCatalog";
  const assetResolverType = rawEnv.CONTENT_ASSET_RESOLVER || "staticBaseUrl";

  if (!SUPPORTED_REPOSITORIES.has(repositoryType)) {
    throw new Error(`Unsupported CONTENT_REPOSITORY: ${repositoryType}`);
  }

  if (!SUPPORTED_ASSET_RESOLVERS.has(assetResolverType)) {
    throw new Error(`Unsupported CONTENT_ASSET_RESOLVER: ${assetResolverType}`);
  }

  return {
    repositoryType,
    assetResolverType,
    catalogPath: rawEnv.CONTENT_CATALOG_PATH || "",
    staticBaseUrl: normalizeBaseUrl(rawEnv.STATIC_BASE_URL),
    host: rawEnv.HOST || "127.0.0.1",
    port: parsePort(rawEnv.PORT, 3000)
  };
}

module.exports = {
  parseContentServiceEnv
};
