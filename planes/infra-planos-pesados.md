# Planos CAD pesados: optimización en segundo plano (VPS ingenieros.tech)

El navegador no puede abrir un DWG/DXF de decenas de MB sin quedarse sin
memoria ("Out of Memory"). El servidor genera en segundo plano una versión
**ligera** (DXF sin sombreados, imágenes, sólidos 3D ni objetos proxy) y el
editor abre esa. Geometría, textos y cotas no cambian: la calibración y las
longitudes de cable siguen siendo reales.

Flujo: subir plano → `PlanFileController::store` → job `LightenDialuxPlan`
(conexión `database-cad`, cola `cad`) → el editor consulta
`.../plans/{scene}/light/status` cada 15 s → "Abrir plano optimizado".

## 1. Desplegar el código

Tu `deploy.sh` ya hace `git pull`, `composer install`, build, `migrate --force`
y `config:cache`. La migración nueva agrega 4 columnas a `dialux_plans`
(`light_status`, `light_path`, `light_size_bytes`, `light_error`).

## 2. Worker dedicado para planos (Supervisor)

Un solo proceso, para que optimizar un plano (minutos, 1–2 GB de RAM con DWG)
no compita con la web ni con `pcl-worker`.

`sudo nano /etc/supervisor/conf.d/pcl-cad-worker.conf`

```ini
[program:pcl-cad-worker]
process_name=%(program_name)s
command=php /var/www/ingenieros.tech/artisan queue:work database-cad --queue=cad --tries=1 --timeout=1800 --memory=2048 --sleep=5
directory=/var/www/ingenieros.tech
user=www-data
autostart=true
autorestart=true
numprocs=1
stopwaitsecs=1900
redirect_stderr=true
stdout_logfile=/var/www/ingenieros.tech/storage/logs/cad-worker.log
```

(Usa el mismo `user=` que tiene `pcl-worker.conf`.)

```bash
sudo supervisorctl reread && sudo supervisorctl update
sudo supervisorctl status          # pcl-cad-worker RUNNING
```

Y agrega al final de `deploy.sh`, junto al reinicio de `pcl-worker`:

```bash
sudo supervisorctl restart pcl-cad-worker
```

## 3. Permitir subir planos grandes (hasta 100 MB)

PHP (`/etc/php/8.3/fpm/php.ini`):

```ini
upload_max_filesize = 110M
post_max_size = 120M
max_execution_time = 300
```

Nginx (bloque `server` de ingenieros.tech):

```nginx
client_max_body_size 120M;
client_body_timeout 300s;
```

```bash
sudo systemctl reload php8.3-fpm && sudo nginx -t && sudo systemctl reload nginx
```

## 4. (Opcional, recomendado) Conversor de DWG → DXF

Sin conversor, los **DXF** pesados se optimizan igual; los **DWG** pesados
muestran "sube el DXF o una imagen". Con conversor, también se optimizan los DWG.

**ODA File Converter** (gratuito, el más compatible):

```bash
# Descarga el .deb para Ubuntu 24 desde https://www.opendesign.com/guestfiles/oda_file_converter
sudo apt install -y xvfb
sudo apt install -y ./ODAFileConverter_QT*_lnxX64_*.deb
which ODAFileConverter
```

En `.env`:

```dotenv
DIALUX_DWG_CONVERTER='xvfb-run -a /usr/bin/ODAFileConverter "{input_dir}" "{output_dir}" ACAD2013 DXF 0 1 "{input_name}"'
```

Luego `php artisan config:cache && sudo supervisorctl restart pcl-cad-worker`.
Los planos que fallaron antes se reintentan desde el editor (botón "Reintentar").

## 5. Verificar

```bash
tail -f storage/logs/cad-worker.log          # ver el job al subir un plano
grep "plano aligerado" storage/logs/laravel.log   # tamaños antes/después
```

En el editor: Módulo General → Importar plano → el aviso pasa de
"Optimizando el plano en el servidor…" a "Plano optimizado listo" →
"Abrir plano optimizado".

## Variables (`config/dialux.php`)

| Variable | Por defecto | Qué hace |
|---|---|---|
| `DIALUX_DWG_CONVERTER` | vacío | Comando de conversión DWG→DXF |
| `DIALUX_PLAN_TIMEOUT` | 1800 | Segundos máximos por plano |
| `DIALUX_PLAN_QUEUE_RETRY_AFTER` | 2100 | Debe ser MAYOR que el timeout |
| Topes para usar la versión ligera | DWG 6 MB, DXF 20 MB | Iguales a `cadOpenHardMax` del frontend |
