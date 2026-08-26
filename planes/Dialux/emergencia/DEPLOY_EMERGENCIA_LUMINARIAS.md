# Deploy de Luminarias de Emergencia

## 📋 Descripción General

Cuando despliegas la aplicación, el **`deploy.sh`** ahora automáticamente:

1. Ejecuta migraciones de BD
2. **Importa/actualiza luminarias de emergencia** (nuevo paso)
3. Limpia caché de Laravel
4. Reinicia workers

Esto asegura que **siempre tengas las versiones más recientes** de las luminarias en producción, incluso si han cambiado los valores.

---

## 🔄 ¿Cómo funciona?

### En DESARROLLO (Local)

```bash
# Modo normal: solo importa si falta
php artisan db:seed --class=EmergencyLuminaireSeeder
```

**Comportamiento:**
- ✅ Si una luminaria NO existe → importa (crea nueva)
- ⏭️ Si ya existe → salta (no toca valores antiguos)

### En PRODUCTION (Deploy)

```bash
# Modo fuerza actualización: reemplaza siempre
SEEDER_FORCE_UPDATE=true php artisan db:seed --class=EmergencyLuminaireSeeder
```

**Comportamiento:**
- ✅ Si luminaria NO existe → importa (crea nueva)
- 🔄 Si ya existe → reemplaza (elimina soft-delete y reimporta con nuevos valores)

---

## 📦 Paso a Paso: Qué sucede en Deploy

### 1. Descargas LDT Nuevas (ANTES de deploy)

```
Tu máquina local:
  → Descarga los 5-7 archivos LDT desde luminaires.dialux.com
  → Coloca en: ../../database/seeders/fixtures/luminaires-emergency/
  → Commit y push a git
```

### 2. Deploy Automático (CI/CD o manual)

```bash
# En servidor de producción:
./deploy.sh

# Que internamente hace:
SEEDER_FORCE_UPDATE=true php artisan db:seed --class=EmergencyLuminaireSeeder
```

### 3. Resultado

```
✅ Nueva luminaria 1: Reimportada
✅ Nueva luminaria 2: Reimportada
...
✅ Existente 1: Reimportada con valores actualizados
✅ Existente 2: Reimportada con valores actualizados
```

**BD ahora tiene:**
- ✅ Todas las versiones más recientes
- ✅ Sin valores obsoletos
- ✅ Soft-deleted → opcionalmente restauradas

---

## 🎯 Variables de Control

### `SEEDER_FORCE_UPDATE`

```php
// En database/seeders/EmergencyLuminaireSeeder.php

private bool $forceUpdate = false;

public function __construct()
{
    parent::__construct();
    // ← Detecta esta variable
    $this->forceUpdate = env('SEEDER_FORCE_UPDATE', false);
}
```

**Valores:**
- `SEEDER_FORCE_UPDATE=false` (o sin definir) → desarrollo
- `SEEDER_FORCE_UPDATE=true` → producción/deploy

---

## 🚀 Flujo Completo de Deploy

```
1. [LOCAL] Descarga LDT nuevos
   └─ ../../database/seeders/fixtures/luminaires-emergency/Archivo-Nuevo.ldt

2. [LOCAL] Modifica EmergencyLuminaireSeeder.php si necesario
   └─ Agrega importOrUpdate(...) si hay nuevas luminarias

3. [LOCAL] Commit y push
   └─ git add .
   └─ git commit -m "chore: actualizar luminarias de emergencia"
   └─ git push origin Emes

4. [SERVER] Deploy automático o manual
   └─ ./deploy.sh
   └─ git pull origin Emes
   └─ composer install
   └─ npm ci && npm run build
   └─ php artisan migrate --force
   └─ [NUEVO] SEEDER_FORCE_UPDATE=true php artisan db:seed --class=EmergencyLuminaireSeeder
   └─ php artisan config:cache && route:cache && view:cache
   └─ supervisorctl restart pcl-worker:*

5. [SERVER] BD actualizada con luminarias más recientes
   └─ ✅ Deploy completado
```

---

## 🔍 Cómo Verificar después de Deploy

### Opción 1: SSH a servidor y usar Tinker

```bash
ssh user@ingenieros.tech
cd /var/www/ingenieros.tech

php artisan tinker
>>> $emergency = App\Models\LuminaireProduct::where('fixture_type', 'like', '%emergency%')->get()
>>> echo $emergency->count()        # Debe ser >= 6
>>> $emergency->first()->only(['id','name','power_watts','total_lumens'])
# Verifica que los valores sean actuales
>>> exit
```

### Opción 2: Revisar logs de deploy

```bash
# En servidor:
tail -f /path/to/deploy-logs.txt

# Busca líneas como:
# 💡 Importando luminarias de EMERGENCIA...
# 🔄 Reimportada: Safety Exit Sign LED (PHILIPS-EXIT-LED)
# ✅ Importada: ...
```

### Opción 3: Desde frontend

En DIALux, abre el selector de luminarias:
- ✅ Deberían aparecer 6+ con `fixture_type` que contiene "emergency"
- ✅ Los valores (lúmenes, potencia) deben ser recientes

---

## 📊 Comparativa: Antes vs Después

### Antes (sin integración)

```
Deploy día 1:
  ✅ Migraciones ejecutadas
  ✅ Assets compilados
  ❌ Luminarias de emergencia NO actualizadas
  → Si tenía valores viejos, siguen viejos

Problema:
  - Después de deploy, aún tienes luminarias obsoletas
  - DIALux sigue usando especificaciones antiguas
  - Necesitarías ejecutar manualmente el seeder
```

### Después (con integración)

```
Deploy día 1:
  ✅ Migraciones ejecutadas
  ✅ Assets compilados
  ✅ Luminarias de emergencia reimportadas (NUEVO)
  ✅ Cálculos usan especificaciones más recientes

Beneficio:
  - Después de deploy, tienes luminarias actualizadas automáticamente
  - DIALux siempre usa especificaciones correctas
  - Zero manual intervention
  - Valores siempre sincronizados entre local y producción
```

---

## 🛡️ Seguridad y Rollback

### Si algo sale mal

#### Opción 1: Rollback de Git

```bash
# Si necesitas revertir a versión anterior
git revert <commit-hash>
git push origin Emes

# Ejecutar deploy nuevamente
./deploy.sh

# Seeder se ejecutará con versión anterior de LDT
```

#### Opción 2: Restaurar soft-deleted

Si ejecutaste con `SEEDER_FORCE_UPDATE=true` y quieres restaurar:

```bash
php artisan tinker

# Restaurar todas las luminarias de emergencia soft-deleted
>>> App\Models\LuminaireProduct::withTrashed()
    ->where('fixture_type', 'like', '%emergency%')
    ->where('deleted_at', '!=', null)
    ->restore()
>>> exit

# Luego ejecutar seeder nuevamente
php artisan db:seed --class=EmergencyLuminaireSeeder
```

#### Opción 3: Eliminar y reimportar

```bash
# Solo si necesitas limpieza total
php artisan db:seed --class=EmergencyLuminaireSeeder

# Seeder manejará restauración/reimportación automáticamente
```

---

## 📝 Cambios Realizados en Archivos

### `database/seeders/EmergencyLuminaireSeeder.php`

**Adiciones:**

1. **Constructor con detección de modo**
   ```php
   private bool $forceUpdate = false;

   public function __construct()
   {
       parent::__construct();
       $this->forceUpdate = env('SEEDER_FORCE_UPDATE', false);
   }
   ```

2. **Método mejorado `importOrUpdate()`**
   - Reemplaza `importIfMissing()`
   - Lee flag `$forceUpdate`
   - Si true: soft-delete anterior + reimporta
   - Si false: comportamiento original (solo importa si falta)

3. **Mensajes descriptivos**
   ```
   ⏱️ Inicio: 🔄 Iniciando importación de luminarias de EMERGENCIA...
   🗝️ Modo: ⚡ MODO: Fuerza actualización (deploy)
   🔄 Update: 🔄 Reimportada: Nombre (ID)
   ✅ Nueva: ✅ Importada: Nombre (ID)
   ```

### `deploy.sh`

**Cambios:**

```bash
# ANTES
echo "🗄️ Ejecutando migraciones..."
php artisan migrate --force

echo "🔧 Optimizando Laravel..."

# DESPUÉS
echo "🗄️ Ejecutando migraciones..."
php artisan migrate --force

echo "💡 Importando luminarias de EMERGENCIA..."
SEEDER_FORCE_UPDATE=true php artisan db:seed --class=EmergencyLuminaireSeeder --force

echo "🔧 Optimizando Laravel..."
```

---

## 🎯 Casos de Uso

### Caso 1: Primera vez (sin luminarias previas)

```
Deploy 1:
  ✅ No existen luminarias de emergencia
  ✅ Seeder importa las 8 predefinidas
  ✅ BD tiene luminarias nuevas

Siguiente deploy:
  ✅ Las 8 ya existen
  ✅ Si cambiaste LDT, se reimportan con nuevos valores
  ✅ Si no cambiaste, se reutilizan (sin cambios innecesarios)
```

### Caso 2: Actualizar solo UNA luminaria

```
Paso 1: Descarga nuevo LDT para Philips-EXIT-LED
Paso 2: Reemplaza archivo antiguo en ../../database/seeders/fixtures/luminaires-emergency/
Paso 3: Deploy

Resultado:
  ✅ Seeder detecta que existe
  ✅ Soft-delete versión anterior
  ✅ Importa nueva con especificaciones actualizadas
  ✅ Resto de luminarias: sin cambios
```

### Caso 3: Agregar luminaria nueva

```
Paso 1: Descarga LDT nuevo
Paso 2: Agrega nueva línea importOrUpdate() en run()
Paso 3: Deploy

Resultado:
  ✅ Seeder detecta que no existe
  ✅ Importa directamente (sin soft-delete)
  ✅ Resto: sin cambios
```

---

## 🔗 Referencias Relacionadas

- [database/seeders/EmergencyLuminaireSeeder.php](../../database/seeders/EmergencyLuminaireSeeder.php)
- [deploy.sh](../../deploy.sh)
- [QUICK_START_EMERGENCIA.md](../../QUICK_START_EMERGENCIA.md)
- [PROCEDIMIENTO_descarga_emergencia_completo.md](./PROCEDIMIENTO_descarga_emergencia_completo.md)

---

## ✅ Checklist de Deploy

```
PRE-DEPLOY:
  [ ] LDT descargados y validados (> 1 KB)
  [ ] Archivos colocados en ../../database/seeders/fixtures/luminaires-emergency/
  [ ] EmergencyLuminaireSeeder.php actualizado si hay nuevas luminarias
  [ ] Tests locales pasados: php artisan test --compact
  [ ] Compilación assets OK: npm run build
  [ ] Seeder funciona local: php artisan db:seed --class=EmergencyLuminaireSeeder

DEPLOY:
  [ ] git push a rama Emes
  [ ] Servidor ejecuta: ./deploy.sh (automático o manual)
  [ ] Verificar salida: "💡 Importando luminarias..." + líneas ✅
  [ ] Checking: php artisan tinker > verificar conteo

POST-DEPLOY:
  [ ] DIALux frontend: verifica que luminarias aparezcan
  [ ] Cálculos: verifica que use nuevos valores
  [ ] Normativa: verifica que cumpla RNE/EN 1838
```

---

**Versión:** 1.0  
**Actualizado:** 2026-08-12  
**Autor:** Sistema de Deploy PCL  
**Status:** ✅ Producción
