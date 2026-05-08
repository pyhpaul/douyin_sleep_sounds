const fs = require("node:fs");

function createJsonCatalogRepository({ catalogPath }) {
  if (!catalogPath) {
    throw new Error("catalogPath is required");
  }

  return {
    async getCatalog() {
      return JSON.parse(fs.readFileSync(catalogPath, "utf8"));
    }
  };
}

module.exports = {
  createJsonCatalogRepository
};
