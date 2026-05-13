function parseArgs(args) {
  const result = {
    envName: "prod"
  };

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];

    if (token === "--env") {
      result.envName = args[index + 1] || result.envName;
      index += 1;
    }
  }

  return result;
}

function getNpmTestCommand() {
  if (process.platform === "win32") {
    return {
      command: "cmd.exe",
      args: ["/d", "/s", "/c", "npm test"]
    };
  }

  return {
    command: "npm",
    args: ["test"]
  };
}

function runDefaultStep({ command, args }) {
  const { spawnSync } = require("node:child_process");
  const result = spawnSync(command, args, {
    stdio: "inherit"
  });

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }

  return {
    ok: true
  };
}

function createSteps({ envName }) {
  const npmTest = getNpmTestCommand();

  return [
    {
      name: "sync",
      command: process.execPath,
      args: ["scripts/sync-content-artifacts.js"]
    },
    {
      name: "status",
      command: process.execPath,
      args: ["scripts/content-release/status.js", "--env", envName]
    },
    {
      name: "syntax",
      command: process.execPath,
      args: ["scripts/check-syntax.js"]
    },
    {
      name: "test",
      command: npmTest.command,
      args: npmTest.args
    }
  ];
}

async function runPreflight({
  args = process.argv.slice(2),
  runStep = runDefaultStep,
  logger = console
} = {}) {
  const options = parseArgs(args);
  const steps = createSteps({ envName: options.envName });
  const results = [];

  for (const step of steps) {
    await runStep(step);
    results.push({
      name: step.name,
      ok: true
    });
  }

  const payload = {
    ok: true,
    envName: options.envName,
    steps: results
  };

  logger.log(JSON.stringify(payload, null, 2));
  return payload;
}

if (require.main === module) {
  runPreflight().catch((error) => {
    console.error(error && error.stack ? error.stack : String(error));
    process.exit(1);
  });
}

module.exports = {
  createSteps,
  getNpmTestCommand,
  parseArgs,
  runPreflight
};
