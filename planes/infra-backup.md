# Backup de base de datos — PCL producción

**Estado:** comandos en el repo (`php artisan db:backup` / `db:restore`, con
wrappers `scripts/*.sh`). Falta: instalar el cron en el servidor (una vez). Es
**prerrequisito del Nivel B** y de cualquier migración de esquema — hoy no hay respaldos.

Servidor: `ingenieros.tech` · `ssh gerente@2.24.83.11 -p 2222` · app en
`/var/www/ingenieros.tech`.

---

## Qué respalda

`php artisan db:backup` auto-descubre y vuelca:
- `pcl_central`
- todas las BD tenant de Costos (`costos_%`) — incluye automáticamente las nuevas

Un `.sql.gz` por BD en `storage/app/private/backups/db/<fecha>/`, con `MANIFEST.txt`
y un symlink `latest`. Copia mensual el día 1. Retención: **14 días** de diarios,
**6 meses** de mensuales. Log en `.../backups/db/backup.log`. Marcadores `LAST_RUN_OK`
/ `LAST_RUN_FAILED`.

**Panel visual** en `/backups` (rol `root` / `gerencia` / `administracion`): lista por
fecha, «crear backup ahora», descargar un `.sql.gz`, y **restaurar** (solo `root`;
respalda la BD destino automáticamente antes de sobrescribir). Override de ruta con
`--dir` si se prefiere fuera del repo (`php artisan db:backup --dir=/var/backups/pcl`).

**Usa `config('database.connections.mysql')`** — las mismas credenciales/socket que
usa la app (no parsea `.env` a mano; el descubrimiento de BD va por la conexión PDO
que ya funciona). No requiere `sudo`. `mysqldump --single-transaction` → sin bloqueo
de escritura. Si `mysqldump` no está en el `PATH`: `MYSQLDUMP_PATH=/ruta/mysqldump`.

---

## Instalación en el servidor (una vez)

```bash
cd /var/www/ingenieros.tech
git pull --ff-only origin Emes

# 1. Prueba manual
php artisan db:backup --list
php artisan db:backup
ls -lh storage/app/private/backups/db/latest/
cat storage/app/private/backups/db/latest/MANIFEST.txt

# 2. Cron diario 02:15 (limpiar líneas viejas primero)
( crontab -l 2>/dev/null | grep -vE 'db:backup|backup-db.sh'
  echo '15 2 * * * cd /var/www/ingenieros.tech && php artisan db:backup >> storage/logs/db-backup.log 2>&1'
) | crontab -
crontab -l

# 3. Perms compartidos: la web (php-fpm) y el cron (gerente) escriben en el mismo
#    dir. Que compartan grupo con setgid:
sudo chgrp -R www-data storage/app/private/backups
sudo chmod -R 2775 storage/app/private/backups
# (gerente ya debería estar en el grupo www-data; si no: `sudo usermod -aG www-data gerente`)
```

`deploy.sh` ya corre `php artisan db:backup` **antes de las migraciones** (best-effort;
saltable con `PCL_SKIP_DEPLOY_BACKUP=1`). También corre `tenant:migrate-all` después
del migrate central.

### Espacio en disco

Cada corrida ≈ (tamaño total de las BD) / 5–8 comprimido. Con 14 diarios + 6 mensuales
≈ 20 copias. Si `df -h ~` queda ajustado, bajar `PCL_BACKUP_RETENTION_DAYS` o mover
`~/backups` a un disco/volumen aparte (`PCL_BACKUP_DIR=/mnt/backups/mysql`).
El script aborta si hay < 2 GB libres (`PCL_BACKUP_MIN_FREE_MB`).

### Off-site (recomendado, follow-up)

Los backups viven en el mismo VPS. Para sobrevivir a una pérdida del servidor:
`rclone`/`rsync` de `~/backups/mysql/` a un bucket o a otra máquina, en un segundo
cron. O activar snapshots del VPS en el panel de Hostinger.

---

## Restaurar

```bash
# una BD desde el último backup
php artisan db:restore ~/backups/mysql/latest/costos_2_20260616143745_926.sql.gz

# a una BD con otro nombre (staging)
php artisan db:restore ~/backups/mysql/2026-09-01/pcl_central.sql.gz pcl_central_staging
```

Si la BD destino ya existe, pide confirmación escribiendo su nombre.

---

## Antes del Nivel B

1. Cron instalado y con al menos **2 corridas OK** (`~/backups/mysql/LAST_RUN_OK`).
2. Probar un restore real a una BD `_staging` y verificar que la app levanta apuntada a ella.
3. Recién entonces correr la migración de datos del Nivel B (primero en el staging).
