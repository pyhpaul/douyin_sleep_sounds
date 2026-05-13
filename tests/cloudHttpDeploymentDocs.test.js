const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

test("cloud deployment README includes required operator sections", () => {
  const readme = fs.readFileSync("deployment/cloud-http-content/README.md", "utf8");

  for (const section of [
    "## Prerequisites",
    "## Remote directories",
    "## Upload static assets",
    "## Start the API",
    "## Nginx setup",
    "## HTTPS",
    "## Douyin domain whitelist",
    "## Verification"
  ]) {
    assert.match(readme, new RegExp(section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("cloud deployment README documents the single-domain path deployment", () => {
  const readme = fs.readFileSync("deployment/cloud-http-content/README.md", "utf8");

  for (const phrase of [
    "Single-domain deployment",
    "https://sleep.zhenwei1.cn/content/bootstrap",
    "https://sleep.zhenwei1.cn/covers/rain_night.jpg",
    "https://sleep.zhenwei1.cn/audio/rain_night.mp3",
    "STATIC_BASE_URL=https://sleep.zhenwei1.cn",
    "deployment/cloud-http-content/nginx/single-domain.example.conf",
    "/healthz"
  ]) {
    assert.match(readme, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("single-domain nginx example documents HTTPS and health proxy", () => {
  const nginx = fs.readFileSync("deployment/cloud-http-content/nginx/single-domain.example.conf", "utf8");

  for (const phrase of [
    "server_name sleep.zhenwei1.cn",
    "listen 443 ssl",
    "ssl_certificate /etc/letsencrypt/live/sleep.zhenwei1.cn/fullchain.pem",
    "ssl_certificate_key /etc/letsencrypt/live/sleep.zhenwei1.cn/privkey.pem",
    "location /healthz",
    "proxy_pass http://127.0.0.1:3000/healthz",
    "location /content/bootstrap",
    "location /covers/",
    "location /audio/"
  ]) {
    assert.match(nginx, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("cloud deployment README records the production certificate details", () => {
  const readme = fs.readFileSync("deployment/cloud-http-content/README.md", "utf8");

  for (const phrase of [
    "Current production certificate record",
    "public DV TLS certificate",
    "Let's Encrypt",
    "Key type: ECDSA",
    "Subject / SAN: `sleep.zhenwei1.cn`",
    "Issued on: `2026-05-13 05:23:21 UTC`",
    "Expires on: `2026-08-11 05:23:20 UTC`",
    "/etc/letsencrypt/renewal/sleep.zhenwei1.cn.conf",
    "Renewal method: Certbot `webroot`",
    "Webroot path: `/srv/sleep-sounds/static`",
    "certbot.timer",
    "certbot renew --dry-run"
  ]) {
    assert.match(readme, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});
