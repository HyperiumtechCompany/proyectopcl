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

if [ "${PCL_SKIP_DEPLOY_BACKUP:-0}" != "1" ]; then
  echo "[BACKUP] Respaldo de BD previo a migraciones..."
  if bash scripts/backup-db.sh; then
    echo "[BACKUP] OK"
  else
    echo "[BACKUP] ⚠ El respaldo FALLÓ (ver ~/backups/mysql/backup.log)."
    echo "[BACKUP] ⚠ El deploy sigue, pero NO corras migraciones de esquema grandes sin respaldo."
  fi
fi

echo "[DB] Ejecutando migraciones (BD central)..."
php artisan migrate --force

echo "[DB] Ejecutando migraciones de las BD tenant de Costos..."
php artisan tenant:migrate-all || echo "[DB] ⚠ Alguna migración tenant falló — revisar arriba."

echo "[DB] Reconciliando insumos huerfanos de todos los proyectos de Costos..."
php artisan costos:reconcile-insumos --force

echo "[DB] Catalogo de luminarias omitido; su carga se realiza manualmente."

echo "[STORAGE] Verificando enlace publico..."
php artisan storage:link --force
test -L public/storage

echo "[CACHE] Optimizando Laravel..."
php artisan optimize

echo "[QUEUE] Reiniciando workers..."
php artisan queue:restart
sudo supervisorctl restart pcl-worker:*

echo "[OK] Deploy completado exitosamente"
