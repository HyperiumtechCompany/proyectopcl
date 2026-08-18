#!/usr/bin/env bash
set -Eeuo pipefail

echo "[DEPLOY] Iniciando deploy PCL..."

cd /var/www/ingenieros.tech

echo "[GIT] Actualizando codigo..."
git pull --ff-only origin Emes

echo "[PHP] Instalando dependencias..."
composer install --no-dev --prefer-dist --optimize-autoloader --no-interaction

echo "[CACHE] Limpiando caches anteriores..."
php artisan optimize:clear

echo "[FRONTEND] Instalando y compilando assets..."
npm ci --include=dev --legacy-peer-deps --no-audit --no-fund
npm run build

test -s public/build/manifest.json
test -s public/dialux-core/pkg/dialux_core.js
test -s public/dialux-core/pkg/dialux_core_bg.wasm
test -s public/cad-workers/index.js
test -s public/cad-workers/libredwg-parser-worker.js
test -s public/cad-workers/mtext-renderer-worker.js
test -s public/wasm/web-ifc.wasm

echo "[DB] Ejecutando migraciones..."
php artisan migrate --force

echo "[DB] Reconciliando insumos huerfanos de todos los proyectos de Costos..."
php artisan costos:reconcile-insumos --force

echo "[DB] Sincronizando catalogo fotometrico real..."
php artisan db:seed --class=RealPhotometryLuminaireSeeder --force

echo "[DB] Importando luminarias de emergencia..."
SEEDER_FORCE_UPDATE=true php artisan db:seed --class=EmergencyLuminaireSeeder --force

echo "[STORAGE] Verificando enlace publico..."
php artisan storage:link --force
test -L public/storage

echo "[CACHE] Optimizando Laravel..."
php artisan optimize

echo "[QUEUE] Reiniciando workers..."
php artisan queue:restart
sudo supervisorctl restart pcl-worker:*

echo "[OK] Deploy completado exitosamente"
