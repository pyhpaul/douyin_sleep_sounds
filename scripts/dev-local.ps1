$ErrorActionPreference = "Stop"

# VS Code JavaScript Auto Attach uses these variables to inject its debugger
# bootloader into Node processes. Remove them before starting the long-running
# preview server so `npm run dev` works from Debug Terminal as well.
Remove-Item Env:NODE_OPTIONS -ErrorAction SilentlyContinue
Remove-Item Env:VSCODE_INSPECTOR_OPTIONS -ErrorAction SilentlyContinue

& node "$PSScriptRoot/dev-local.js"
exit $LASTEXITCODE
