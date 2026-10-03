#!/usr/bin/env bash
# Installs or updates the sync server on this machine. Idempotent. Run as root from /opt/quadern-sync
# (scripts/deploy-sync.sh copies the files and runs it).
set -euo pipefail

APP=/opt/quadern-sync
SERVICE=quadern-sync
NODE_MAJOR=24
CADDY_MIN=2.10

main() {
  echo "==> Node $NODE_MAJOR for the service"
  export NVM_DIR=/root/.nvm
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
  nvm install "$NODE_MAJOR" >/dev/null
  local version node_home
  version="$(nvm version "$NODE_MAJOR")"
  node_home="$(dirname "$(dirname "$(nvm which "$NODE_MAJOR")")")"
  if [ ! -x "/opt/node/$version/bin/node" ]; then
    mkdir -p /opt/node
    cp -a "$node_home" "/opt/node/$version"
    chown -R root:root "/opt/node/$version"
    chmod -R go-w "/opt/node/$version"
  fi
  ln -sfn "/opt/node/$version" /opt/node/sync-current   # the bot uses /opt/node/current: separate link
  echo "    $version"

  echo "==> Code is read-only for everyone but root"
  chown -R root:root "$APP"
  chmod -R go-w "$APP"

  echo "==> systemd unit"
  systemd-analyze verify "$APP/deploy/$SERVICE.service"
  install -m 644 "$APP/deploy/$SERVICE.service" "/etc/systemd/system/$SERVICE.service"
  systemctl daemon-reload
  systemctl enable "$SERVICE" >/dev/null
  systemctl restart "$SERVICE"

  echo "==> Caddy (HTTPS)"
  if ! command -v caddy >/dev/null || [ "$(printf '%s\n' "$CADDY_MIN" "$(caddy version | grep -oE '[0-9]+\.[0-9]+' | head -1)" | sort -V | head -1)" != "$CADDY_MIN" ]; then
    apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https curl gpg >/dev/null
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
    apt-get update -qq
    apt-get install -y -qq caddy >/dev/null
  fi
  caddy version
  caddy validate --config "$APP/deploy/Caddyfile" --adapter caddyfile >/dev/null
  if ! cmp -s "$APP/deploy/Caddyfile" /etc/caddy/Caddyfile; then
    install -m 644 "$APP/deploy/Caddyfile" /etc/caddy/Caddyfile
    systemctl reload caddy || systemctl restart caddy
  fi
  systemctl enable caddy >/dev/null

  echo "==> Health"
  sleep 2
  for s in "$SERVICE" caddy; do
    systemctl is-active --quiet "$s" || { journalctl -u "$s" -n 30 --no-pager; echo "!!! $s is not running"; exit 1; }
    echo "    $s: active, enabled at boot: $(systemctl is-enabled "$s")"
  done
  curl -fsS http://127.0.0.1:8787/v1/health; echo
}

main "$@"
