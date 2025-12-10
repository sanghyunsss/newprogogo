#!/bin/bash
cd /var/www/hotel-app || exit

echo "📥 최신 코드 가져오기..."
git pull origin main

echo "📦 의존성 설치..."
npm install --production

echo "🔨 빌드 실행..."
npm run build

echo "🚀 PM2 재시작..."
pm2 restart hotel-app

echo "✅ 배포 완료!"