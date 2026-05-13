# Content Release Runbook

## Purpose

Use this runbook when an agent or operator needs to publish content-only changes to the current ECS production service.

This runbook assumes:

- content source of truth stays in `content/catalog.json`
- production environment is `prod`
- current production domain is `https://sleep.zhenwei1.cn`
- the current default asset mode is `remote-only`

## Inputs

- updated `content/catalog.json`
- local operator config: `deployment/content-release/prod.env`
- optional external assets directory when using `local-assets`

## Guardrails

- do not commit `deployment/content-release/*.env`
- do not commit `artifacts/content-release/`
- do not mix API code deployment with content release
- do not continue after a failed publish until rollback or state review is complete

## Step 1: Preflight

1. confirm the working tree only contains the intended content release changes
2. confirm `deployment/content-release/prod.env` exists on the local machine
3. confirm SSH access to the ECS host works from the current machine
4. run the preflight check:

```bash
npm run preflight:content -- --env prod
```

This is the preferred one-command gate before publish.

5. if you only need drift inspection, run the status check:

```bash
npm run status:content -- --env prod
```

This compares local source, deployment artifact, and live bootstrap. If it exits non-zero, resolve the drift before release.

6. if this is a risky release, run a dry run first:

```bash
npm run publish:content -- --env prod --dry-run
```

Dry run only builds local release evidence and does not connect to ECS.

## Step 2: Publish

Standard production publish:

```bash
npm run publish:content -- --env prod
```

External asset publish:

```bash
npm run publish:content -- --env prod --asset-source D:\sleep-assets\prod
```

On success, record the JSON output fields:

- `releaseId`
- `envName`
- `assetMode`
- `backupDir`

## Step 3: Automated verification

The publish command already runs the built-in verification flow. It checks:

- internal health: `http://127.0.0.1:3000/healthz`
- internal bootstrap: `http://127.0.0.1:3000/content/bootstrap`
- public health: `https://sleep.zhenwei1.cn/healthz`
- public bootstrap: `https://sleep.zhenwei1.cn/content/bootstrap`
- sample cover HEAD request
- sample audio HEAD request

If the command exits non-zero, treat the release as failed until state is reviewed.

After publish, it is also valid to run:

```bash
npm run status:content -- --env prod
```

Expected result: `ok: true` and no drift between local, deployment, and remote.

## Step 4: Optional real-device smoke test

After automated verification passes, optionally verify on device:

1. open the mini app
2. confirm covers render
3. confirm at least one track plays
4. confirm there is no stale cached content

## Step 5: Failure handling

If publish or verification fails after remote files were changed:

1. stop and verify the failed `releaseId`
2. run:

```bash
npm run rollback:content -- --env prod --release-id <releaseId>
```

3. re-check:
   - `https://sleep.zhenwei1.cn/healthz`
   - `https://sleep.zhenwei1.cn/content/bootstrap`

The current pipeline does not auto-rollback.

## Step 6: Post-release cleanup

After a successful publish:

1. keep `deployment/content-release/prod.env` on the local operator machine
2. review the release record in `artifacts/content-release/<releaseId>/release-summary.json`:
   - `releaseId`
   - `backupDir`
   - publish date
   - verification URLs checked
3. review `artifacts/content-release/release-log.jsonl` for the recent local release timeline
4. if this release should be kept as project history, run:

```bash
npm run archive:content -- --release-id <releaseId>
```

5. confirm the release record is appended to `deployment/content-release/archive.jsonl`
6. remove `artifacts/content-release/<releaseId>/` after review and archive

## Release record template

```text
date:
env: prod
releaseId:
assetMode:
backupDir:
verification:
- https://sleep.zhenwei1.cn/healthz
- https://sleep.zhenwei1.cn/content/bootstrap
- sample cover URL
- sample audio URL
notes:
```

## Latest verified rehearsal

- date: `2026-05-13`
- env: `prod`
- releaseId: `prod-20260513T131117Z`
- assetMode: `remote-only`
- backupDir: `/srv/sleep-sounds/backups/content/prod-20260513T131117Z`

