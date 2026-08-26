# Especificaciones Técnicas: Luminarias de Emergencia

## Referencia rápida para búsqueda en DIALux Luminaire Finder

Use esta tabla cuando busque en luminaires.dialux.com para descargar LDT.

---

## 1️⃣ CATEGORÍA: SEÑALIZACIÓN DE SALIDA (EXIT SIGNS)

### Función
Indicar claramente la salida de emergencia. **Normativa**: EN 50271, ISO 3864-4

### Especificaciones Esperadas

| Parámetro | Rango | Notas |
|-----------|-------|-------|
| **Potencia** | 1–10 W | Bajo consumo (batería de respaldo) |
| **Lúmenes totales** | 80–500 lm | Depende de número de caras (1 o 2) |
| **Tipo de luz** | LED (obligatorio) | Halógeno/incandescente: obsoleto |
| **CCT (Temperatura)** | 3000–6500 K | Típicamente 4000K o 6500K |
| **CRI Ra** | ≥ 70 | Reproducción de color aceptable |
| **Distribución** | Lambertiana o direccional | Depende de diseño |
| **Montaje** | Pared o techo | Surface-mounted preferentemente |
| **Fuente de alimentación** | AC + batería de respaldo | Mínimo 3 horas autonomía (EN 50271) |

### Modelos Esperados en DIALux Luminaire Finder

```
Buscar en https://luminaires.dialux.com:
- Tipo: "Exit Sign" o "Emergency Exit"
- Palabras clave: "Exit", "EXIT", "Señalización"
- Fabricantes: Philips Safety, LEDVANCE, Legrand, Eaton, Zumtobel
```

### Ejemplos Realistas

| Fabricante | Modelo | Lúmenes | Potencia | Artículo |
|-----------|--------|---------|----------|----------|
| Philips | Safety Exit Sign | 2×150 | 2×1.6W | SPD-EXIT-LED |
| LEDVANCE | Emergency Sign | 300 | 4W | EMLED-300 |
| Legrand | Compact Exit | 200 | 3W | LEG-EXIT-3W |

### Verificación en LDT Descargado

Abre con Notepad++:
- **Línea 9**: Debe contener "Exit" o "Salida"
- **Línea 30**: Número > 0.05 klm (ej: "0.3" = 300 lm)
- **Línea 33**: Número entre 1-10 (watts)
- **Líneas 34+**: Valores de candela (cd/klm)

---

## 2️⃣ CATEGORÍA: ANTIPÁNICO Y ALUMBRADO DE EMERGENCIA GENERAL

### Función
Iluminar ambientes con nivel suficiente para evacuación segura.
**Normativa**: RNE A.130 (Perú), EN 1838 (Europa)

### Especificaciones Esperadas

| Parámetro | Rango | Notas |
|-----------|-------|-------|
| **Potencia** | 15–50 W | Según tamaño y tipo de ambiente |
| **Lúmenes totales** | 1000–3500 lm | Crucial para cumplir iluminancia mínima |
| **Tipo de luz** | LED | Opto: Fluorescente compacta (CFL) |
| **CCT** | 3000–4000 K | Neutral o cálida (mejor percepción en emergencia) |
| **CRI Ra** | ≥ 75 | Mejor discriminación de colores |
| **Distribución** | Amplia/Broad (100–180°) | NO estrecha (< 40°) |
| **Ángulo haz 50%** | 80–150° | Cuanto más amplio, mejor cobertura |
| **Montaje** | Pared o techo | Surface-mounted o recessed |
| **Batería respaldo** | 1–3 horas | Según norma aplicable |

### Requisitos Normativos de Iluminancia

#### RNE A.130 (Perú) — Obligatoria
```
Rutas de evacuación:   ≥ 1 lux (en el piso, centro de ruta)
Áreas amplias:         ≥ 1 lux
Escaleras:             ≥ 5 lux (en los peldaños)
Uniformidad:           U ≥ 0.4 (Emin / Emax)
```

#### EN 1838 (Europa) — Referencia complementaria
```
Zonas de circulación:  ≥ 1 lux
Áreas de espera:       ≥ 0.5 lux
Escaleras (horizontales): ≥ 2 lux
Uniformidad:           U ≥ 0.4
```

### Modelos Típicos en DIALux

```
Buscar en https://luminaires.dialux.com:
- Tipo: "Emergency Light", "Anti-panic", "Emergency Luminaire"
- Palabras: "Emergency", "Antipánico", "Evacuación"
- Rango de potencia: 15–50 W
- Fabricantes: Philips, LEDVANCE, Thorlux, Zumtobel, Legrand, Eaton
```

### Ejemplos Realistas

| Fabricante | Modelo | Lúmenes | Potencia | Ángulo | Artículo |
|-----------|--------|---------|----------|--------|----------|
| Philips | Compact Emergency 25W | 2300 | 25 | 120° | BAU420 |
| LEDVANCE | Bulkhead Emergency 30W | 2600 | 30 | 130° | EMBL30 |
| Thorlux | Radiance Corridor 20W | 2100 | 20 | 100° | RC18820 |
| Zumtobel | Emergency Pendant 20W | 2000 | 20 | 140° | EMPEN-20 |

### Verificación en LDT Descargado

Abre con Notepad++:
- **Línea 9**: Nombre contiene "Emergency", "Antipánico", etc.
- **Línea 30**: Número entre 1.5–3.5 klm (ej: "2.3" = 2300 lm)
- **Línea 33**: Número entre 15–50 W
- **Línea 6** (Ng): ≥ 30 ángulos gamma (cobertura amplia)
- **Línea 7** (Dg): ≤ 6° (resolución buena, distribución suave)

---

## 3️⃣ CATEGORÍA: CINTA Y MARCACIÓN DE PISO (FLOOR STRIP / WAYFINDING)

### Función
Marcar rutas de evacuación con bajo consumo. Guía visual en oscuridad.
**Normativa**: RNE A.130.070 (Perú), EN 1838 (puntos de marcación)

### Especificaciones Esperadas

| Parámetro | Rango | Notas |
|-----------|-------|-------|
| **Potencia** | 0.5–3 W | Ultra bajo (batería larga duración) |
| **Lúmenes totales** | 30–300 lm | Bajo (más que suficiente para marcación) |
| **Tipo de luz** | LED | 100% LED obligatorio |
| **CCT** | 3000–6500 K | Verde/ámbar: visibilidad nocturna |
| **Distribuir** | Lambertiana o direccional hacia abajo | Hacia el suelo |
| **Formato** | Punto, línea, tira | Según aplicación |
| **Montaje** | Embutido en piso, pared baja, esquina | Próximo al suelo |
| **Espaciamiento** | 1–2 m entre puntos | Si son puntos discretos |

### Requisitos de Iluminancia (Marcación)

```
RNE A.130 (Perú):
- Franjas de piso: ≥ 0.3 lux (para visibilidad de ruta)
- Espaciamiento: máx 2 m entre puntos

EN 1838:
- Marcación de esquinas/puertas: ≥ 0.5 lux
- Espaciamiento: máx 2 m
```

### Modelos Típicos en DIALux

```
Buscar en https://luminaires.dialux.com:
- Tipo: "Floor Strip", "Emergency Marker", "Wayfinding Dot"
- Palabras: "Floor", "Piso", "Wayfinding", "Marker", "Dot"
- Rango: 1–5 W
- Fabricantes: Legrand, Philips, LEDVANCE, Signify
```

### Ejemplos Realistas

| Fabricante | Modelo | Lúmenes | Potencia | Tipo | Artículo |
|-----------|--------|---------|----------|------|----------|
| Legrand | Floor Strip LED | 120 | 1.2 | Cinta | EMFS-12 |
| Philips | Route Marking | 150 | 1.5 | Punto | RMLED-05 |
| LEDVANCE | Waypoint Dot | 50 | 0.8 | Punto | EMWP-3 |

### Verificación en LDT Descargado

Abre con Notepad++:
- **Línea 9**: Contiene "Floor", "Marker", "Waypoint", o equivalente
- **Línea 30**: Número entre 0.03–0.3 klm (30–300 lm)
- **Línea 33**: Número entre 0.5–3 W
- **Línea 7** (Dg): Entre 15–30° (distribución estrecha hacia piso)

---

## 4️⃣ CATEGORÍA: ILUMINARIA CON EMERGENCIA INTEGRADA (Dual-mode)

### Función
Luminaria de iluminación normal que integra alimentación de emergencia en batería.
Ahorra espacio y costo (1 luminaria = 2 funciones).

### Especificaciones Esperadas

| Parámetro | Modo Normal | Modo Emergencia | Notas |
|-----------|----------|-----------------|-------|
| **Potencia** | 20–100 W | 5–30 W | Menos en emergencia (batería) |
| **Lúmenes (Normal)** | 2000–8000 lm | – | Uso regular |
| **Lúmenes (Emergencia)** | – | 1500–3000 lm | Para evacuación |
| **CCT** | 2700–4000 K | 3000–4000 K | Coherente en ambos modos |
| **Batería** | Integrada (Li-Po) | 1–3 horas autonomía | NiMH o Li-Po |
| **Cambio automático** | Sí | Falla eléctrica → emergencia | Relé automático |

### Modelos Típicos

| Fabricante | Modelo | Normal (W) | Emergencia (W) | Artículo |
|-----------|--------|-----------|-----------------|----------|
| Philips | LED Pendant Emergency | 40 | 15 | LED-PEND-EM |
| Zumtobel | Suspended Dual-Mode | 50 | 18 | ZMB-DM-50 |
| Thorlux | Industrial Emergency | 60 | 20 | INDU-EM-60 |

---

## 🔍 ESTRATEGIA DE BÚSQUEDA EN DIALUX LUMINAIRE FINDER

### Paso 1: Acceso
```
URL: https://luminaires.dialux.com
```

### Paso 2: Filtros por Categoría

#### Para EXIT SIGNS:
```
Palabra clave: "exit" OR "salida"
Potencia: < 10 W
Lúmenes: 100–500 lm
```

#### Para ANTIPÁNICO:
```
Palabra clave: "emergency" OR "anti-panic" OR "antipánico"
Potencia: 15–50 W
Lúmenes: 1500–3500 lm
Ángulo: > 90° (broad)
```

#### Para FLOOR STRIP:
```
Palabra clave: "floor" OR "marker" OR "wayfinding" OR "piso"
Potencia: < 5 W
Montaje: "Floor" o "Recessed"
```

### Paso 3: Descargar

Para cada producto encontrado:
1. Click en el nombre → abre detalles
2. Scroll hacia abajo → "Download" o "Download LDT"
3. Descarga como **LDT** (preferencia) o **IES** (alternativa)
4. Guarda en: `../../database/seeders/fixtures/luminaires-emergency/`

### Paso 4: Nombrar

Patrón: `Fabricante-Tipo-Especificacion.ldt`

**Ejemplos:**
```
✅ Philips-Emergency-Exit-Sign.ldt
✅ LEDVANCE-Emergency-Bulkhead-30W.ldt
✅ Thorlux-Emergency-Corridor-20W.ldt
✅ Legrand-Floor-Strip-LED-1.2W.ldt
```

---

## 📋 CHECKLIST DE VALIDEZ ANTES DE IMPORTAR

Antes de ejecutar el seeder, verifica cada LDT:

- [ ] **Tamaño**: > 2 KB (no es un stub vacío)
- [ ] **Extensión**: `.ldt` o `.ies` (no `.ldt.txt`)
- [ ] **Contenido** (abre con Notepad++):
  - [ ] Línea 1: Nombre empresa (ASCII texto)
  - [ ] Línea 9: Nombre luminaria (contiene "Emergency", "Exit", etc.)
  - [ ] Línea 30: Número > 0 (klm = lúmenes/1000)
  - [ ] Línea 33: Número > 0 (watts)
  - [ ] Líneas 34+: Números (candela values)
- [ ] **NO es**: PDF, imagen, HTML, o archivo binario

---

## 🚀 Próxima Acción

Una vez validados todos los LDT:

```bash
php artisan db:seed --class=EmergencyLuminaireSeeder
```

Luego verifica en Tinker:
```php
php artisan tinker
>>> App\Models\LuminaireProduct::where('fixture_type', 'like', '%emergency%')->count()
```

Debe mostrar: número > 0 (cantidad de luminarias importadas)

---

**Última actualización**: 2026-08-12  
**Versión**: 1.0
