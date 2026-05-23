#!/bin/bash
# =============================================================
# deploy.sh — Deploy / Update EBTS บน Oracle Cloud VM
# รันใน /opt/ebts ทุกครั้งที่ต้องการ deploy หรืออัปเดต
# =============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"

echo ""
echo "=================================================="
echo "  EBTS — Deploy"
echo "=================================================="

# ── ตรวจสอบ .env ─────────────────────────────────────
if [ ! -f "$APP_DIR/.env" ]; then
  echo ""
  echo "❌ ไม่พบไฟล์ .env"
  echo "   กรุณา: cp .env.example .env && nano .env"
  exit 1
fi

cd "$APP_DIR"

# ── Load .env เพื่อตรวจสอบค่าจำเป็น ──────────────────
source .env

if [ -z "$POSTGRES_PASSWORD" ] || [ "$POSTGRES_PASSWORD" = "YourStrongPassword123!" ]; then
  echo "❌ กรุณาเปลี่ยน POSTGRES_PASSWORD ใน .env ก่อน deploy"
  exit 1
fi

if [ -z "$JWT_SECRET" ] || [ "$JWT_SECRET" = "your-random-64-char-secret-here" ]; then
  echo "❌ กรุณาเปลี่ยน JWT_SECRET ใน .env ก่อน deploy"
  exit 1
fi

echo ""
echo "📦 Building Docker images..."
docker compose build --no-cache

echo ""
echo "🚀 Starting services..."
docker compose up -d

echo ""
echo "⏳ รอ database พร้อม..."
sleep 8
until docker compose exec -T postgres pg_isready -U ebts_user -d ebts_db 2>/dev/null; do
  echo "   waiting for postgres..."
  sleep 3
done
echo "✅ Database ready"

echo ""
echo "🌱 ตรวจสอบ database migration..."
docker compose exec -T backend npx prisma migrate deploy || \
docker compose exec -T backend npx prisma db push

# ── Seed ถ้ายังไม่มีข้อมูล ──────────────────────────
USER_COUNT=$(docker compose exec -T postgres psql -U ebts_user -d ebts_db -t -c "SELECT COUNT(*) FROM \"User\";" 2>/dev/null | tr -d ' ' || echo "0")
if [ "$USER_COUNT" = "0" ] || [ -z "$USER_COUNT" ]; then
  echo ""
  echo "🌱 ใส่ข้อมูลตั้งต้น (seed)..."
  docker compose exec -T backend npm run db:seed
  echo "✅ Seed เสร็จสิ้น"
else
  echo "✅ Database มีข้อมูลแล้ว (ข้าม seed)"
fi

echo ""
echo "🔍 ตรวจสอบ services..."
docker compose ps

echo ""
echo "🧪 ทดสอบ API..."
sleep 3
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/health || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Backend API พร้อม (HTTP $HTTP_CODE)"
else
  echo "⚠️  Backend ยังไม่พร้อม (HTTP $HTTP_CODE) — ดู logs: docker compose logs backend"
fi

# ── แสดง IP ───────────────────────────────────────────
PUBLIC_IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || curl -s --max-time 5 ipecho.net/plain || echo "ดูใน Oracle Console")

echo ""
echo "=================================================="
echo "  ✅ Deploy เสร็จสิ้น!"
echo ""
echo "  🌐 เว็บไซต์: http://$PUBLIC_IP"
echo "  🔑 Login เริ่มต้น: admin / admin1234"
echo ""
echo "  ⚠️  เปลี่ยนรหัสผ่านทันทีหลัง login!"
echo ""
echo "  คำสั่งที่มีประโยชน์:"
echo "  docker compose logs -f        # ดู logs"
echo "  docker compose restart        # restart ทุก service"
echo "  ./scripts/backup.sh           # backup database"
echo "=================================================="
