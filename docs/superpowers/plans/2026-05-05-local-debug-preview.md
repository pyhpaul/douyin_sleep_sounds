# Local Debug Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add VS Code friendly local debugging for the Douyin mini app while isolating real mini app source under `miniprogram/`.

**Architecture:** Move production mini app files into `miniprogram/` and point `project.config.json` there. Add Node runtime mocks for page logic and a browser preview that reuses mini app data/services/utils and converts real TTSS into browser CSS.

**Tech Stack:** Node.js built-in test runner, native HTTP server, browser HTML/CSS/JS, Douyin mini app source files.

---

## File Structure

- Move: `app.js` -> `miniprogram/app.js`
- Move: `app.json` -> `miniprogram/app.json`
- Move: `app.ttss` -> `miniprogram/app.ttss`
- Move: `pages/` -> `miniprogram/pages/`
- Move: `data/` -> `miniprogram/data/`
- Move: `services/` -> `miniprogram/services/`
- Move: `utils/` -> `miniprogram/utils/`
- Modify: `project.config.json`
- Modify: `package.json`
- Modify: `tests/*.test.js`
- Create: `tests/helpers/mockMiniAppRuntime.js`
- Create: `tests/pageRuntime.test.js`
- Create: `scripts/transform-ttss.js`
- Create: `scripts/dev-preview-server.js`
- Create: `scripts/dev-local.js`
- Create: `dev-preview/index.html`
- Create: `dev-preview/preview.js`

---

### Task 1: Move mini app source into `miniprogram/`

**Files:**
- Move: `app.js`, `app.json`, `app.ttss`, `pages/`, `data/`, `services/`, `utils/`
- Modify: `project.config.json`
- Modify: `package.json`
- Modify: `tests/timer.test.js`
- Modify: `tests/playbackState.test.js`
- Modify: `tests/soundSourceService.test.js`

- [ ] **Step 1: Move source files**

Run:

```powershell
New-Item -ItemType Directory -Force -Path 'E:\douyinProj\test\miniprogram' | Out-Null
Move-Item -LiteralPath 'E:\douyinProj\test\app.js' -Destination 'E:\douyinProj\test\miniprogram\app.js'
Move-Item -LiteralPath 'E:\douyinProj\test\app.json' -Destination 'E:\douyinProj\test\miniprogram\app.json'
Move-Item -LiteralPath 'E:\douyinProj\test\app.ttss' -Destination 'E:\douyinProj\test\miniprogram\app.ttss'
Move-Item -LiteralPath 'E:\douyinProj\test\pages' -Destination 'E:\douyinProj\test\miniprogram\pages'
Move-Item -LiteralPath 'E:\douyinProj\test\data' -Destination 'E:\douyinProj\test\miniprogram\data'
Move-Item -LiteralPath 'E:\douyinProj\test\services' -Destination 'E:\douyinProj\test\miniprogram\services'
Move-Item -LiteralPath 'E:\douyinProj\test\utils' -Destination 'E:\douyinProj\test\miniprogram\utils'
```

- [ ] **Step 2: Update `project.config.json`**

Keep current `appid`, `projectname`, and `setting` values. Set:

```json
"miniprogramRoot": "miniprogram/"
```

- [ ] **Step 3: Update `package.json` check script**

The script must check existing files from `miniprogram/`:

```json
"check": "node -e \"const fs=require('fs');const {spawnSync}=require('child_process');const files=['miniprogram/app.js','miniprogram/pages/index/index.js','miniprogram/utils/timer.js','miniprogram/utils/playbackState.js','miniprogram/services/soundSourceService.js'].filter((file)=>fs.existsSync(file));for(const file of files){const result=spawnSync(process.execPath,['--check',file],{stdio:'inherit'});if(result.status){process.exit(result.status);}}console.log('checked '+files.length+' file(s)');\""
```

- [ ] **Step 4: Update existing test require paths**

Change:

```js
require("../utils/timer")
require("../utils/playbackState")
require("../services/soundSourceService")
require("../data/sounds")
```

to:

```js
require("../miniprogram/utils/timer")
require("../miniprogram/utils/playbackState")
require("../miniprogram/services/soundSourceService")
require("../miniprogram/data/sounds")
```

- [ ] **Step 5: Verify migration**

Run:

```powershell
npm test
npm run check
node -e "for (const file of ['package.json','project.config.json','miniprogram/app.json','miniprogram/pages/index/index.json']) JSON.parse(require('fs').readFileSync(file, 'utf8')); console.log('json ok')"
git status --short
```

Expected:

- `npm test`: 24 pass.
- `npm run check`: checked 5 files.
- JSON validation outputs `json ok`.
- `project.config.json` remains modified only with intended `miniprogramRoot` and preserved user values.

- [ ] **Step 6: Commit migration**

Run:

```powershell
git add -- project.config.json package.json tests miniprogram app.js app.json app.ttss pages data services utils
git commit -m "chore: isolate miniapp source"
```

---

### Task 2: Add page runtime mock tests

**Files:**
- Create: `tests/helpers/mockMiniAppRuntime.js`
- Create: `tests/pageRuntime.test.js`

- [ ] **Step 1: Write failing page runtime tests**

Create tests that require `../miniprogram/pages/index/index.js` after installing globals:

```js
const assert = require("node:assert/strict");
const test = require("node:test");
const { createMiniAppRuntime } = require("./helpers/mockMiniAppRuntime");

test("loads sounds and selects first sound without auto playing", async () => {
  const runtime = createMiniAppRuntime();
  const page = runtime.loadPage("../miniprogram/pages/index/index.js");

  await page.call("onLoad");
  await runtime.flushAsync();

  assert.equal(page.data.hasSounds, true);
  assert.equal(page.data.currentSoundTitle, "雨声");
  assert.equal(page.data.isPlaying, false);
  assert.equal(runtime.audio.src, "");
});

test("clicking a sound starts background audio and confirms on play", async () => {
  const runtime = createMiniAppRuntime();
  const page = runtime.loadPage("../miniprogram/pages/index/index.js");

  await page.call("onLoad");
  await runtime.flushAsync();
  page.call("handleSoundTap", runtime.tapEvent("wave"));
  runtime.audio.emit("play");

  assert.equal(page.data.currentSoundTitle, "海浪");
  assert.equal(page.data.isPlaying, true);
  assert.match(runtime.audio.src, /^https:\/\//);
});

test("timer expiration on show stops audio and clears timer state", async () => {
  const runtime = createMiniAppRuntime();
  runtime.storage.set("sleepSounds.timerMinutes", 15);
  runtime.storage.set("sleepSounds.timerEndAt", Date.now() - 1000);
  const page = runtime.loadPage("../miniprogram/pages/index/index.js");

  await page.call("onLoad");
  await runtime.flushAsync();
  page.call("onShow");

  assert.equal(runtime.audio.stopCalls, 1);
  assert.equal(page.data.selectedTimerMinutes, 0);
  assert.equal(page.data.remainingText, "未开启");
  assert.equal(runtime.storage.get("sleepSounds.timerEndAt"), 0);
});

test("unload cleans listeners without stopping background audio", async () => {
  const runtime = createMiniAppRuntime();
  const page = runtime.loadPage("../miniprogram/pages/index/index.js");

  await page.call("onLoad");
  await runtime.flushAsync();
  page.call("onUnload");

  assert.equal(runtime.audio.stopCalls, 0);
  assert.equal(runtime.audio.listenerCount("play"), 0);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
npm test -- tests/pageRuntime.test.js
```

Expected: FAIL because `tests/helpers/mockMiniAppRuntime.js` does not exist.

- [ ] **Step 3: Implement `tests/helpers/mockMiniAppRuntime.js`**

Implement helpers:

- Install `global.Page`.
- Install `global.tt`.
- Capture page config.
- Provide page instance with `data`, `setData()`, and `call(method, ...args)`.
- Mock background audio manager with event registration and `emit()`.
- Provide storage map.
- Provide `tapEvent(id)`.
- Provide `flushAsync()`.

- [ ] **Step 4: Run page runtime tests and all tests**

Run:

```powershell
npm test -- tests/pageRuntime.test.js
npm test
npm run check
```

Expected:

- page runtime tests pass.
- all tests pass.
- check passes.

- [ ] **Step 5: Commit runtime tests**

Run:

```powershell
git add -- tests/helpers/mockMiniAppRuntime.js tests/pageRuntime.test.js
git commit -m "test: add miniapp page runtime mock"
```

---

### Task 3: Add TTSS transform and preview server

**Files:**
- Create: `scripts/transform-ttss.js`
- Create: `scripts/dev-preview-server.js`
- Create: `dev-preview/index.html`
- Create: `dev-preview/preview.js`
- Modify: `package.json`

- [ ] **Step 1: Write failing transform test inline command**

Run:

```powershell
node -e "const { transformTtss } = require('./scripts/transform-ttss'); const css = transformTtss('.x{padding:20rpx;}'); if (!css.includes('10px')) throw new Error(css);"
```

Expected: FAIL because `scripts/transform-ttss.js` does not exist.

- [ ] **Step 2: Implement `scripts/transform-ttss.js`**

Create:

```js
function transformTtss(source) {
  return String(source).replace(/(-?\d*\.?\d+)rpx/g, (_, value) => `${Number(value) * 0.5}px`);
}

module.exports = { transformTtss };
```

- [ ] **Step 3: Create preview files**

Create `dev-preview/index.html` with:

- `<div id="app"></div>`
- `<script src="/preview.js"></script>`
- `<link rel="stylesheet" href="/preview.css">`

Create `dev-preview/preview.js` that:

- Fetches `/api/sounds`.
- Renders DOM using the same key classes as TTML.
- Uses `<audio>` for playback.
- Supports sound click, play/pause, loop, timer.

- [ ] **Step 4: Create preview server**

Create `scripts/dev-preview-server.js` that:

- Serves `/` from `dev-preview/index.html`.
- Serves `/preview.js`.
- Serves `/preview.css` by reading `miniprogram/pages/index/index.ttss` and running `transformTtss()`.
- Serves `/api/sounds` using `miniprogram/services/soundSourceService.getSoundGroups()`.
- Listens on port `5173`.

- [ ] **Step 5: Add npm script**

Update `package.json`:

```json
"preview": "node scripts/dev-preview-server.js"
```

- [ ] **Step 6: Verify preview building blocks**

Run:

```powershell
node -e "const { transformTtss } = require('./scripts/transform-ttss'); const css = transformTtss('.x{padding:20rpx;}'); if (!css.includes('10px')) throw new Error(css); console.log('transform ok')"
node --check scripts/transform-ttss.js
node --check scripts/dev-preview-server.js
node --check dev-preview/preview.js
npm run check
npm test
```

Expected: all pass.

- [ ] **Step 7: Commit preview server**

Run:

```powershell
git add -- scripts/transform-ttss.js scripts/dev-preview-server.js dev-preview/index.html dev-preview/preview.js package.json
git commit -m "feat: add browser preview"
```

---

### Task 4: Add one-click local debug script

**Files:**
- Create: `scripts/dev-local.js`
- Modify: `package.json`

- [ ] **Step 1: Create `scripts/dev-local.js`**

Implement script that:

1. Runs `npm run check`.
2. Runs `npm run debug:page`.
3. Starts `node scripts/dev-preview-server.js`.
4. Prints `http://localhost:5173`.
5. Tries to open browser with `Start-Process http://localhost:5173` on Windows.

- [ ] **Step 2: Add npm scripts**

Update `package.json`:

```json
"dev": "node scripts/dev-local.js",
"debug:page": "node --test tests/pageRuntime.test.js"
```

- [ ] **Step 3: Verify one-click dependencies**

Run:

```powershell
npm run debug:page
node --check scripts/dev-local.js
npm run check
npm test
```

Expected: all pass.

- [ ] **Step 4: Commit dev script**

Run:

```powershell
git add -- scripts/dev-local.js package.json
git commit -m "feat: add one-click local debug"
```

---

### Task 5: Final verification

**Files:**
- Modify only if verification finds concrete issues.

- [ ] **Step 1: Run full verification**

Run:

```powershell
npm test
npm run check
npm run debug:page
node -e "for (const file of ['package.json','project.config.json','miniprogram/app.json','miniprogram/pages/index/index.json']) JSON.parse(require('fs').readFileSync(file, 'utf8')); console.log('json ok')"
git status --short
```

Expected:

- All tests pass.
- Check passes.
- JSON ok.
- Only expected user-owned `project.config.json` changes are absent because they should be incorporated into the migration commit.

- [ ] **Step 2: Optional manual preview smoke test**

Run:

```powershell
npm run preview
```

Open:

```text
http://localhost:5173
```

Verify:

- Sounds render.
- Clicking a sound changes active card.
- Play/pause works with browser audio.
- Timer counts down and stops audio.

- [ ] **Step 3: Commit fixes if needed**

If any concrete issue is found, make the smallest fix and commit:

```powershell
git add -- <changed-files>
git commit -m "fix: stabilize local debug preview"
```
