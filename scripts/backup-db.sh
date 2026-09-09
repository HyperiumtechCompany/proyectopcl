#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Backup de las bases de datos de PCL: pcl_central + todas las BD tenant de
# Costos (costos_%). Auto-descubre las tenants nuevas.
#
#   scripts/backup-db.sh                 # respalda todo
#   scripts/backup-db.sh --only <bd>     # solo una BD (antes de una operación riesgosa)
#   scripts/backup-db.sh --list          # solo lista las BD que respaldaría
#
# Pensado para el cron diario del usuario `gerente` (no requiere sudo).
# Salida:  ~/backups/mysql/<fecha>/<bd>.sql.gz  +  symlink `latest`  +  copia
# mensual el día 1. Retención: 14 días de diarios, 6 meses de mensuales.
# Log:  ~/backups/mysql/backup.log
# ─────────────────────────────────────────────────────────────────────────────
set -Eeuo pipefail

APP_DIR="${PCL_APP_DIR:-/var/www/ingenieros.tech}"
BACKUP_ROOT="${PCL_BACKUP_DIR:-$HOME/backups/mysql}"
RETENTION_DAILY_DAYS="${PCL_BACKUP_RETENTION_DAYS:-14}"
RETENTION_MONTHLY_KEEP="${PCL_BACKUP_MONTHLY_KEEP:-6}"
MIN_FREE_MB="${PCL_BACKUP_MIN_FREE_MB:-2048}"

ENV_FILE="$APP_DIR/.env"
LOG="$BACKUP_ROOT/backup.log"
DATE="$(date +%F)"
DEST="$BACKUP_ROOT/$DATE"

ONLY=""
MODE="backup"
while [ $# -gt 0 ]; do
    case "$1" in
        --only) ONLY="${2:-}"; shift 2 ;;
        --list) MODE="list"; shift ;;
        *) echo "opción desconocida: $1" >&2; exit 2 ;;
    esac
done

mkdir -p "$BACKUP_ROOT"
STATUS=1
log() { echo "[$(date '+%F %T')] $*" | tee -a "$LOG"; }
finish() {
    if [ "$STATUS" -ne 0 ]; then
        log "FALLÓ (línea ${BASH_LINENO[0]:-?})"
        date '+%F %T' > "$BACKUP_ROOT/LAST_RUN_FAILED"
    fi
    [ -n "${CNF:-}" ] && rm -f "$CNF"
}
trap finish EXIT

[ -r "$ENV_FILE" ] || { log "no puedo leer $ENV_FILE"; exit 1; }

envval() {
    grep -E "^$1=" "$ENV_FILE" | head -n1 | cut -d= -f2- \
        | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' \
              -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'\$/\1/"
}
DB_HOST="$(envval DB_HOST)"; DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="$(envval DB_PORT)"; DB_PORT="${DB_PORT:-3306}"
DB_USER="$(envval DB_USERNAME)"
DB_PASS="$(envval DB_PASSWORD)"
[ -n "$DB_USER" ] || { log "DB_USERNAME vacío en .env"; exit 1; }

# Credenciales en archivo temporal 600 — nunca en la línea de comandos (ps).
CNF="$(mktemp)"; chmod 600 "$CNF"
printf '[client]\nhost=%s\nport=%s\nuser=%s\npassword=%s\n' \
    "$DB_HOST" "$DB_PORT" "$DB_USER" "$DB_PASS" > "$CNF"

# Descubrir BD
if [ -n "$ONLY" ]; then
    DBS=("$ONLY")
else
    mapfile -t DBS < <(mysql --defaults-extra-file="$CNF" -N -B -e \
        "SELECT schema_name FROM information_schema.schemata
         WHERE schema_name = 'pcl_central' OR schema_name LIKE 'costos\\_%'
         ORDER BY schema_name")
fi
[ "${#DBS[@]}" -gt 0 ] || { log "0 BD encontradas"; exit 1; }

if [ "$MODE" = "list" ]; then
    printf '%s\n' "${DBS[@]}"
    STATUS=0
    exit 0
fi

FREE_MB="$(df -Pm "$BACKUP_ROOT" | awk 'NR==2 {print $4}')"
[ "${FREE_MB:-0}" -ge "$MIN_FREE_MB" ] \
    || { log "espacio insuficiente: ${FREE_MB}MB < ${MIN_FREE_MB}MB"; exit 1; }

mkdir -p "$DEST"
log "Respaldando ${#DBS[@]} BD → $DEST"

DUMP_OPTS=(
    --defaults-extra-file="$CNF"
    --single-transaction --quick --routines --triggers --events
    --no-tablespaces --set-gtid-purged=OFF --column-statistics=0
    --default-character-set=utf8mb4 --hex-blob
)

FAILS=0
for db in "${DBS[@]}"; do
    out="$DEST/${db}.sql.gz"
    if mysqldump "${DUMP_OPTS[@]}" "$db" 2>>"$LOG" | gzip -6 > "$out"; then
        log "  ✔ ${db}  ($(du -h "$out" | cut -f1))"
    else
        log "  ✖ ${db}  (mysqldump falló)"
        rm -f "$out"
        FAILS=$((FAILS + 1))
    fi
done
[ "$FAILS" -eq 0 ] || { log "$FAILS BD fallaron"; exit 1; }

{ echo "fecha=$DATE"; echo "hora=$(date +%T)"; echo "count=${#DBS[@]}"
  printf '%s\n' "${DBS[@]}"; } > "$DEST/MANIFEST.txt"
ln -sfn "$DEST" "$BACKUP_ROOT/latest"

if [ "$(date +%d)" = "01" ] && [ -z "$ONLY" ]; then
    mkdir -p "$BACKUP_ROOT/monthly"
    rm -rf "$BACKUP_ROOT/monthly/$DATE"
    cp -a "$DEST" "$BACKUP_ROOT/monthly/$DATE"
    log "copia mensual → monthly/$DATE"
fi

# Retención
find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -regextype posix-extended \
    -regex '.*/[0-9]{4}-[0-9]{2}-[0-9]{2}$' -mtime "+$RETENTION_DAILY_DAYS" \
    -exec rm -rf {} + 2>/dev/null || true
if [ -d "$BACKUP_ROOT/monthly" ]; then
    # shellcheck disable=SC2012
    ls -1dt "$BACKUP_ROOT"/monthly/*/ 2>/dev/null \
        | tail -n "+$((RETENTION_MONTHLY_KEEP + 1))" | xargs -r rm -rf
fi

STATUS=0
rm -f "$BACKUP_ROOT/LAST_RUN_FAILED"
date '+%F %T' > "$BACKUP_ROOT/LAST_RUN_OK"
log "OK — $DEST ($(du -sh "$DEST" | cut -f1))"
