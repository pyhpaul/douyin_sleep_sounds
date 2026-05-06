const createVmContentServerModule = require("./createVmContentServer");

const createVmContentServer =
  createVmContentServerModule.createVmContentServer || createVmContentServerModule;
const port = Number.parseInt(process.env.VM_CONTENT_PORT || "8787", 10);

const server = createVmContentServer({
  audioBaseUrl: process.env.VM_CONTENT_AUDIO_BASE_URL || "",
  coverBaseUrl: process.env.VM_CONTENT_COVER_BASE_URL || ""
});

server.listen(port, "127.0.0.1", () => {
  console.log(`VM content server listening on http://127.0.0.1:${port}`);
});
