#!/usr/bin/env bash
# Runs on the EC2 instance through AWS Systems Manager (see .github/workflows/ci-deploy.yml).
# Idempotent: installs Docker, Compose and git if missing, adds swap on small instances,
# checks out the given commit and (re)starts the stack on port 80.
# Usage: remote-deploy.sh <repo-url> <commit-sha>
set -euo pipefail

REPO_URL="${1:?repo url}"
SHA="${2:?commit sha}"
APP_DIR=/opt/reclaim
WEB_PORT="${WEB_PORT:-80}"

log() { echo "[deploy] $*"; }

. /etc/os-release
log "OS: ${PRETTY_NAME:-unknown}, arch: $(uname -m)"

install_packages() {
  if command -v dnf >/dev/null 2>&1; then
    dnf install -y docker git
  elif command -v apt-get >/dev/null 2>&1; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -y
    apt-get install -y docker.io git curl
    apt-get install -y docker-compose-v2 || true
  else
    log "Unsupported OS: install docker and git manually"; exit 1
  fi
}

if ! command -v docker >/dev/null 2>&1 || ! command -v git >/dev/null 2>&1; then
  log "Installing Docker and git"
  install_packages
fi
systemctl enable --now docker

# Docker Compose v2 plugin (not packaged on Amazon Linux 2023).
if ! docker compose version >/dev/null 2>&1; then
  log "Installing the Docker Compose plugin"
  case "$(uname -m)" in
    x86_64) arch=x86_64 ;;
    aarch64|arm64) arch=aarch64 ;;
    *) log "Unknown arch"; exit 1 ;;
  esac
  mkdir -p /usr/local/lib/docker/cli-plugins
  curl -fsSL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-${arch}" \
    -o /usr/local/lib/docker/cli-plugins/docker-compose
  chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
fi
docker compose version

# Building the web image needs more than 1 GB of memory: add 2 GB swap on small instances.
mem_kb=$(awk '/MemTotal/ {print $2}' /proc/meminfo)
if [ "$mem_kb" -lt 2500000 ] && ! swapon --show | grep -q .; then
  log "Adding 2 GB swap"
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

if [ ! -d "$APP_DIR/.git" ]; then
  log "Cloning $REPO_URL"
  git clone "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"
git fetch --depth 1 origin "$SHA"
git checkout --force --detach FETCH_HEAD
log "At commit $(git rev-parse --short HEAD)"

# Public port for the web container (docker-compose.yml reads WEB_PORT).
echo "WEB_PORT=${WEB_PORT}" > .env

docker compose up --build -d --remove-orphans
docker image prune -f >/dev/null

for i in $(seq 1 30); do
  if curl -fsS "http://localhost:${WEB_PORT}/api/health" >/dev/null; then
    log "Healthy on port ${WEB_PORT}"
    docker compose ps
    exit 0
  fi
  sleep 3
done
log "Health check failed"
docker compose logs --tail 80
exit 1
