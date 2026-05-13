# Content Release Pipeline

## Purpose

Use this workflow to publish content changes from `content/catalog.json` to the current ECS production service without mixing in API code deployment.

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

## Optional 真机 acceptance

After automated verification passes, optionally do a real-device smoke test:

- open the mini app
- confirm covers render
- confirm at least one track plays
- confirm there is no stale cached content
