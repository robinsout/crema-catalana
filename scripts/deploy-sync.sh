#!/usr/bin/env bash
# Deploys the sync server to the Hetzner machine (ssh host "hetzner"): copies the server code and
# runs deploy/install.sh there. Usage: npm run deploy:sync
set -euo pipefail
cd "$(dirname "$0")/.."
HOST="${SYNC_HOST:-hetzner}"

rsync -az --delete \
  --include='server/***' --include='shared/***' --include='deploy/***' --exclude='*' \
  ./ "$HOST:/opt/quadern-sync/"
ssh "$HOST" 'bash /opt/quadern-sync/deploy/install.sh'

echo "==> From outside"
curl -fsS --max-time 15 https://188.245.182.47/v1/health && echo
