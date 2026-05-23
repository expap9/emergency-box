#!/bin/bash
# backup.sh — Backup PostgreSQL database
set -e

APP_DIR="$(dirname "$(dirname "${BASH_SOURCE[0]}")")"
BACKUP_DIR="$APP_DIR/backups"
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="ebts_backup_$DATE.sql.gz"

mkdir -p "$BACKUP_DIR"
cd "$APP_DIR"

echo "📦 Backing up database..."
docker compose exec -T postgres pg_dump -U ebts_user ebts_db | gzip > "$BACKUP_DIR/$FILENAME"

SIZE=$(du -sh "$BACKUP_DIR/$FILENAME" | cut -f1)
echo "✅ Backup saved: backups/$FILENAME ($SIZE)"

# เก็บแค่ 30 ไฟล์ล่าสุด
ls -t "$BACKUP_DIR"/*.sql.gz 2>/dev/null | tail -n +31 | xargs rm -f 2>/dev/null || true
echo "🗂️  เก็บ backup ล่าสุด 30 ไฟล์"
