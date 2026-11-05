#!/usr/bin/env bash
# Daily Postgres backup, sent as a file to a Telegram chat.
# Meant to run via cron on the VPS, from the project root (/home/modme):
#   0 3 * * * /home/modme/scripts/backup_to_telegram.sh >> /home/modme/backup.log 2>&1
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

set -a
source .env.prod
set +a

if [ -z "${BACKUP_CHAT_ID:-}" ]; then
  echo "BACKUP_CHAT_ID is not set in .env.prod" >&2
  exit 1
fi
if [ -z "${TELEGRAM_BOT_TOKEN:-}" ]; then
  echo "TELEGRAM_BOT_TOKEN is not set in .env.prod" >&2
  exit 1
fi

TIMESTAMP="$(date +%Y-%m-%d)"
DUMP_FILE="/tmp/modme_backup_${TIMESTAMP}.sql.gz"

docker compose -f docker-compose.prod.yml exec -T db \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$DUMP_FILE"

RESPONSE=$(curl -s -F "chat_id=${BACKUP_CHAT_ID}" \
  -F "document=@${DUMP_FILE}" \
  -F "caption=Modme backup ${TIMESTAMP}" \
  "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument")

rm -f "$DUMP_FILE"

echo "$(date -Iseconds) ${RESPONSE}"

if ! echo "$RESPONSE" | grep -q '"ok":true'; then
  echo "Backup send failed: ${RESPONSE}" >&2
  exit 1
fi
