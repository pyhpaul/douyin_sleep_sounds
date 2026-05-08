const path = require("node:path");

function requireFirst(candidatePaths) {
  for (const candidatePath of candidatePaths) {
    try {
      return require(candidatePath);
    } catch (error) {
      if (error.code !== "MODULE_NOT_FOUND") {
        throw error;
      }
    }
  }

  throw new Error(`Unable to load module from: ${candidatePaths.join(", ")}`);
}

const {
  createContentBootstrapService
} = requireFirst([
  path.resolve(__dirname, "../../../server/contentService/createContentBootstrapService"),
  path.resolve(__dirname, "../server/contentService/createContentBootstrapService")
]);
const {
  createContentHttpApp
} = requireFirst([
  path.resolve(__dirname, "../../../server/contentService/createContentHttpApp"),
  path.resolve(__dirname, "../server/contentService/createContentHttpApp")
]);
const {
  parseContentServiceEnv
} = requireFirst([
  path.resolve(__dirname, "../../../server/contentService/env"),
  path.resolve(__dirname, "../server/contentService/env")
]);
const {
  createJsonCatalogRepository
} = requireFirst([
  path.resolve(__dirname, "../../../server/contentService/repositories/jsonCatalogRepository"),
  path.resolve(__dirname, "../server/contentService/repositories/jsonCatalogRepository")
]);
const {
  createStaticBaseUrlResolver
} = requireFirst([
  path.resolve(__dirname, "../../../server/contentService/assetResolvers/staticBaseUrlResolver"),
  path.resolve(__dirname, "../server/contentService/assetResolvers/staticBaseUrlResolver")
]);

function createServer(options = {}) {
  const env = parseContentServiceEnv(
    Object.assign({}, process.env, {
      CONTENT_CATALOG_PATH:
        options.catalogPath ||
        process.env.CONTENT_CATALOG_PATH ||
        path.resolve(__dirname, "./catalog.json"),
      STATIC_BASE_URL:
        options.staticBaseUrl !== undefined ? options.staticBaseUrl : process.env.STATIC_BASE_URL
    })
  );
  const repository = createJsonCatalogRepository({
    catalogPath: env.catalogPath
  });
  const assetResolver = createStaticBaseUrlResolver({
    staticBaseUrl: env.staticBaseUrl
  });
  const contentService = createContentBootstrapService({
    repository,
    assetResolver
  });

  return createContentHttpApp({ contentService });
}

if (require.main === module) {
  const env = parseContentServiceEnv(
    Object.assign({}, process.env, {
      CONTENT_CATALOG_PATH: process.env.CONTENT_CATALOG_PATH || path.resolve(__dirname, "./catalog.json")
    })
  );
  const server = createServer();

  server.listen(env.port, env.host, () => {
    console.log(`Sleep Sounds API listening on http://${env.host}:${env.port}`);
  });
}

module.exports = {
  createServer
};
