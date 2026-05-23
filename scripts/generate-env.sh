#!/bin/bash
# generate-env.sh — สร้างไฟล์ .env พร้อม secret ที่ปลอดภัยอัตโนมัติ
APP_DIR="$(dirname "$(dirname "${BASH_SOURCE[0]}")")"

if [ -f "$APP_DIR/.env" ]; then
  echo "⚠️  พบไฟล์ .env อยู่แล้ว ไม่สร้างทับ"
  echo "   ลบก่อนถ้าต้องการสร้างใหม่: rm .env"
  exit 1
fi

# สร้าง random secrets
JWT_SECRET=$(openssl rand -base64 48 | tr -d '\n')
DB_PASS=$(openssl rand -base64 24 | tr -d '/+=' | head -c 20)
PUBLIC_IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || echo "YOUR_VM_IP")

cat > "$APP_DIR/.env" << EOF
# ===== Database =====
POSTGRES_PASSWORD=$DB_PASS

# ===== JWT =====
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=7d

# ===== URLs (เปลี่ยน YOUR_VM_IP เป็น IP จริง หรือ domain) =====
FRONTEND_URL=http://$PUBLIC_IP
APP_URL=http://$PUBLIC_IP
PORT=4000
NODE_ENV=production

# ===== Email (แก้ไขเมื่อต้องการส่ง email) =====
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-gmail-app-password
EMAIL_FROM=Emergency Box System <your-email@gmail.com>

# ===== Telegram Bot (แก้ไขเมื่อต้องการส่ง Telegram) =====
TELEGRAM_BOT_TOKEN=

# ===== Notification thresholds (วัน) =====
ALERT_DAYS_30=30
ALERT_DAYS_7=7
ALERT_DAYS_1=1
EOF

echo "✅ สร้าง .env สำเร็จ (JWT_SECRET และ POSTGRES_PASSWORD ถูก generate อัตโนมัติ)"
echo ""
echo "📝 แก้ไขค่าที่ยังต้องปรับ:"
echo "   FRONTEND_URL / APP_URL → ใส่ IP หรือ domain จริง"
echo "   SMTP_USER / SMTP_PASS → ถ้าต้องการส่ง email"
echo "   TELEGRAM_BOT_TOKEN → ถ้าต้องการส่ง Telegram"
echo ""
echo "เปิดแก้ไข: nano .env"
