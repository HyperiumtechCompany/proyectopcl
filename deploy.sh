#!/bin/bash
set -e

echo "🚀 Iniciando deploy PCL..."

cd /var/www/ingenieros.tech

echo "📥 Actualizando código..."
git pull origin Emes

echo "📦 Instalando dependencias PHP..."
composer install --no-dev --optimize-autoloader

echo "🎨 Compilando assets..."
NODE_OPTIONS="--max-old-space-size=3072" npm ci --legacy-peer-deps
npm run build

echo "🗄️ Ejecutando migraciones..."
php artisan migrate --force

echo "🔧 Optimizando Laravel..."
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache

echo "🔄 Reiniciando workers..."
sudo supervisorctl restart pcl-worker:*

echo "✅ Deploy completado exitosamente"
