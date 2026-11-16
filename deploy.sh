#!/usr/bin/env bash
# Deploy script for the modme CRM shared-VPS setup.
# Run from the server, inside the repo's working copy (e.g. /home/modme).
#
#   ./deploy.sh
#
# Override the frontend's API base URL if needed:
#   VITE_API_BASE_URL=https://example.com ./deploy.sh
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

VITE_API_BASE_URL="${VITE_API_BASE_URL:-https://markaz.alijonovblog.uz}"
FRONTEND_IMAGE="modme-frontend"
FRONTEND_TMP_CONTAINER="modme-frontend-tmp"

echo "==> Pulling latest code"
git pull

echo "==> Rebuilding backend (docker compose, no-op if unchanged)"
docker compose -f docker-compose.prod.yml up -d --build

echo "==> Building frontend image"
docker build \
  -t "$FRONTEND_IMAGE" \
  -f frontend/Dockerfile \
  --build-arg VITE_API_BASE_URL="$VITE_API_BASE_URL" \
  frontend

echo "==> Extracting frontend dist"
docker rm -f "$FRONTEND_TMP_CONTAINER" >/dev/null 2>&1 || true
docker create --name "$FRONTEND_TMP_CONTAINER" "$FRONTEND_IMAGE" >/dev/null
trap 'docker rm -f "$FRONTEND_TMP_CONTAINER" >/dev/null 2>&1 || true' EXIT

rm -rf frontend/dist
docker cp "$FRONTEND_TMP_CONTAINER:/usr/share/nginx/html/." frontend/dist

echo "==> Done. Frontend served from $(pwd)/frontend/dist, backend via docker compose."
