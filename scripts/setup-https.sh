#!/bin/bash
# setup-https.sh — ตั้งค่า HTTPS ด้วย Let's Encrypt (ต้องมี domain name)
# ใช้งาน: ./scripts/setup-https.sh yourdomain.com your@email.com
set -e

DOMAIN=$1
EMAIL=$2

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
  echo "การใช้งาน: ./scripts/setup-https.sh <domain> <email>"
  echo "ตัวอย่าง:  ./scripts/setup-https.sh ebts.hospital.th admin@hospital.th"
  exit 1
fi

APP_DIR="$(dirname "$(dirname "${BASH_SOURCE[0]}")")"
cd "$APP_DIR"

echo "🔒 ติดตั้ง Certbot..."
sudo apt-get install -y certbot

echo "⏸️  หยุด nginx ชั่วคราว..."
docker compose stop frontend

echo "📜 ขอ SSL certificate สำหรับ $DOMAIN..."
sudo certbot certonly --standalone \
  --non-interactive \
  --agree-tos \
  --email "$EMAIL" \
  -d "$DOMAIN"

echo "📁 Copy certificates..."
sudo mkdir -p "$APP_DIR/ssl"
sudo cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem "$APP_DIR/ssl/cert.pem"
sudo cp /etc/letsencrypt/live/$DOMAIN/privkey.pem  "$APP_DIR/ssl/key.pem"
sudo chown $USER:$USER "$APP_DIR/ssl/"*.pem

# อัปเดต nginx.conf ให้รองรับ HTTPS
cat > "$APP_DIR/nginx-https.conf" << EOF
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN;
    root /usr/share/nginx/html;
    index index.html;

    ssl_certificate     /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript;

    location /api/ {
        proxy_pass http://backend:4000/api/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /health {
        proxy_pass http://backend:4000/health;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|ico|svg|woff2)$ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }
}
EOF

echo "✅ nginx-https.conf สร้างแล้ว"
echo ""
echo "⚙️  อัปเดต .env..."
sed -i "s|FRONTEND_URL=.*|FRONTEND_URL=https://$DOMAIN|" "$APP_DIR/.env"
sed -i "s|APP_URL=.*|APP_URL=https://$DOMAIN|" "$APP_DIR/.env"

echo "🔄 Rebuild frontend และ restart..."
# อัปเดต docker-compose ให้ mount ssl และ nginx-https.conf
docker compose down frontend
docker compose build frontend
docker compose up -d

echo ""
echo "⏰ ตั้ง cron job สำหรับ auto-renew certificate..."
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet && cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem $APP_DIR/ssl/cert.pem && cp /etc/letsencrypt/live/$DOMAIN/privkey.pem $APP_DIR/ssl/key.pem && docker compose -f $APP_DIR/docker-compose.yml restart frontend") | crontab -

echo ""
echo "=================================================="
echo "  ✅ HTTPS เสร็จสิ้น!"
echo "  🔒 https://$DOMAIN"
echo "  🔄 Auto-renew ทุกวันตี 3"
echo "=================================================="
