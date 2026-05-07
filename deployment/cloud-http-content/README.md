# Cloud HTTP Content Deployment

This folder contains the minimum deployment artifacts for running the Douyin mini app content service on a standard cloud server.

## Domains

- `api.<your-domain>` for `GET /content/bootstrap`
- `static.<your-domain>` for `/covers/*` and `/audio/*`

## Remote directories

- `/srv/sleep-sounds/api`
- `/srv/sleep-sounds/static/covers`
- `/srv/sleep-sounds/static/audio`

## Required services

- Nginx
- Node.js
- systemd
- HTTPS certificates
