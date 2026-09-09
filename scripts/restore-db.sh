#!/usr/bin/env bash
# Wrapper de `php artisan db:restore`.
#
#   scripts/restore-db.sh <archivo.sql.gz> [bd_destino]
#
# Si la BD destino ya existe, pide confirmación (escribir su nombre).
set -Eeuo pipefail
cd "${PCL_APP_DIR:-/var/www/ingenieros.tech}"
exec php artisan db:restore "$@"
