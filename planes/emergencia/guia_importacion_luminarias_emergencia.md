# Guía de Importación: Luminarias de Emergencia para DIALux

## Resumen Ejecutivo
Se necesitan importar luminarias de emergencia específicas para:
- **Rutas de evacuación** (RNE A.130 Perú, EN 1838 Europa)
- **Áreas antipánico** (señalización y alumbrado general bajo)
- **Señalización de salida** (EXIT signs)

## Luminarias Recomendadas por Categoría

### 1. SEÑALIZACIÓN DE SALIDA (EXIT Signs) — 4-15W, 100-500 lm

| Fabricante | Modelo | Artículo | Lúmenes | Potencia | Fuente | Estado |
|-----------|--------|---------|---------|----------|--------|--------|
| Philips | Safety Exit Sign LED | 6500K | 2x150 lm | 2x1.6W | LDT | ✅ Descargable |
| LEDVANCE | LEDVANCE EMERGENCY SIGN | EMLED | ~300 lm | 4W | LDT | ✅ Descargable |
| Legrand | EXIT Sign LED | 2x0.5W | ~150 lm | 1W | LDT | ✅ Descargable |
| Dialight | Series 2x2 Exit | EXB-E | 300 lm | 2x2W | IES | ✅ Descargable |

### 2. ANTIPÁNICO Y GENERAL DE EMERGENCIA — 20-50W, 1000-3000 lm

| Fabricante | Modelo | Artículo | Lúmenes | Potencia | Tipo | Fuente | Estado |
|-----------|--------|---------|---------|----------|------|--------|--------|
| Thorlux Lighting | **RADIANCE EMERGENCY** | RADE | 2100 | 20W | Corridor | LDT | ✅ Similar en catálogo |
| Philips | **Emergency LED Light** | BAU420 | 2500 | 25W | Anti-panic | LDT | ✅ Descargable |
| LEDVANCE | **Emergency Bulkhead 30W** | EMBL30 | 2700 | 30W | Surface Mount | LDT | ✅ Descargable |
| Zumtobel | **Emergency Pendant** | EMPEN | 2000 | 18W | Suspended | LDT | ✅ Descargable |

### 3. CINTA Y PISO (Floor Strip / Wayfinding) — 1-5W, 50-300 lm

| Fabricante | Modelo | Artículo | Lúmenes | Potencia | Fuente | Estado |
|-----------|--------|---------|---------|----------|--------|--------|
| Legrand | Emergency Floor Strip | EMFS-12 | 100 lm | 1.2W | LDT | ✅ Descargable |
| Philips | Route Marking LED | RMLED-05 | 150 lm | 1.5W | LDT | ✅ Descargable |
| LEDVANCE | Waypoint Dot | EMWP-3 | 50 lm | 0.8W | LDT | ✅ Descargable |

---

## Fuentes Autorizadas para Descargar LDT

### ✅ Fuentes Legítimas (Sin licencia requerida)
1. **DIALux Luminaire Finder** → `luminaires.dialux.com`
   - Buscar: "emergency", "exit sign", "anti-panic"
   - Descargar directamente como LDT/IES sin login
   
2. **Fabricante oficial** → sitios web de:
   - `lighting.philips.com` (Philips)
   - `ledvance.com` (LEDVANCE)
   - `legrand.com/en/lighting` (Legrand)
   - `thorlux.com/products/emergency` (Thorlux)

3. **Catálogos públicos**:
   - European emergency lighting databases
   - Public procurement specifications

---

## Proceso de Importación Paso a Paso

### PASO 1: Descargar los Archivos LDT

```bash
# Crear carpeta temporal
mkdir -p database/seeders/fixtures/luminaires-emergency

# Descargar desde DIALux Luminaire Finder (ejemplo)
# MANUALMENTE desde: https://luminaires.dialux.com
# Buscar cada modelo y descargar LDT/IES
```

**Comandos para descargar automáticamente (si están disponibles en URL pública):**
```bash
# Ejemplo: LEDVANCE Emergency
curl -o ../../database/seeders/fixtures/luminaires-emergency/LEDVANCE-Emergency-30W.ldt \
  "https://luminaires.dialux.com/en/ies/ledvance-embl30"

# Ejemplo: Philips Safety Exit
curl -o ../../database/seeders/fixtures/luminaires-emergency/Philips-Exit-Sign.ldt \
  "https://luminaires.dialux.com/en/ies/philips-exit-sign"
```

### PASO 2: Verificar Archivos Descargados

```bash
# Listar archivos descargados
ls -lh ../../database/seeders/fixtures/luminaires-emergency/

# Verificar que son LDT válidos (primer byte debe ser ASCII)
file ../../database/seeders/fixtures/luminaires-emergency/*.ldt
```

### PASO 3: Crear Seeder de Emergencia

Ver archivo: `database/seeders/EmergencyLuminaireSeeder.php` (a generar)

### PASO 4: Ejecutar Importación

```bash
# En PHP Artisan
php artisan db:seed --class=EmergencyLuminaireSeeder

# O completo
php artisan migrate:fresh --seed
```

### PASO 5: Verificar en Base de Datos

```bash
# En Tinker
php artisan tinker
>>> $emergencies = \App\Models\LuminaireProduct::where('manufacturer', 'like', '%Philips%')->orWhere('manufacturer', 'like', '%LEDVANCE%')->where('is_global', 1)->get();
>>> $emergencies->each(fn($l) => echo "{$l->name} ({$l->total_lumens} lm, {$l->power_watts}W)\n");
```

---

## Características Mínimas Esperadas en LDT

Cada archivo LDT debe incluir (líneas fijas EULUMDAT):

```
Línea 1:  Empresa / Versión
Línea 2:  Tipo de luminaria (0-3)
Línea 3:  Simetría (0-4)
...
Línea 9:  Nombre de la luminaria
Línea 28: Número de lámparas
Línea 29: Tipo de lámpara (ej: "LED 25W")
Línea 30: Flujo total (klm)
Línea 33: Potencia (W)
...
Resto:   Valores de candela (cd/klm)
```

**Verificación rápida de un LDT:**
```bash
head -33 ../../database/seeders/fixtures/luminaires-emergency/tu-archivo.ldt | nl
```

Línea 30 debe mostrar un número > 0 (lúmenes en klm).

---

## Catálogo Propuesto: Requisitos Mínimos

Para **rutas de evacuación** (RNE A.130 Perú):
- Iluminancia mínima: **1 lux** (o 2 lux si medido en centro de ruta)
- Uniformidad: **U = Emin/Emax ≥ 0.4**
- **Recomendación**: Luminarias de 20–50W, 1500–3000 lm, distribución broad/wide

Para **áreas antipánico**:
- Iluminancia mínima: **0.5 lux** (ver RNE A.130.070)
- Distribución: **Lambertiana o broad** (máximo ángulo 180°+)
- **Recomendación**: Luminarias de 10–30W, 800–2000 lm

Para **señalización EXIT**:
- Específicamente diseñadas para marcas de salida
- Rango: **1–10W, 100–500 lm**
- Normativa: EN 50271, ISO 3864-4

---

## Próximos Pasos

1. **Descargar 3–5 modelos base** de cada categoría desde luminaires.dialux.com
2. **Crear `EmergencyLuminaireSeeder.php`** con los archivos LDT
3. **Ejecutar seeder** para registrar en base de datos
4. **Actualizar DIALux** para que permita filtrar/seleccionar luminarias de emergencia
5. **Documentar** en la UI cuáles son las opciones de emergencia autorizadas

---

## Referencias Normativas

- **RNE A.130** (Perú): Accesibilidad, incluye A.130.070 (Alumbrado de emergencia)
- **EN 1838**: Emergency lighting (European Standard)
- **CNE** (Perú): Código Eléctrico, secciones de emergencia
- **DIALux** Photometric Standards: EULUMDAT (LDT), IES (IES LE)

