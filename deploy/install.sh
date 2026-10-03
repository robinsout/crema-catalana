#!/usr/bin/env bash
# Installs or updates the sync server on this machine. Idempotent. Run as root.
#   deploy/install.sh              full install (scripts/deploy-sync.sh copies the files and runs it)
#   deploy/install.sh --node-only  latest Node 24 patch; restarts the service only if Node changed
#                                  (run weekly by quadern-sync-update.timer)
set -euo pipefail

APP=/opt/quadern-sync
SERVICE=quadern-sync
NODE_MAJOR=24
CADDY_MIN=2.10

# Installs the latest Node $NODE_MAJOR via root's nvm and copies it to /opt/node (the service has no
# access to /root). Prints "changed" when the service now uses a new version.
ensure_node() {
  export NVM_DIR=/root/.nvm
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
  nvm install "$NODE_MAJOR" >/dev/null 2>&1
  local version node_home
  version="$(nvm version "$NODE_MAJOR")"
  node_home="$(dirname "$(dirname "$(nvm which "$NODE_MAJOR")")")"
  if [ ! -x "/opt/node/$version/bin/node" ]; then
    mkdir -p /opt/node
    cp -a "$node_home" "/opt/node/$version"
    chown -R root:root "/opt/node/$version"
    chmod -R go-w "/opt/node/$version"
  fi
  if [ "$(readlink /opt/node/sync-current || true)" != "/opt/node/$version" ]; then
    ln -sfn "/opt/node/$version" /opt/node/sync-current   # the bot uses /opt/node/current: separate link
    echo changed
  fi
  echo "    node $version" >&2
}

health() {
  sleep 2
  for s in "$SERVICE" caddy; do
    systemctl is-active --quiet "$s" || { journalctl -u "$s" -n 30 --no-pager; echo "!!! $s is not running"; exit 1; }
    echo "    $s: active, enabled at boot: $(systemctl is-enabled "$s")"
  done
  curl -fsS http://127.0.0.1:8787/v1/health; echo
}

node_only() {
  echo "==> Node $NODE_MAJOR"
  if [ "$(ensure_node)" = changed ]; then
    systemctl restart "$SERVICE"
    echo "    restarted on the new Node"
  fi
  health
}

full() {
  echo "==> Node $NODE_MAJOR for the service"
  ensure_node >/dev/null

  echo "==> Code is read-only for everyone but root"
  chown -R root:root "$APP"
  chmod -R go-w "$APP"

  echo "==> systemd units"
  for unit in "$SERVICE.service" "$SERVICE-update.service" "$SERVICE-update.timer"; do
    systemd-analyze verify "$APP/deploy/$unit"
    install -m 644 "$APP/deploy/$unit" "/etc/systemd/system/$unit"
  done
  systemctl daemon-reload
  systemctl enable "$SERVICE" >/dev/null
  systemctl enable --now "$SERVICE-update.timer" >/dev/null
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
  caddy validate --config "$APP/deploy/Caddyfile" --adapter caddyfile >/dev/null 2>&1
  if ! cmp -s "$APP/deploy/Caddyfile" /etc/caddy/Caddyfile; then
    install -m 644 "$APP/deploy/Caddyfile" /etc/caddy/Caddyfile
    systemctl restart caddy   # the admin API is off, so "reload" cannot work
  fi
  systemctl enable caddy >/dev/null

  echo "==> Automatic security updates of Caddy"
  install -m 644 "$APP/deploy/52unattended-caddy" /etc/apt/apt.conf.d/52unattended-caddy

  echo "==> Health"
  health
}

case "${1:-}" in
  --node-only) node_only ;;
  "") full ;;
  *) echo "usage: install.sh [--node-only]"; exit 2 ;;
esac
