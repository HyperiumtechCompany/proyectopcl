# DIALux Web — Scaffold Completo

Motor de diseño lumínico en la web: **Rust/WASM + React/TypeScript + Babylon.js + Laravel**

---

## Arquitectura

```
dialux-web/
├── dialux-core/          ← Motor Rust compilado a WebAssembly
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs        ← Bindings WASM (wasm-bindgen)
│       ├── geometry.rs   ← Room, Surface, CalculationGrid
│       ├── lighting.rs   ← Punto a punto, UGR, Isolux
│       └── ies_parser.rs ← Parser .IES con nom
│
└── dialux-frontend/      ← React + TypeScript + Babylon.js
    ├── src/
    │   ├── components/
    │   │   ├── Editor2D/
    │   │   │   ├── Editor2D.tsx      ← Canvas Konva con herramientas
    │   │   │   ├── GridLayer.tsx     ← Grilla de fondo
    │   │   │   ├── FixtureLayer.tsx  ← Símbolos de luminarias
    │   │   │   └── IsoluxOverlay.tsx ← Mapa de curvas isolu(d3-contour)
    │   │   ├── Viewer3D/
    │   │   │   └── Viewer3D.tsx      ← Escena Babylon.js sincronizada
    │   │   └── App.tsx               ← Layout principal
    │   ├── hooks/
    │   │   └── useWasmEngine.ts      ← Carga WASM en Web Worker
    │   ├── store/
    │   │   └── index.ts              ← Zustand (proyecto, UI, resultados)
    │   ├── types/
    │   │   └── index.ts              ← Tipos TypeScript completos
    │   └── wasm/pkg/                 ← Generado por wasm-pack (git-ignorado)
    └── vite.config.ts                ← WASM + COOP/COEP headers
```

---

## Setup Rápido

### 1. Prerrequisitos

```bash
# Rust + wasm-pack
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
cargo install wasm-pack

# Node 20+
node --version
```

### 2. Compilar el motor Rust → WASM

```bash
cd dialux-core
wasm-pack build --target web --out-dir ../dialux-frontend/src/wasm/pkg
```

Esto genera en `dialux-frontend/src/wasm/pkg/`:
- `dialux_core.js`      ← glue code JavaScript
- `dialux_core_bg.wasm` ← binario WebAssembly (~200-500 KB optimizado)
- `dialux_core.d.ts`    ← tipos TypeScript auto-generados

### 3. Levantar el frontend

```bash
cd dialux-frontend
npm install
npm run dev
```

Abre **http://localhost:5173**

---

## Flujo de Datos

```
Usuario dibuja recinto (Konva 2D)
    ↓
Store Zustand actualiza Room / Fixture
    ↓
Botón "Calcular" → useWasmEngine.calculate()
    ↓
Web Worker → Rust/WASM:
  calculate_lighting(room_json, fixtures_json, spacing, wp_height)
    ↓
LightingResult { avg_lux, uniformity, ugr, grid_values[] }
    ↓
IsoluxOverlay (d3-contour) pinta curvas en Konva
Viewer3D (Babylon.js) actualiza luces 3D
ResultsPanel muestra métricas EN 12464
    ↓
(Opcional) POST /api/projects/:id → Laravel guarda resultado
```

---

## Archivos IES

Para usar luminarias reales, arrastra un `.IES` al panel de luminarias.
El parser Rust (`ies_parser.rs`) lo procesa en WASM sin tocar el servidor.

Fuentes de archivos IES gratuitos:
- https://www.erco.com  → sección Downloads
- https://www.dial.de  → DIALux plugin database
- https://www.relux.com

---

## Normas soportadas

| Métrica        | Norma          | Umbral oficinas |
|---------------|----------------|-----------------|
| Iluminancia E | EN 12464-1     | ≥ 500 lux       |
| Uniformidad Uo| EN 12464-1     | ≥ 0.60          |
| UGR           | CIE 117 / EN   | ≤ 19            |

---

## Próximos pasos

- [ ] Radiosity (rebotes de luz entre superficies)
- [ ] Importar modelos GLTF/GLB en Babylon.js
- [ ] Backend Laravel: guardar proyectos, exportar PDF
- [ ] Catálogo de luminarias con búsqueda
- [ ] Múltiples recintos y plantas
- [ ] Exportar DWG/DXF del plano
