# PCL - Guía de clonado e instalación

Aplicación Laravel 12 + React (Inertia) con autenticación, roles/permisos y colaboración en tiempo real con Reverb.

## 1) Requisitos

- PHP `8.2+`
- Composer `2+`
- Node.js `20+`
- MySQL/MariaDB
- Extensiones PHP recomendadas para Laravel: `pdo_mysql`, `mbstring`, `openssl`, `fileinfo`, `tokenizer`, `xml`, `ctype`, `json`

## 2) Clonar el repositorio

```bash
git clone <URL_DEL_REPOSITORIO> proyectopcl
cd proyectopcl
```

## 3) Configurar entorno

```bash
cp .env.example .env
```

Editar `.env` y validar mínimo:

```env
APP_URL=http://localhost

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=proyectopcl
DB_USERNAME=root
DB_PASSWORD=

BROADCAST_CONNECTION=reverb
QUEUE_CONNECTION=database
```

Crear la base de datos en MySQL antes de migrar (por ejemplo: `proyectopcl`).

## 4) Motor WASM (Dialux Core — Rust)

El módulo `dialux-core` usa Rust/WASM para parsear archivos DXF con máximo rendimiento. **Sin este paso el parser cae al modo TypeScript de respaldo** (funcional pero más lento).

### Requisitos adicionales

- [Rust](https://rustup.rs/) (instala `rustup`, luego `rustup target add wasm32-unknown-unknown`)
- [wasm-pack](https://rustwasm.github.io/wasm-pack/installer/)

### Compilar WASM

```bash
# Modo desarrollo (más rápido, sin optimizaciones)
npm run wasm:build

# Modo release (optimizado para producción, ~40% más pequeño)
npm run wasm:build:release
```

El output se genera en `public/dialux-core/pkg/` y queda disponible automáticamente en `/dialux-core/pkg/dialux_core.js`.

> El CI compila WASM en modo release antes de cada build de assets.

## 5) Instalación rápida (recomendada)

Este comando instala dependencias, genera `APP_KEY`, ejecuta migraciones + seeders, crea el symlink de storage y compila frontend:

```bash
composer run setup
```

## 6) Levantar el proyecto en desarrollo

En terminal 1:

```bash
composer run dev
```

En terminal 2 (WebSocket/Reverb):

```bash
php artisan reverb:start
```

Abrir la aplicación en: `http://127.0.0.1:8000`

## 7) Usuarios de prueba (seeders)

Después de `migrate --seed`:

- `root@pcl.com` / `root123`
- `gerencia@pcl.com` / `gerencia123`
- `admin@pcl.com` / `admin123`
- `asistente@pcl.com` / `asistente123`
- `cliente@pcl.com` / `cliente123`

## 8) Comandos útiles

```bash
# Reinstalar base de datos con seeders
php artisan migrate:fresh --seed

# Ejecutar pruebas
php artisan test

# Formateo/lint PHP
./vendor/bin/pint

# Frontend en modo desarrollo (solo Vite)
npm run dev
```

## 9) Solución rápida de errores comunes

- Error de conexión MySQL: validar `DB_HOST`, `DB_PORT`, `DB_DATABASE`, usuario/clave en `.env`.
- Error por tablas faltantes (`sessions`, `jobs`, `cache`): ejecutar `php artisan migrate --seed`.
- Error de clave de app: ejecutar `php artisan key:generate`.
- Eventos en tiempo real no funcionan: iniciar `php artisan reverb:start`.
