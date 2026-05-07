# Cloud HTTP Content Deployment

This folder contains the minimum deployment artifacts for running the Douyin mini app content service on a standard cloud server.

## Prerequisites

- A Linux cloud server with public network access
- A registered domain with DNS control
- Two subdomains recommended:
  - `api.<your-domain>`
  - `static.<your-domain>`
- HTTPS certificates for both subdomains
- Node.js and Nginx installed on the server

## Single-domain deployment

If you do not want to add `api.` and `static.` subdomains, serve all paths from one HTTPS domain:

- `https://sleep.zhenweiai.com/content/bootstrap`
- `https://sleep.zhenweiai.com/covers/rain_night.jpg`
- `https://sleep.zhenweiai.com/audio/rain_night.mp3`

For this layout:

- set the API environment to `STATIC_BASE_URL=https://sleep.zhenweiai.com`
- use `deployment/cloud-http-content/nginx/single-domain.example.conf`
- set the mini app `httpBaseUrl` to `https://sleep.zhenweiai.com`

## Remote directories

Create these directories on the server:

```bash
mkdir -p /srv/sleep-sounds/api
mkdir -p /srv/sleep-sounds/static/covers
mkdir -p /srv/sleep-sounds/static/audio
```

## Upload static assets

Upload cover images to:

```bash
/srv/sleep-sounds/static/covers
```

Upload audio files to:

```bash
/srv/sleep-sounds/static/audio
```

The final public URLs should look like:

- `https://static.<your-domain>/covers/rain_night.jpg`
- `https://static.<your-domain>/audio/rain_night.mp3`

For the single-domain deployment, use:

- `https://sleep.zhenweiai.com/covers/rain_night.jpg`
- `https://sleep.zhenweiai.com/audio/rain_night.mp3`

## Deploy the API

Copy these files to `/srv/sleep-sounds/api`:

- `deployment/cloud-http-content/api/app.js`
- `deployment/cloud-http-content/api/package.json`
- `deployment/cloud-http-content/api/catalog.json`

Install dependencies if needed:

```bash
cd /srv/sleep-sounds/api
npm install
```

## Start the API

For manual verification:

```bash
cd /srv/sleep-sounds/api
PORT=3000 STATIC_BASE_URL=https://static.<your-domain> node app.js
```

For the single-domain deployment:

```bash
cd /srv/sleep-sounds/api
PORT=3000 STATIC_BASE_URL=https://sleep.zhenweiai.com node app.js
```

Expected output:

```text
Sleep Sounds API listening on http://127.0.0.1:3000
```

## systemd setup

Copy:

- `deployment/cloud-http-content/systemd/sleep-sounds-api.service`

to:

```bash
/etc/systemd/system/sleep-sounds-api.service
```

Then run:

```bash
sudo systemctl daemon-reload
sudo systemctl enable sleep-sounds-api
sudo systemctl restart sleep-sounds-api
sudo systemctl status sleep-sounds-api
```

## Nginx setup

Copy:

- `deployment/cloud-http-content/nginx/api.example.conf`
- `deployment/cloud-http-content/nginx/static.example.conf`
- `deployment/cloud-http-content/nginx/single-domain.example.conf` when using a single domain

into your Nginx sites configuration and replace `example.com` with the real domain.

Reload Nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## HTTPS

Use Let's Encrypt or your existing certificate workflow for both subdomains.

For the single-domain deployment, issue one certificate for `sleep.zhenweiai.com`.

The deployment is not valid for Douyin mini app runtime until both:

- `api.<your-domain>`
- `static.<your-domain>`

are reachable via HTTPS.

## Douyin domain whitelist

Add the deployed domains to Douyin Open Platform:

- request domain:
  - `https://api.<your-domain>`
- media / image domain:
  - `https://static.<your-domain>`

Do not use raw IP addresses.

For the single-domain deployment, whitelist:

- request domain:
  - `https://sleep.zhenweiai.com`
- downloadFile domain:
  - `https://sleep.zhenweiai.com`

## Verification

From a local operator machine:

```powershell
powershell -File deployment/cloud-http-content/scripts/verify-deployment.ps1 -ApiBaseUrl https://api.<your-domain> -StaticBaseUrl https://static.<your-domain>
```

Expected results:

- bootstrap returns JSON
- cover URL returns `200`
- audio URL returns `200`

Then switch the mini app to HTTP provider and verify:

- covers load on real device
- audio plays on real device
- no `127.0.0.1` dependency remains
- no third-party domain whitelist errors remain
