#!/bin/bash
# =============================================================
# setup-vm.sh — รันบน Oracle Cloud VM ครั้งแรกครั้งเดียว
# ใช้กับ Ubuntu 22.04 (AMD หรือ ARM A1)
# =============================================================
set -e

echo ""
echo "=================================================="
echo "  EBTS — Oracle Cloud VM Setup"
echo "=================================================="
echo ""

# ── 1. อัปเดต OS ─────────────────────────────────────
echo "[1/6] อัปเดต Ubuntu..."
sudo apt-get update -y && sudo apt-get upgrade -y
sudo apt-get install -y curl git wget unzip htop

# ── 2. ติดตั้ง Docker ────────────────────────────────
echo "[2/6] ติดตั้ง Docker..."
if ! command -v docker &> /dev/null; then
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker $USER
  echo "✅ Docker installed"
else
  echo "✅ Docker already installed"
fi

# ── 3. ติดตั้ง Docker Compose v2 ─────────────────────
echo "[3/6] ติดตั้ง Docker Compose..."
if ! docker compose version &> /dev/null; then
  COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep '"tag_name"' | cut -d'"' -f4)
  ARCH=$(uname -m)
  sudo curl -SL "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-${ARCH}" \
    -o /usr/local/lib/docker/cli-plugins/docker-compose
  sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
  echo "✅ Docker Compose installed: $COMPOSE_VERSION"
else
  echo "✅ Docker Compose already installed"
fi

# ── 4. สร้าง Swap 2GB (สำหรับ VM RAM น้อย) ──────────
echo "[4/6] ตั้งค่า Swap memory (2GB)..."
if [ ! -f /swapfile ]; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
  echo "✅ Swap 2GB created"
else
  echo "✅ Swap already exists"
fi

# ── 5. เปิด Firewall (Oracle ใช้ iptables) ───────────
echo "[5/6] เปิด port 80, 443 ใน iptables..."
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80  -j ACCEPT 2>/dev/null || true
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT 2>/dev/null || true
# บันทึก iptables ให้คงอยู่หลัง reboot
if command -v netfilter-persistent &> /dev/null; then
  sudo netfilter-persistent save
else
  sudo apt-get install -y iptables-persistent -o Dpkg::Options::="--force-confnew" 2>/dev/null || true
  sudo netfilter-persistent save 2>/dev/null || true
fi
echo "✅ Firewall configured"

# ── 6. สร้าง directory ───────────────────────────────
echo "[6/6] สร้างโครงสร้าง directory..."
sudo mkdir -p /opt/ebts
sudo chown $USER:$USER /opt/ebts
echo "✅ Directory /opt/ebts ready"

echo ""
echo "=================================================="
echo "  ✅ Setup เสร็จสิ้น!"
echo ""
echo "  ⚠️  สำคัญ: logout แล้ว login ใหม่ 1 ครั้ง"
echo "     เพื่อให้ docker group มีผล"
echo ""
echo "  ขั้นตอนถัดไป:"
echo "  1. logout / login ใหม่"
echo "  2. cd /opt/ebts"
echo "  3. รัน ./scripts/deploy.sh"
echo "=================================================="
