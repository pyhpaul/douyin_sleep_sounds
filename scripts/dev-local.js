const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const PREVIEW_URL = "http://localhost:5173";

function main() {
  runNpmScript("check");
  runNpmScript("debug:page");

  console.log(`Starting local preview: ${PREVIEW_URL}`);
  openBrowser(PREVIEW_URL);

  const server = spawn(process.execPath, [path.join(__dirname, "dev-preview-server.js")], {
    stdio: "inherit"
  });

  server.on("exit", (code) => {
    process.exit(code || 0);
  });
}

function runNpmScript(scriptName) {
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(npmCommand, ["run", scriptName], {
    cwd: path.resolve(__dirname, ".."),
    stdio: "inherit"
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
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
  getOpenCommand
};
