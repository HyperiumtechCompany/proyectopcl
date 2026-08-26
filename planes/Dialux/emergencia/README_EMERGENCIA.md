# 📦 PAQUETE COMPLETO: Importación de Luminarias de Emergencia

## ✨ Resumen Ejecutivo

Se ha preparado un **paquete completo** para buscar, descargar e importar luminarias de emergencia en tu proyecto DIALux.

**Tiempo estimado**: 30–60 minutos (depende de velocidad de descarga)

---

## 📁 Archivos Creados (En tu Proyecto)

### Documentación (Guías)
| Archivo | Propósito | Lectura |
|---------|----------|---------|
| `guia_importacion_luminarias_emergencia.md` | Visión general y categorías | 📖 Primero |
| `ESPECIFICACIONES_luminarias_emergencia.md` | Qué buscar, cómo validar | 📖 Referencia |
| `PROCEDIMIENTO_descarga_emergencia_completo.md` | Paso a paso detallado | 📖 Instrucciones |

### Scripts de Descarga
| Archivo | Sistema | Uso |
|---------|---------|-----|
| `Descargar-Luminarias-Emergencia.ps1` | Windows PowerShell | Execute for UI guidance |
| `descargar-luminarias-emergencia.sh` | Linux/Mac Bash | `bash descargar-luminarias-emergencia.sh` |

### Código (Seeder)
| Archivo | Función |
|---------|----------|
| `../../database/seeders/EmergencyLuminaireSeeder.php` | Importa LDT a base de datos |

### Carpeta de Destino
```
../../database/seeders/fixtures/luminaires-emergency/
    ↑ Aquí van los archivos LDT descargados
```

---

## 🎯 Flujo de Trabajo (5 PASOS)

### 1️⃣ DESCARGA (15–30 min)

**Opción A (Recomendado)**: DIALux Luminaire Finder
```
1. Abre: https://luminaires.dialux.com
2. Busca: "emergency", "exit", "anti-panic"
3. Filtra: Philips, LEDVANCE, Legrand, Thorlux
4. Descarga: LDT files
5. Guarda en: ../../database/seeders/fixtures/luminaires-emergency/
```

**Opción B**: Sitios de fabricantes
- Philips: https://www.lighting.philips.com
- LEDVANCE: https://www.ledvance.com
- Legrand: https://www.legrand.com/en/lighting
- Thorlux: https://www.thorlux.com/products/emergency

**Target**: Descargar al menos 5–7 archivos LDT

### 2️⃣ VALIDACIÓN (5 min)

```powershell
# En PowerShell
cd database\seeders\fixtures\luminaires-emergency
Get-ChildItem *.ldt | Format-Table Name, Length
```

Verificar:
- [ ] Todos los archivos son > 1 KB
- [ ] Extensión es `.ldt` o `.ies` (no `.txt`)

### 3️⃣ IMPORTACIÓN (2 min)

```bash
php artisan db:seed --class=EmergencyLuminaireSeeder
```

Esperado:
```
✅ Importada: Compact Emergency Light 25W...
✅ Importada: Emergency Bulkhead 30W...
...
```

### 4️⃣ VERIFICACIÓN (5 min)

```bash
php artisan tinker
>>> $e = App\Models\LuminaireProduct::where('fixture_type', 'like', '%emergency%')->get();
>>> $e->each(fn($l) => echo "{$l->name} ({$l->total_lumens} lm)\n");
>>> exit
```

Verificar que aparezca tu lista de emergencia.

### 5️⃣ INTEGRACIÓN (Opcional, después)

Cuando esté listo, agregar a `DatabaseSeeder.php`:
```php
$this->call([
    // ... otros seeders
    EmergencyLuminaireSeeder::class,
]);
```

---

## 🔍 REFERENCIAS RÁPIDAS

### Buscar en DIALux Luminaire Finder

| Categoría | Palabras | Potencia | Fabricantes |
|-----------|----------|----------|-------------|
| **EXIT Signs** | exit, salida, señalización | 1–10 W | Philips, LEDVANCE |
| **Antipánico** | emergency, anti-panic | 15–50 W | Thorlux, Zumtobel |
| **Floor Strip** | floor, marker, piso | 1–5 W | Legrand, Philips |

### Características Esperadas

| Tipo | Lúmenes | Potencia | Ángulo |
|------|---------|----------|--------|
| EXIT | 100–500 | 1–10 W | 60–120° |
| Antipánico | 1500–3500 | 15–50 W | 100–180° |
| Floor Strip | 30–300 | 0.5–3 W | < 90° |

### Normativa Aplicable

- **RNE A.130** (Perú): ≥ 1 lux rutas, ≥ 0.5 lux antipánico
- **EN 1838** (Europa): 1 lux mantenido, U ≥ 0.4
- **CNE** (Perú): Alimentación de emergencia a baterías

---

## 🛠️ Comandos Útiles (Copy & Paste)

```bash
# Crear carpeta
New-Item -ItemType Directory -Path "database\seeders\fixtures\luminaires-emergency" -Force

# Listar descargas
Get-ChildItem database\seeders\fixtures\luminaires-emergency -Filter *.ldt | Sort-Object Name

# Importar
php artisan db:seed --class=EmergencyLuminaireSeeder

# Verificar en Tinker
php artisan tinker
App\Models\LuminaireProduct::where('is_global', 1)->where('fixture_type', 'like', '%emergency%')->count()

# Salir
exit
```

---

## 📋 CHECKLIST VISUAL

**Antes de Descargar:**
- [ ] Conocer qué es un LDT (archivo fotométrico estándar)
- [ ] Tener cuenta en luminaires.dialux.com (gratis, sin licencia requerida)
- [ ] Conexión a internet estable

**Durante la Descarga:**
- [ ] ✅ EXIT Signs: 2–3 modelos
- [ ] ✅ Antipánico: 2–3 modelos
- [ ] ✅ Floor Strip: 1–2 modelos
- [ ] ✅ (Opcional) Dual-mode: 1 modelo

**Después de Descargar:**
- [ ] Todos en carpeta: `../../database/seeders/fixtures/luminaires-emergency/`
- [ ] Nombrados según patrón: `Fabricante-Tipo.ldt`
- [ ] Validados: tamaño > 1 KB, no binario

**Después de Importar:**
- [ ] Ejecutado seeder sin errores
- [ ] Verificado en Tinker (count > 0)
- [ ] Visible en UI del proyecto (si implementado)

---

## 🚨 SOLUCIÓN RÁPIDA DE PROBLEMAS

| Problema | Solución |
|----------|----------|
| "Archivo no encontrado" | Verificar ruta exacta: `../../database/seeders/fixtures/luminaires-emergency/` |
| "LDT no válido" | Descargar nuevamente desde DIALux Luminaire Finder |
| "Error parseando" | Verificar que sea .ldt (no .pdf, .txt, o .ldt.zip) |
| "BD sin cambios" | Restaurar soft-deleted: `App\Models\LuminaireProduct::withTrashed()->restore();` |

---

## 📚 Documentos Relacionados

### En Este Proyecto
- `guia_importacion_luminarias_emergencia.md`
- `ESPECIFICACIONES_luminarias_emergencia.md`
- `PROCEDIMIENTO_descarga_emergencia_completo.md`
- `../../database/seeders/EmergencyLuminaireSeeder.php`

### Externos (Referencias)
- DIALux Luminaire Finder: https://luminaires.dialux.com
- RNE A.130: https://www.sbn.gob.pe/descargas/estándares/RNE/RP-EM-110_RNE.pdf
- EN 1838: European Standard (PDF disponible)
- CNE Perú: https://www.minem.gob.pe/

---

## ⏱️ ESTIMACIÓN DE TIEMPO

| Paso | Tiempo | Notas |
|------|--------|-------|
| 1. Descargar LDT | 15–30 min | Depende de conexión y número de archivos |
| 2. Validar archivos | 5 min | Verificación rápida |
| 3. Ejecutar seeder | 2 min | Laravel importa automáticamente |
| 4. Verificar en BD | 5 min | Tinker o UI |
| 5. Documentar | 5–10 min | Opcional pero recomendado |
| **TOTAL** | **30–60 min** | Actividades en paralelo posibles |

---

## 🎓 ¿POR QUÉ ESTO ES IMPORTANTE?

### Compliance Normativo
✅ RNE A.130 (Perú): Requisitos obligatorios de iluminación de emergencia
✅ EN 1838 (Europa): Referencia técnica internacional
✅ CNE: Alimentación segura a sistemas de emergencia

### Funcionalidad DIALux
✅ Catálogo específico de emergencia
✅ Cálculos diferenciados (batería vs. normal)
✅ Informes con cumplimiento normativo

### Seguridad del Proyecto
✅ Luminarias validadas (LDT de fabricante)
✅ Características reales (no sintéticas)
✅ Trazabilidad (artículo, manual de fabricante)

---

## 🔗 PRÓXIMAS FASES (Después de Importar)

1. **Fase 1** (ACTUAL): Importar LDT base ← **TÚ ESTÁS AQUÍ**
2. **Fase 2**: Crear filtros en UI (emergencia vs. normal)
3. **Fase 3**: Validación normativa automática
4. **Fase 4**: Informes con RNE/EN 1838
5. **Fase 5**: Integración con cálculo de batería

---

## 💬 SOPORTE

Si encuentras problemas:

1. **Consulta**: `PROCEDIMIENTO_descarga_emergencia_completo.md` (sección Solución de Problemas)
2. **Verifica**: Archivos LDT están en la carpeta correcta
3. **Valida**: LDT es un archivo válido (no corrupto)
4. **Reintentos**: Descarga nuevamente desde DIALux Luminaire Finder

---

## ✅ STATUS ACTUAL

```
[✅] Documentación completa
[✅] Seeder programado
[✅] Scripts de descarga preparados
[⏳] Descargas de LDT (ACCIÓN MANUAL)
[⏳] Ejecución de seeder (COMANDO)
[⏳] Verificación (VALIDACIÓN)
```

---

**Última actualización**: 2026-08-12  
**Versión**: 1.0  
**Estado**: Ready for implementation
