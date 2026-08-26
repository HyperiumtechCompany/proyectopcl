# PROCEDIMIENTO: Descargar e Importar Luminarias de Emergencia en DIALux

## 🎯 Objetivo Final
Tener un catálogo de luminarias de emergencia importadas en tu base de datos DIALux para:
- Rutas de evacuación (RNE A.130 Perú)
- Áreas antipánico
- Señalización de salida (EXIT)

---

## 📋 PASO 1: Preparar la Carpeta de Descarga

Ejecuta en PowerShell (en la carpeta del proyecto):

```powershell
# Windows
New-Item -ItemType Directory -Path "database\seeders\fixtures\luminaires-emergency" -Force
```

O manualmente:
1. Abre el Explorador de archivos
2. Navega a: `c:\laragon\www\proyectopcl\database\seeders\fixtures\`
3. Crea una carpeta nueva llamada `luminaires-emergency`

---

## 🌐 PASO 2: Descargar Archivos LDT (Opción A: DIALux Luminaire Finder - RECOMENDADO)

### 2.1 Accede a la base de datos online

1. Abre en tu navegador: **https://luminaires.dialux.com**
2. Haz login o usa acceso de invitado (no requiere licencia DIALux evo)
3. En el buscador principal, escribe: **"emergency"** o **"exit sign"**

### 2.2 Filtra los resultados

Utiliza estos filtros para encontrar luminarias de emergencia:

| Filtro | Valor | Propósito |
|--------|-------|----------|
| **Fabricante** | Selecciona: Philips, LEDVANCE, Thorlux, Legrand, Zumtobel | Marcas confiables |
| **Palabra clave** | "emergency", "exit", "anti-panic", "evacuation" | Tipo específico |
| **Tipo de instalación** | "Surface-Mounted", "Recessed" (según necesites) | Formato físico |
| **Potencia** | 1-50 W (varía según categoría) | Rango de energía |

### 2.3 Descarga cada LDT

Para cada producto encontrado:

1. **Haz click en el nombre del producto**
2. En la página de detalles, busca el botón **"Download"** o **"Download LDT"**
   - Si ves **"LDT"**, esa es la opción preferida
   - Si solo aparece **"IES"**, descarga esa versión (funciona igual)
3. **Guarda el archivo** directamente en: `database\seeders\fixtures\luminaires-emergency\`
4. **Renombra el archivo** según este patrón:
   - **Formato**: `Fabricante-Modelo-Especificacion.ldt`
   - **Ejemplos**:
     - `Philips-Emergency-Exit-Sign.ldt`
     - `LEDVANCE-Emergency-Bulkhead-30W.ldt`
     - `Thorlux-Emergency-Pendant-20W.ldt`

---

## 🌐 PASO 2 (Opción B): Descargar de Sitios Oficiales de Fabricantes

Si prefieres no usar DIALux Luminaire Finder, descarga directamente del fabricante:

### Philips Safety & Security
```
Sitio: https://www.lighting.philips.com
Buscar: "Emergency LED", "Safety Exit Sign"
Descargar: Hoja de fotometría (LDT o IES)
```

### LEDVANCE
```
Sitio: https://www.ledvance.com
Buscar: "Emergency Lighting", "Emergency Luminaires"
Descargar: Archivos fotométricos (Download LDT)
```

### Legrand
```
Sitio: https://www.legrand.com/en/lighting
Buscar: "Emergency", "Safety"
Descargar: Catálogos técnicos con LDT
```

### Thorlux
```
Sitio: https://www.thorlux.com/products/emergency
Buscar: Productos de emergencia
Nota: Algunos requieren login — usar DIALux Finder como alternativa
```

---

## ✅ PASO 3: Verificar Archivos Descargados

### 3.1 En PowerShell (Windows)

```powershell
# Navega a la carpeta
cd database\seeders\fixtures\luminaires-emergency

# Lista los archivos
Get-ChildItem | Format-Table Name, Length

# Verifica que todos sean válidos (tamaño > 1 KB)
Get-ChildItem *.ldt | Where-Object {$_.Length -lt 1000} | ForEach-Object {
    Write-Host "⚠️  Archivo muy pequeño (posible descarga incompleta): $($_.Name)"
}
```

### 3.2 Contenido esperado (primeras líneas de un LDT válido)

Abre uno de los .ldt con Notepad++ o VS Code:

```
Philips Manufacturing
0
0
...
```

**Reglas de validez:**
- ✅ Primera línea: nombre de la empresa (texto ASCII)
- ✅ Líneas 2-7: números (tipos, simetría, etc.)
- ✅ Línea 30 (aproximadamente): un número > 0 (lúmenes)
- ❌ NO debe ser imagen, PDF binario, o HTML

---

## 🔧 PASO 4: Ejecutar el Seeder (Importación Automática)

### 4.1 En PowerShell/Terminal, en la carpeta del proyecto:

```powershell
# Ejecutar solo el seeder de emergencia
php artisan db:seed --class=EmergencyLuminaireSeeder
```

**Salida esperada:**
```
✅ Importada: Compact Emergency Light 25W Broad (PHILIPS-EMERGENCY-BROAD)
✅ Importada: Emergency Bulkhead 30W Surface (LEDVANCE-EMERGENCY-BULKHEAD-30)
✅ Importada: Emergency Floor Strip LED 1.2W (LEGRAND-FLOOR-STRIP-LED)
...
```

### 4.2 Si un archivo LDT falta

El seeder mostrará:
```
⚠️  Archivo no encontrado: Philips-Emergency-Compact-25W.ldt
   Descárgalo desde:
   - luminaires.dialux.com (recomendado)
   - Sitio oficial del fabricante
   Coloca el archivo en: database\seeders\fixtures\luminaires-emergency\...
```

**Solución:**
1. Descarga el archivo faltante (siguiendo PASO 2)
2. Renómbralo exactamente como se menciona
3. Vuelve a ejecutar: `php artisan db:seed --class=EmergencyLuminaireSeeder`

---

## 🔍 PASO 5: Verificar Importación en Base de Datos

### 5.1 Usando Tinker (shell interactivo de Laravel)

```powershell
php artisan tinker
```

Una vez en Tinker:

```php
# Ver todas las luminarias de emergencia importadas
>>> $emergency = App\Models\LuminaireProduct::where('fixture_type', 'like', '%emergency%')->get();
>>> $emergency->each(fn($l) => echo "{$l->name} ({$l->total_lumens} lm, {$l->power_watts}W)\n");

# Ver solo señalización de salida
>>> $exits = App\Models\LuminaireProduct::where('fixture_type', 'exit-sign')->get();
>>> $exits->each(fn($e) => echo "{$e->name}\n");

# Ver todo (incluyendo metadata)
>>> $all = App\Models\LuminaireProduct::where('is_global', 1)->orderBy('manufacturer')->get();
>>> $all->each(fn($l) => echo "{$l->manufacturer} - {$l->name}: {$l->total_lumens}lm\n");

# Salir
>>> exit
```

### 5.2 Usando un navegador (desde la UI de la app)

1. Abre `http://proyectopcl.test` en tu navegador
2. Navega a **Catálogo de Luminarias** (o menú equivalente)
3. Busca por **"emergency"** o **"exit"**
4. Verifica que aparezcan las nuevas luminarias importadas

---

## 🗂️ PASO 6: Incluir el Seeder en Migraciones (Opcional pero Recomendado)

Para que las luminarias de emergencia se importen **automáticamente** cuando hagas `php artisan migrate:fresh --seed`:

### 6.1 Abre el archivo: `database/seeders/DatabaseSeeder.php`

Busca la sección donde se llama a otros seeders:

```php
public function run(): void
{
    // ... otros seeders ...
    
    $this->call([
        RoleAndPermissionSeeder::class,
        RealPhotometryLuminaireSeeder::class,
        // AGREGAR ESTA LÍNEA:
        EmergencyLuminaireSeeder::class,
        // ... más seeders ...
    ]);
}
```

### 6.2 Ahora, cuando ejecutes:

```bash
php artisan migrate:fresh --seed
```

Se importarán automáticamente las luminarias de emergencia junto con el resto.

---

## 📊 PASO 7: Validación Final (Checklist)

Marca cuando hayas completado cada paso:

- [ ] ✅ Creada carpeta: `../../database/seeders/fixtures/luminaires-emergency/`
- [ ] ✅ Descargados al menos 3 archivos LDT de emergencia
- [ ] ✅ Verificados que sean archivos válidos (texto, no binario)
- [ ] ✅ Ejecutado: `php artisan db:seed --class=EmergencyLuminaireSeeder`
- [ ] ✅ Sin errores en la consola
- [ ] ✅ Verificado en Tinker que existen en BD
- [ ] ✅ Visible en la UI del proyecto (si existe sección de catálogo)

---

## 🚨 Solución de Problemas

### Problema: "Archivo no encontrado"
**Causa:** El archivo LDT no está en la carpeta correcta.
**Solución:** 
1. Verifica que esté en: `../../database/seeders/fixtures/luminaires-emergency/`
2. Verifica que el nombre coincida exactamente (mayúsculas/minúsculas)

### Problema: "Error parseando LDT"
**Causa:** El archivo descargado está corrupto o no es un LDT válido.
**Solución:**
1. Reintenta descargar el archivo
2. Usa DIALux Luminaire Finder en lugar del sitio del fabricante
3. Verifica que no sea PDF, imagen, o HTML enmascarado

### Problema: Seeder ejecutado pero sin cambios visibles
**Causa:** Luminarias ya existían en BD.
**Solución:**
```bash
# Restaurar luminiarias eliminadas (soft delete)
php artisan tinker
>>> App\Models\LuminaireProduct::withTrashed()->restore();
>>> exit
```

### Problema: No aparecen en DIALux (UI del proyecto)
**Causa:** La sección de catálogo podría no estar implementada aún.
**Solución:** Verificar en base de datos directamente (PASO 5.1)

---

## 📚 Referencias Normativas

- **RNE A.130** (Perú): Requisitos de iluminación de emergencia
  - Mínimo 1 lux en rutas de evacuación
  - Mínimo 0.5 lux en áreas antipánico
  - Uniformidad ≥ 0.4 (Emin/Emax)

- **EN 1838** (Europa): Aplicable como referencia complementaria
  - 1 lux mantenido en suelo de ruta
  - 0.5 lux en áreas abiertas
  - Montaje a máximo 2.5m de altura

- **CNE** (Código Eléctrico Peruano): Capítulos de alimentación a sistemas de emergencia

---

## ✨ Próximos Pasos Después de Importar

Una vez que tengas las luminarias importadas:

1. **Crear filtros en DIALux** para seleccionar fácilmente emergencia vs. iluminación normal
2. **Documentar** en el proyecto cuáles son las "approved" para emergencia
3. **Integrar validación normativa** en el motor de cálculo
4. **Generar informes** con cumplimiento de RNE/EN 1838

---

**Última actualización:** 2026-08-12
**Versión:** 1.0
**Estado:** Ready for testing
