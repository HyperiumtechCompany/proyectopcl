import { useState } from "react";
import {
    ChevronDown, ChevronRight, Terminal, Package, Database,
    Code2, Layers, GitBranch, Zap, AlertTriangle, CheckCircle2,
    XCircle, Info, Copy, Check
} from "lucide-react";

const COLORS = {
    bg: "#0d1117", panel: "#161b22", border: "#30363d",
    accent: "#58a6ff", green: "#3fb950", yellow: "#d29922",
    red: "#f85149", purple: "#bc8cff", orange: "#e3b341",
    muted: "#8b949e", text: "#e6edf3", heading: "#f0f6fc"
};

function CodeBlock({ code, lang = "bash" }: { code: string; lang?: string }) {
    const [copied, setCopied] = useState(false);
    const copy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };
    return (
        <div style={{ position: "relative", background: "#010409", border: `1px solid ${COLORS.border}`, borderRadius: 8, margin: "8px 0" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 14px", borderBottom: `1px solid ${COLORS.border}` }}>
                <span style={{ fontSize: 10, color: COLORS.muted, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: 1 }}>{lang}</span>
                <button onClick={copy} style={{ background: "none", border: "none", cursor: "pointer", color: copied ? COLORS.green : COLORS.muted, display: "flex", alignItems: "center", gap: 4, fontSize: 10 }}>
                    {copied ? <Check size={11} /> : <Copy size={11} />}
                    {copied ? "Copiado" : "Copiar"}
                </button>
            </div>
            <pre style={{ margin: 0, padding: "12px 16px", overflowX: "auto", fontSize: 12, lineHeight: 1.7, color: "#adbac7", fontFamily: "'Fira Code', 'Cascadia Code', monospace" }}>
                <code>{code}</code>
            </pre>
        </div>
    );
}

function Badge({ text, color }: { text: string; color: string }) {
    return (
        <span style={{ background: color + "22", color, border: `1px solid ${color}44`, borderRadius: 20, padding: "1px 8px", fontSize: 10, fontWeight: 700, letterSpacing: 0.5 }}>
            {text}
        </span>
    );
}

function Section({ title, icon: Icon, color, children, defaultOpen = false }: any) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 10, marginBottom: 12, overflow: "hidden" }}>
            <div onClick={() => setOpen(o => !o)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: COLORS.panel, cursor: "pointer", userSelect: "none" }}>
                <Icon size={16} color={color} />
                <span style={{ fontWeight: 700, fontSize: 13, color: COLORS.heading, flex: 1 }}>{title}</span>
                {open ? <ChevronDown size={14} color={COLORS.muted} /> : <ChevronRight size={14} color={COLORS.muted} />}
            </div>
            {open && <div style={{ padding: "16px", background: COLORS.bg }}>{children}</div>}
        </div>
    );
}

function CompareRow({ label, mysql, pg }: { label: string; mysql: string | boolean; pg: string | boolean }) {
    const cell = (v: string | boolean, good: boolean) => (
        <td style={{ padding: "8px 12px", borderBottom: `1px solid ${COLORS.border}`, color: typeof v === "boolean" ? (v ? COLORS.green : COLORS.red) : (good ? COLORS.green : COLORS.yellow), fontSize: 12 }}>
            {typeof v === "boolean" ? (v ? "✅ Sí" : "❌ No") : v}
        </td>
    );
    const mysqlGood = mysql === true || (typeof mysql === "string" && !mysql.includes("❌") && !mysql.includes("No "));
    const pgGood = pg === true || (typeof pg === "string" && !pg.includes("❌") && !pg.includes("No "));
    return (
        <tr>
            <td style={{ padding: "8px 12px", borderBottom: `1px solid ${COLORS.border}`, color: COLORS.muted, fontSize: 12, fontWeight: 600 }}>{label}</td>
            {cell(mysql, mysqlGood)}
            {cell(pg, pgGood)}
        </tr>
    );
}

const DEPS = [
    {
        group: "Core Framework", color: COLORS.accent,
        items: [
            { name: "react@19", install: "npm install react@19 react-dom@19", concept: "UI con Server Components, useOptimistic, use() hook", why: "React 19 trae optimistic updates nativos — ideal para edición de celdas sin lag" },
            { name: "@inertiajs/react@2", install: "npm install @inertiajs/react@2", concept: "Puente SPA entre Laravel y React, sin API REST explícita", why: "Elimina boilerplate de fetch/axios para datos iniciales de página" },
            { name: "vite@6 + @vitejs/plugin-react", install: "npm install -D vite@6 @vitejs/plugin-react", concept: "Bundler ultrarrápido con HMR instantáneo", why: "Build en <500ms vs Webpack que tarda minutos en proyectos grandes" },
        ]
    },
    {
        group: "Tablas y Virtualización", color: COLORS.green,
        items: [
            { name: "@tanstack/react-table@8", install: "npm install @tanstack/react-table@8", concept: "Headless table: lógica sin UI. Tú controlas 100% el HTML/CSS", why: "Para S10 necesitas columnas editables, reordenamiento, agrupación — TanStack lo permite sin restricciones de look" },
            { name: "@tanstack/react-virtual@3", install: "npm install @tanstack/react-virtual@3", concept: "Renderiza solo las filas visibles en pantalla (windowing)", why: "Con 2000+ partidas, sin virtual el DOM se congela. Virtual renderiza ~20 filas siempre" },
            { name: "@tanstack/react-query@5", install: "npm install @tanstack/react-query@5", concept: "Servidor como fuente de verdad: cache, invalidación, prefetch", why: "Cuando editas una partida, invalida automáticamente el árbol padre y recalcula totales" },
        ]
    },
    {
        group: "Estado Global", color: COLORS.purple,
        items: [
            { name: "zustand@5", install: "npm install zustand@5", concept: "Store minimalista, sin boilerplate Redux, con TypeScript nativo", why: "El árbol de partidas es un grafo normalizado — Zustand con Immer maneja mutaciones inmutables fácil" },
            { name: "immer@10", install: "npm install immer@10", concept: "Mutaciones inmutables con sintaxis mutable (produce())", why: "Actualizar un nodo en árbol anidado sin Immer requiere spread profundo; con Immer: `item.quantity = 5`" },
        ]
    },
    {
        group: "UI / Layout", color: COLORS.orange,
        items: [
            { name: "react-resizable-panels@2", install: "npm install react-resizable-panels@2", concept: "Panel split drag-resize accesible y TypeScript-first", why: "El split izquierda/derecha de Delphin (árbol | ACU) — esta lib lo replica exactamente" },
            { name: "@dnd-kit/core @dnd-kit/sortable", install: "npm install @dnd-kit/core @dnd-kit/sortable", concept: "Drag & drop accesible con soporte táctil y teclado", why: "Para reordenar partidas por drag. dnd-kit es más liviano que react-beautiful-dnd (abandonado)" },
            { name: "tailwindcss@4", install: "npm install -D tailwindcss@4 @tailwindcss/vite", concept: "Utility-first CSS, Vite plugin nativo en v4 (sin postcss)", why: "v4 sin config, integración directa con Vite, tokens CSS nativos" },
            { name: "cmdk@1", install: "npm install cmdk@1", concept: "Command palette / búsqueda con keyboard navigation", why: "Para buscar recursos del maestro al agregar al ACU (como buscador de S10)" },
            { name: "lucide-react", install: "npm install lucide-react", concept: "Iconos SVG consistentes, tree-shakeable", why: "Solo importa los íconos que usas — zero bundle bloat" },
        ]
    },
    {
        group: "Formularios y Validación", color: COLORS.yellow,
        items: [
            { name: "react-hook-form@7", install: "npm install react-hook-form@7", concept: "Formularios con ref-based, mínimo re-render", why: "Edición de partidas: validar cantidad, precio, código sin re-render en cada keystroke" },
            { name: "zod@3", install: "npm install zod@3", concept: "Schema validation TypeScript-first, inferencia de tipos automática", why: "Define el schema de BudgetItem una sola vez — valida en frontend Y backend (Laravel via zod-like)" },
        ]
    },
    {
        group: "Exports y Reportes", color: COLORS.red,
        items: [
            { name: "@react-pdf/renderer@4 (frontend)", install: "npm install @react-pdf/renderer@4", concept: "Genera PDFs con componentes React (para preview)", why: "Preview del presupuesto en browser antes de imprimir" },
            { name: "xlsx (SheetJS)", install: "npm install xlsx", concept: "Lee/escribe Excel desde el browser sin servidor", why: "Export rápido sin roundtrip al servidor — útil para reportes simples" },
        ]
    },
    {
        group: "Backend Laravel", color: "#f97316",
        items: [
            { name: "laravel/framework@12", install: "composer require laravel/framework", concept: "Framework PHP, MVC + Service Container + Eloquent ORM", why: "Base del sistema — routes, controllers, models, jobs" },
            { name: "inertiajs/inertia-laravel@2", install: "composer require inertiajs/inertia-laravel@2", concept: "Respuestas Inertia desde controllers Laravel", why: "return Inertia::render('Budget/Index', $data) — sin API endpoints" },
            { name: "spatie/laravel-query-builder", install: "composer require spatie/laravel-query-builder", concept: "Filtros, sorts, includes desde query params automáticamente", why: "Para búsqueda de recursos del maestro: ?filter[type]=LABOR&sort=code" },
            { name: "spatie/laravel-activitylog", install: "composer require spatie/laravel-activitylog", concept: "Auditoría automática de cambios en modelos", why: "S10 tiene historial de cambios — este package lo da gratis" },
            { name: "barryvdh/laravel-dompdf", install: "composer require barryvdh/laravel-dompdf", concept: "Genera PDFs desde Blade views en el servidor", why: "Reportes formales del presupuesto en formato S10 oficial" },
            { name: "maatwebsite/excel", install: "composer require maatwebsite/excel", concept: "Export/import Excel con PhpSpreadsheet, queued exports", why: "Export masivo de presupuesto — puede correr en queue para no bloquear" },
        ]
    },
];

const MYSQL_VS_PG = [
    { label: "Árbol jerárquico nativo", mysql: "No nativo (usar closure table)", pg: "ltree nativo, muy eficiente" },
    { label: "Consultas recursivas (CTE)", mysql: "✅ Desde MySQL 8.0", pg: "✅ Más maduro y estable" },
    { label: "JSON columns", mysql: "✅ Funcional", pg: "✅ JSONB superior (indexable)" },
    { label: "Full-text search", mysql: "Básico", pg: "✅ Más potente con tsvector" },
    { label: "Rendimiento bulk inserts", mysql: "Bueno", pg: "✅ Mejor en carga masiva" },
    { label: "Hosting (Shared hosting Perú)", mysql: "✅ Universal, en todo lado", pg: "Solo VPS/dedicado" },
    { label: "Laravel Eloquent ORM", mysql: "✅ Full soporte", pg: "✅ Full soporte" },
    { label: "Soporte en equipo", mysql: "✅ Más conocido", pg: "Requiere aprendizaje extra" },
    { label: "Costo operativo", mysql: "✅ Gratis / incluido", pg: "✅ Gratis (pero VPS)" },
];

const MYSQL_TREE_SQL = `-- Closure Table Pattern para MySQL
-- Funciona igual que ltree de PostgreSQL
-- Un modelo para árbol de partidas ilimitado

CREATE TABLE budget_items (
  id          BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  project_id  BIGINT UNSIGNED NOT NULL,
  code        VARCHAR(50) NOT NULL,
  description VARCHAR(500) NOT NULL,
  unit        VARCHAR(20),
  quantity    DECIMAL(15,4) DEFAULT 0,
  unit_price  DECIMAL(15,4) DEFAULT 0,
  total_price DECIMAL(15,4) DEFAULT 0,
  level       TINYINT DEFAULT 0,
  sort_order  INT DEFAULT 0,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Closure table: guarda TODOS los ancestros de cada nodo
CREATE TABLE budget_item_hierarchy (
  ancestor_id   BIGINT UNSIGNED NOT NULL,
  descendant_id BIGINT UNSIGNED NOT NULL,
  depth         INT NOT NULL DEFAULT 0,
  PRIMARY KEY (ancestor_id, descendant_id),
  INDEX idx_descendant (descendant_id)
);

-- Insertar nodo hijo (se inserta solo con un stored procedure)
DELIMITER //
CREATE PROCEDURE insert_budget_item(
  IN p_parent_id BIGINT,
  IN p_project_id BIGINT,
  IN p_code VARCHAR(50),
  IN p_description VARCHAR(500)
)
BEGIN
  DECLARE new_id BIGINT;
  
  INSERT INTO budget_items (project_id, code, description)
  VALUES (p_project_id, p_code, p_description);
  
  SET new_id = LAST_INSERT_ID();
  
  -- Auto-referencia del nodo
  INSERT INTO budget_item_hierarchy (ancestor_id, descendant_id, depth)
  VALUES (new_id, new_id, 0);
  
  -- Hereda todos los ancestros del padre
  INSERT INTO budget_item_hierarchy (ancestor_id, descendant_id, depth)
  SELECT ancestor_id, new_id, depth + 1
  FROM budget_item_hierarchy
  WHERE descendant_id = p_parent_id;
END //
DELIMITER ;

-- Obtener todos los hijos de un nodo
SELECT bi.* FROM budget_items bi
JOIN budget_item_hierarchy h ON h.descendant_id = bi.id
WHERE h.ancestor_id = :parent_id AND h.depth = 1
ORDER BY bi.sort_order;

-- Obtener árbol completo (todos los niveles)
SELECT bi.*, h.depth FROM budget_items bi
JOIN budget_item_hierarchy h ON h.descendant_id = bi.id
WHERE h.ancestor_id = :root_id
ORDER BY h.depth, bi.sort_order;`;

const LARAVEL_MODEL = `// app/Models/BudgetItem.php
class BudgetItem extends Model
{
    // Adjacency List via staudenmeir/laravel-adjacency-list
    use HasRecursiveRelationships;

    protected $fillable = [
        'project_id', 'parent_id', 'code', 'description',
        'unit', 'quantity', 'unit_price', 'total_price', 'sort_order'
    ];

    // Hijos directos
    public function children(): HasMany
    {
        return $this->hasMany(BudgetItem::class, 'parent_id')
                    ->orderBy('sort_order');
    }

    // TODOS los descendientes (recursivo)
    public function descendants(): HasMany
    {
        return $this->hasManyOfDescendants(BudgetItem::class);
    }

    // ACU items
    public function acuItems(): HasMany
    {
        return $this->hasMany(AcuItem::class);
    }

    // Recalcular precio unitario
    public function recalculate(): void
    {
        $total = $this->acuItems()
            ->with('resource')
            ->get()
            ->sum(fn($acu) => $acu->quantity * $acu->resource->price);

        $this->update(['unit_price' => $total, 'total_price' => $total * $this->quantity]);
        
        // Propagar hacia arriba
        if ($this->parent_id) {
            $this->parent->recalculateTotal();
        }
    }
}`;

const ADJACENCY_INSTALL = `# El paquete que resuelve árboles en MySQL/PostgreSQL para Laravel
composer require staudenmeir/laravel-adjacency-list

# Soporta:
# - MySQL 8+ (CTE recursivas)
# - PostgreSQL (CTE recursivas)  
# - SQLite 3.35+ (para testing)
# Solo requiere parent_id en la tabla — sin closure tables manuales`;

const VITE_CONFIG = `// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import laravel from 'laravel-vite-plugin'

export default defineConfig({
  plugins: [
    laravel({
      input: ['resources/ts/app.tsx'],
      refresh: true,
    }),
    react(),
    tailwindcss(),  // Tailwind v4: sin postcss.config.js
  ],
  resolve: {
    alias: { '@': '/resources/ts' }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', '@inertiajs/react'],
          'vendor-table': ['@tanstack/react-table', '@tanstack/react-virtual'],
          'vendor-state': ['zustand', 'immer', '@tanstack/react-query'],
        }
      }
    }
  }
})`;

const FOLDER_STRUCTURE = `s10-web/
├── app/
│   ├── Http/Controllers/
│   │   ├── ProjectController.php
│   │   ├── BudgetItemController.php
│   │   ├── AcuController.php
│   │   └── ResourceController.php
│   ├── Models/
│   │   ├── BudgetItem.php       ← usa adjacency-list
│   │   ├── AcuItem.php
│   │   └── Resource.php
│   ├── Jobs/
│   │   └── RecalculateBudget.php ← cálculo masivo en queue
│   └── Services/
│       └── AcuCalculatorService.php
├── resources/
│   └── ts/
│       ├── app.tsx              ← Entry point Inertia
│       ├── pages/
│       │   ├── Budget/
│       │   │   ├── Index.tsx    ← Split view principal
│       │   │   └── partials/
│       │   │       ├── BudgetTree.tsx
│       │   │       └── AcuPanel.tsx
│       │   └── Resources/
│       │       └── Index.tsx
│       ├── stores/
│       │   ├── budgetStore.ts   ← Zustand
│       │   └── projectStore.ts
│       ├── hooks/
│       │   ├── useBudgetTree.ts
│       │   └── useAcuCalc.ts
│       └── types/
│           ├── budget.ts
│           └── acu.ts
└── database/
    └── migrations/
        ├── create_projects_table.php
        ├── create_budget_items_table.php
        ├── create_resources_table.php
        └── create_acu_items_table.php`;

const INSTALL_ALL = `# 1. Crear proyecto Laravel 12
composer create-project laravel/laravel s10-web
cd s10-web

# 2. Instalar Inertia + SSR
composer require inertiajs/inertia-laravel@^2.0
php artisan inertia:middleware
# Agregar HandleInertiaRequests al kernel

# 3. Paquetes Laravel
composer require staudenmeir/laravel-adjacency-list
composer require spatie/laravel-query-builder
composer require spatie/laravel-activitylog  
composer require barryvdh/laravel-dompdf
composer require maatwebsite/excel

# 4. Init NPM con React 19 + Vite 6
npm create vite@latest . -- --template react-ts
npm install react@19 react-dom@19 @inertiajs/react@2
npm install @tanstack/react-table@8 @tanstack/react-virtual@3
npm install @tanstack/react-query@5
npm install zustand@5 immer@10
npm install react-resizable-panels@2
npm install @dnd-kit/core @dnd-kit/sortable
npm install react-hook-form@7 zod@3
npm install cmdk lucide-react
npm install xlsx

# 5. Dev dependencies
npm install -D tailwindcss@4 @tailwindcss/vite
npm install -D @types/node typescript

# 6. Laravel Vite plugin
npm install -D laravel-vite-plugin`;

export default function TechPlan() {
    const [tab, setTab] = useState < "mysql" | "libs" | "structure" | "install" > ("mysql");

    const tabs = [
        { id: "mysql", label: "MySQL vs PostgreSQL", icon: Database },
        { id: "libs", label: "Librerías", icon: Package },
        { id: "structure", label: "Estructura", icon: Layers },
        { id: "install", label: "Instalación", icon: Terminal },
    ] as const;

    return (
        <div style={{ minHeight: "100vh", background: COLORS.bg, color: COLORS.text, fontFamily: "'Segoe UI', system-ui, sans-serif", padding: "0 0 40px" }}>
            {/* Header */}
            <div style={{ background: "linear-gradient(135deg, #0d1117 0%, #161b22 100%)", borderBottom: `1px solid ${COLORS.border}`, padding: "20px 24px 0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
                    <div style={{ background: "#58a6ff22", border: "1px solid #58a6ff44", borderRadius: 8, padding: "6px 10px" }}>
                        <Code2 size={18} color={COLORS.accent} />
                    </div>
                    <div>
                        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: COLORS.heading }}>S10-Web · Plan Técnico Completo</h1>
                        <p style={{ margin: 0, fontSize: 11, color: COLORS.muted }}>React 19 · Laravel 12 · Inertia v2 · TypeScript · Vite 6</p>
                    </div>
                </div>
                <div style={{ display: "flex", gap: 2, marginTop: 16 }}>
                    {tabs.map(({ id, label, icon: Icon }) => (
                        <button key={id} onClick={() => setTab(id as any)}
                            style={{
                                display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", border: "none", borderRadius: "6px 6px 0 0", cursor: "pointer", fontSize: 12, fontWeight: 600, transition: "all 0.15s",
                                background: tab === id ? COLORS.bg : "transparent",
                                color: tab === id ? COLORS.accent : COLORS.muted,
                                borderBottom: tab === id ? `2px solid ${COLORS.accent}` : "2px solid transparent"
                            }}>
                            <Icon size={13} />{label}
                        </button>
                    ))}
                </div>
            </div>

            <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px 16px" }}>

                {/* ── TAB: MySQL vs PG ── */}
                {tab === "mysql" && (
                    <div>
                        <div style={{ background: "#d2992215", border: `1px solid ${COLORS.yellow}44`, borderRadius: 10, padding: "12px 16px", marginBottom: 20, display: "flex", gap: 10 }}>
                            <Info size={16} color={COLORS.yellow} style={{ flexShrink: 0, marginTop: 1 }} />
                            <p style={{ margin: 0, fontSize: 12, color: COLORS.yellow, lineHeight: 1.6 }}>
                                <strong>Respuesta directa:</strong> Sí, la misma lógica funciona con MySQL 8+. La diferencia está en cómo manejas el árbol de partidas. PostgreSQL tiene <code>ltree</code> nativo; con MySQL usas <strong>Closure Table</strong> o el paquete <code>staudenmeir/laravel-adjacency-list</code> que abstrae todo.
                            </p>
                        </div>

                        {/* Compare table */}
                        <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 10, overflow: "hidden", marginBottom: 20 }}>
                            <div style={{ padding: "10px 16px", borderBottom: `1px solid ${COLORS.border}`, background: "#161b22" }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.heading }}>Comparativa para el proyecto S10-Web</span>
                            </div>
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                    <tr>
                                        <th style={{ padding: "8px 12px", textAlign: "left", fontSize: 10, color: COLORS.muted, borderBottom: `1px solid ${COLORS.border}`, textTransform: "uppercase", letterSpacing: 1 }}>Característica</th>
                                        <th style={{ padding: "8px 12px", textAlign: "left", fontSize: 10, color: "#f97316", borderBottom: `1px solid ${COLORS.border}`, textTransform: "uppercase", letterSpacing: 1 }}>MySQL 8+</th>
                                        <th style={{ padding: "8px 12px", textAlign: "left", fontSize: 10, color: COLORS.accent, borderBottom: `1px solid ${COLORS.border}`, textTransform: "uppercase", letterSpacing: 1 }}>PostgreSQL 16</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {MYSQL_VS_PG.map(row => <CompareRow key={row.label} {...row} />)}
                                </tbody>
                            </table>
                        </div>

                        <div style={{ background: "#3fb95015", border: `1px solid ${COLORS.green}44`, borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
                            <p style={{ margin: "0 0 4px", fontSize: 12, fontWeight: 700, color: COLORS.green }}>✅ Recomendación para tu caso (Perú / shared hosting)</p>
                            <p style={{ margin: 0, fontSize: 11, color: COLORS.muted, lineHeight: 1.6 }}>Usa <strong style={{ color: COLORS.text }}>MySQL 8.0+</strong> con el paquete <code style={{ color: COLORS.accent }}>staudenmeir/laravel-adjacency-list</code>. Evita implementar Closure Table manualmente — el paquete lo abstrae con <code>parent_id</code> simple y te da <code>children()</code>, <code>descendants()</code>, <code>ancestors()</code> en Eloquent. Si tienes VPS propio, migra a PostgreSQL después.</p>
                        </div>

                        <Section title="SQL: Closure Table en MySQL (alternativa manual)" icon={Database} color={COLORS.orange} defaultOpen={false}>
                            <CodeBlock code={MYSQL_TREE_SQL} lang="sql" />
                        </Section>

                        <Section title="Laravel Model con adjacency-list (recomendado)" icon={Code2} color={COLORS.green} defaultOpen={true}>
                            <div style={{ background: "#3fb95015", border: `1px solid ${COLORS.green}33`, borderRadius: 8, padding: "8px 12px", marginBottom: 8 }}>
                                <p style={{ margin: 0, fontSize: 11, color: COLORS.green }}>Este paquete elimina la necesidad de Closure Table manual. Solo necesitas <code>parent_id</code> en la migración.</p>
                            </div>
                            <CodeBlock code={ADJACENCY_INSTALL} lang="bash" />
                            <CodeBlock code={LARAVEL_MODEL} lang="php" />
                        </Section>
                    </div>
                )}

                {/* ── TAB: Librerías ── */}
                {tab === "libs" && (
                    <div>
                        {DEPS.map(group => (
                            <div key={group.group} style={{ marginBottom: 16 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                    <div style={{ width: 3, height: 16, background: group.color, borderRadius: 2 }} />
                                    <span style={{ fontSize: 11, fontWeight: 700, color: group.color, textTransform: "uppercase", letterSpacing: 1 }}>{group.group}</span>
                                </div>
                                <div style={{ display: "grid", gap: 8 }}>
                                    {group.items.map(lib => (
                                        <div key={lib.name} style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 14 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                                                <code style={{ fontSize: 12, color: group.color, fontWeight: 700, background: group.color + "15", padding: "1px 8px", borderRadius: 4 }}>{lib.name}</code>
                                            </div>
                                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                                                <div>
                                                    <p style={{ margin: "0 0 2px", fontSize: 9, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 1 }}>Qué hace</p>
                                                    <p style={{ margin: 0, fontSize: 11, color: COLORS.text, lineHeight: 1.5 }}>{lib.concept}</p>
                                                </div>
                                                <div>
                                                    <p style={{ margin: "0 0 2px", fontSize: 9, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 1 }}>Por qué en este proyecto</p>
                                                    <p style={{ margin: 0, fontSize: 11, color: COLORS.muted, lineHeight: 1.5 }}>{lib.why}</p>
                                                </div>
                                            </div>
                                            <CodeBlock code={lib.install} lang="bash" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}

                        <Section title="vite.config.ts — Configuración recomendada" icon={Zap} color={COLORS.yellow} defaultOpen={false}>
                            <CodeBlock code={VITE_CONFIG} lang="typescript" />
                        </Section>
                    </div>
                )}

                {/* ── TAB: Estructura ── */}
                {tab === "structure" && (
                    <div>
                        <div style={{ marginBottom: 16 }}>
                            <Section title="Estructura de carpetas del proyecto" icon={GitBranch} color={COLORS.accent} defaultOpen={true}>
                                <CodeBlock code={FOLDER_STRUCTURE} lang="text" />
                            </Section>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                            {[
                                { title: "Flujo de datos (Inertia)", color: COLORS.accent, items: ["1. Request llega a Laravel route", "2. Controller carga datos (Eloquent)", "3. return Inertia::render('Page', $data)", "4. React recibe props tipadas", "5. useOptimistic para edición local", "6. axios.patch() para guardar", "7. Inertia.reload() actualiza página"] },
                                { title: "Flujo de cálculo ACU", color: COLORS.green, items: ["1. Usuario edita cantidad/precio en celda", "2. useOptimistic actualiza UI inmediato", "3. Debounce 500ms antes de enviar", "4. POST /api/acu-items/{id}", "5. AcuCalculatorService->recalculate()", "6. Job en queue actualiza árbol padre", "7. Broadcast event → React actualiza total"] },
                                { title: "TypeScript: tipos compartidos", color: COLORS.purple, items: ["types/budget.ts → BudgetItem, AcuItem", "types/resource.ts → Resource, Crew", "types/inertia.d.ts → Page props tipados", "Zod schemas validan API responses", "tRPC (opcional) para type-safe API", "Compartir tipos con Laravel via openapi-ts"] },
                                { title: "Performance con 5000+ partidas", color: COLORS.orange, items: ["Lazy load: solo 2 niveles en inicio", "TanStack Virtual: renderiza ~30 filas", "Redis cache: precios calculados", "Stale-while-revalidate con React Query", "Batch mutations: agrupa cambios 500ms", "Web Worker: cálculos heavy off main thread"] },
                            ].map(card => (
                                <div key={card.title} style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 16 }}>
                                    <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 700, color: card.color }}>{card.title}</p>
                                    {card.items.map((item, i) => (
                                        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 5 }}>
                                            <span style={{ fontSize: 10, color: card.color, fontFamily: "monospace", flexShrink: 0, marginTop: 1 }}>{String(i + 1).padStart(2, "0")}</span>
                                            <span style={{ fontSize: 11, color: COLORS.muted, lineHeight: 1.5 }}>{item}</span>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── TAB: Instalación ── */}
                {tab === "install" && (
                    <div>
                        <div style={{ background: "#58a6ff15", border: `1px solid ${COLORS.accent}44`, borderRadius: 10, padding: "12px 16px", marginBottom: 20 }}>
                            <p style={{ margin: 0, fontSize: 12, color: COLORS.accent, lineHeight: 1.6 }}>
                                <strong>Script completo de instalación</strong> — Ejecuta todo en orden. Requiere PHP 8.3+, Node 20+, Composer 2.7+, MySQL 8.0+
                            </p>
                        </div>
                        <CodeBlock code={INSTALL_ALL} lang="bash" />
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 16 }}>
                            {[
                                { label: "PHP mínimo", value: "8.3+", color: COLORS.purple },
                                { label: "Node mínimo", value: "20 LTS", color: COLORS.green },
                                { label: "MySQL mínimo", value: "8.0+", color: COLORS.orange },
                                { label: "Composer", value: "2.7+", color: COLORS.accent },
                                { label: "React", value: "19.x", color: COLORS.accent },
                                { label: "TypeScript", value: "5.x", color: COLORS.accent },
                            ].map(item => (
                                <div key={item.label} style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 14px", textAlign: "center" }}>
                                    <p style={{ margin: "0 0 2px", fontSize: 10, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 1 }}>{item.label}</p>
                                    <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: item.color, fontFamily: "monospace" }}>{item.value}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}