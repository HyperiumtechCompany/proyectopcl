# 📑 ÍNDICE MAESTRO: Paquete de Luminarias de Emergencia

## 🎯 Propósito General

Buscar, descargar e importar **luminarias de emergencia** LDT en tu base de datos DIALux para:
- ✅ Rutas de evacuación (RNE A.130 Perú)
- ✅ Áreas antipánico (EN 1838 referencia)
- ✅ Señalización de salida (EXIT signs)

**Tiempo estimado**: 30–60 minutos  
**Complejidad**: Media (principalmente descargas manuales + 1 comando)

---

## 📂 ARCHIVOS CREADOS (Organización)

### 🚀 PUNTO DE INICIO (Lee primero)

| Archivo | Tipo | Propósito | Lectura |
|---------|------|----------|---------|
| **QUICK_START_EMERGENCIA.md** | 📄 Guía | Resumen visual 5 pasos | ⏱️ 5 min |
| **README_EMERGENCIA.md** | 📄 Índice | Índice general del paquete | ⏱️ 10 min |

### 📚 DOCUMENTACIÓN DETALLADA (Consulta según necesites)

| Archivo | Ubicación | Propósito | Lectura |
|---------|-----------|----------|---------|
| **guia_importacion_luminarias_emergencia.md** | `planes/` | Visión general, categorías, fuentes | ⏱️ 15 min |
| **ESPECIFICACIONES_luminarias_emergencia.md** | `planes/` | Qué buscar, validación, modelos ejemplo | ⏱️ 20 min |
| **PROCEDIMIENTO_descarga_emergencia_completo.md** | `planes/` | Paso a paso con troubleshooting | ⏱️ 30 min |

### 🛠️ CÓDIGO (El Motor)

| Archivo | Ubicación | Función | Ejecutar |
|---------|-----------|----------|----------|
| **EmergencyLuminaireSeeder.php** | `database/seeders/` | Importa LDT a BD | `php artisan db:seed --class=EmergencyLuminaireSeeder` |

### 🎯 SCRIPTS (Automatización)

| Archivo | SO | Propósito | Ejecutar |
|---------|-----|----------|----------|
| **Descargar-Luminarias-Emergencia.ps1** | Windows | UI + guía descarga | `.\Descargar-Luminarias-Emergencia.ps1` |
| **descargar-luminarias-emergencia.sh** | Linux/Mac | UI + guía descarga | `bash descargar-luminarias-emergencia.sh` |

### 📁 CARPETA DE DATOS (Donde van los LDT)

```
../../database/seeders/fixtures/luminaires-emergency/
    ↑ AQUÍ DESCARGAS los archivos .ldt
```

---

## 🗺️ FLUJO DE LECTURA RECOMENDADO

### Para Usuarios Ocupados ⚡

```
1. QUICK_START_EMERGENCIA.md (5 min)
   ↓
2. Descargar LDT (15-30 min)
   ↓
3. Ejecutar seeder (2 min)
   ↓
4. Verificar en Tinker (5 min)
✅ LISTO
```

### Para Usuarios Detallistas 📖

```
1. README_EMERGENCIA.md (10 min) — Visión general
   ↓
2. guia_importacion_luminarias_emergencia.md (15 min) — Categorías
   ↓
3. ESPECIFICACIONES_luminarias_emergencia.md (20 min) — Validación
   ↓
4. PROCEDIMIENTO_descarga_emergencia_completo.md (30 min) — Paso a paso
   ↓
5. QUICK_START_EMERGENCIA.md (5 min) — Resumen rápido
   ↓
6. Ejecutar pasos
✅ LISTO
```

---

## 🎯 WORKFLOW COMPLETO (Con Archivos)

```
START
  ↓
[QUICK_START_EMERGENCIA.md]
  ↓
[Descargar-Luminarias-Emergencia.ps1] ← (opcional, solo UI guidance)
  ↓
Descargar LDT manualmente desde luminaires.dialux.com
  (Seguir: PROCEDIMIENTO_descarga_emergencia_completo.md PASO 2)
  ↓
[ESPECIFICACIONES_luminarias_emergencia.md]
  ← Verificar que archivos sean válidos (checklist)
  ↓
php artisan db:seed --class=EmergencyLuminaireSeeder
  (Código: EmergencyLuminaireSeeder.php)
  ↓
Verificar en Tinker
  (Ver: PROCEDIMIENTO_descarga_emergencia_completo.md PASO 5)
  ↓
END ✅
```

---

## 📋 RESUMEN DE CONTENIDOS

### QUICK_START_EMERGENCIA.md

**Contenido:**
- 5 pasos visuales (ASCII art)
- Links importantes
- Archivos mínimos necesarios
- Validación rápida
- Troubleshooting básico

**Cuándo usarlo:**
- Cuando tienes prisa
- Como referencia visual
- Para recordar el flujo

**Duración:** 5 minutos

---

### README_EMERGENCIA.md

**Contenido:**
- Resumen ejecutivo
- Archivos creados (tabla)
- Flujo de 5 pasos
- Referencias rápidas (tablas)
- Checklist visual
- Estimación de tiempo
- Status actual

**Cuándo usarlo:**
- Visión general del proyecto
- Para saber qué archivo leer siguiente
- Para entender estructura

**Duración:** 10 minutos

---

### guia_importacion_luminarias_emergencia.md

**Contenido:**
- Categorías de luminarias
- Especificaciones por tipo (tabla)
- Fuentes autorizadas
- Proceso paso a paso
- Características LDT
- Referencias normativas

**Cuándo usarlo:**
- Entender categorías
- Conocer fuentes legítimas
- Aprender normativa

**Duración:** 15 minutos

---

### ESPECIFICACIONES_luminarias_emergencia.md

**Contenido:**
- Especificaciones técnicas detalladas por categoría
- Rango de valores esperados
- Modelos reales ejemplos
- Cómo buscar en DIALux Finder
- Validación de LDT
- Checklist de validez
- Estrategia de búsqueda

**Cuándo usarlo:**
- Cuando buscas en DIALux Luminaire Finder
- Para validar archivos descargados
- Para entender qué es "válido"

**Duración:** 20 minutos

---

### PROCEDIMIENTO_descarga_emergencia_completo.md

**Contenido:**
- Paso 1: Preparar carpeta
- Paso 2: Descargar LDT (Opción A y B)
- Paso 3: Verificar archivos
- Paso 4: Ejecutar seeder
- Paso 5: Verificar en BD
- Paso 6: Integrar en seeders
- Paso 7: Validación final (checklist)
- Solución de problemas (tabla)
- Referencias normativas

**Cuándo usarlo:**
- Cuando necesitas paso a paso detallado
- Durante la implementación
- Para troubleshooting

**Duración:** 30 minutos

---

### EmergencyLuminaireSeeder.php

**Contenido:**
- Clase seeder con 8 luminarias de emergencia
- Categorías: EXIT, Antipánico, Floor Strip
- Metadata con especificaciones
- Método de importación
- Método de actualización

**Cuándo usarlo:**
- Cuando ejecutas: `php artisan db:seed`
- Automáticamente al usar: `php artisan migrate:fresh --seed`

**Ejecución:**
```bash
php artisan db:seed --class=EmergencyLuminaireSeeder
```

---

## 🔍 ÍNDICE TEMÁTICO (Por Pregunta)

### ¿Por dónde empiezo?
→ **QUICK_START_EMERGENCIA.md** (5 min)

### ¿Qué archivos se crearon?
→ **README_EMERGENCIA.md** → sección "Archivos Creados"

### ¿Cuáles son las categorías de emergencia?
→ **guia_importacion_luminarias_emergencia.md** (sección superior)

### ¿Qué debo buscar en DIALux Finder?
→ **ESPECIFICACIONES_luminarias_emergencia.md** → "Estrategia de Búsqueda"

### ¿Cómo valido que un LDT es válido?
→ **ESPECIFICACIONES_luminarias_emergencia.md** → "Checklist de Validez"

### ¿Paso a paso completo?
→ **PROCEDIMIENTO_descarga_emergencia_completo.md** (30 min)

### ¿Qué comando ejecuto?
→ **QUICK_START_EMERGENCIA.md** → PASO 3

### ¿Cómo verifico que se importó?
→ **PROCEDIMIENTO_descarga_emergencia_completo.md** → PASO 5

### Algo no funciona, ¿qué hago?
→ **PROCEDIMIENTO_descarga_emergencia_completo.md** → "Solución de Problemas"

### ¿Cuáles son los requisitos normativos?
→ **guia_importacion_luminarias_emergencia.md** → "Referencias Normativas"

---

## 💾 ARCHIVOS CREADOS (Ubicaciones)

```
c:\laragon\www\proyectopcl\
├── 📄 QUICK_START_EMERGENCIA.md ← INICIO AQUÍ
├── 📄 README_EMERGENCIA.md
├── 📄 Descargar-Luminarias-Emergencia.ps1
├── 📄 descargar-luminarias-emergencia.sh
│
├── 📁 planes/
│   ├── 📄 guia_importacion_luminarias_emergencia.md
│   ├── 📄 ESPECIFICACIONES_luminarias_emergencia.md
│   └── 📄 PROCEDIMIENTO_descarga_emergencia_completo.md
│
├── 📁 database/seeders/
│   ├── 📄 EmergencyLuminaireSeeder.php
│   └── 📁 fixtures/
│       └── 📁 luminaires-emergency/  ← DESCARGAS AQUÍ
```

---

## ⚙️ PRÓXIMOS PASOS DESPUÉS DE IMPORTAR

Una vez que los LDT estén importados (base de datos lista):

### Fase 2: Integración en UI
- Agregar filtro "Emergency" en selector de luminarias
- Mostrar icono/badge diferenciador

### Fase 3: Validación Normativa
- Implementar validador RNE A.130
- Implementar validador EN 1838
- Mostrar warnings si no cumple

### Fase 4: Informes Específicos
- Generar informe de emergencia PDF
- Incluir cumplimiento normativo
- Tabla de luminarias vs. requisitos

### Fase 5: Integración con Cálculos
- Motor separado para modo emergencia
- Cálculo de duración batería
- Autonomía en horas

---

## 📞 SOPORTE RÁPIDO

**Problema:** ¿Qué está en cada archivo?
```
Tema: Categorías
Documento: guia_importacion_luminarias_emergencia.md
Sección: "Luminarias Recomendadas por Categoría"

Tema: Cómo buscar
Documento: ESPECIFICACIONES_luminarias_emergencia.md
Sección: "Estrategia de Búsqueda en DIALux"

Tema: Paso a paso
Documento: PROCEDIMIENTO_descarga_emergencia_completo.md
Sección: "PASO 1", "PASO 2", etc.
```

---

## ✅ CHECKLIST FINAL

- [ ] Leído: QUICK_START_EMERGENCIA.md
- [ ] Leído: README_EMERGENCIA.md
- [ ] Descargados: 5–7 archivos LDT
- [ ] Validados: Todos > 1 KB, formato correcto
- [ ] Ejecutado: `php artisan db:seed --class=EmergencyLuminaireSeeder`
- [ ] Verificado: Tinker muestra luminarias importadas
- [ ] Documentado: Cómo y cuándo usar cada archivo

---

## 🎓 CONOCIMIENTOS CLAVE

### Qué es un LDT
Archivo de texto (EULUMDAT) con distribución fotométrica de una luminaria.
**Estándar**: ISO 13123-2, usado en DIALux, Dialux Evo, AGi32, etc.

### Qué es RNE A.130
Reglamento Nacional de Edificaciones (Perú) — Accesibilidad, incluye capítulo específico de alumbrado de emergencia (A.130.070).

### Qué es EN 1838
European Standard para Emergency Lighting — Requisitos mínimos de iluminancia, uniformidad, duración, marcación.

### Qué es CNE
Código Eléctrico Nacional (Perú) — Capítulos para fuentes de alimentación y respaldo (baterías, generadores).

---

## 🚀 ESTADO ACTUAL

```
[✅] DOCUMENTACIÓN: 100% (5 archivos)
[✅] SEEDER: 100% (1 archivo, listo para usar)
[✅] SCRIPTS: 100% (2 scripts, Windows + Linux)
[⏳] DESCARGAS: 0% (TÚ INICIAS)
[⏳] EJECUCIÓN: 0% (TÚ EJECUTAS)
[⏳] VERIFICACIÓN: 0% (TÚ VALIDAS)

ESTADO GENERAL: Ready for Implementation ✅
```

---

**Fecha de Creación**: 2026-08-12  
**Versión**: 1.0  
**Última Revisión**: 2026-08-12  
**Mantenimiento**: Ver `README_EMERGENCIA.md` → Próximos Pasos

---

## 🎯 TU PRÓXIMO PASO

### OPCIÓN A (Rápido - 5 minutos)
1. Abre: **QUICK_START_EMERGENCIA.md**
2. Síguelo paso a paso

### OPCIÓN B (Completo - 1 hora)
1. Abre: **README_EMERGENCIA.md**
2. Lee la estructura
3. Abre archivos según necesites

### RECOMENDACIÓN
👉 Comienza con **QUICK_START_EMERGENCIA.md** (rápido overview)
👉 Luego sigue los pasos en **PROCEDIMIENTO_descarga_emergencia_completo.md**

**¡Estás listo! 🚀**

