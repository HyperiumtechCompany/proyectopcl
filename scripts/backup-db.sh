#!/usr/bin/env bash
# Wrapper del comando `php artisan db:backup` (que usa la config de Laravel —
# credenciales y socket exactos que usa la app, sin parsear .env a mano).
#
#   scripts/backup-db.sh                 # respalda todo
#   scripts/backup-db.sh --only <bd>     # solo una BD (antes de algo riesgoso)
#   scripts/backup-db.sh --list          # solo lista las BD
#
# Destino:  ~/backups/mysql/<fecha>/<bd>.sql.gz  + symlink `latest` + MANIFEST.
# Retención 14 días / 6 meses. Log en ~/backups/mysql/backup.log.
# Restaurar:  scripts/restore-db.sh <archivo.sql.gz> [bd_destino]
set -Eeuo pipefail
cd "${PCL_APP_DIR:-/var/www/ingenieros.tech}"
exec php artisan db:backup "$@"
