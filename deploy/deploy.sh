#!/bin/bash
# 记账本 - 云服务器部署脚本
# 适用于 Ubuntu/Debian 系统
# 使用方法: bash deploy.sh

set -e

echo "========================================"
echo "  记账本 - 云服务器部署"
echo "========================================"

# 配置（可修改）
APP_DIR="/opt/jzb"
NODE_VERSION="20"
PORT=3000
DOMAIN=""  # 留空则用IP访问，填域名则自动配置HTTPS

# 1. 安装 Node.js
echo "[1/5] 安装 Node.js..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi
echo "  Node.js: $(node -v)"

# 2. 安装 PM2（进程守护）
echo "[2/5] 安装 PM2..."
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
fi

# 3. 复制项目文件
echo "[3/5] 复制项目文件..."
sudo mkdir -p ${APP_DIR}
sudo cp -r ../server ${APP_DIR}/
sudo cp -r ../database ${APP_DIR}/
sudo cp -r ../services ${APP_DIR}/
sudo cp -r ../data ${APP_DIR}/ 2>/dev/null || true

# 安装依赖
cd ${APP_DIR}/server
npm install --production 2>/dev/null || true
cd ${APP_DIR}
npm install bcryptjs 2>/dev/null || true

# 4. 配置环境变量
echo "[4/5] 配置环境变量..."
cat > ${APP_DIR}/.env << EOF
PORT=${PORT}
TRUST_PROXY=true
ADMIN_PASSWORD=admin888
# OCR 配置（按需填写）
BAIDU_OCR_API_KEY=
BAIDU_OCR_SECRET_KEY=
TENCENT_SECRET_ID=
TENCENT_SECRET_KEY=
DEEPSEEK_API_KEY=
EOF

# 5. 启动服务
echo "[5/5] 启动服务..."
cd ${APP_DIR}/server
PORT=${PORT} TRUST_PROXY=true pm2 start index.js --name jzb -- -e ${APP_DIR}/.env
pm2 save
pm2 startup 2>/dev/null || true

echo ""
echo "========================================"
echo "  部署完成！"
echo ""
echo "  本地访问: http://localhost:${PORT}"
echo "  公网访问: http://服务器IP:${PORT}"
echo "  手机App:  http://服务器IP:${PORT}/app/"
echo "  管理后台: http://服务器IP:${PORT}/admin"
echo ""
echo "  常用命令:"
echo "    pm2 status     查看状态"
echo "    pm2 logs jzb   查看日志"
echo "    pm2 restart jzb 重启服务"
echo "    pm2 stop jzb   停止服务"
echo "========================================"

# 可选：配置 Nginx + HTTPS
if [ -n "$DOMAIN" ]; then
    echo ""
    echo "[可选] 配置 Nginx + HTTPS..."
    if ! command -v nginx &> /dev/null; then
        sudo apt-get install -y nginx
    fi
    if ! command -v certbot &> /dev/null; then
        sudo apt-get install -y certbot python3-certbot-nginx
    fi

    sudo tee /etc/nginx/sites-available/jzb > /dev/null << EOF
server {
    listen 80;
    server_name ${DOMAIN};

    client_max_body_size 10m;

    location / {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

    sudo ln -sf /etc/nginx/sites-available/jzb /etc/nginx/sites-enabled/
    sudo nginx -t && sudo systemctl reload nginx
    sudo certbot --nginx -d ${DOMAIN} --non-interactive --agree-tos -m admin@${DOMAIN}

    echo ""
    echo "  HTTPS 已配置！"
    echo "  公网访问: https://${DOMAIN}"
    echo "  手机App:  https://${DOMAIN}/app/"
fi
