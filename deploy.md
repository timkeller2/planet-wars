# 🚀 Deployment Guide: Publish Planet Wars to a Public Website

This guide walks you through publishing **Planet Wars** to a public-facing website. Since the game features a Node.js real-time multiplayer backend using **Socket.io** (WebSockets), it must be hosted on a platform that supports persistent active server connections.

Below are the **four best options** for deploying Planet Wars, ranked by ease of use and cost.

---

## 🎨 Table of Contents
1. [Option 1: Render.com (Recommended - Free / Low-cost Web Service)](#option-1-rendercom-recommended)
2. [Option 2: Railway.app (Easiest and Fastest Setup)](#option-2-railwayapp-easiest)
3. [Option 3: Hugging Face Spaces (Free & Permanent Docker Space)](#option-3-hugging-face-spaces-free--permanent)
4. [Option 4: Self-Hosted VPS (Highest Control and Performance)](#option-4-self-hosted-vps-complete-control)
5. [Environment Variables Reference](#environment-variables-reference)

---

## Option 1: Render.com (Recommended)
**Best for**: Free-tier hosting with automatic GitHub integration and custom domains.

### Step 1: Push Code to GitHub
Ensure your local project is pushed to a public or private repository on GitHub:
```bash
git init
git add .
git commit -m "Prepare for production release"
# Create a repository on GitHub, then link and push:
git remote add origin https://github.com/your-username/planet-wars.git
git branch -M main
git push -u origin main
```

### Step 2: Create a Web Service on Render
1. Sign up/log in at [Render.com](https://render.com).
2. Click **New +** and select **Web Service**.
3. Connect your GitHub account and choose the **planet-wars** repository.
4. Configure the service settings:
   - **Name**: `planet-wars`
   - **Region**: Select the region closest to your target audience.
   - **Branch**: `main`
   - **Language/Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `node server.js`
   - **Instance Type**: `Free` (or Starter for 24/7 run without idling).
5. Click **Advanced** and add the following Environment Variable:
   - `NODE_ENV` = `production`
6. Click **Create Web Service**.

> [!NOTE]
> On the Free tier, Render Web Services will sleep after 15 minutes of inactivity. When a user first opens the page, it may take 30-50 seconds to boot up. Subsequent interactions and game performance will run at native speed.

---

## Option 2: Railway.app (Easiest)
**Best for**: Instant, zero-config deployments with excellent WebSocket support and minimal cost.

### Step 1: Install the Railway CLI (Optional) or Link Git
You can deploy directly by linking GitHub on [Railway.app](https://railway.app) or using the CLI.

### Step 2: Deploy from the Dashboard
1. Go to [Railway.app](https://railway.app) and create a project.
2. Select **Deploy from GitHub repo**.
3. Choose your repository.
4. Railway will automatically detect the `package.json` file and setup the build and start commands.
5. In the **Variables** tab for the service, add:
   - `NODE_ENV` = `production`
   - `PORT` = `5173` (Railway will automatically map this to its public route).
6. Click **Deploy**. Your game will be live in less than 2 minutes!

---

## Option 3: Hugging Face Spaces (Free & Permanent)
**Best for**: Free 24/7 hosting, embedding inside other websites via iframes, and zero-sleep runs.

Hugging Face allows hosting custom Docker containers for free. We have already prepared a multi-stage `Dockerfile` in the root of the project to enable this.

### Step 1: Create a Space on Hugging Face
1. Create an account at [Hugging Face](https://huggingface.co).
2. Go to **Spaces** -> **New Space**.
3. Configure the Space:
   - **Space Name**: `planet-wars`
   - **License**: Choose any license (e.g., `mit`).
   - **SDK**: Select **Docker** (very important!).
   - **Docker Template**: Choose `Blank` or `None`.
   - **Space Hardware**: Select `CPU Basic` (Free, 16GB RAM, 2 vCPUs - *more than enough for 200+ concurrent connections*).
   - **Visibility**: `Public` (or Private if desired).
4. Click **Create Space**.

### Step 2: Push your repository to HF Git
HF will provide you with a Git remote URL. Run the following commands locally to push:
```bash
# Add Hugging Face Space as a git remote
git remote add hf https://huggingface.co/spaces/your-username/planet-wars
# Force push since HF creates a default README.md
git push -f hf main
```
HF Spaces will automatically build your `Dockerfile` and boot the server. You can view the build logs directly on your Hugging Face Space panel.

---

## Option 4: Self-Hosted VPS (Complete Control)
**Best for**: Dedicated environments (DigitalOcean, Linode, AWS, Hetzner) with zero overhead, high performance, and permanent uptime.

### Step 1: Install Node.js & PM2
Connect to your VPS via SSH and install Node.js (version 20+) and PM2 (Process Manager):
```bash
# Install Node.js (using NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 globally
sudo npm install -g pm2
```

### Step 2: Clone & Build Planet Wars
Clone your repository onto the server and compile the assets:
```bash
git clone https://github.com/your-username/planet-wars.git
cd planet-wars

# Install all dependencies and build
npm install
npm run build
```

### Step 3: Run the Server via PM2
PM2 ensures the server runs in the background and restarts automatically if it crashes or if the server reboots:
```bash
# Start the server in production mode
NODE_ENV=production PORT=5173 pm2 start server.js --name "planet-wars"

# Setup auto-start on server reboot
pm2 startup
pm2 save
```

### Step 4: Configure Nginx as a Reverse Proxy
To serve the game over standard ports (`80` / `443` HTTPS) and configure SSL, use Nginx:
```bash
sudo apt install nginx -y
```

Modify your Nginx configuration (e.g., `/etc/nginx/sites-available/default`):
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:5173;
        proxy_http_version 1.1;
        
        # Critical headers for WebSockets (Socket.io support)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Restart Nginx and optionally configure Certbot for free HTTPS:
```bash
sudo systemctl restart nginx
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d yourdomain.com
```

---

## Environment Variables Reference

| Variable Name | Purpose | Example Value |
| :--- | :--- | :--- |
| `NODE_ENV` | Must be set to `production` for optimal speed and static hosting. | `production` |
| `PORT` | The port the Express/Socket.io server listens on. Defaults to `5173`. | `8080`, `5173`, `3000` |

---

🎉 **Congratulations!** Your Planet Wars multiplayer game is ready to conquer the public web. Choose any of the platforms above to share it with your friends and players across the globe!
