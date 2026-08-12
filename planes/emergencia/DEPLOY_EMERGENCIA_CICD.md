# ⚡ Deploy Emergencia: Guía Rápida para CI/CD

## 🎯 Resumen Ejecución

**Cuando despliegas ahora, automáticamente:**

```
git pull → composer install → npm build → migrate →
→ [NUEVO] SEEDER EMERGENCIA → cache/optimize → restart workers
```

---

## 🚀 Para Desarrollador Local

### Ejecutar seeder en MODO DESARROLLO

```bash
# Modo NORMAL (no sobrescribe si existe)
php artisan db:seed --class=EmergencyLuminaireSeeder

# Resultado esperado:
# ⏱️ Iniciando importación de luminarias de EMERGENCIA...
# 📦 MODO: Solo importar faltantes
# ✅ Importada: Safety Exit Sign LED (PHILIPS-EXIT-LED)
# ... (más luminarias)
```

### Ejecutar seeder en MODO FUERZA (simular deploy)

```bash
# Modo FUERZA (reemplaza si existe)
SEEDER_FORCE_UPDATE=true php artisan db:seed --class=EmergencyLuminaireSeeder

# Resultado esperado:
# ⏱️ Iniciando importación de luminarias de EMERGENCIA...
# ⚡ MODO: Fuerza actualización (deploy)
# 🔄 Reimportada: Safety Exit Sign LED (PHILIPS-EXIT-LED)
# ... (más luminarias)
```

---

## 🔧 Para DevOps / CI-CD

### Cambios Automáticos en Deploy

**Archivo:** `deploy.sh` (línea ~20)

```bash
# ANTES
php artisan migrate --force
echo "🔧 Optimizando Laravel..."

# DESPUÉS
php artisan migrate --force

echo "💡 Importando luminarias de EMERGENCIA..."
SEEDER_FORCE_UPDATE=true php artisan db:seed --class=EmergencyLuminaireSeeder --force

echo "🔧 Optimizando Laravel..."
```

### Variables de Entorno

**NO necesitas agregar .env** — el seeder detecta automáticamente:

```php
// En EmergencyLuminaireSeeder.php:
$this->forceUpdate = env('SEEDER_FORCE_UPDATE', false);
```

- Si `SEEDER_FORCE_UPDATE=true` → modo fuerza
- Si no existe → modo normal

---

## ✅ Checklist Pre-Deploy

```
[ ] 1. Descargas LDT nuevos desde luminaires.dialux.com
      └─ Guardados en: ../../database/seeders/fixtures/luminaires-emergency/
      └─ Validar: > 1 KB y legibles como texto

[ ] 2. Verificar archivos LDT en git
      └─ git status | grep luminaires-emergency
      └─ Deben aparecer en "new file" o "modified"

[ ] 3. Verificar EmergencyLuminaireSeeder.php
      └─ php -l database/seeders/EmergencyLuminaireSeeder.php
      └─ Resultado: "No syntax errors detected"

[ ] 4. Test local
      └─ php artisan db:seed --class=EmergencyLuminaireSeeder
      └─ Verificar: ✅ líneas de importación

[ ] 5. Test con fuerza (simular producción)
      └─ SEEDER_FORCE_UPDATE=true php artisan db:seed --class=EmergencyLuminaireSeeder
      └─ Verificar: 🔄 líneas de reimportación

[ ] 6. Verificar BD local
      └─ php artisan tinker
      └─ >>> App\Models\LuminaireProduct::where('fixture_type', 'like', '%emergency%')->count()
      └─ Debe retornar: >= 6

[ ] 7. Commit y push
      └─ git add database/seeders/
      └─ git commit -m "chore: actualizar luminarias emergencia"
      └─ git push origin Emes
```

---

## 📊 Monitoreo Post-Deploy

### 1. Revisar Logs en Servidor

```bash
# SSH a servidor
ssh user@ingenieros.tech
cd /var/www/ingenieros.tech

# Buscar líneas del seeder
grep "💡 Importando" /ruta/a/logs/deploy.log
grep "✅ Importada\|🔄 Reimportada" /ruta/a/logs/deploy.log

# Contar reimportadas
grep -c "🔄 Reimportada" /ruta/a/logs/deploy.log
```

### 2. Verificar en Base de Datos

```bash
# SSH a servidor
php artisan tinker

# Contar total
>>> App\Models\LuminaireProduct::where('fixture_type', 'like', '%emergency%')->count()
6

# Listar todas
>>> App\Models\LuminaireProduct::where('fixture_type', 'like', '%emergency%')
    ->select('id','name','total_lumens','power_watts','article_number')
    ->get()

# Verificar una específica
>>> $p = App\Models\LuminaireProduct::where('article_number','PHILIPS-EXIT-LED')->first()
>>> dump($p->only(['name','total_lumens','power_watts','updated_at']))
```

### 3. Verificar en Frontend

```
1. Abre DIALux en navegador: https://proyectopcl.test
2. Ve a: Panel → Selector de Luminarias → Busca "emergency"
3. Verifica:
   ✅ Aparecen 6+ luminarias
   ✅ Especificaciones son recientes
   ✅ No hay duplicadas
```

---

## 🚨 Troubleshooting

### Error: "Archivo no encontrado"

```
⚠️ Archivo no encontrado: Philips-Emergency-Exit-Sign.ldt
   Coloca el archivo en: ../../database/seeders/fixtures/luminaires-emergency/
```

**Solución:**
```bash
# Verificar que existen archivos
ls -la ../../database/seeders/fixtures/luminaires-emergency/

# Si faltan, descargarlos desde luminaires.dialux.com
# y colocar en la carpeta anterior
```

### Error: "Conexión a BD"

```
PDOException: SQLSTATE[HY000]: General error
```

**Solución:**
```bash
# Verificar que migraciones ejecutaron
php artisan migrate:status

# Si faltan, ejecutar
php artisan migrate --force

# Luego ejecutar seeder
php artisan db:seed --class=EmergencyLuminaireSeeder
```

### Error: "Clase no encontrada"

```
Class "App\Models\LuminaireProduct" not found
```

**Solución:**
```bash
# Ejecutar dump-autoload
composer dump-autoload

# Reintentar seeder
php artisan db:seed --class=EmergencyLuminaireSeeder
```

### Error: "Sintaxis en seeder"

```
PHP Parse error: syntax error
```

**Solución:**
```bash
# Validar sintaxis
php -l database/seeders/EmergencyLuminaireSeeder.php

# Si hay errores, revisar archivo y corregir
# Si no hay errores pero sigue falla, hacer clear:
php artisan config:clear
php artisan cache:clear
php artisan optimize:clear

# Reintentar
php artisan db:seed --class=EmergencyLuminaireSeeder
```

---

## 📈 Métricas de Éxito

Después del deploy, verifica:

```
✅ MÉTRICA 1: Conteo de luminarias
   Esperado: >= 6
   Query: SELECT COUNT(*) FROM luminaire_products WHERE fixture_type LIKE '%emergency%'

✅ MÉTRICA 2: Valores actualizados
   Verificar que updated_at es reciente (hoy o ayer)
   Query: SELECT article_number, updated_at FROM luminaire_products WHERE fixture_type LIKE '%emergency%'

✅ MÉTRICA 3: Sin duplicadas
   Esperado: 0 duplicadas por article_number
   Query: SELECT article_number, COUNT(*) FROM luminaire_products 
           WHERE fixture_type LIKE '%emergency%' GROUP BY article_number HAVING COUNT(*) > 1

✅ MÉTRICA 4: Valores en rango
   Potencia: 0.5–50 W
   Lúmenes: 50–3500 lm
   Query: SELECT name, power_watts, total_lumens FROM luminaire_products WHERE fixture_type LIKE '%emergency%'
```

---

## 🔄 Ciclo de Actualización Recomendado

### Cada 3 meses (o cuando hay cambios en normativa)

```
1. Revisar luminaires.dialux.com para actualizaciones
2. Descargar nuevas versiones LDT
3. Reemplazar archivos en ../../database/seeders/fixtures/luminaires-emergency/
4. (Opcional) Actualizar metadatos en EmergencyLuminaireSeeder.php
5. Test local: php artisan db:seed --class=EmergencyLuminaireSeeder
6. Deploy a producción
7. Verificar que todo funciona
8. Documentar en changelog
```

---

## 📞 Support

### Si necesitas help:

1. **Verificar logs:**
   ```bash
   tail -f /var/www/ingenieros.tech/storage/logs/laravel.log
   ```

2. **Conectar Tinker:**
   ```bash
   php artisan tinker
   >>> # Ejecutar queries de verificación
   >>> exit
   ```

3. **Revertir si es necesario:**
   ```bash
   git revert <commit-hash>
   git push origin Emes
   ./deploy.sh  # Redeploy con versión anterior
   ```

---

## 📚 Referencias

- [EmergencyLuminaireSeeder.php](../../database/seeders/EmergencyLuminaireSeeder.php)
- [deploy.sh](../../deploy.sh)
- [DEPLOY_EMERGENCIA_LUMINARIAS.md](./DEPLOY_EMERGENCIA_LUMINARIAS.md)
- [QUICK_START_EMERGENCIA.md](../../QUICK_START_EMERGENCIA.md)

---

**Versión:** 1.0  
**Para:** DevOps, CI/CD, Deployment  
**Status:** ✅ Ready  
**Última actualización:** 2026-08-12
