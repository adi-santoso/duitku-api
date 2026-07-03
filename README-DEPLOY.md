# DuitKu API - Deployment Guide

## Setup Server Production

### 1. Clone Repository
```bash
# Login ke server
ssh user@your-server.com

# Clone repository
sudo mkdir -p /var/www/duitku-api
sudo chown $USER:$USER /var/www/duitku-api
cd /var/www/duitku-api
git clone https://github.com/YOUR_USERNAME/duiku-api.git .
```

### 2. Setup Environment
```bash
# Buat file .env (JANGAN commit ke git!)
nano .env
```

Isi dengan:
```env
DATABASE_URL=postgresql://...
JWT_SECRET=d89d76b185e3262c893028644ef4df981df25569c23acf48f736955164281a3dc3e0050d3e2d8a7e74879c39aafd039a02330ecd9c6b4a7156b27d0835c2a1cc
JWT_EXPIRES_IN=7d
PORT=3010
NODE_ENV=production
CORS_ORIGIN=http://duitku.gatrion.my.id,https://duitku.gatrion.my.id
```

### 3. Install Dependencies & Build
```bash
npm ci --production
npm run build
```

### 4. Setup PM2
```bash
# Install PM2 global (jika belum)
sudo npm install -g pm2

# Start aplikasi
pm2 start npm --name "duitku-api" -- start

# Save PM2 config
pm2 save

# Auto-start on boot
pm2 startup
# Jalankan command yang muncul (biasanya sudo ...)
```

### 5. Setup Nginx
```bash
# Copy nginx config
sudo cp nginx.conf /etc/nginx/sites-available/duitku-api.gatrion.my.id

# Enable site
sudo ln -s /etc/nginx/sites-available/duitku-api.gatrion.my.id /etc/nginx/sites-enabled/

# Test config
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

## Setup GitHub Actions

### 1. Generate SSH Key di Server
```bash
# Generate key
ssh-keygen -t rsa -b 4096 -C "github-actions" -f ~/.ssh/github_deploy

# Add public key ke authorized_keys
cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys

# Copy private key (untuk GitHub Secret)
cat ~/.ssh/github_deploy
```

### 2. Tambahkan GitHub Secrets

Di repository GitHub: **Settings > Secrets and variables > Actions**

Tambahkan secrets:
- `SERVER_HOST` → IP atau domain server (contoh: `123.456.789.10`)
- `SERVER_USER` → Username SSH (contoh: `ubuntu` atau `root`)
- `SERVER_SSH_KEY` → Private key dari `~/.ssh/github_deploy` (copy full text)
- `SERVER_PORT` → Port SSH (opsional, default: `22`)

## Cara Deploy

### Auto Deploy (via GitHub Actions)
Push ke branch `main`:
```bash
git add .
git commit -m "feat: new feature"
git push origin main
```

GitHub Actions akan otomatis:
1. SSH ke server
2. `git fetch origin`
3. `git reset --hard origin/main` (HARD RESET)
4. `git clean -fd`
5. `npm ci --production`
6. `npm run db:migrate`
7. `npm run build`
8. `pm2 restart duitku-api`
9. Health check

### Manual Trigger
- Buka tab **Actions** di GitHub
- Pilih workflow **Deploy DuitKu API**
- Click **Run workflow** > **Run workflow**

## Monitoring

### PM2 Commands
```bash
pm2 list                    # List semua process
pm2 logs duitku-api         # View logs
pm2 restart duitku-api      # Restart aplikasi
pm2 stop duitku-api         # Stop aplikasi
pm2 start duitku-api        # Start aplikasi
pm2 monit                   # Monitor CPU/Memory real-time
```

### Nginx Logs
```bash
# Access logs
sudo tail -f /var/log/nginx/duitku-api.access.log

# Error logs
sudo tail -f /var/log/nginx/duitku-api.error.log
```

### Application Health
```bash
# Check health endpoint
curl http://localhost:3010/health

# Check if port is listening
sudo netstat -tulpn | grep 3010
```

## Rollback

Jika deployment bermasalah:

```bash
# Di local
git log --oneline -10              # Cari commit yang baik
git revert HEAD                    # Revert commit terakhir
git push origin main               # Auto deploy versi sebelumnya
```

Atau manual di server:
```bash
cd /var/www/duitku-api
git reset --hard PREVIOUS_COMMIT_HASH
npm ci --production
npm run build
pm2 restart duitku-api
```

## Troubleshooting

### PM2 process tidak jalan
```bash
pm2 status duitku-api
pm2 logs duitku-api --lines 50
pm2 restart duitku-api
```

### Port 3010 sudah dipakai
```bash
# Cek process yang pakai port 3010
sudo netstat -tulpn | grep 3010
sudo lsof -i :3010

# Kill process jika perlu
sudo kill -9 PID
```

### Database connection error
```bash
# Verify .env
cat /var/www/duitku-api/.env | grep DATABASE_URL

# Test connection
cd /var/www/duitku-api
npm run db:studio
```

### Permission denied
```bash
# Fix ownership
sudo chown -R $USER:$USER /var/www/duitku-api

# Fix permissions
chmod 600 /var/www/duitku-api/.env
```

## Security Checklist

✅ `.env` file tidak di-commit ke git  
✅ SSH key disimpan di GitHub Secrets  
✅ Database credentials di environment variables  
✅ JWT secret strong (128 karakter)  
✅ CORS configured untuk domain frontend  
✅ Nginx security headers aktif  
✅ PM2 jalan sebagai non-root user  
✅ Git clean untuk remove untracked files  

## Flow Deployment

```
Developer → Git Push → GitHub Actions
                            ↓
                    SSH to Server
                            ↓
                    git reset --hard
                            ↓
                    npm ci --production
                            ↓
                    npm run build
                            ↓
                    pm2 restart
                            ↓
                    health check
                            ↓
                       ✓ Done
```
