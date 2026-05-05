const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const { createServer } = require("./dev-preview-server");

const DEFAULT_HOST = "localhost";
const DEFAULT_PORT = Number(process.env.PORT) || 5173;

function main() {
  runValidationSteps();

  startPreviewServer().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

function runValidationSteps() {
  for (const step of getValidationSteps()) {
    const result = spawnSync(step.command, step.args, {
      cwd: path.resolve(__dirname, ".."),
      env: buildChildProcessEnv(process.env),
      stdio: "inherit"
    });

    if (result.status !== 0) {
      process.exit(result.status || 1);
    }
  }
}

function getValidationSteps() {
  return [
    {
      command: process.execPath,
      args: ["scripts/check-syntax.js"]
    },
    {
      command: process.execPath,
      args: ["--test", "tests/pageRuntime.test.js"]
    }
  ];
}

function buildChildProcessEnv(sourceEnv) {
  const env = { ...sourceEnv };

  // VS Code JavaScript Auto Attach injects these into every Node child process.
  // The nested npm/node processes can then wait forever for debugger disconnect.
  delete env.NODE_OPTIONS;
  delete env.VSCODE_INSPECTOR_OPTIONS;

  return env;
}

function openBrowser(url) {
  try {
    const command = getOpenCommand(url);
    const child = spawn(command.command, command.args, {
      detached: true,
      stdio: "ignore"
    });
    child.unref();
  } catch (error) {
    console.log(`Open this URL manually: ${url}`);
  }
}

function startPreviewServer(options = {}) {
  const host = options.host || DEFAULT_HOST;
  const port = options.port === undefined ? DEFAULT_PORT : options.port;
  const log = options.log || console.log;
  const browserOpener = options.openBrowser || openBrowser;
  const serverFactory = options.createServer || createServer;
  const server = serverFactory();

  return new Promise((resolve, reject) => {
    const rejectStart = (error) => {
      reject(error);
    };

    server.once("error", rejectStart);
    server.listen(port, () => {
      server.off("error", rejectStart);
      const address = server.address();
      const actualPort = typeof address === "object" && address ? address.port : port;
      const url = `http://${host}:${actualPort}`;

      log(`Preview server running at ${url}`);
      browserOpener(url);
      resolve(server);
    });
  });
}

function getOpenCommand(url) {
  if (process.platform === "win32") {
    return {
      command: "powershell.exe",
      args: ["-NoProfile", "-Command", "Start-Process", url]
    };
  }

  if (process.platform === "darwin") {
    return {
      command: "open",
      args: [url]
    };
  }

  return {
    command: "xdg-open",
    args: [url]
  };
}

if (require.main === module) {
  main();
}

module.exports = {
  buildChildProcessEnv,
  getValidationSteps,
  startPreviewServer,
  getOpenCommand
};
