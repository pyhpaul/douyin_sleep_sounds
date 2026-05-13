# Content Release Pipeline

## Purpose

Use this workflow to publish content changes from `content/catalog.json` to the current ECS production service without mixing in API code deployment.

For the command-level operator checklist, see `deployment/content-release/RUNBOOK.md`.

## Prerequisites

- copy `deployment/content-release/prod.env.example` to `deployment/content-release/prod.env`
- keep SSH access to the ECS host available on the execution machine
- run `npm install` before the first publish on that machine

## Asset modes

- `remote-only` (default): publish `catalog.json` and covers, keep production audio on ECS
- `local-assets`: publish `catalog.json`, covers, and audio from an external asset directory

## Standard publish command

```bash
npm run publish:content -- --env prod
```

## External asset publish command

```bash
npm run publish:content -- --env prod --asset-source D:\sleep-assets\prod
```

## Dry run

```bash
npm run publish:content -- --env prod --dry-run
```

Dry run only builds the local release bundle and manifest. It does not connect to ECS.
Both dry run and successful publish also write `release-summary.json` into the local bundle directory.

## Local-only files

- keep `deployment/content-release/prod.env` on the operator machine only
- do not commit `deployment/content-release/*.env`
- `artifacts/content-release/<releaseId>/` is local release evidence and can be deleted after review

## Success result

The command prints structured JSON that includes:

- `releaseId`
- `envName`
- `assetMode`
- `backupDir`

## Failure result

The command stops on failure and prints rollback guidance. The current version does not auto-rollback.

## Rollback

Use the rollback commands printed by `scripts/content-release/printRollbackHint.js`.

## Agent workflow

For an agent or operator, the expected path is:

1. update `content/catalog.json`
2. run `npm run publish:content -- --env prod`
3. review the JSON result or rollback hint
4. optionally perform a 真机 smoke check

If the executor needs a step-by-step operational checklist, use `deployment/content-release/RUNBOOK.md`.

## Optional 真机 acceptance

After automated verification passes, optionally do a real-device smoke test:

- open the mini app
- confirm covers render
- confirm at least one track plays
- confirm there is no stale cached content

## Post-release cleanup

Recommended local cleanup after a successful publish:

1. keep `deployment/content-release/prod.env` for the next release
2. copy release details from `artifacts/content-release/<releaseId>/release-summary.json`
3. remove `artifacts/content-release/<releaseId>/` after the release record is copied out
4. keep rollback details (`releaseId`, `backupDir`) with the project docs or operator log

## Real publish rehearsal record

Latest verified production rehearsal:

- date: `2026-05-13`
- env: `prod`
- releaseId: `prod-20260513T131117Z`
- backupDir: `/srv/sleep-sounds/backups/content/prod-20260513T131117Z`
- verification:
  - `https://sleep.zhenwei1.cn/healthz`
  - `https://sleep.zhenwei1.cn/content/bootstrap`
  - `https://sleep.zhenwei1.cn/covers/rain_night.jpg`
  - `https://sleep.zhenwei1.cn/audio/rain_night.mp3`

This rehearsal used `remote-only` mode and completed without a service restart.
