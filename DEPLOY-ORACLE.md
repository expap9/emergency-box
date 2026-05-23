# วิธี Deploy EBTS บน Oracle Cloud Free Tier

## ภาพรวม

```
[PC ของคุณ] ──scp──▶ [Oracle VM] ──docker──▶ [Nginx:80] ──▶ [React App]
                                          └──▶ [Backend:4000]
                                          └──▶ [PostgreSQL]
```

---

## ขั้นตอนที่ 1 — สร้าง VM บน Oracle Console

### 1.1 เข้า Oracle Cloud Console
ไปที่: **Compute → Instances → Create Instance**

### 1.2 เลือก Shape (แนะนำ ARM — ฟรีดีกว่า)

| Option | Shape | CPU | RAM | แนะนำ |
|--------|-------|-----|-----|-------|
| **ARM (ดีที่สุด)** | VM.Standard.A1.Flex | 2 OCPU | 12 GB | ✅ |
| AMD (สำรอง) | VM.Standard.E2.1.Micro | 1/8 OCPU | 1 GB | ⚠️ RAM น้อย |

**วิธีเลือก ARM A1:**
1. Shape → Change Shape → Ampere → VM.Standard.A1.Flex
2. OCPU: **2**, Memory: **12 GB** (ยังอยู่ใน Free Tier)

### 1.3 OS Image
- Image: **Ubuntu 22.04** (Canonical)

### 1.4 SSH Key
- Generate key pair → Download `.key` file เก็บไว้
- หรือ upload public key ที่มีอยู่แล้ว

### 1.5 กด Create → รอ ~2 นาที

---

## ขั้นตอนที่ 2 — เปิด Port บน Oracle VCN

ใน Oracle Console: **Networking → Virtual Cloud Networks → VCN ของคุณ → Security Lists → Default**

กด **Add Ingress Rules** เพิ่ม 2 rules:

| Source CIDR | Protocol | Port | คำอธิบาย |
|-------------|----------|------|---------|
| 0.0.0.0/0 | TCP | 80 | HTTP |
| 0.0.0.0/0 | TCP | 443 | HTTPS |

> ⚠️ Port 22 (SSH) ควรมีอยู่แล้ว ถ้าไม่มีให้เพิ่มด้วย

---

## ขั้นตอนที่ 3 — SSH เข้า VM

```bash
# บน PC ของคุณ (Mac/Linux)
chmod 400 ~/Downloads/your-key.key
ssh -i ~/Downloads/your-key.key ubuntu@YOUR_VM_IP

# บน Windows (PowerShell)
ssh -i C:\Users\YourName\Downloads\your-key.key ubuntu@YOUR_VM_IP
```

> หา IP ได้ที่ Oracle Console → Compute → Instances → Public IP Address

---

## ขั้นตอนที่ 4 — Setup VM (ครั้งแรกครั้งเดียว)

```bash
# ใน VM: รัน setup script
curl -fsSL https://raw.githubusercontent.com/your-repo/main/scripts/setup-vm.sh | bash
# หรือถ้า copy ไฟล์ขึ้นแล้ว:
bash /opt/ebts/scripts/setup-vm.sh
```

**แล้ว logout / login ใหม่ 1 ครั้ง (สำคัญ!)**

---

## ขั้นตอนที่ 5 — Copy ไฟล์โปรเจกต์ขึ้น VM

### วิธี A: SCP (แนะนำสำหรับครั้งแรก)

```bash
# บน PC — compress โปรเจกต์ก่อน (ข้าม node_modules)
cd C:\path\emer
tar -czf ebts.tar.gz --exclude=node_modules --exclude=.git --exclude=frontend/dist --exclude=backend/dist .

# Upload ขึ้น VM
scp -i your-key.key ebts.tar.gz ubuntu@YOUR_VM_IP:/opt/ebts/

# SSH เข้า VM แล้วแตกไฟล์
ssh -i your-key.key ubuntu@YOUR_VM_IP
cd /opt/ebts
tar -xzf ebts.tar.gz
```

### วิธี B: Git (แนะนำสำหรับ update ครั้งถัดไป)

```bash
# บน VM
cd /opt/ebts
git clone https://github.com/your-repo/ebts.git .
# หรือ git pull ถ้ามีอยู่แล้ว
```

---

## ขั้นตอนที่ 6 — ตั้งค่า Environment Variables

```bash
# บน VM ใน /opt/ebts
chmod +x scripts/*.sh

# สร้าง .env อัตโนมัติ (generate password + JWT secret ให้เลย)
bash scripts/generate-env.sh

# แก้ไขค่าที่จำเป็น
nano .env
```

**ค่าที่ต้องแก้ใน .env:**

```env
# เปลี่ยน IP เป็นของ VM จริง (หรือ domain ถ้ามี)
FRONTEND_URL=http://YOUR_VM_IP
APP_URL=http://YOUR_VM_IP

# Email (Gmail) — ถ้าต้องการแจ้งเตือน email
SMTP_USER=your-email@gmail.com
SMTP_PASS=xxxx-xxxx-xxxx-xxxx    # Gmail App Password (ไม่ใช่รหัส Google!)

# Telegram Bot — ถ้าต้องการแจ้งเตือน Telegram
TELEGRAM_BOT_TOKEN=123456789:AAF...
```

> 💡 **Gmail App Password**: myaccount.google.com → Security → 2FA → App Passwords

---

## ขั้นตอนที่ 7 — Deploy!

```bash
cd /opt/ebts
bash scripts/deploy.sh
```

Script จะทำให้อัตโนมัติ:
- ✅ Build Docker images
- ✅ Start PostgreSQL, Backend, Frontend
- ✅ Run database migration
- ✅ Seed ข้อมูลตั้งต้น (ยา 11 รายการ, หอผู้ป่วย 8 แห่ง)
- ✅ แสดง URL และ login เริ่มต้น

---

## ขั้นตอนที่ 8 — ทดสอบ

```bash
# เปิด browser: http://YOUR_VM_IP
# Login: admin / admin1234
# ⚠️ เปลี่ยนรหัสผ่านทันที!

# ทดสอบ API
curl http://YOUR_VM_IP/health
# ควรได้: {"status":"ok",...}
```

---

## ขั้นตอนที่ 9 — ตั้งค่า HTTPS (ถ้ามี domain name)

```bash
# ต้องมี domain ที่ชี้ A record มาที่ VM IP ก่อน
bash scripts/setup-https.sh your-domain.com admin@hospital.th
```

---

## คำสั่งที่ใช้บ่อย

```bash
cd /opt/ebts

# ดู status ทุก service
docker compose ps

# ดู logs แบบ real-time
docker compose logs -f
docker compose logs -f backend   # เฉพาะ backend
docker compose logs -f frontend  # เฉพาะ nginx

# Restart
docker compose restart
docker compose restart backend

# Stop / Start
docker compose down
docker compose up -d

# Backup database
bash scripts/backup.sh

# อัปเดตระบบ (หลัง git pull)
bash scripts/deploy.sh

# เข้า database โดยตรง
docker compose exec postgres psql -U ebts_user -d ebts_db
```

---

## การตั้งค่า Telegram Bot

1. เปิด Telegram → หา **@BotFather**
2. พิมพ์ `/newbot` → ตั้งชื่อ → ได้ Token
3. ใส่ Token ใน `.env` → `TELEGRAM_BOT_TOKEN=...`
4. แต่ละ user ต้องหา Chat ID ตัวเอง:
   - เปิด `https://t.me/your_bot` → กด Start
   - เปิด `https://api.telegram.org/botTOKEN/getUpdates`
   - หา `"chat":{"id": 123456789}` → นั่นคือ Chat ID
5. ใส่ Chat ID ในโปรไฟล์ user (หน้า ผู้ใช้งาน → แก้ไข)

---

## แก้ปัญหาที่พบบ่อย

### ❌ "Connection refused" เปิดเว็บไม่ได้
```bash
# ตรวจสอบ containers รันอยู่ไหม
docker compose ps

# ตรวจสอบ iptables (Ubuntu firewall)
sudo iptables -L INPUT -n | grep -E "80|443"
# ถ้าไม่เห็น → เพิ่ม rules:
sudo iptables -I INPUT 6 -p tcp --dport 80  -j ACCEPT
sudo iptables -I INPUT 6 -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

### ❌ Backend crash / "out of memory"
```bash
# ตรวจสอบ memory
free -h

# ถ้า swap ยังไม่มี
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile

# Restart
docker compose restart backend
```

### ❌ Database connection error
```bash
# ตรวจสอบ postgres
docker compose logs postgres
docker compose exec postgres pg_isready -U ebts_user

# Reset database (ระวัง: ลบข้อมูลทั้งหมด)
docker compose down
docker volume rm ebts_postgres_data
docker compose up -d
bash scripts/deploy.sh
```

### ❌ ARM build ช้ามาก
```bash
# ARM build อาจใช้ RAM เยอะ เพิ่ม swap ก่อน
# แล้ว build ทีละ service
docker compose build postgres
docker compose build backend
docker compose build frontend
docker compose up -d
```

---

## Architecture บน Oracle Cloud

```
Internet
    │
    ▼
Oracle VCN (Security List: 80, 443)
    │
    ▼
VM (Ubuntu 22.04 — ARM A1 หรือ AMD)
    │
    ├── Docker: nginx (port 80/443)
    │       ├── / → React Frontend (static files)
    │       └── /api/ → proxy → backend:4000
    │
    ├── Docker: backend (port 4000, internal only)
    │       ├── Express API
    │       ├── Prisma ORM
    │       └── Cron jobs (แจ้งเตือน 08:00 ทุกวัน)
    │
    └── Docker: postgres (port 5432, internal only)
            └── Volume: postgres_data (persistent)
```
