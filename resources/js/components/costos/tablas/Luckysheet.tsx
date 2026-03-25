/**
 * Luckysheet.tsx — Wrapper React para la hoja de cálculo Luckysheet
 *
 * ── POR QUÉ CARGA DINÁMICA Y NO ESM IMPORT ──────────────────────────────────
 *
 * Luckysheet es una librería legacy (jQuery-dependiente) que:
 * 1. Asume que window.$ y window.jQuery existen en tiempo de evaluación
 *    del módulo, NO solo en tiempo de render.
 * 2. Su bundle ESM tiene efectos de lado que rompen con Vite + React Compiler
 *    (babel-plugin-react-compiler) porque el compilador puede reordenar o
 *    memoizar los efectos del import.
 * 3. Su bundle UMD en node_modules/luckysheet/dist/luckysheet.umd.js SÍ
 *    funciona perfectamente cargado como <script> en el DOM.
 *
 * ESTRATEGIA: Inyectamos el script UMD de Luckysheet dinámicamente via
 * loadLuckysheetScript(). El script se carga UNA vez (guardado en un
 * singleton de estado de carga). Una vez cargado, window.luckysheet está
 * disponible y luckysheet.create() funciona.
 *
 * REQUISITO: Copiar luckysheet.umd.js a public/ (ver instrucciones abajo).
 */

import React, { useEffect, useRef, useState } from 'react';

// ── Singleton de estado de carga del script ───────────────────────────────────
// 'idle'    → aún no se solicitó cargar
// 'loading' → tag <script> añadido, esperando onload
// 'ready'   → window.luckysheet disponible
// 'error'   → onload o onerror fallaron
type ScriptState = 'idle' | 'loading' | 'ready' | 'error';
let _scriptState: ScriptState = 'idle';
const _callbacks: Array<(state: 'ready' | 'error') => void> = [];

/**
 * Carga la cadena de scripts en orden:
 *   1) jquery.mousewheel.js  (plugin de jQuery para scroll en la hoja)
 *   2) luckysheet.umd.js     (la hoja de cálculo)
 *
 * PROBLEMA RESUELTO: El error `$(...).mousewheel is not a function` ocurría
 * porque `jquery-mousewheel` se importaba dentro del bundle de Vite y
 * registraba `.mousewheel` en esa instancia de jQuery. Pero cuando Luckysheet
 * (cargado como UMD externo) llama a `window.$(...).mousewheel(...)`,
 * puede que window.$ no tenga el plugin si hay diferencia de instancias.
 *
 * SOLUCIÓN: Cargamos jquery.mousewheel.js como <script> externo desde
 * public/ — ejecuta en el contexto de window y registra el plugin en
 * window.$ directamente, garantizando que Luckysheet lo encuentre.
 *
 * Archivos requeridos en public/:
 *   public/luckysheet/jquery.mousewheel.js  ← jquery-mousewheel
 *   public/luckysheet/luckysheet.umd.js     ← luckysheet
 *   public/luckysheet/css/luckysheet.css    ← estilos + todos los assets
 *   public/luckysheet/css/*.gif, *.png ...  ← imágenes referenciadas por el CSS
 */
function loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
        // No cargar dos veces el mismo script
        if (document.querySelector(`script[src="${src}"]`)) {
            resolve();
            return;
        }
        const s = document.createElement('script');
        s.src = src;
        s.async = false; // false = respeta el orden en que se añaden
        s.onload = () => resolve();
        s.onerror = () => reject(new Error(`No se pudo cargar: ${src}`));
        document.head.appendChild(s);
    });
}

function loadLuckysheetScript(onDone: (state: 'ready' | 'error') => void): void {
    if (_scriptState === 'ready') { onDone('ready'); return; }
    if (_scriptState === 'error') { onDone('error'); return; }

    _callbacks.push(onDone);
    if (_scriptState === 'loading') return;
    _scriptState = 'loading';

    // El CSS ahora se carga dinámicamente en el componente para que pueda desinstalarse
    // al desmontar, evitando que estilos globales de luckysheet rompan el resto de la app
    // basada en Tailwind.

    // Cargar en cadena: primero el plugin mousewheel, luego plugins de luckysheet y finalmente Luckysheet
    loadScript('/luckysheet/jquery.mousewheel.js')
        .then(() => loadScript('/luckysheet/plugins/js/plugin.js'))
        .then(() => loadScript('/luckysheet/luckysheet.umd.js'))
        .then(() => {
            _scriptState = 'ready';
            _callbacks.forEach((cb) => cb('ready'));
            _callbacks.length = 0;
        })
        .catch((err) => {
            _scriptState = 'error';
            _callbacks.forEach((cb) => cb('error'));
            _callbacks.length = 0;
            console.error(
                '[Luckysheet] Fallo al cargar scripts externos.\n' +
                'Asegúrate de que estos archivos existen:\n' +
                '  public/luckysheet/jquery.mousewheel.js\n' +
                '  public/luckysheet/luckysheet.umd.js\n' +
                '  public/luckysheet/css/luckysheet.css + assets\n\n' +
                'Comandos para copiarlos:\n' +
                '  Copy-Item node_modules/jquery-mousewheel/jquery.mousewheel.js public/luckysheet/ -Force\n' +
                '  Copy-Item node_modules/luckysheet/dist/luckysheet.umd.js public/luckysheet/ -Force\n' +
                '  Copy-Item node_modules/luckysheet/dist/css/* public/luckysheet/css/ -Force\n',
                err,
            );
        });
}

// ── Tipos públicos ────────────────────────────────────────────────────────────

interface LuckysheetProps {
    /** Array de sheets en formato JSON de Luckysheet. Puede estar vacío. */
    data?: any[];
    /** Opciones adicionales para luckysheet.create() */
    options?: Record<string, any>;
    /**
     * Llamado con el array completo de sheets cada vez que el usuario edita
     * una celda. Usa esto para actualizar el estado del padre y programar el guardado.
     */
    onDataChange?: (sheets: any[]) => void;
    /**
     * Llamado cuando el usuario selecciona una celda.
     * Recibe: fila, columna, y datos de la fila completa
     */
    onCellSelect?: (row: number, col: number, rowData: Record<string, any>) => void;
    /**
     * Llamado cuando el usuario solicita eliminar una fila.
     * Recibe: número de fila
     */
    onDeleteRow?: (rowIndex: number) => void;
    /** Alto del contenedor. Default: '600px' */
    height?: string;
    /** Si false, Luckysheet mostrará la hoja en modo lectura (sin edición). */
    canEdit?: boolean;
    /** Columnas para determinar claves de datos */
    columns?: Array<{ key: string; label: string }>;
}

// ── Componente ────────────────────────────────────────────────────────────────

const Luckysheet: React.FC<LuckysheetProps> = ({
    data,
    options = {},
    onDataChange,
    onCellSelect,
    onDeleteRow,
    height = '640px',
    canEdit = true,
    columns = [],
}) => {
    // ID fijo del contenedor — CommunicationsIndex.tsx y otros archivos
    // manipulan window.luckysheet directamente esperando este ID
    const containerId = 'luckysheet';

    const [scriptState, setScriptState] = useState<ScriptState>(_scriptState);
    const isInitialized = useRef(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const selectionCleanupRef = useRef<null | (() => void)>(null);

    // ── Paso 1: Cargar el script UMD y CSS ────────────────────────────────────
    useEffect(() => {
        // Montamos los 4 CSS requeridos por Luckysheet globalmente solo mientras el componente exista
        const win = window as any;
        win.__luckysheet_css_ref_count = (win.__luckysheet_css_ref_count || 0) + 1;

        const cssLinks = [
            { id: 'luckysheet-css-plugins', href: '/luckysheet/plugins/css/pluginsCss.css' },
            { id: 'luckysheet-css-plugins-base', href: '/luckysheet/plugins/plugins.css' },
            { id: 'luckysheet-css-core', href: '/luckysheet/css/luckysheet.css' },
            { id: 'luckysheet-css-iconfont', href: '/luckysheet/assets/iconfont/iconfont.css' },
        ];

        cssLinks.forEach(({ id, href }) => {
            let link = document.getElementById(id) as HTMLLinkElement;
            if (!link) {
                link = document.createElement('link');
                link.id = id;
                link.rel = 'stylesheet';
                link.href = href;
                document.head.appendChild(link);
            }
        });

        let isCanceled = false;

        // Si ya está cargado (navegación SPA de regreso a la página), saltar directo
        if (_scriptState === 'ready') {
            setScriptState('ready');
        } else {
            loadLuckysheetScript((state) => {
                if (!isCanceled) {
                    setScriptState(state);
                }
            });
        }

        return () => {
            isCanceled = true;
            win.__luckysheet_css_ref_count -= 1;
            if (win.__luckysheet_css_ref_count <= 0) {
                win.__luckysheet_css_ref_count = 0;
                cssLinks.forEach(({ id }) => {
                    const linkToRemove = document.getElementById(id);
                    if (linkToRemove) {
                        linkToRemove.remove();
                    }
                });
            }
        };
        // Solo ejecutar al montar
         
    }, []);

    // ── Paso 2: Inicializar Luckysheet cuando el script esté listo ────────────
    useEffect(() => {
        if (scriptState !== 'ready') return;
        if (isInitialized.current) return;
        isInitialized.current = true;

        const initialData =
            Array.isArray(data) && data.length > 0
                ? data
                : [
                    {
                        name: 'Metrado',
                        status: 1,
                        order: 0,
                        row: 40,
                        column: 26,
                        celldata: [],
                        config: {},
                    },
                ];

        /**
         * 300ms de delay para asegurar que:
         * 1. El div contenedor está pintado en el DOM real
         * 2. Los globals window.$ y window.jQuery están disponibles
         * 3. El CSS ya fue parseado por el navegador
         */
        timerRef.current = setTimeout(() => {
            const ls = (window as any).luckysheet;
            if (!ls) {
                console.error('[Luckysheet] window.luckysheet no está disponible tras cargar el script.');
                return;
            }

            /**
             * Helper que extrae todos los datos de la hoja con un micro-delay.
             *
             * PROBLEMA: getAllSheets() llamado DENTRO del callback afterChange
             * puede devolver el estado ANTERIOR porque Luckysheet aún no terminó
             * de escribir el nuevo valor en su store interno.
             *
             * SOLUCIÓN: setTimeout(0) cede el hilo al event loop, permitiendo
             * que Luckysheet complete su ciclo de actualización antes de leer.
             */
            const captureSheetsData = () => {
                setTimeout(() => {
                    try {
                        const sheets = ls.getAllSheets();
                        if (onDataChange && Array.isArray(sheets)) {
                            onDataChange(sheets);
                        }
                    } catch (e) {
                        // getAllSheets puede fallar si la hoja fue destruida
                        console.warn('[Luckysheet] getAllSheets() falló:', e);
                    }
                }, 0);
            };

            const readCellValue = (sheet: any, row: number, col: number) => {
                const cell = sheet?.data?.[row]?.[col];
                if (cell && cell.v !== undefined) {
                    if (typeof cell.v === 'object' && cell.v !== null && 'v' in cell.v) {
                        return (cell.v as any).v ?? '';
                    }
                    return cell.v ?? '';
                }
                const cellObj = sheet?.celldata?.find(
                    (cd: any) => cd.r === row && cd.c === col,
                );
                return cellObj?.v?.v ?? '';
            };

            const notifySelection = (forcedRow?: number, forcedCol?: number) => {
                if (!onCellSelect) return;
                try {
                    const sheets = ls.getAllSheets();
                    const sheet = sheets?.[0];
                    if (!sheet) return;

                    let row = forcedRow;
                    let col = forcedCol;
                    if (row === undefined || col === undefined) {
                        const range = ls.getRange?.();
                        if (!range || range.length === 0) return;
                        row = range[0]?.row?.[0];
                        col = range[0]?.column?.[0];
                    }

                    if (row === undefined || row <= 0 || col === undefined) return;

                    const rowData: Record<string, any> = {};
                    columns.forEach((column, idx) => {
                        rowData[column.key] = readCellValue(sheet, row as number, idx);
                    });
                    onCellSelect(row as number, col as number, rowData);
                } catch (e) {
                    console.warn('[Luckysheet] Error notificando selección de celda:', e);
                }
            };

            try {
                ls.create({
                    container: containerId,
                    data: initialData,
                    lang: 'es',
                    showinfobar: false,
                    // Ocultar la barra de estadísticas inferior (Suma, Promedio, etc.)
                    // La dejamos en true porque el usuario puede necesitarla
                    showstatisticBar: true,
                    sheetFormulaBar: true,
                    // NOTA: allowEdit no se pasa aquí. Luckysheet 2.x no respeta
                    // este parámetro de forma consistente. El control de edición
                    // se maneja a nivel de servidor (can_edit) y de UX (botón Bloquear).
                    ...options,

                    /**
                     * afterChange — se dispara cuando el usuario confirma el valor
                     * de una celda (Enter, Tab, clic fuera).
                     * Firma: (r: fila, c: columna, v: objeto valor nuevo)
                     */
                    afterChange: (r: number, c: number, v: any) => {
                        captureSheetsData();

                        // Notificar la selección de celda
                        if (onCellSelect) {
                            notifySelection(r, c);
                        }

                        options?.afterChange?.(r, c, v);
                    },

                    /**
                     * updateCell — hook alternativo para fórmulas y ediciones
                     * programáticas que a veces no disparan afterChange.
                     */
                    updated: (operate: any) => {
                        captureSheetsData();
                        options?.updated?.(operate);
                    },
                });

                const containerEl = document.getElementById(containerId);
                if (containerEl) {
                    const handleSelectionEvent = () => {
                        if (!onCellSelect) return;
                        setTimeout(() => {
                            notifySelection();
                        }, 0);
                    };
                    containerEl.addEventListener('mouseup', handleSelectionEvent);
                    containerEl.addEventListener('keyup', handleSelectionEvent);
                    selectionCleanupRef.current = () => {
                        containerEl.removeEventListener('mouseup', handleSelectionEvent);
                        containerEl.removeEventListener('keyup', handleSelectionEvent);
                    };
                }
            } catch (err) {
                console.error('[Luckysheet] Error en luckysheet.create():', err);
            }
        }, 300);

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            if (selectionCleanupRef.current) {
                selectionCleanupRef.current();
                selectionCleanupRef.current = null;
            }
            isInitialized.current = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scriptState]);

    // ── Render ────────────────────────────────────────────────────────────────

    if (scriptState === 'error') {
        return (
            <div
                style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                className="rounded border border-red-300 bg-red-50 text-sm text-red-600">
                <div className="text-center p-4">
                    <p className="font-semibold">Error al cargar Luckysheet</p>
                    <p className="mt-1 text-xs text-red-500">
                        Ejecuta en la raíz del proyecto:
                    </p>
                    <pre className="mt-2 rounded bg-red-100 p-2 text-left text-xs text-red-700">
                        {`New-Item -ItemType Directory -Force -Path public/luckysheet/css
                        Copy-Item node_modules/luckysheet/dist/luckysheet.umd.js public/luckysheet/ -Force
                        Copy-Item node_modules/luckysheet/dist/css/luckysheet.css public/luckysheet/css/ -Force`}
                    </pre>
                </div>
            </div>
        );
    }

    if (scriptState !== 'ready') {
        return (
            <div
                style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                className="rounded border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
                <div className="flex items-center gap-2 text-sm text-gray-400">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
                    Cargando hoja de cálculo…
                </div>
            </div>
        );
    }

    // Cuando el script está listo, renderizamos el div contenedor.
    // Luckysheet lo llenará con su UI completa.
    return (
        <div
            id={containerId}
            style={{
                width: '100%',
                height:'100%',
                position: 'relative',
                overflow: 'hidden',
                // CRÍTICO: Sin un fondo explícito, el tema oscuro de la app
                // puede hacer que el grid de Luckysheet sea invisible (texto blanco
                // sobre fondo blanco o viceversa). Luckysheet maneja su propio tema.
                background: '#ffffff',
            }}
            className="luckysheet-container"
        />
    );
};

export default Luckysheet;
