# Fitnesta — Deployment Guide (CloudPanel)

This guide covers deploying both the **Node.js backend** and the **React admin panel** on CloudPanel.

---

## Part 1: Backend Deployment (Node.js + Express + Prisma)

### 1.1 Create the Site in CloudPanel

1. Log into CloudPanel
2. Click **"Add Site"** → choose **Node.js**
3. Domain: `fitnesta.rivoratech.com`
4. Note the **App Port** assigned (e.g., `3003`) — you'll need this later

---

### 1.2 Clone the Repository

SSH into the server:

```bash
cd ~/htdocs/fitnesta.rivoratech.com
git clone https://github.com/YOUR_ORG/fitnesta-backend.git fitnesta_be
cd fitnesta_be
npm install
```

---

### 1.3 Create the `.env` File

```bash
nano .env
```

Paste the following (fill in actual production values):

```env
# Database
DB_HOST=127.0.0.1
DB_USER=fitnesta-user
DB_PASSWORD=YOUR_DB_PASSWORD
DB_NAME=fitnesta-db
PORT=3003
DEV_SKIP_PAYMENT=false

# Security
FLUTTER_APP_SECRET=YOUR_FLUTTER_SECRET
JWT_ACCESS_SECRET=YOUR_JWT_SECRET

# Cloudinary
CLOUDINARY_CLOUD_NAME=YOUR_CLOUD_NAME
CLOUDINARY_API_KEY=YOUR_API_KEY
CLOUDINARY_API_SECRET=YOUR_API_SECRET

# Razorpay
RAZORPAY_KEY_ID=YOUR_RAZORPAY_KEY
RAZORPAY_KEY_SECRET=YOUR_RAZORPAY_SECRET
RAZORPAY_WEBHOOK_SECRET=YOUR_WEBHOOK_SECRET

# Firebase (FCM)
FIREBASE_PROJECT_ID=YOUR_PROJECT_ID
FIREBASE_CLIENT_EMAIL=YOUR_SERVICE_ACCOUNT_EMAIL
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Prisma Database URL (CRITICAL — must match DB credentials above)
DATABASE_URL="mysql://fitnesta-user:YOUR_DB_PASSWORD@127.0.0.1:3306/fitnesta-db?timezone=+00:00"
```

> **IMPORTANT:** The `PORT` value must match the App Port shown in CloudPanel Settings.

---

### 1.4 Set Up the Database

#### Create database and user in CloudPanel:
1. Go to your site → **Databases** tab
2. Click **"Add Database"** → name it `fitnesta-db`
3. Click **"Add Database User"** → create a user (e.g., `fitnesta-user`) with a strong password

#### Fix MySQL auth plugin (required for Prisma):

Get the MySQL root password:
```bash
clpctl db:show:master-credentials
```

Log in as root:
```bash
mysql -h'127.0.0.1' -P'3306' -u'root' -p'ROOT_PASSWORD_FROM_ABOVE' -A
```

Run:
```sql
ALTER USER 'fitnesta-user'@'%' IDENTIFIED WITH mysql_native_password BY 'YOUR_DB_PASSWORD';
FLUSH PRIVILEGES;
EXIT;
```

#### Push the schema to the database:
```bash
cd ~/htdocs/fitnesta.rivoratech.com/fitnesta_be
npx prisma db push
```

#### Generate Prisma client:
```bash
npx prisma generate
```

#### Seed commission rules:
```bash
node prisma/seed-commission-rules.js
```

---

### 1.5 Create Admin User

```bash
mysql -h'127.0.0.1' -P'3306' -u'root' -p'ROOT_PASSWORD' -A fitnesta-db
```

```sql
INSERT INTO users (role, subrole, full_name, mobile, is_verified, approval_status)
VALUES ('admin', NULL, 'Admin Name', '9876543210', 1, 'approved');

INSERT INTO admins (user_id, scope)
VALUES (LAST_INSERT_ID(), 'super_admin');

EXIT;
```

---

### 1.6 Start with PM2

```bash
cd ~/htdocs/fitnesta.rivoratech.com/fitnesta_be
pm2 start index.js --name fitnesta-backend
pm2 save
```

Verify:
```bash
pm2 logs fitnesta-backend --lines 5
```

You should see:
```
Server running on port 3003
[absent-job] Started
[autocomplete-job] Started
```

---

### 1.7 Verify Backend

```bash
curl -X POST https://fitnesta.rivoratech.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"mobile": "9876543210", "role": "admin"}'
```

You should get a JSON response with a token.

---

## Part 2: Admin Panel Deployment (React + Vite — Static Site)

### 2.1 Create the Site in CloudPanel

1. Click **"Add Site"** → choose **Static**
2. Domain: `fitnestadmin.rivoratech.com`

---

### 2.2 Build and Upload

**Option A — Build on server:**

```bash
cd ~/htdocs/fitnestadmin.rivoratech.com
git clone https://github.com/YOUR_ORG/fitnesta-admin.git temp
cd temp
npm install
npm run build
cp -r dist/* ~/htdocs/fitnestadmin.rivoratech.com/
cd ~/htdocs/fitnestadmin.rivoratech.com
rm -rf temp
```

**Option B — Build locally, upload files:**

1. On your local machine: `npm run build`
2. Upload the contents of `dist/` to `/home/rivoratech-fitnestadmin/htdocs/fitnestadmin.rivoratech.com/`

The folder should contain:
```
index.html
assets/
favicon.svg
icons.svg
```

---

### 2.3 Configure Nginx Vhost

In CloudPanel → fitnestadmin site → **Vhost** tab, use:

```nginx
server {
  listen 80;
  listen [::]:80;
  listen 443 quic;
  listen 443 ssl;
  listen [::]:443 quic;
  listen [::]:443 ssl;
  http2 on;
  http3 off;

  {{ssl_certificate_key}}
  {{ssl_certificate}}

  server_name fitnestadmin.rivoratech.com;

  {{root}}

  {{nginx_access_log}}
  {{nginx_error_log}}

  if ($scheme != "https") {
    rewrite ^ https://$host$request_uri permanent;
  }

  location ~ /.well-known {
    auth_basic off;
    allow all;
  }

  {{settings}}

  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }

  location ~* \.(css|js|jpg|jpeg|gif|png|ico|svg|woff|woff2|ttf|eot|webp)$ {
    expires max;
    access_log off;
  }
}
```

> The `try_files $uri $uri/ /index.html;` line is critical — it makes React Router work for all routes like `/login`, `/dashboard`, etc.

---

### 2.4 Fix CloudPanel Root Path Bug

After saving the vhost, CloudPanel may generate a broken `root` path. Check:

```bash
cat /etc/nginx/sites-enabled/fitnestadmin.rivoratech.com.conf | grep root
```

If it shows something like:
```
root /home/rivoratech-fitnestadmin/htdocs//home/rivoratech-fitnestadmin/htdocs/fitnestadmin.rivoratech.com;
```

Fix it manually:
```bash
nano /etc/nginx/sites-enabled/fitnestadmin.rivoratech.com.conf
```

Change the root line to:
```
root /home/rivoratech-fitnestadmin/htdocs/fitnestadmin.rivoratech.com;
```

Then reload:
```bash
nginx -t
systemctl reload nginx
```

---

### 2.5 Verify Admin Panel

Open `https://fitnestadmin.rivoratech.com/login` in your browser. You should see the login page.

---

## Part 3: Redeployment (Future Updates)

### Backend updates:
```bash
cd ~/htdocs/fitnesta.rivoratech.com/fitnesta_be
git pull
npm install
npx prisma generate
pm2 restart fitnesta-backend
```

### Admin panel updates:
```bash
cd ~/htdocs/fitnestadmin.rivoratech.com
# Upload new build files (or git pull + npm run build)
# No restart needed — Nginx serves static files directly
```

---

## Quick Reference

| Item | Value |
|------|-------|
| Backend URL | `https://fitnesta.rivoratech.com/api/v1` |
| Admin Panel URL | `https://fitnestadmin.rivoratech.com` |
| Backend Port | `3003` (must match CloudPanel App Port) |
| DB Host | `127.0.0.1:3306` |
| DB Name | `fitnesta-db` |
| PM2 Process Name | `fitnesta-backend` |
| Backend Site Type | Node.js |
| Admin Site Type | Static |

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `DATABASE_URL not found` | `.env` file is missing — create it |
| `Unknown authentication plugin sha256_password` | Run `ALTER USER ... WITH mysql_native_password` |
| `502 Bad Gateway` on backend | PM2 not running or wrong port — check `pm2 list` and `.env PORT` |
| `404` on admin panel routes | Missing `try_files` in Nginx vhost |
| `500` on admin panel | Root path is broken — fix manually in nginx conf |
| `Cannot GET /` on backend | Normal — backend only serves `/api/v1/...` routes |
