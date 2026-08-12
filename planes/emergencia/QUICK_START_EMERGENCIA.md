# QUICK START: Luminarias de Emergencia

## 🚀 En 5 Pasos (30 minutos)

```
┌─────────────────────────────────────────────────────────┐
│  PASO 1: DESCARGAR LDT                  [15-30 min]    │
├─────────────────────────────────────────────────────────┤
│  1. Abre: https://luminaires.dialux.com                │
│  2. Busca: "emergency" / "exit" / "floor"              │
│  3. Descarga: LDT files                                │
│  4. Guarda en: database/seeders/fixtures/              │
│              luminaires-emergency/                     │
│                                                        │
│  📌 Busca mínimo 5-7 archivos:                         │
│     • 2-3 Exit Signs (3-5W, 250-400 lm)               │
│     • 2-3 Anti-panic (20-50W, 1500-3500 lm)           │
│     • 1-2 Floor Strip (1-3W, 50-200 lm)               │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  PASO 2: VALIDAR ARCHIVOS                 [5 min]      │
├─────────────────────────────────────────────────────────┤
│  PowerShell:                                           │
│  $ cd database\seeders\fixtures\luminaires-emergency  │
│  $ ls *.ldt | % {$_.Length}                           │
│                                                        │
│  ✅ Todos > 1000 bytes (1 KB)                          │
│  ✅ Extensión: .ldt (no .txt)                          │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  PASO 3: EJECUTAR SEEDER                   [2 min]     │
├─────────────────────────────────────────────────────────┤
│  $ php artisan db:seed \\                              │
│      --class=EmergencyLuminaireSeeder                 │
│                                                        │
│  Esperado: \"✅ Importada: ...\")                      │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  PASO 4: VERIFICAR EN BASE DE DATOS       [5 min]      │
├─────────────────────────────────────────────────────────┤
│  $ php artisan tinker                                  │
│  >>> $e = App\\Models\\LuminaireProduct::             │
│      where('fixture_type', 'like', '%emergency%')     │
│      ->get();                                         │
│  >>> echo \"Total: \" . $e->count();                  │
│  >>> exit                                             │
│                                                        │
│  Esperado: Total > 0                                  │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  PASO 5: (OPCIONAL) INTEGRAR EN SEEDER                 │
├─────────────────────────────────────────────────────────┤
│  Abre: database/seeders/DatabaseSeeder.php            │
│  Agrega: EmergencyLuminaireSeeder::class,             │
│                                                        │
│  Ahora: php artisan migrate:fresh --seed              │
│  Importará automáticamente todo (normal + emergencia) │
└─────────────────────────────────────────────────────────┘
```

---

## 📦 Archivos Que Se Crearon (Automáticamente)

```
📁 planes/
  ├── guia_importacion_luminarias_emergencia.md
  ├── ESPECIFICACIONES_luminarias_emergencia.md
  └── PROCEDIMIENTO_descarga_emergencia_completo.md

📁 database/seeders/
  ├── EmergencyLuminaireSeeder.php ← SEEDER PRINCIPAL

📁 database/seeders/fixtures/
  └── luminaires-emergency/ ← TÚ DESCARGAS AQUÍ

📄 README_EMERGENCIA.md ← ÍNDICE GENERAL
📄 Descargar-Luminarias-Emergencia.ps1 ← SCRIPT WINDOWS

```

---

## 🔍 Qué Buscar en DIALux Luminaire Finder

### PATRÓN DE BÚSQUEDA

```
URL: luminaires.dialux.com

1. En el buscador principal:
   "emergency" → Enter

2. Filtros (lado izquierdo):
   - Fabricante: ☑ Philips, ☑ LEDVANCE, ☑ Legrand, ☑ Thorlux
   - Tipo: "Emergency Light"
   - Potencia: 5–50 W

3. Para cada resultado:
   a) Click en el nombre
   b) Scroll → "Download" o "Download LDT"
   c) Descarga → Guarda en: ../../database/seeders/fixtures/luminaires-emergency/
   d) Renombra: Fabricante-Tipo.ldt
```

### EJEMPLOS PARA BUSCAR

```
✓ "Philips Emergency"
✓ "LEDVANCE Exit Sign"
✓ "Legrand Floor Strip"
✓ "Thorlux Corridor Emergency"
✓ "exit sign led"
✓ "anti-panic"
✓ "floor marker"
```

---

## 📊 Características MÍNIMAS por Tipo

| TIPO | LÚMENES | POTENCIA | ÁNGULO | EJEMPLO |
|------|---------|----------|--------|---------|
| **EXIT** | 200–500 | 2–10W | 90° | 2x150lm @ 2x1.6W |
| **ANTI-PÁNICO** | 1500–3500 | 15–50W | 100–180° | 2300lm @ 25W |
| **FLOOR** | 50–300 | 0.5–3W | < 90° | 120lm @ 1.2W |

---

## 🎯 Archivos Que Vas a Necesitar

```
✅ ../../database/seeders/fixtures/luminaires-emergency/
   ├── Philips-Emergency-Exit-Sign.ldt              (descargar)
   ├── LEDVANCE-Emergency-Bulkhead-30W.ldt          (descargar)
   ├── Thorlux-Emergency-Corridor-20W.ldt           (descargar)
   ├── Legrand-Floor-Strip-LED-1.2W.ldt             (descargar)
   └── [más según encuentres]
```

---

## 🔗 LINKS IMPORTANTES

```
📌 DIALux Luminaire Finder:
   https://luminaires.dialux.com

📌 Fabricantes:
   • Philips: https://www.lighting.philips.com
   • LEDVANCE: https://www.ledvance.com
   • Legrand: https://www.legrand.com/en/lighting
   • Thorlux: https://www.thorlux.com

📌 Normativa:
   • RNE A.130 (Perú) — obligatoria
   • EN 1838 (Europa) — referencia
```

---

## ⚠️ VALIDACIÓN ANTES DE IMPORTAR

Antes de ejecutar el seeder, verifica cada LDT:

```
✅ ARCHIVO:
   □ Tamaño > 1 KB
   □ Extensión .ldt o .ies
   □ NO es .pdf, .zip, .txt, .html

✅ CONTENIDO (abre con Notepad++):
   □ Línea 1: Nombre empresa (ej: "Philips")
   □ Línea 9: Nombre luminaria (contiene "Emergency", "Exit", etc.)
   □ Línea 30: Número > 0 (lúmenes/1000)
   □ Línea 33: Número > 0 (watts)
```

---

## 🚨 SI FALLA ALGO

| Error | Solución |
|-------|----------|
| ❌ "Archivo no encontrado" | Verifica ruta exacta: `../../database/seeders/fixtures/luminaires-emergency/` |
| ❌ "LDT no válido" | Descarga nuevamente desde DIALux Finder |
| ❌ "PHP error" | Verifica que el archivo sea texto, no binario |
| ❌ "BD sin cambios" | Usa: `App\Models\LuminaireProduct::withTrashed()->restore();` |

---

## 📚 DOCUMENTACIÓN COMPLETA

Para instrucciones detalladas, consulta:

```
📖 README_EMERGENCIA.md
   → Resumen general y flujo completo

📖 PROCEDIMIENTO_descarga_emergencia_completo.md
   → Paso a paso WITH SCREENSHOTS CONCEPTUALES

📖 ESPECIFICACIONES_luminarias_emergencia.md
   → Qué buscar, características técnicas por tipo

📖 guia_importacion_luminarias_emergencia.md
   → Categorías, fuentes autorizadas, próximos pasos
```

---

## ✨ STATUS

```
[✅] Seeder creado
[✅] Documentación completa
[✅] Scripts de descarga preparados
[⏳] TÚ: Descargas LDT (15-30 min)
[⏳] TÚ: Ejecutas seeder (2 min)
[⏳] TÚ: Verificas en BD (5 min)
```

---

**¡Estás LISTO! Comienza por PASO 1 (DESCARGAR).**

Tiempo total: ~30–60 minutos  
Resultado: Catálogo de emergencia listo en DIALux ✅

