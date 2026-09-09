# Backup de base de datos — PCL producción

**Estado:** scripts en el repo (`scripts/backup-db.sh`, `scripts/restore-db.sh`).
Falta: instalar el cron en el servidor (una vez). Es **prerrequisito del Nivel B**
y de cualquier migración de esquema — hoy no hay respaldos.

Servidor: `ingenieros.tech` · `ssh gerente@2.24.83.11 -p 2222` · app en
`/var/www/ingenieros.tech` · MySQL `127.0.0.1`, credenciales en `.env`.

---

## Qué respalda

`scripts/backup-db.sh` auto-descubre y vuelca:
- `pcl_central`
- todas las BD tenant de Costos (`costos_%`) — incluye automáticamente las nuevas

Un `.sql.gz` por BD en `~/backups/mysql/<fecha>/`, con `MANIFEST.txt` y un symlink
`latest`. Copia mensual el día 1. Retención: **14 días** de diarios, **6 meses** de
mensuales. Log en `~/backups/mysql/backup.log`. Marcadores `LAST_RUN_OK` /
`LAST_RUN_FAILED` para un healthcheck.

No requiere `sudo`. Las credenciales se pasan por archivo temporal `600` (nunca en
`ps`). `mysqldump --single-transaction` → sin bloqueo de escritura.

---

## Instalación en el servidor (una vez)

```bash
cd /var/www/ingenieros.tech
git pull --ff-only origin Emes            # trae los scripts

# 1. Prueba manual
bash scripts/backup-db.sh --list          # ¿qué BD detecta?
bash scripts/backup-db.sh                 # corre el backup completo
ls -lh ~/backups/mysql/latest/            # verifica los .sql.gz
cat ~/backups/mysql/latest/MANIFEST.txt

# 2. Cron diario 02:15 (hora del servidor)
( crontab -l 2>/dev/null | grep -v 'scripts/backup-db.sh'
  echo '15 2 * * * cd /var/www/ingenieros.tech && bash scripts/backup-db.sh >> $HOME/backups/mysql/cron.log 2>&1'
) | crontab -
crontab -l
```

`deploy.sh` ya corre `scripts/backup-db.sh` **antes de las migraciones** (best-effort;
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
bash scripts/restore-db.sh ~/backups/mysql/latest/costos_2_20260616143745_926.sql.gz

# a una BD con otro nombre (staging)
bash scripts/restore-db.sh ~/backups/mysql/2026-09-01/pcl_central.sql.gz pcl_central_staging
```

Si la BD destino ya existe, pide confirmación escribiendo su nombre.

---

## Antes del Nivel B

1. Cron instalado y con al menos **2 corridas OK** (`~/backups/mysql/LAST_RUN_OK`).
2. Probar un restore real a una BD `_staging` y verificar que la app levanta apuntada a ella.
3. Recién entonces correr la migración de datos del Nivel B (primero en el staging).
