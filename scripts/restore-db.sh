#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Restaura UNA base de datos desde un dump creado por backup-db.sh
#
#   scripts/restore-db.sh <archivo.sql.gz> [nombre_bd_destino]
#
#   - Si no se indica destino, usa el nombre del archivo (sin .sql.gz).
#   - CREA la BD si no existe; si existe, PIDE confirmación escribiendo su nombre
#     (el import sobrescribe tablas y datos).
#   - Lee credenciales de /var/www/ingenieros.tech/.env
#
# Ejemplo:
#   scripts/restore-db.sh ~/backups/mysql/latest/costos_2_20260616143745_926.sql.gz
# ─────────────────────────────────────────────────────────────────────────────
set -Eeuo pipefail

APP_DIR="${PCL_APP_DIR:-/var/www/ingenieros.tech}"
ENV_FILE="$APP_DIR/.env"

SRC="${1:-}"
[ -n "$SRC" ] && [ -r "$SRC" ] || { echo "uso: $0 <archivo.sql.gz> [bd_destino]" >&2; exit 2; }

TARGET="${2:-}"
if [ -z "$TARGET" ]; then
    TARGET="$(basename "$SRC")"
    TARGET="${TARGET%.sql.gz}"
    TARGET="${TARGET%.sql}"
fi

[ -r "$ENV_FILE" ] || { echo "no puedo leer $ENV_FILE" >&2; exit 1; }
envval() {
    grep -E "^$1=" "$ENV_FILE" | head -n1 | cut -d= -f2- \
        | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' \
              -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'\$/\1/"
}
DB_HOST="$(envval DB_HOST)"; DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="$(envval DB_PORT)"; DB_PORT="${DB_PORT:-3306}"
DB_USER="$(envval DB_USERNAME)"
DB_PASS="$(envval DB_PASSWORD)"

CNF="$(mktemp)"; chmod 600 "$CNF"
trap 'rm -f "$CNF"' EXIT
printf '[client]\nhost=%s\nport=%s\nuser=%s\npassword=%s\n' \
    "$DB_HOST" "$DB_PORT" "$DB_USER" "$DB_PASS" > "$CNF"

EXISTS="$(mysql --defaults-extra-file="$CNF" -N -B -e \
    "SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name='$TARGET'")"

echo "Origen : $SRC"
echo "Destino: $TARGET  ($([ "$EXISTS" = "1" ] && echo 'YA EXISTE — se sobrescribe' || echo 'se creará'))"
if [ "$EXISTS" = "1" ]; then
    read -r -p "Escribe el nombre de la BD para confirmar: " CONFIRM
    [ "$CONFIRM" = "$TARGET" ] || { echo "cancelado"; exit 1; }
fi

mysql --defaults-extra-file="$CNF" -e \
    "CREATE DATABASE IF NOT EXISTS \`$TARGET\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"

echo "Restaurando…"
gunzip -c "$SRC" | mysql --defaults-extra-file="$CNF" "$TARGET"
echo "OK — $TARGET restaurada desde $SRC"
