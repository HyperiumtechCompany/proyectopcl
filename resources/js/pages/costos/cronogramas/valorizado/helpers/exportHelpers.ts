import ExcelJS from 'exceljs';

// TIPOS INTERNOS
type ViewMode = 'monto' | 'porcentaje';

interface ExportarExcelOptions {
    totalPresupuesto?: number;
    diasPorMes?: Record<string, number>;
    totalDias?: number;
    codigoProyecto?: string;
    ubicacion?: string;
    projectData?: any;
    projectId?: number | string;
    costoProjectId?: number | string;
    finDefaults?: {
        pctGastosGenerales?: number;
        pctUtilidad?: number;
        pctIGV?: number;
        montoMobiliario?: number;
        pctIGVMobiliario?: number;
        pctSupervision?: number;
    };
}

// HELPERS DE FORMATO
const fmtN = (v: number) => (v ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nivel = (item: string) => (item?.split('.').length ?? 1) - 1;

// PALETA DE COLORES 
const C = {
    // Cabecera principal
    headerBg: 'FF1F4E79', // slate-950
    headerFg: 'FFFFFFFF',
    // Cabecera parcial
    parcialBg: 'FF5B9BD5', // azul oscuro
    parcialFg: 'FFFFFFFF',
    // Total (col derecha)
    totalBg: 'FF70AD47', // emerald-950
    totalFg: 'FFFFFFFF',
    // Mes pico
    picoBg: 'FFFFC000', // amber-700
    picoFg: 'FF3A3A3A',
    // Niveles de ítem
    nivel0Bg: 'FFD9EAF7', nivel0Fg: 'FF1F4E79',   // slate-800
    nivel1Bg: 'FFEAF4DD', nivel1Fg: 'FF375623',   // slate-200
    nivel2Bg: 'FFF2F2F2', nivel2Fg: 'FF404040',   // slate-100
    nivel3Bg: 'FFFFFFFF', nivel3Fg: 'FF404040',
    leafBg: 'FFFFFFFF', leafFg: 'FF1E293B',
    // Footer filas
    footer1Bg: 'FF5B9BD5', footer1Fg: 'FFFFFFFF',  // Valorización mensual
    footer2Bg: 'FF808080', footer2Fg: 'FFFFFFFF',  // % mensual
    footer3Bg: 'FF70AD47', footer3Fg: 'FFFFFFFF',  // Val. acumulada
    footer4Bg: 'FF44546A', footer4Fg: 'FFFFFFFF',  // % acumulado
    // Celda datos
    dataBg: 'FFFFFFFF', dataFg: 'FF808080',
    altRowBg: 'FFF7FBFF',
    // Resumen superior
    resumeBg: 'FF5B9BD5',
};

// HELPER: aplicar fill sólido
function fill(cell: ExcelJS.Cell, argb: string) {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function style(
    cell: ExcelJS.Cell,
    opts: {
        bg?: string; fg?: string; bold?: boolean; size?: number;
        hAlign?: ExcelJS.Alignment['horizontal'];
        vAlign?: ExcelJS.Alignment['vertical'];
        wrapText?: boolean; italic?: boolean; border?: boolean;
        numFmt?: string; indent?: number;
    },
) {
    if (opts.bg) fill(cell, opts.bg);
    if (opts.fg || opts.bold || opts.size || opts.italic) {
        cell.font = {
            name: 'Arial',
            color: opts.fg ? { argb: opts.fg } : undefined,
            bold: opts.bold ?? false,
            size: opts.size ?? 9,
            italic: opts.italic ?? false,
        };
    }
    cell.alignment = {
        horizontal: opts.hAlign ?? 'left',
        vertical: opts.vAlign ?? 'middle',
        wrapText: opts.wrapText ?? false,
        indent: opts.indent,
    };
    if (opts.numFmt) cell.numFmt = opts.numFmt;
    if (opts.border) {
        const b: ExcelJS.Border = { style: 'thin', color: { argb: 'FFD1D5DB' } };
        cell.border = { top: b, left: b, bottom: b, right: b };
    }
}

function borderAll(cell: ExcelJS.Cell, color = 'FFD1D5DB') {
    const b: ExcelJS.Border = { style: 'thin', color: { argb: color } };
    cell.border = { top: b, left: b, bottom: b, right: b };
}
function getFechaFormatoModelo(): string {
    const meses = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
    const hoy = new Date();
    return `${meses[hoy.getMonth()]} ${hoy.getFullYear()}`;
}

function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}



// ENCABEZADO 
const EXCEL_START_COL = 3;
const xcol = (logicalCol: number): number => EXCEL_START_COL + logicalCol - 1;
const xlast = (logicalTotalCols: number): number => xcol(logicalTotalCols);

const fontX = (opts: Partial<ExcelJS.Font>): Partial<ExcelJS.Font> => ({
    name: 'Calibri', size: 11, ...opts,
});
const fillX = (argb: string): ExcelJS.Fill => ({
    type: 'pattern', pattern: 'solid', fgColor: { argb },
});
const borderX = (color = 'FFCBD5E1', styleBorder: ExcelJS.BorderStyle = 'thin'): Partial<ExcelJS.Borders> => ({
    top: { style: styleBorder, color: { argb: color } },
    bottom: { style: styleBorder, color: { argb: color } },
    left: { style: styleBorder, color: { argb: color } },
    right: { style: styleBorder, color: { argb: color } },
});
const alignX = (
    horizontal: ExcelJS.Alignment['horizontal'] = 'center',
    vertical: ExcelJS.Alignment['vertical'] = 'middle',
    wrap = false,
): Partial<ExcelJS.Alignment> => ({ horizontal, vertical, wrapText: wrap });

const getProjectNombre = (projectData: any, fallback = '-') =>
    (projectData?.nombre || projectData?.name || fallback || '-').toString().toUpperCase();

const getCodigoModular = (projectData: any): string => {
    try {
        const raw = projectData?.codigos_modulares ?? projectData?.codigo_modular;
        if (!raw) return '-';
        const modulares = typeof raw === 'string' ? JSON.parse(raw) : raw;
        const partes: string[] = [];
        if (modulares?.inicial) partes.push(modulares.inicial);
        if (modulares?.primaria) partes.push(modulares.primaria);
        if (modulares?.secundaria) partes.push(modulares.secundaria);
        return partes.length ? partes.join('-') : String(raw);
    } catch {
        return projectData?.codigos_modulares || projectData?.codigo_modular || '-';
    }
};

const getUbicacionProyecto = (projectData: any, fallback = '-') => {
    const partes = [
        projectData?.departamento,
        projectData?.provincia,
        projectData?.distrito,
    ].filter(Boolean);
    return partes.length ? partes.join(' - ').toUpperCase() : fallback;
};

const calcularDuracionProyecto = (projectData: any, totalDias?: number): string => {
    if (totalDias && totalDias > 0) return `${totalDias} DÍAS CALENDARIO`;
    try {
        if (!projectData?.fecha_inicio || !projectData?.fecha_fin) return '-';
        const ini = new Date(projectData.fecha_inicio);
        const fin = new Date(projectData.fecha_fin);
        const dias = Math.round((fin.getTime() - ini.getTime()) / (1000 * 60 * 60 * 24));
        return dias > 0 ? `${dias} DÍAS CALENDARIO` : '-';
    } catch { return '-'; }
};

// NOMBRE CORTO Y PROFESIONAL PARA EXCEL/PDF
// Ejemplo: CV_CUI_2468101_2026-06-03.xlsx
function buildExportFileName(
    prefix: string,
    projectName: string,
    projectData: any,
    options: ExportarExcelOptions,
    extension: 'xlsx' | 'pdf',
): string {
    const limpiar = (value: any) => String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_-]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '')
        .substring(0, 42);

    const fecha = new Date().toISOString().slice(0, 10);
    const codigo = limpiar(
        projectData?.codigo_cui
        || projectData?.cui
        || projectData?.codigo_local
        || options?.codigoProyecto
        || options?.projectId
        || options?.costoProjectId
        || '',
    );

    const base = codigo
        ? `CUI_${codigo}`
        : limpiar(projectName || projectData?.nombre || 'PROYECTO');

    return `${prefix}_${base}_${fecha}.${extension}`;
}

async function fetchProjectImage(relativePath?: string): Promise<{ buffer: ArrayBuffer; extension: 'png' | 'jpeg' | 'gif' | 'bmp' } | null> {
    try {
        if (!relativePath) return null;
        const rawPath = String(relativePath).trim();
        if (!rawPath) return null;

        const lower = rawPath.toLowerCase();
        const extension: 'png' | 'jpeg' | 'gif' | 'bmp' =
            lower.endsWith('.jpg') || lower.endsWith('.jpeg') ? 'jpeg' :
                lower.endsWith('.gif') ? 'gif' :
                    lower.endsWith('.bmp') ? 'bmp' : 'png';

        const apiUrl = (import.meta as any).env?.VITE_API_URL || (window as any).__API_URL__ || '';
        const appUrl = (import.meta as any).env?.VITE_APP_URL || (window as any).__APP_URL__ || '';
        const apiStorage = apiUrl ? `${String(apiUrl).replace(/\/api\/?$/, '').replace(/\/$/, '')}/storage` : '';
        const appStorage = appUrl ? `${String(appUrl).replace(/\/$/, '')}/storage` : '';

        const bases = [

            (window as any).__PROYECTAPCL_STORAGE_URL__,
            (window as any).__STORAGE_URL__,
            (import.meta as any).env?.VITE_PROYECTAPCL_STORAGE_URL,
            (import.meta as any).env?.VITE_STORAGE_URL,
            apiStorage,
            appStorage,
            // Fallbacks comunes en Laravel local.
            'http://127.0.0.1:8000/storage',
            'http://localhost:8000/storage',
            '/storage',
        ].filter(Boolean) as string[];

        const urls = rawPath.startsWith('http')
            ? [rawPath]
            : bases.map(base => `${String(base).replace(/\/$/, '')}/${rawPath.replace(/^\//, '')}`);

        for (const url of urls) {
            try {
                const res = await fetch(url);
                if (!res.ok) continue;
                const buffer = await res.arrayBuffer();
                return { buffer, extension };
            } catch { /* probar siguiente URL */ }
        }
        return null;
    } catch { return null; }
}

function safeJsonParseProject(value: any): any {
    try {
        if (!value) return {};
        if (typeof value === 'string') return JSON.parse(value);
        return value;
    } catch { return {}; }
}

function looksLikeCostoProject(obj: any, projectName = ''): boolean {
    if (!obj || typeof obj !== 'object') return false;
    const hasProjectFields = !!(
        obj.plantilla_logo_izq || obj.plantilla_logo_der ||
        obj.codigo_cui || obj.codigo_local || obj.codigos_modulares ||
        obj.unidad_ejecutora || obj.fecha_inicio || obj.fecha_fin
    );
    if (!hasProjectFields) return false;
    if (!projectName || !obj.nombre) return true;
    const a = String(obj.nombre).toUpperCase().replace(/\s+/g, ' ').trim();
    const b = String(projectName).toUpperCase().replace(/\s+/g, ' ').trim();
    return a === b || a.includes(b.slice(0, 40)) || b.includes(a.slice(0, 40));
}

function findCostoProjectDeep(value: any, projectName = '', depth = 0): any {
    if (!value || depth > 4) return {};
    if (typeof value === 'string') {
        try { return findCostoProjectDeep(JSON.parse(value), projectName, depth + 1); } catch { return {}; }
    }
    if (Array.isArray(value)) {
        for (const item of value) {
            const found = findCostoProjectDeep(item, projectName, depth + 1);
            if (looksLikeCostoProject(found, projectName)) return found;
        }
        return {};
    }
    if (typeof value === 'object') {
        if (looksLikeCostoProject(value, projectName)) return value;
        const priorityKeys = ['projectData', 'project', 'costoProject', 'costo_project', 'proyecto', 'currentProject', 'data'];
        for (const k of priorityKeys) {
            if (k in value) {
                const found = findCostoProjectDeep(value[k], projectName, depth + 1);
                if (looksLikeCostoProject(found, projectName)) return found;
            }
        }
        for (const k of Object.keys(value)) {
            const found = findCostoProjectDeep(value[k], projectName, depth + 1);
            if (looksLikeCostoProject(found, projectName)) return found;
        }
    }
    return {};
}

function findProjectInBrowserStorage(projectName: string): any {
    const keys = [
        'costo_project', 'costoProject', 'costoProjectData', 'projectData', 'currentProject',
        'proyecto', 'proyectoActual', 'selectedProject', 'project', 'pcl_project', 'proyecta_project',
    ];

    for (const storage of [localStorage, sessionStorage]) {
        for (const key of keys) {
            try {
                const found = findCostoProjectDeep(storage.getItem(key), projectName);
                if (looksLikeCostoProject(found, projectName)) return found;
            } catch { /* continuar */ }
        }


        try {
            for (let i = 0; i < storage.length; i++) {
                const key = storage.key(i);
                if (!key) continue;
                const found = findCostoProjectDeep(storage.getItem(key), projectName);
                if (looksLikeCostoProject(found, projectName)) return found;
            }
        } catch { /* continuar */ }
    }
    return {};
}

async function resolveProjectDataForExport(options: ExportarExcelOptions, projectName: string): Promise<any> {

    const optAny: any = options || {};

    const fromOptions = findCostoProjectDeep({
        projectData: optAny.projectData,
        project: optAny.project,
        costoProject: optAny.costoProject,
        costo_project: optAny.costo_project,
        proyecto: optAny.proyecto,
        data: optAny.data,
        direct: optAny,
    }, projectName);

    const w: any = window as any;
    const fromWindow = findCostoProjectDeep({
        __COSTO_PROJECT__: w.__COSTO_PROJECT__,
        __PROJECT_DATA__: w.__PROJECT_DATA__,
        __PROYECTO_ACTUAL__: w.__PROYECTO_ACTUAL__,
        __CURRENT_PROJECT__: w.__CURRENT_PROJECT__,
        projectData: w.projectData,
        currentProject: w.currentProject,
        costoProject: w.costoProject,
        proyectoActual: w.proyectoActual,
    }, projectName);

    const fromStorage = findProjectInBrowserStorage(projectName);

    const pd: any = {
        nombre: projectName,
        ...fromStorage,
        ...fromWindow,
        ...fromOptions,
    };

    // Compatibilidad con nombres alternativos.
    pd.plantilla_logo_izq = pd.plantilla_logo_izq || pd.logo_izq || pd.logoIzquierdo || pd.logo_izquierdo || pd.logo_institucion || pd.logo_entidad;
    pd.plantilla_logo_der = pd.plantilla_logo_der || pd.logo_der || pd.logoDerecho || pd.logo_derecho || pd.logo_municipalidad || pd.logo_gobierno;

    // Debug útil en consola: 
    console.log('[Valorizado export] projectData resuelto:', {
        nombre: pd.nombre,
        codigo_cui: pd.codigo_cui,
        codigo_local: pd.codigo_local,

    });


    pd.plantilla_logo_izq_url = pd.plantilla_logo_izq || pd.logo_izq || '';
    pd.plantilla_logo_der_url = pd.plantilla_logo_der || pd.logo_der || '';

    return pd;
}

function projectImageUrl(relativePath?: string): string {
    if (!relativePath) return '';
    const rawPath = String(relativePath).trim();
    if (!rawPath) return '';
    if (rawPath.startsWith('http')) return rawPath;
    const apiUrl = (import.meta as any).env?.VITE_API_URL || (window as any).__API_URL__ || '';
    const appUrl = (import.meta as any).env?.VITE_APP_URL || (window as any).__APP_URL__ || '';
    const base = (window as any).__PROYECTAPCL_STORAGE_URL__
        || (window as any).__STORAGE_URL__
        || (import.meta as any).env?.VITE_PROYECTAPCL_STORAGE_URL
        || (import.meta as any).env?.VITE_STORAGE_URL
        || (apiUrl ? `${String(apiUrl).replace(/\/api\/?$/, '').replace(/\/$/, '')}/storage` : '')
        || (appUrl ? `${String(appUrl).replace(/\/$/, '')}/storage` : '')
        || 'http://127.0.0.1:8000/storage';
    return `${String(base).replace(/\/$/, '')}/${rawPath.replace(/^\//, '')}`;
}

function putProjectImage(
    ws: ExcelJS.Worksheet,
    imgData: { buffer: ArrayBuffer; extension: string },
    colIni: number,
    rowIni: number,
    colFin: number,
    rowFin: number,
): void {
    const imgId = ws.workbook.addImage({
        buffer: new Uint8Array(imgData.buffer) as any,
        extension: imgData.extension as any,
    });
    ws.addImage(imgId, {
        tl: { col: colIni - 1, row: rowIni - 1 } as any,
        br: { col: colFin - 1, row: rowFin - 1 } as any,
        editAs: 'oneCell',
    });
}


// ─── ENCABEZADO ──────────────────────────────────────────────────────────────
async function buildHeader(
    workbook: ExcelJS.Workbook,
    ws: ExcelJS.Worksheet,
    projectName: string,
    proyecto: any,
    totalColumnas: number,
    tituloPersonalizado: string = 'RESUMEN DE PRESUPUESTO'
): Promise<number> {

    const logoIzq = proyecto?.plantilla_logo_izq_url || proyecto?.plantilla_logo_izq;
    const logoDer = proyecto?.plantilla_logo_der_url || proyecto?.plantilla_logo_der;

    const modular = proyecto?.codigos_modulares || '-';
    const codigoLocal = proyecto?.codigo_local || '-';
    const cui = proyecto?.codigo_cui || '-';
    const unidadEjecutora = proyecto?.unidad_ejecutora || '-';
    const propietario = proyecto?.propietario || unidadEjecutora || '-';
    const nombreProyecto = projectName || 'PROYECTO';

    let filaActual = 1;

    // ── Configurar anchos ──
    const colInicio = xcol(1);
    const colFin = xcol(totalColumnas);

    ws.getColumn(colInicio).width = 9;
    ws.getColumn(colInicio + 1).width = 9;
    if (totalColumnas > 2) {
        ws.getColumn(colFin - 1).width = 9;
        ws.getColumn(colFin).width = 9;
    }

    // ── Altura de filas ──
    for (let r = filaActual; r <= filaActual + 3; r++) {
        ws.getRow(r).height = 22;
    }

    const f1 = filaActual;

    // ── Logo izquierdo ──
    if (totalColumnas >= 2) {
        ws.mergeCells(f1, colInicio, f1 + 3, colInicio + 1);
        const cell = ws.getCell(f1, colInicio);
        cell.value = '';
        cell.border = {
            top: { style: 'medium' },
            bottom: { style: 'medium' },
            left: { style: 'medium' },
            right: { style: 'thin' },
        };
    }

    // ── Texto central ──
    if (totalColumnas >= 3) {
        const colCentralInicio = colInicio + 2;
        const colCentralFin = colFin - 2;
        ws.mergeCells(f1, colCentralInicio, f1 + 3, colCentralFin);
        const cell = ws.getCell(f1, colCentralInicio);
        cell.value = {
            richText: [
                { font: { bold: true, size: 11, name: 'Calibri' }, text: `"${nombreProyecto.toUpperCase()}"\n` },
                { font: { bold: false, size: 9, name: 'Calibri' }, text: `CUI: ${cui}; CÓDIGO MODULAR: ${modular}; CÓDIGO LOCAL: ${codigoLocal}\n` },
                { font: { bold: false, size: 9, name: 'Calibri' }, text: `I.E. ${nombreProyecto}; UNIDAD EJECUTORA: ${unidadEjecutora}` },
            ],
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = {
            top: { style: 'medium' },
            bottom: { style: 'medium' },
            left: { style: 'thin' },
            right: { style: 'thin' },
        };
    }

    // ── Logo derecho ──
    if (totalColumnas >= 2) {
        ws.mergeCells(f1, colFin - 1, f1 + 3, colFin);
        const cell = ws.getCell(f1, colFin - 1);
        cell.value = '';
        cell.border = {
            top: { style: 'medium' },
            bottom: { style: 'medium' },
            left: { style: 'thin' },
            right: { style: 'medium' },
        };
    }

    // ── Agregar logo izquierdo ──
    if (logoIzq && typeof logoIzq === 'string' && logoIzq.trim() !== '') {
        try {
            if (logoIzq.startsWith('data:image')) {
                const base64Data = logoIzq.split(',')[1];
                const imgId = workbook.addImage({ base64: base64Data, extension: 'png' });
                ws.addImage(imgId, {
                    tl: { col: colInicio - 1 + 0.15, row: f1 - 1 + 0.15 } as any,
                    br: { col: colInicio - 1 + 1.85, row: f1 - 1 + 3.85 } as any,
                    editAs: 'oneCell',
                } as any);
            } else {
                const url = logoIzq.startsWith('http') ? logoIzq : `/storage/${logoIzq.replace(/^\//, '')}`;
                const response = await fetch(url);
                if (response.ok) {
                    const blob = await response.blob();
                    const base64 = await blobToBase64(blob);
                    const ext = detectImageExt(logoIzq, blob);
                    const imgId = workbook.addImage({ base64, extension: ext });
                    ws.addImage(imgId, {
                        tl: { col: colInicio - 1 + 0.15, row: f1 - 1 + 0.15 } as any,
                        br: { col: colInicio - 1 + 1.85, row: f1 - 1 + 3.85 } as any,
                        editAs: 'oneCell',
                    } as any);
                }
            }
        } catch (e) {
            console.error('Error al agregar logo izq:', e);
        }
    }

    // ── Agregar logo derecho ── (SOLO UNA VEZ)
    if (logoDer && typeof logoDer === 'string' && logoDer.trim() !== '') {
        try {
            if (logoDer.startsWith('data:image')) {
                const base64Data = logoDer.split(',')[1];
                const imgId = workbook.addImage({ base64: base64Data, extension: 'png' });
                ws.addImage(imgId, {
                    tl: { col: colFin - 1 - 1 + 0.15, row: f1 - 1 + 0.15 } as any,
                    br: { col: colFin - 1 + 0.85, row: f1 - 1 + 3.85 } as any,
                    editAs: 'oneCell',
                } as any);
            } else {
                const url = logoDer.startsWith('http') ? logoDer : `/storage/${logoDer.replace(/^\//, '')}`;
                const response = await fetch(url);
                if (response.ok) {
                    const blob = await response.blob();
                    const base64 = await blobToBase64(blob);
                    const ext = detectImageExt(logoDer, blob);
                    const imgId = workbook.addImage({ base64, extension: ext });
                    ws.addImage(imgId, {
                        tl: { col: colFin - 1 - 1 + 0.15, row: f1 - 1 + 0.15 } as any,
                        br: { col: colFin - 1 + 0.85, row: f1 - 1 + 3.85 } as any,
                        editAs: 'oneCell',
                    } as any);
                }
            }
        } catch (e) {
            console.error('Error al agregar logo der:', e);
        }
    }

    filaActual = f1 + 4;
    filaActual++;


    // ── Título ──
    ws.mergeCells(filaActual, colInicio, filaActual, colFin);
    const cellTitulo = ws.getCell(filaActual, colInicio);
    cellTitulo.value = tituloPersonalizado;
    cellTitulo.font = { bold: true, size: 11, name: 'Calibri', color: { argb: 'FF1A3C5E' } };
    cellTitulo.alignment = { horizontal: 'center', vertical: 'middle' };
    cellTitulo.border = {
        top: { style: 'medium' },
        bottom: { style: 'medium' },
        left: { style: 'medium' },
        right: { style: 'medium' },
    };
    ws.getRow(filaActual).height = 24;
    filaActual++;
    filaActual++;

    // ═══════════════════════════════════════════════════════════════════════
    // DATOS DEL PROYECTO - UN SOLO BLOQUE FUSIONADO
    // ═══════════════════════════════════════════════════════════════════════
    const fechaFormateada = getFechaFormatoModelo();
    const inicioFila = filaActual;

    const lineasContenido: string[] = [];

    const datosProyecto = [
        ['Proyecto', nombreProyecto],
        ['Propietario', propietario],
        ['Fecha', fechaFormateada],
        ['Módulo', proyecto?.modulo || 'GENERAL'],
    ];

    for (const [label, value] of datosProyecto) {
        lineasContenido.push(`${label} : ${value}`);
    }

    lineasContenido.push(`Hecho por : ${proyecto?.hechoPor || ''}          Revisado por : ${proyecto?.revisadoPor || ''}`);

    const totalLineas = lineasContenido.length;
    const filaFin = inicioFila + totalLineas - 1;

    // ✅ UN SOLO MERGE de todo el bloque (colInicio a colFin)
    ws.mergeCells(inicioFila, colInicio, filaFin, colFin);

    const cellBloque = ws.getCell(inicioFila, colInicio);
    let textoCompleto = '';
    for (const linea of lineasContenido) {
        textoCompleto += linea + '\n';
    }
    cellBloque.value = textoCompleto.trimEnd();
    cellBloque.font = { size: 9, name: 'Calibri' };
    cellBloque.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };


    cellBloque.border = {
        top: { style: 'medium', color: { argb: 'FF000000' } },
        bottom: { style: 'medium', color: { argb: 'FF000000' } },
        left: { style: 'medium', color: { argb: 'FF000000' } },
        right: { style: 'medium', color: { argb: 'FF000000' } },
    };

    filaActual = filaFin + 1;
    filaActual++;
    ws.getRow(filaActual).height = 5;
    filaActual++;
    return filaActual;
}

interface FilaDesembolso {
    key: string;
    label: string;
    dias: number;
    diasAcumulados: number;
    adelantoEfectivo: number;
    adelantoMateriales: number;
    totalAdelanto: number;
    valorizacion: number;
    pctAvance: number;
    desembolsoMensual: number;
    desembolsoAcumulado: number;
    pctDesembolso: number;
}

interface DesembolsoData {
    totalPresupuesto: number;
    totalDias: number;
    adelantoDirecto: number;
    adelantoMateriales: number;
    adelantoTotal: number;
    flujoTotal: number;
    totalValorizacion: number;
    maxDesembolso: number;
    filas: FilaDesembolso[];
    curva: Array<{ label: string; acumulado: number; pct: number }>;
}

function buildDesembolsoData(periodos: any[], totales: any, options: ExportarExcelOptions): DesembolsoData {
    const totalPresupuesto: number = options.totalPresupuesto
        ?? (Object.values(totales as Record<string, any>).reduce((s: number, t: any) => s + (t.monto ?? 0), 0) as number);
    const diasPorMes = options.diasPorMes ?? {};
    const totalDias = options.totalDias ?? Object.values(diasPorMes).reduce((s, d) => s + (Number(d) || 0), 0);
    const adelantoDirecto = totalPresupuesto * 0.10;
    const adelantoMateriales = totalPresupuesto * 0.20;
    const adelantoTotal = adelantoDirecto + adelantoMateriales;
    const flujoTotal = totalPresupuesto + adelantoTotal;
    const totalDiasProyecto = totalDias || 1;

    let acumulado = adelantoTotal;
    let diasAcumulados = 0;
    const filas = periodos.map((p: any): FilaDesembolso => {
        const dias = diasPorMes[p.key] ?? 0;
        diasAcumulados += dias;
        const valorizacion = totales[p.key]?.monto ?? 0;
        const pctAvance = totales[p.key]?.porcentaje ?? 0;
        const factor = totalDiasProyecto > 0 ? dias / totalDiasProyecto : 0;
        const adelantoEfectivo = adelantoDirecto * factor;
        const adelantoMat = adelantoMateriales * factor;
        const totalAdelanto = adelantoEfectivo + adelantoMat;
        const desembolsoMensual = totalAdelanto + valorizacion;
        acumulado += desembolsoMensual;

        return {
            key: p.key,
            label: p.labelCal ?? p.label,
            dias,
            diasAcumulados,
            adelantoEfectivo,
            adelantoMateriales: adelantoMat,
            totalAdelanto,
            valorizacion,
            pctAvance,
            desembolsoMensual,
            desembolsoAcumulado: acumulado,
            pctDesembolso: flujoTotal > 0 ? acumulado / flujoTotal : 0,
        };
    });

    const lastPct = filas[filas.length - 1]?.pctDesembolso || 1;
    const lastAcum = filas[filas.length - 1]?.desembolsoAcumulado || flujoTotal || 1;
    const curva = filas.map((f, i) => ({
        label: f.label,
        acumulado: i === filas.length - 1 ? flujoTotal : f.desembolsoAcumulado * (flujoTotal / lastAcum),
        pct: i === filas.length - 1 ? 100 : f.pctDesembolso * (100 / lastPct),
    }));

    return {
        totalPresupuesto,
        totalDias,
        adelantoDirecto,
        adelantoMateriales,
        adelantoTotal,
        flujoTotal,
        totalValorizacion: filas.reduce((s, f) => s + f.valorizacion, 0),
        maxDesembolso: Math.max(...filas.map(f => f.desembolsoMensual), 1),
        filas,
        curva,
    };
}

async function addCronogramaDesembolsosSheet(
    wb: ExcelJS.Workbook,
    periodos: any[],
    totales: any,
    projectName: string,
    options: ExportarExcelOptions,
): Promise<void> {
    const data = buildDesembolsoData(periodos, totales, options);
    if (!data.filas.length) return;

    const ws = wb.addWorksheet('Desembolso', {
        pageSetup: {
            paperSize: 9,
            orientation: 'landscape',
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            margins: { left: 0.35, right: 0.35, top: 0.45, bottom: 0.45, header: 0.2, footer: 0.2 },
        },
        views: [{ state: 'normal', showGridLines: true, zoomScale: 100 }],
        properties: { tabColor: { argb: 'FFFFD966' } },
    });

    ws.getColumn(1).width = 3;
    const widths = [17, 19, 19, 17, 20, 16, 20, 18];
    widths.forEach((w, i) => ws.getColumn(xcol(i + 1)).width = w);

    const pd = await resolveProjectDataForExport(options, projectName);
    let r = await buildHeader(wb, ws, projectName, pd, 8, 'CRONOGRAMA DE DESEMBOLSOS');

    // Resumen ejecutivo corto
    const info: Array<[string, string | number]> = [
        ['PRESUPUESTO DE OBRA', data.totalPresupuesto],
        ['ADELANTO DIRECTO 10%', data.adelantoDirecto],
        ['ADELANTO MATERIALES 20%', data.adelantoMateriales],
        ['ADELANTO TOTAL 30%', data.adelantoTotal],
        ['FLUJO TOTAL', data.flujoTotal],
    ];
    for (let i = 0; i < info.length; i++) {
        const col = xcol(i + 1);
        const cell = ws.getCell(r, col);
        cell.value = info[i][0];
        style(cell, { bg: 'FFDCEBFA', fg: 'FF1F2937', bold: true, size: 8, hAlign: 'center', vAlign: 'middle', wrapText: true });
        borderAll(cell, 'FF9CA3AF');
        const val = ws.getCell(r + 1, col);
        val.value = info[i][1] as any;
        style(val, { bg: 'FFF5FAFF', fg: 'FF111827', bold: true, size: 9, hAlign: 'center', vAlign: 'middle', numFmt: typeof info[i][1] === 'number' ? '"S/. "#,##0.00' : undefined });
        borderAll(val, 'FFB6C0CC');
    }
    ws.getRow(r).height = 22;
    ws.getRow(r + 1).height = 22;
    r += 3;

    // Grupos superiores
    ws.mergeCells(r, xcol(2), r, xcol(4));
    ws.getCell(r, xcol(2)).value = 'ADELANTOS';
    ws.mergeCells(r, xcol(5), r, xcol(6));
    ws.getCell(r, xcol(5)).value = 'VALORIZACIÓN';
    ws.mergeCells(r, xcol(7), r, xcol(8));
    ws.getCell(r, xcol(7)).value = 'DESEMBOLSOS INC/IGV';
    [1, 2, 5, 7].forEach(lc => {
        const cell = ws.getCell(r, xcol(lc));
        style(cell, { bg: 'FFDCEBFA', fg: 'FF111827', bold: true, size: 8, hAlign: 'center', vAlign: 'middle' });
        borderAll(cell, 'FF000000');
    });
    r++;

    const headers = [
        'CALENDARIO', 'EFECTIVO\n10%', 'MATERIALES\n20%', 'TOTAL\n(1 + 2)',
        'PARCIAL\nPRESUPUESTO', '%\nAVANCE', 'MONTO\nDESEMBOLSO', '% DE\nDESEMBOLSO',
    ];
    headers.forEach((h, i) => {
        const cell = ws.getCell(r, xcol(i + 1));
        cell.value = h;
        style(cell, { bg: 'FFDCEBFA', fg: 'FF000000', bold: true, size: 10, hAlign: 'center', vAlign: 'middle', wrapText: true });
        borderAll(cell, 'FF000000');
    });
    ws.getRow(r).height = 31;
    r++;

    const paintRow = (values: any[], bg = 'FFFFFFFF', bold = false) => {
        values.forEach((value, i) => {
            const cell = ws.getCell(r, xcol(i + 1));
            cell.value = value as any;
            const isPct = i === 5 || i === 7;
            style(cell, {
                bg,
                fg: 'FF000000',
                bold,
                size: 11,
                hAlign: i === 0 ? 'center' : 'right',
                vAlign: 'middle',
                numFmt: isPct ? '0.00%' : i > 0 ? '#,##0.00' : undefined,
            });
            borderAll(cell, 'FF000000');
        });
        r++;
    };

    paintRow([
        0, data.adelantoDirecto, data.adelantoMateriales, data.adelantoTotal,
        null, null, data.adelantoTotal, data.flujoTotal > 0 ? data.adelantoTotal / data.flujoTotal : 0,
    ]);

    data.filas.forEach(f => paintRow([
        f.diasAcumulados,
        f.adelantoEfectivo,
        f.adelantoMateriales,
        f.totalAdelanto,
        f.valorizacion,
        f.pctAvance / 100,
        f.desembolsoMensual,
        f.pctDesembolso,
    ]));

    paintRow(['PARCIAL', null, null, null, data.totalValorizacion, 1, data.totalValorizacion, 1], 'FFDDEBF7', true);
    r++;

    [
        ['TOTAL PRESUPUESTO DE OBRA', data.totalPresupuesto],
        ['Adelanto Directo 10% del Monto del contrato', data.adelantoDirecto],
        ['Adelanto Materiales 20% del Monto del contrato', data.adelantoMateriales],
    ].forEach(([label, value]) => {
        ws.mergeCells(r, xcol(1), r, xcol(3));
        ws.getCell(r, xcol(1)).value = label as string;
        style(ws.getCell(r, xcol(1)), { bg: 'FFFFFFFF', fg: 'FF000000', bold: true, size: 8, hAlign: 'left', vAlign: 'middle' });
        ws.getCell(r, xcol(4)).value = value as number;
        style(ws.getCell(r, xcol(4)), { bg: 'FFFFFFFF', fg: 'FF000000', size: 8, hAlign: 'right', vAlign: 'middle', numFmt: '#,##0.00' });
        r++;
    });

    r++;
    ws.mergeCells(r, xcol(1), r, xcol(8));
    ws.getCell(r, xcol(1)).value = '* Porcentajes máximos de Adelantos según Artículo 155 del Reglamento de la Ley de Contrataciones del Estado.';
    style(ws.getCell(r, xcol(1)), { bg: 'FFFFFFFF', fg: 'FF000000', bold: true, size: 8, hAlign: 'left', vAlign: 'middle' });
    r++;
    ws.mergeCells(r, xcol(1), r, xcol(8));
    ws.getCell(r, xcol(1)).value = 'Las Bases establecerán el otorgamiento y el porcentaje final de dichos adelantos.';
    style(ws.getCell(r, xcol(1)), { bg: 'FFFFFFFF', fg: 'FF000000', bold: true, size: 8, hAlign: 'left', vAlign: 'middle' });
}

function escapeXml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function svgToPngDataUrl(svg: string, width: number, height: number): Promise<string> {
    return new Promise((resolve, reject) => {
        const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                URL.revokeObjectURL(url);
                reject(new Error('No se pudo crear canvas para el grafico.'));
                return;
            }
            ctx.fillStyle = '#F7F9FC';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('No se pudo convertir el grafico SVG a PNG.'));
        };
        img.src = url;
    });
}

function buildGaussSvg(data: DesembolsoData): { svg: string; width: number; height: number } {
    const width = 1320;
    const height = 640;
    const ml = 145;
    const mr = 60;
    const mt = 145;
    const mb = 140;
    const cw = width - ml - mr;
    const ch = height - mt - mb;
    const dx = 16;
    const dy = -8;
    const max = data.maxDesembolso || 1;
    const n = Math.max(data.filas.length, 1);
    const slot = cw / n;
    const gap = Math.max(12, slot * 0.18);
    const bw = Math.max(36, slot - gap);
    const ticks = [0, 0.25, 0.5, 0.75, 1];

    const bars = data.filas.map((d, i) => {
        const isPeak = d.desembolsoMensual === max;
        const h = (d.desembolsoMensual / max) * ch;
        const x = ml + i * slot + gap / 2;
        const y = mt + ch - h;
        const bottom = mt + ch;
        const front = isPeak ? 'url(#gPeak)' : 'url(#gNormal)';
        const top = isPeak ? '#FFE38A' : '#7DAED8';
        const side = isPeak ? '#A86200' : '#154E8C';

        return `
            <g filter="url(#shadow)">
                <path d="M ${x + bw} ${y} L ${x + bw + dx} ${y + dy} L ${x + bw + dx} ${bottom + dy} L ${x + bw} ${bottom} Z" fill="${side}" opacity="0.92"/>
                <path d="M ${x} ${y} L ${x + bw} ${y} L ${x + bw + dx} ${y + dy} L ${x + dx} ${y + dy} Z" fill="${top}"/>
                <rect x="${x}" y="${y}" width="${bw}" height="${h}" fill="${front}"/>
                ${isPeak ? `<rect x="${x + bw / 2 - 20}" y="${y - 25}" width="40" height="18" rx="4" fill="#D4820A"/><text x="${x + bw / 2}" y="${y - 12}" text-anchor="middle" font-size="10" font-weight="800" fill="#fff">PICO</text>` : ''}
                <text x="${x + bw / 2}" y="${bottom + 20}" text-anchor="middle" font-size="11" font-weight="800" fill="#1E3A5F">${d.dias}</text>
                <text x="${x + bw / 2}" y="${bottom + 39}" text-anchor="middle" font-size="10" fill="#425C7A">${escapeXml(d.label)}</text>
            </g>`;
    }).join('');

    const grid = ticks.map(t => {
        const y = mt + ch - (t * ch);
        return `<line x1="${ml}" y1="${y}" x2="${ml + cw + dx}" y2="${y}" stroke="${t === 0 ? '#9DC3E6' : '#DDEAF5'}" stroke-width="${t === 0 ? 1.6 : 1}" stroke-dasharray="${t === 0 ? 'none' : '7 5'}"/>
            <text x="${ml - 12}" y="${y + 4}" text-anchor="end" font-size="11" fill="#2B4A6F">S/${fmtN(max * t)}</text>`;
    }).join('');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <defs>
            <linearGradient id="gNormal" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#5B9BD5"/><stop offset="100%" stop-color="#1E5BB5"/></linearGradient>
            <linearGradient id="gPeak" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#FFC844"/><stop offset="100%" stop-color="#D4820A"/></linearGradient>
            <filter id="shadow"><feDropShadow dx="4" dy="6" stdDeviation="4" flood-color="#1E3A5F" flood-opacity="0.22"/></filter>
        </defs>
        <rect width="100%" height="100%" fill="#F7F9FC"/>
        <text x="22" y="38" font-size="16" font-weight="900" letter-spacing="2" fill="#1E3A5F">GAUSS DE DESEMBOLSOS MENSUALES</text>
        <text x="22" y="61" font-size="11" fill="#425C7A">Desembolso mensual (Adelantos + Valorizacion).</text>
        ${grid}
        <line x1="${ml}" y1="${mt}" x2="${ml}" y2="${mt + ch}" stroke="#9DC3E6" stroke-width="1.5"/>
        <line x1="${ml}" y1="${mt + ch}" x2="${ml + cw + dx}" y2="${mt + ch}" stroke="#9DC3E6" stroke-width="1.8"/>
        ${bars}
        <text transform="translate(34 ${mt + ch / 2}) rotate(-90)" text-anchor="middle" font-size="13" font-weight="800" letter-spacing="2" fill="#2B4A6F">MONTO DESEMBOLSO (S/)</text>
        <rect x="22" y="${height - 52}" width="14" height="12" fill="url(#gNormal)" rx="2"/><text x="44" y="${height - 42}" font-size="11" fill="#425C7A">Desembolso Mensual</text>
        <rect x="160" y="${height - 52}" width="14" height="12" fill="url(#gPeak)" rx="2"/><text x="182" y="${height - 42}" font-size="11" fill="#425C7A">Mes Pico</text>
        <line x1="0" y1="${height - 20}" x2="${width}" y2="${height - 20}" stroke="#9DC3E6"/>
        <text x="20" y="${height - 7}" font-size="10" font-style="italic" fill="#425C7A">* Porcentajes maximos de Adelanto segun Articulo 155 del Reglamento de la Ley de Contrataciones del Estado.</text>
        <text x="${width - 20}" y="${height - 7}" font-size="10" text-anchor="end" fill="#94A3B8">Proyecta PCL - Modulo Financiero</text>
    </svg>`;

    return { svg, width, height };
}

function buildCurvaSvg(data: DesembolsoData): { svg: string; width: number; height: number } {
    const width = 1320;
    const height = 640;
    const ml = 118;
    const mr = 80;
    const mt = 145;
    const mb = 110;
    const cw = width - ml - mr;
    const ch = height - mt - mb;
    const n = Math.max(data.curva.length, 1);
    const step = cw / Math.max(n - 1, 1);
    const xy = (i: number, pct: number) => ({ x: ml + i * step, y: mt + ch - (pct / 100) * ch });
    const pts = data.curva.map((d, i) => xy(i, d.pct));
    let path = pts.length ? `M ${pts[0].x} ${pts[0].y}` : '';
    for (let i = 1; i < pts.length; i++) {
        const p = pts[i - 1];
        const c = pts[i];
        const cx = (p.x + c.x) / 2;
        path += ` C ${cx} ${p.y} ${cx} ${c.y} ${c.x} ${c.y}`;
    }
    const area = pts.length ? `${path} L ${pts[pts.length - 1].x} ${mt + ch} L ${pts[0].x} ${mt + ch} Z` : '';
    const grid = [0, 25, 50, 75, 100].map(t => {
        const y = mt + ch - (t / 100) * ch;
        return `<line x1="${ml}" y1="${y}" x2="${ml + cw}" y2="${y}" stroke="${t === 0 ? '#9DC3E6' : '#DDEAF5'}" stroke-width="${t === 0 ? 1.6 : 1}" stroke-dasharray="${t === 0 ? 'none' : '7 5'}"/>
            <text x="${ml - 12}" y="${y + 4}" text-anchor="end" font-size="12" fill="#2B4A6F">${t}%</text>`;
    }).join('');
    const points = data.curva.map((d, i) => {
        const p = xy(i, d.pct);
        return `<line x1="${p.x}" y1="${mt}" x2="${p.x}" y2="${mt + ch}" stroke="#E7F0F8"/>
            <circle cx="${p.x}" cy="${p.y}" r="7" fill="#fff" stroke="#1E3A5F" stroke-width="3"/>
            <text x="${p.x}" y="${p.y - 18}" text-anchor="middle" font-size="12" font-weight="900" fill="#1E5BB5">${d.pct.toFixed(1)}%</text>
            <text x="${p.x}" y="${mt + ch + 26}" text-anchor="middle" font-size="11" fill="#2B4A6F">${escapeXml(d.label)}</text>`;
    }).join('');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <defs>
            <linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#5B9BD5" stop-opacity="0.35"/><stop offset="100%" stop-color="#5B9BD5" stop-opacity="0.03"/></linearGradient>
            <filter id="lineShadow"><feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="#1E3A5F" flood-opacity="0.35"/></filter>
        </defs>
        <rect width="100%" height="100%" fill="#F7F9FC"/>
        <text x="16" y="38" font-size="16" font-weight="900" letter-spacing="2" fill="#1E3A5F">CURVA S - DESEMBOLSO ACUMULADO (%)</text>
        <text x="16" y="62" font-size="11" fill="#425C7A">Progresion acumulada sobre el flujo total.</text>
        ${grid}
        <line x1="${ml}" y1="${mt}" x2="${ml}" y2="${mt + ch}" stroke="#9DC3E6" stroke-width="1.8"/>
        <line x1="${ml}" y1="${mt + ch}" x2="${ml + cw}" y2="${mt + ch}" stroke="#9DC3E6" stroke-width="1.8"/>
        <path d="${area}" fill="url(#area)"/>
        <path d="${path}" fill="none" stroke="#7DAED8" stroke-width="9" opacity="0.35" stroke-linecap="round"/>
        <path d="${path}" fill="none" stroke="#1E3A5F" stroke-width="4" filter="url(#lineShadow)" stroke-linecap="round"/>
        ${points}
        <text transform="translate(32 ${mt + ch / 2}) rotate(-90)" text-anchor="middle" font-size="13" font-weight="800" letter-spacing="2" fill="#2B4A6F">% DESEMBOLSO ACUMULADO</text>
    </svg>`;

    return { svg, width, height };
}

async function addChartImageSheet(
    wb: ExcelJS.Workbook,
    name: string,
    chart: { svg: string; width: number; height: number },
    data: DesembolsoData,
    projectName: string,
    options: ExportarExcelOptions,
    tabColor: string,
    type: 'gauss' | 'curva',
): Promise<void> {
    const ws = wb.addWorksheet(name, {
        properties: { tabColor: { argb: tabColor } },
        pageSetup: {
            orientation: 'landscape',
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 1,
            paperSize: 9,
            margins: { left: 0.35, right: 0.35, top: 0.45, bottom: 0.45, header: 0.2, footer: 0.2 },
        },
        views: [{ state: 'normal', showGridLines: false, zoomScale: 100 }],
    });

    ws.getColumn(1).width = 3;
    for (let c = 2; c <= 14; c++) ws.getColumn(c).width = 14;
    for (let r = 1; r <= 55; r++) ws.getRow(r).height = 18;

    const pdChart = await resolveProjectDataForExport(options, projectName);
    await buildHeader(
        wb,
        ws,
        projectName,
        pdChart,
        13,
        `CRONOGRAMA VALORIZADO - ${name.toUpperCase()}`
    );

    const png = await svgToPngDataUrl(chart.svg, chart.width, chart.height);
    const imageId = wb.addImage({ base64: png, extension: 'png' });
    // DESPUÉS
    ws.addImage(imageId, {  
        tl: { col: xcol(1) - 1, row: 4 },
        ext: { width: 1188, height: 576 },
        editAs: 'oneCell',
    });

    let r = 39;
    const headers = type === 'gauss'
        ? ['PERÍODO', 'DÍAS', 'ADELANTO', 'VALORIZACIÓN', 'DESEMBOLSO', '% DESEMBOLSO', 'DESCRIPCIÓN']
        : ['PERÍODO', 'ACUMULADO S/.', '% ACUMULADO', 'DESCRIPCIÓN'];

    headers.forEach((h, i) => {
        const cell = ws.getCell(r, 2 + i);
        cell.value = h;
        style(cell, { bg: 'FFDCEBFA', fg: 'FF1F2937', bold: true, size: 8, hAlign: 'center', vAlign: 'middle', wrapText: true });
        borderAll(cell, 'FF9CA3AF');
    });
    r++;

    if (type === 'gauss') {
        data.filas.forEach(f => {
            const values = [
                f.label,
                f.dias,
                f.totalAdelanto,
                f.valorizacion,
                f.desembolsoMensual,
                f.pctDesembolso,
                `Desembolso mensual de ${f.label}`,
            ];
            values.forEach((v, i) => {
                const cell = ws.getCell(r, 2 + i);
                cell.value = v as any;
                style(cell, {
                    bg: r % 2 === 0 ? 'FFFFFFFF' : 'FFF7FBFF',
                    fg: 'FF111827',
                    size: 8,
                    hAlign: i === 0 || i === 6 ? 'left' : 'right',
                    vAlign: 'middle',
                    wrapText: i === 6,
                    numFmt: i >= 2 && i <= 4 ? '"S/. "#,##0.00' : i === 5 ? '0.00%' : undefined,
                });
                borderAll(cell, 'FFB6C0CC');
                cell.note = {
                    texts: [
                        { text: `PERÍODO: ${f.label}\n` },
                        { text: `Días: ${f.dias}\n` },
                        { text: `Adelanto: S/. ${fmtN(f.totalAdelanto)}\n` },
                        { text: `Valorización: S/. ${fmtN(f.valorizacion)}\n` },
                        { text: `Desembolso: S/. ${fmtN(f.desembolsoMensual)}\n` },
                        { text: `% Desembolso: ${(f.pctDesembolso * 100).toFixed(2)}%` },
                    ],
                } as any;
            });
            r++;
        });
    } else {
        data.curva.forEach(f => {
            const values = [f.label, f.acumulado, f.pct / 100, `Curva S acumulada de ${f.label}`];
            values.forEach((v, i) => {
                const cell = ws.getCell(r, 2 + i);
                cell.value = v as any;
                style(cell, {
                    bg: r % 2 === 0 ? 'FFFFFFFF' : 'FFF7FBFF',
                    fg: 'FF111827',
                    size: 8,
                    hAlign: i === 0 || i === 3 ? 'left' : 'right',
                    vAlign: 'middle',
                    wrapText: i === 3,
                    numFmt: i === 1 ? '"S/. "#,##0.00' : i === 2 ? '0.00%' : undefined,
                });
                borderAll(cell, 'FFB6C0CC');
                cell.note = {
                    texts: [
                        { text: `PERÍODO: ${f.label}\n` },
                        { text: `Acumulado: S/. ${fmtN(f.acumulado)}\n` },
                        { text: `% Acumulado: ${f.pct.toFixed(2)}%` },
                    ],
                } as any;
            });
            r++;
        });
    }
}

function addFilasFinancierasValorizado(
    ws: ExcelJS.Worksheet,
    startRow: number,
    periodos: any[],
    totales: any,
    totalPresupuesto: number,
    options: ExportarExcelOptions,
    mesPicoKey: string,
    fixedCols: number,
    totalCol: number,
): number {
    const fin = {
        pctGastosGenerales: options.finDefaults?.pctGastosGenerales ?? 11.56,
        pctUtilidad: options.finDefaults?.pctUtilidad ?? 5.00,
        pctIGV: options.finDefaults?.pctIGV ?? 18.00,
        montoMobiliario: options.finDefaults?.montoMobiliario ?? 0,
        pctIGVMobiliario: options.finDefaults?.pctIGVMobiliario ?? 18.00,
        pctSupervision: options.finDefaults?.pctSupervision ?? 5.13,
    };

    const costoDirecto = totalPresupuesto || periodos.reduce((s, p) => s + (totales[p.key]?.monto ?? 0), 0);
    const cdPorPeriodo: Record<string, number> = {};
    periodos.forEach(p => { cdPorPeriodo[p.key] = totales[p.key]?.monto ?? 0; });
    const cdTotalReal = Object.values(cdPorPeriodo).reduce((a, b) => a + b, 0);

    const propDist = (total: number): Record<string, number> => {
        const r: Record<string, number> = {};
        periodos.forEach(p => {
            r[p.key] = cdTotalReal > 0 ? total * ((cdPorPeriodo[p.key] ?? 0) / cdTotalReal) : 0;
        });
        return r;
    };

    const montoGG = costoDirecto * (fin.pctGastosGenerales / 100);
    const montoUT = costoDirecto * (fin.pctUtilidad / 100);
    const subTotal = costoDirecto + montoGG + montoUT;
    const montoIGV = subTotal * (fin.pctIGV / 100);
    const presupI = subTotal + montoIGV;
    const montoIGVMob = fin.montoMobiliario * (fin.pctIGVMobiliario / 100);
    const subTotalII = fin.montoMobiliario + montoIGVMob;
    const totalI_II = presupI + subTotalII;
    const montoSup = presupI * (fin.pctSupervision / 100);
    const presupTotal = totalI_II + montoSup;

    const rows: Array<[string, number, Record<string, number>]> = [
        [`GASTOS GENERALES ${fin.pctGastosGenerales.toFixed(2)}%`, montoGG, propDist(montoGG)],
        [`UTILIDAD ${fin.pctUtilidad.toFixed(2)}%`, montoUT, propDist(montoUT)],
        ['SUB TOTAL', subTotal, propDist(subTotal)],
        [`IGV ${fin.pctIGV.toFixed(2)}%`, montoIGV, propDist(montoIGV)],
        ['PRESUPUESTO I', presupI, propDist(presupI)],
        ['MOBILIARIO Y EQUIPAMIENTO', fin.montoMobiliario, propDist(fin.montoMobiliario)],
        [`IGV MOBILIARIO ${fin.pctIGVMobiliario.toFixed(2)}%`, montoIGVMob, propDist(montoIGVMob)],
        ['PRESUPUESTO I + II', totalI_II, propDist(totalI_II)],
        [`SUPERVISIÓN ${fin.pctSupervision.toFixed(2)}%`, montoSup, propDist(montoSup)],
    ];

    let r = startRow + 1;
    rows.forEach(([label, total, dist], idx) => {
        ws.getRow(r).height = 19;
        const labelCell = ws.getCell(r, 1);
        labelCell.value = label;
        ws.mergeCells(r, 1, r, fixedCols);
        style(labelCell, { bg: idx % 2 === 0 ? 'FFE5E7EB' : 'FFF3F4F6', fg: 'FF111827', bold: true, size: 8, hAlign: 'right', vAlign: 'middle' });
        borderAll(labelCell, 'FF6B7280');

        periodos.forEach((p, i) => {
            const cell = ws.getCell(r, fixedCols + 1 + i);
            cell.value = dist[p.key] || null;
            style(cell, { bg: p.key === mesPicoKey ? 'FFFFF0B8' : 'FFFFFFFF', fg: 'FF111827', bold: true, size: 8, hAlign: 'right', vAlign: 'middle', numFmt: '"S/. "#,##0.00' });
            borderAll(cell, 'FFB6C0CC');
        });

        const totalCell = ws.getCell(r, totalCol);
        totalCell.value = total || null;
        style(totalCell, { bg: 'FFE5E7EB', fg: 'FF111827', bold: true, size: 8, hAlign: 'right', vAlign: 'middle', numFmt: '"S/. "#,##0.00' });
        borderAll(totalCell, 'FF6B7280');
        r++;
    });

    ws.getRow(r).height = 22;
    const labelCell = ws.getCell(r, 1);
    labelCell.value = 'PRESUPUESTO TOTAL';
    ws.mergeCells(r, 1, r, fixedCols);
    style(labelCell, { bg: 'FF0F172A', fg: 'FFFFFFFF', bold: true, size: 10, hAlign: 'right', vAlign: 'middle' });
    borderAll(labelCell, 'FF0F172A');

    const distPresTotal = propDist(presupI + montoSup);
    periodos.forEach((p, i) => {
        const cell = ws.getCell(r, fixedCols + 1 + i);
        cell.value = distPresTotal[p.key] || null;
        style(cell, { bg: 'FF0F172A', fg: 'FFFFFFFF', bold: true, size: 9, hAlign: 'right', vAlign: 'middle', numFmt: '"S/. "#,##0.00' });
        borderAll(cell, 'FF0F172A');
    });

    const totalCell = ws.getCell(r, totalCol);
    totalCell.value = presupTotal;
    style(totalCell, { bg: 'FF0F172A', fg: 'FF34D399', bold: true, size: 10, hAlign: 'right', vAlign: 'middle', numFmt: '"S/. "#,##0.00' });
    borderAll(totalCell, 'FF0F172A');

    return r + 1;
}

// EXPORTAR EXCEL 
export async function exportarExcel(
    items: any[],
    periodos: any[],
    totales: any,
    projectName: string,
    viewMode: ViewMode,
    totalesPorItem: Record<string | number, number>,
    options: ExportarExcelOptions = {},
): Promise<void> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Proyecta PCL — Módulo Financiero';
    wb.lastModifiedBy = 'Proyecta PCL';
    wb.created = new Date();
    wb.modified = new Date();
    wb.calcProperties.fullCalcOnLoad = true;

    const pd = await resolveProjectDataForExport(options, projectName);
    const mesPicoKey = periodos.reduce((best: any, p: any) =>
        ((totales[p.key]?.monto ?? 0) > (totales[best?.key]?.monto ?? 0) ? p : best), periodos[0]
    )?.key;

    const FIXED = 8;
    const TOTAL_LOGICAL = FIXED + periodos.length + 1;
    const totalCol = xcol(TOTAL_LOGICAL);


    const ws = wb.addWorksheet('Cronograma Valorizado', {
        pageSetup: {
            paperSize: 9,
            orientation: 'landscape',
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            margins: { left: 0.35, right: 0.35, top: 0.45, bottom: 0.45, header: 0.2, footer: 0.2 },
        },
        views: [{ state: 'normal', showGridLines: false, zoomScale: 90 }],
        properties: { tabColor: { argb: 'FF1E3A5F' } },
        headerFooter: {
            oddHeader: `&L&B${getProjectNombre(pd, projectName)}&C&BCRONOGRAMA VALORIZADO&R&P de &N`,
            oddFooter: `&LGenerado: ${new Date().toLocaleString('es-PE')}&RProyecta PCL`,
        },
    });

    ws.getColumn(1).width = 3;
    [7, 13, 55, 9, 13, 15, 18, 11].forEach((w, i) => ws.getColumn(xcol(i + 1)).width = w);
    periodos.forEach((_, i) => ws.getColumn(xcol(FIXED + 1 + i)).width = 17);
    ws.getColumn(totalCol).width = 20;
    const firstRow = await buildHeader(wb, ws, projectName, pd, TOTAL_LOGICAL, 'CRONOGRAMA VALORIZADO')

    ws.getRow(firstRow).height = 24;
    ws.mergeCells(firstRow, xcol(1), firstRow, totalCol);
    const ley = ws.getCell(firstRow, xcol(1));
    ley.value = 'CRONOGRAMA VALORIZADO — DISTRIBUCIÓN MENSUAL, RESUMEN FINANCIERO Y AVANCE DE OBRA';
    ley.style = {
        font: fontX({ bold: true, size: 11, color: { argb: 'FF1F4E79' } }),
        fill: fillX('FFDCEBFA'),
        alignment: alignX('center', 'middle'),
        border: borderX('FF9DC3E6'),
    };

    const rowH1 = firstRow + 1;
    const rowH2 = firstRow + 2;
    ws.getRow(rowH1).height = 38;
    ws.getRow(rowH2).height = 34;

    const fixedHeaders = ['N°', 'ÍTEM', 'DESCRIPCIÓN', 'UND', 'METRADO', 'P.U. (S/.)', 'PARCIAL (S/.)', 'ACC.'];
    fixedHeaders.forEach((h, i) => {
        const col = xcol(i + 1);
        ws.mergeCells(rowH1, col, rowH2, col);
        const cell = ws.getCell(rowH1, col);
        cell.value = h;
        cell.style = {
            font: fontX({ bold: true, size: 11, color: { argb: 'FF000000' } }),
            fill: fillX(i === 6 ? 'FF5B9BD5' : 'FFDCEBFA'),
            alignment: alignX(i === 2 ? 'left' : 'center', 'middle', true),
            border: borderX('FF9DC3E6'),
        };
    });

    periodos.forEach((p, i) => {
        const col = xcol(FIXED + 1 + i);
        const isPico = p.key === mesPicoKey;
        const cell = ws.getCell(rowH1, col);
        cell.value = `${p.label ?? `MES ${i + 1}`}\n${p.labelCal ?? ''}`;
        ws.mergeCells(rowH1, col, rowH2, col);
        cell.style = {
            font: fontX({ bold: true, size: 11, color: { argb: 'FF000000' } }),
            fill: fillX(isPico ? 'FFFFC000' : 'FFDCEBFA'),
            alignment: alignX('center', 'middle', true),
            border: borderX(isPico ? 'FFD966' : 'FF9DC3E6'),
        };
    });

    const totalHeader = ws.getCell(rowH1, totalCol);
    totalHeader.value = 'TOTAL\nS/. acumulado';
    ws.mergeCells(rowH1, totalCol, rowH2, totalCol);
    totalHeader.style = {
        font: fontX({ bold: true, size: 9, color: { argb: 'FFFFFFFF' } }),
        fill: fillX('FF70AD47'),
        alignment: alignX('center', 'middle', true),
        border: borderX('FF065F46'),
    };

    let rowIdx = rowH2 + 1;

    const getItemTotal = (item: any): number => {
        const byId = totalesPorItem[item.id] ?? totalesPorItem[String(item.id)] ?? 0;
        if (byId) return byId;
        return periodos.reduce((s, p) => s + (item.distribucion?.[p.key]?.monto ?? 0), 0);
    };

    items.forEach((item: any, idx: number) => {
        const n = nivel(item.item || '');
        const isLeaf = item.is_leaf ?? true;
        const totalFila = getItemTotal(item);
        const row = ws.getRow(rowIdx);
        row.height = n === 0 ? 30 : 27;

        const isRoot = n === 0;
        const bg = isRoot ? 'FFDCEBFA' : (idx % 2 === 0 ? 'FFFFFFFF' : 'FFF5FAFF');
        const fg = 'FF000000';

        const set = (logicalCol: number, value: ExcelJS.CellValue, st: Partial<ExcelJS.Style>) => {
            const c = ws.getCell(rowIdx, xcol(logicalCol));
            c.value = value;
            c.style = st;
        };

        const bodyBase = (align: ExcelJS.Alignment['horizontal'] = 'center'): Partial<ExcelJS.Style> => ({
            font: fontX({ bold: isRoot, italic: !isRoot && isLeaf, size: 11, color: { argb: fg } }),
            fill: fillX(bg),
            alignment: alignX(align, 'middle', align === 'left'),
            border: borderX('FFCBD5E1'),
        });

        set(1, idx + 1, bodyBase('center'));
        set(2, item.item ?? '', { ...bodyBase('center'), font: fontX({ bold: true, size: 11, color: { argb: fg } }) });
        set(3, item.descripcion ?? item.description ?? '', { ...bodyBase('left'), alignment: { horizontal: 'left', vertical: 'middle', wrapText: true, indent: Math.min(n, 4) } });
        set(4, item.und ?? item.unidad ?? '', bodyBase('center'));
        set(5, item.metrado || null, { ...bodyBase('right'), numFmt: '#,##0.00' });
        set(6, item.precio || null, { ...bodyBase('right'), numFmt: '#,##0.00' });
        set(7, item.parcial || null, {
            font: fontX({ bold: true, size: 11, color: { argb: 'FF1D4ED8' } }),
            fill: fillX(isRoot ? 'FFD9EAF7' : 'FFEAF4FE'),
            alignment: alignX('right'),
            border: borderX('FFCBD5E1'),
            numFmt: '"S/. "#,##0.00',
        });
        set(8, isRoot ? '' : '⟳  ↗  ×', {
            font: fontX({ size: 9, color: { argb: 'FF64748B' } }),
            fill: fillX(isRoot ? 'FFD9EAF7' : 'FFF7FBFF'),
            alignment: alignX('center'),
            border: borderX('FFCBD5E1'),
        });

        periodos.forEach((p, pi) => {
            const monto = item.distribucion?.[p.key]?.monto ?? 0;
            const value = viewMode === 'porcentaje'
                ? (item.parcial > 0 ? (monto / item.parcial) * 100 : null)
                : (monto > 0 ? monto : null);
            const col = xcol(FIXED + 1 + pi);
            const c = ws.getCell(rowIdx, col);
            c.value = value as any;
            c.style = {
                font: fontX({ bold: true, size: 11, color: { argb: monto > 0 ? 'FF000000' : 'FF94A3B8' } }),
                fill: fillX(p.key === mesPicoKey ? 'FFFFF2CC' : bg),
                alignment: alignX('right'),
                border: borderX(p.key === mesPicoKey ? 'FFFFC000' : 'FFCBD5E1'),
                numFmt: viewMode === 'porcentaje' ? '0.0000"%"' : '#,##0.00',
            };
        });

        const tCell = ws.getCell(rowIdx, totalCol);
        tCell.value = totalFila || null;
        tCell.style = {
            font: fontX({ bold: true, size: 11, color: { argb: 'FF008000' } }),
            fill: fillX('FFECFDF5'),
            alignment: alignX('right'),
            border: borderX('FFA7F3D0'),
            numFmt: '"S/. "#,##0.00',
        };

        rowIdx++;
    });

    // Resumen financiero del presupuesto, calculado a partir de los totales por periodo y distribuyendo proporcionalmente según el costo directo real por periodo
    ws.getRow(rowIdx).height = 17;
    ws.mergeCells(rowIdx, xcol(1), rowIdx, totalCol);
    const secFin = ws.getCell(rowIdx, xcol(1));
    secFin.value = 'RESUMEN FINANCIERO DEL PRESUPUESTO';
    secFin.style = {
        font: fontX({ bold: true, size: 9, color: { argb: 'FF1F4E79' } }),
        fill: fillX('FFD9EAF7'),
        alignment: alignX('left'),
        border: borderX('FF9DC3E6'),
    };
    rowIdx++;

    const totalPresupuesto = options.totalPresupuesto
        ?? items.reduce((s, it) => s + (Number(it.parcial) || 0), 0)
        ?? periodos.reduce((s, p) => s + (totales[p.key]?.monto ?? 0), 0);
    const fin = {
        pctGastosGenerales: options.finDefaults?.pctGastosGenerales ?? 11.56,
        pctUtilidad: options.finDefaults?.pctUtilidad ?? 5.00,
        pctIGV: options.finDefaults?.pctIGV ?? 18.00,
        montoMobiliario: options.finDefaults?.montoMobiliario ?? 0,
        pctIGVMobiliario: options.finDefaults?.pctIGVMobiliario ?? 18.00,
        pctSupervision: options.finDefaults?.pctSupervision ?? 5.13,
    };
    const cdPorPeriodo: Record<string, number> = {};
    periodos.forEach(p => { cdPorPeriodo[p.key] = totales[p.key]?.monto ?? 0; });
    const cdTotalReal = Object.values(cdPorPeriodo).reduce((a, b) => a + b, 0);
    const propDist = (total: number): Record<string, number> => {
        const r: Record<string, number> = {};
        periodos.forEach(p => { r[p.key] = cdTotalReal > 0 ? total * ((cdPorPeriodo[p.key] ?? 0) / cdTotalReal) : 0; });
        return r;
    };
    const montoGG = totalPresupuesto * (fin.pctGastosGenerales / 100);
    const montoUT = totalPresupuesto * (fin.pctUtilidad / 100);
    const subTotal = totalPresupuesto + montoGG + montoUT;
    const montoIGV = subTotal * (fin.pctIGV / 100);
    const presupI = subTotal + montoIGV;
    const montoIGVMob = fin.montoMobiliario * (fin.pctIGVMobiliario / 100);
    const subTotalII = fin.montoMobiliario + montoIGVMob;
    const totalI_II = presupI + subTotalII;
    const montoSup = presupI * (fin.pctSupervision / 100);
    const presupTotal = totalI_II + montoSup;

    const finRows: Array<{ pct?: string; label: string; total: number; dark?: boolean; gray?: boolean }> = [
        { label: 'COSTO DIRECTO', total: totalPresupuesto, gray: true },
        { pct: `${fin.pctGastosGenerales.toFixed(2)}%`, label: 'GASTOS GENERALES', total: montoGG },
        { pct: `${fin.pctUtilidad.toFixed(2)}%`, label: 'UTILIDAD', total: montoUT },
        { label: 'SUB TOTAL', total: subTotal, gray: true },
        { pct: `${fin.pctIGV.toFixed(2)}%`, label: 'I.G.V.', total: montoIGV },
        { label: 'PRESUPUESTO DE OBRA INFRAESTRUCTURA COMPONENTE I', total: presupI, dark: true },
        { pct: 'monto', label: 'MOBILIARIO Y EQUIPAMIENTO COMPONENTE II', total: fin.montoMobiliario },
        { pct: `${fin.pctIGVMobiliario.toFixed(2)}%`, label: 'IGV (MOBILIARIO Y EQUIPAMIENTO)', total: montoIGVMob },
        { label: 'SUB TOTAL COMPONENTE II', total: subTotalII, gray: true },
        { label: 'TOTAL PRESUPUESTO DE OBRA COMPONENTE I+II', total: totalI_II, dark: true },
        { pct: `${fin.pctSupervision.toFixed(2)}%`, label: 'GASTOS DE SUPERVISIÓN Y LIQUIDACIÓN', total: montoSup },
        { label: 'PRESUPUESTO TOTAL', total: presupTotal, dark: true },
    ];

    finRows.forEach(fr => {
        const dist = propDist(fr.label.includes('COSTO DIRECTO') ? totalPresupuesto : fr.total);
        ws.getRow(rowIdx).height = fr.dark ? 24 : 22;
        const bg = fr.dark ? 'FF5B9BD5' : fr.gray ? 'FFDCEBFA' : 'FFFFFFFF';
        const fg = 'FF000000';

        ws.getCell(rowIdx, xcol(1)).value = fr.pct ?? '';
        ws.getCell(rowIdx, xcol(1)).style = { font: fontX({ italic: fr.pct === 'monto', size: 9, color: { argb: 'FF000000' } }), fill: fillX(bg), alignment: alignX('center'), border: borderX('FFCBD5E1') };

        ws.mergeCells(rowIdx, xcol(2), rowIdx, xcol(6));
        const l = ws.getCell(rowIdx, xcol(2));
        l.value = fr.label;
        l.style = { font: fontX({ bold: true, size: 11, color: { argb: fg } }), fill: fillX(bg), alignment: alignX('right'), border: borderX('FFCBD5E1') };

        const parcialCell = ws.getCell(rowIdx, xcol(7));
        parcialCell.value = fr.total || null;
        parcialCell.style = { font: fontX({ bold: true, size: 9, color: { argb: fr.dark && fr.label === 'PRESUPUESTO TOTAL' ? 'FF008000' : fg } }), fill: fillX(bg), alignment: alignX('right'), border: borderX('FFCBD5E1'), numFmt: '"S/. "#,##0.00' };
        ws.getCell(rowIdx, xcol(8)).style = { fill: fillX(bg), border: borderX('FFCBD5E1') };

        periodos.forEach((p, pi) => {
            const c = ws.getCell(rowIdx, xcol(FIXED + 1 + pi));
            c.value = dist[p.key] || null;
            c.style = { font: fontX({ bold: true, size: 11, color: { argb: fg } }), fill: fillX(p.key === mesPicoKey ? 'FFFFF2CC' : bg), alignment: alignX('right'), border: borderX(p.key === mesPicoKey ? 'FFFFC000' : 'FFCBD5E1'), numFmt: '#,##0.00' };
        });
        const t = ws.getCell(rowIdx, totalCol);
        t.value = fr.total || null;
        t.style = { font: fontX({ bold: true, size: 9, color: { argb: fr.dark && fr.label === 'PRESUPUESTO TOTAL' ? 'FF008000' : fg } }), fill: fillX(fr.dark ? 'FF5B9BD5' : 'FFECFDF5'), alignment: alignX('right'), border: borderX(fr.dark ? 'FF2F75B6' : 'FFA7F3D0'), numFmt: '"S/. "#,##0.00' };
        rowIdx++;
    });

    // Valorización y avance de obra
    ws.getRow(rowIdx).height = 17;
    ws.mergeCells(rowIdx, xcol(1), rowIdx, totalCol);
    const secVal = ws.getCell(rowIdx, xcol(1));
    secVal.value = 'VALORIZACIÓN Y AVANCE DE OBRA';
    secVal.style = { font: fontX({ bold: true, size: 9, color: { argb: 'FF1F4E79' } }), fill: fillX('FFD9EAF7'), alignment: alignX('left'), border: borderX('FF334155') };
    rowIdx++;

    const totalMensualGeneral = periodos.reduce((s, p) => s + (totales[p.key]?.monto ?? 0), 0);
    const lastKey = periodos.length ? periodos[periodos.length - 1].key : '';
    const footerRows = [
        { label: 'VALORIZACIÓN MENSUAL (S/.)', bg: 'FF5B9BD5', fg: 'FFFFFFFF', values: periodos.map(p => totales[p.key]?.monto ?? 0), total: totalMensualGeneral, fmt: '#,##0.00' },
        { label: '% AVANCE MENSUAL', bg: 'FFD9EAF7', fg: 'FF000000', values: periodos.map(p => totales[p.key]?.porcentaje ?? 0), total: null, fmt: '0.000"%"' },
        { label: 'DÍAS TRABAJADOS', bg: 'FFD9EAF7', fg: 'FF000000', values: periodos.map(p => options.diasPorMes?.[p.key] ?? null), total: null, fmt: '0' },
        { label: 'VALORIZACIÓN ACUMULADA (S/.)', bg: 'FF70AD47', fg: 'FFFFFFFF', values: periodos.map(p => totales[p.key]?.acumuladoMonto ?? 0), total: totales[lastKey]?.acumuladoMonto ?? totalMensualGeneral, fmt: '#,##0.00' },
        { label: '% AVANCE ACUMULADO (CURVA S)', bg: 'FFE2EFDA', fg: 'FF000000', values: periodos.map(p => totales[p.key]?.acumuladoPorcentaje ?? 0), total: 100, fmt: '0.00"%"' },
    ];

    footerRows.forEach(fr => {
        ws.getRow(rowIdx).height = 24;
        ws.mergeCells(rowIdx, xcol(1), rowIdx, xcol(FIXED));
        const l = ws.getCell(rowIdx, xcol(1));
        l.value = fr.label;
        l.style = { font: fontX({ bold: true, size: 9, color: { argb: fr.fg } }), fill: fillX(fr.bg), alignment: alignX('right'), border: borderX('FF9DC3E6'), numFmt: fr.fmt };
        fr.values.forEach((v, pi) => {
            const c = ws.getCell(rowIdx, xcol(FIXED + 1 + pi));
            c.value = v as any;
            c.style = { font: fontX({ bold: true, size: 9, color: { argb: fr.fg } }), fill: fillX(periodos[pi]?.key === mesPicoKey ? 'FFFFC000' : fr.bg), alignment: alignX('center'), border: borderX('FF9DC3E6'), numFmt: fr.fmt };
        });
        const t = ws.getCell(rowIdx, totalCol);
        t.value = fr.total as any;
        t.style = { font: fontX({ bold: true, size: 9, color: { argb: fr.fg } }), fill: fillX(fr.bg === 'FF5B9BD5' ? 'FF70AD47' : fr.bg), alignment: alignX('center'), border: borderX('FF9DC3E6'), numFmt: fr.fmt };
        rowIdx++;
    });

    ws.autoFilter = { from: { row: rowH1, column: xcol(1) }, to: { row: rowH2, column: totalCol } };

    // Hojas de desembolso y gráficos
    const desembolsoData = buildDesembolsoData(periodos, totales, options);
    await addCronogramaDesembolsosSheet(wb, periodos, totales, projectName, options);
    await addChartImageSheet(wb, 'Gauss', buildGaussSvg(desembolsoData), desembolsoData, projectName, options, 'FF5B9BD5', 'gauss');
    await addChartImageSheet(wb, 'Curva S', buildCurvaSvg(desembolsoData), desembolsoData, projectName, options, 'FF10B981', 'curva');

    const nombreExcel = buildExportFileName('CV', projectName, pd, options, 'xlsx');
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreExcel;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}


// EXPORTAR PDF — 4 HOJAS (Cronograma valorizado, Cronograma de desembolsos, Gráfico Gauss, Curva S)

export async function exportarPDF(
    items: any[],
    periodos: any[],
    totales: any,
    projectName: string,
    totalesPorItem: Record<string | number, number>,
    options: ExportarExcelOptions = {},
): Promise<void> {
    const pd = await resolveProjectDataForExport(options, projectName);
    const logoIzq = projectImageUrl(pd.plantilla_logo_izq || pd.logo_izq || pd.logoIzquierdo || '');
    const logoDer = projectImageUrl(pd.plantilla_logo_der || pd.logo_der || pd.logoDerecho || '');
    const dataDes = buildDesembolsoData(periodos, totales, options);
    const gauss = buildGaussSvg(dataDes);
    const curva = buildCurvaSvg(dataDes);

    const fmt = (v: number) => (v ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtS = (v: number) => `S/. ${fmt(v)}`;
    const esc = (v: any) => String(v ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] as string));
    const lastKey = periodos.length ? periodos[periodos.length - 1].key : '';
    const totalMensualGeneral = periodos.reduce((s, p) => s + (totales[p.key]?.monto ?? 0), 0);
    const mesPicoKey = periodos.reduce((best: any, p: any) =>
        ((totales[p.key]?.monto ?? 0) > (totales[best?.key]?.monto ?? 0) ? p : best), periodos[0]
    )?.key;

    const totalPresupuesto = options.totalPresupuesto
        ?? items.reduce((s, it) => s + (Number(it.parcial) || 0), 0)
        ?? totalMensualGeneral;
    const fin = {
        pctGastosGenerales: options.finDefaults?.pctGastosGenerales ?? 11.56,
        pctUtilidad: options.finDefaults?.pctUtilidad ?? 5.00,
        pctIGV: options.finDefaults?.pctIGV ?? 18.00,
        montoMobiliario: options.finDefaults?.montoMobiliario ?? 0,
        pctIGVMobiliario: options.finDefaults?.pctIGVMobiliario ?? 18.00,
        pctSupervision: options.finDefaults?.pctSupervision ?? 5.13,
    };
    const cdPorPeriodo: Record<string, number> = {};
    periodos.forEach(p => cdPorPeriodo[p.key] = totales[p.key]?.monto ?? 0);
    const cdTotalReal = Object.values(cdPorPeriodo).reduce((a, b) => a + b, 0);
    const propDist = (total: number) => {
        const r: Record<string, number> = {};
        periodos.forEach(p => r[p.key] = cdTotalReal > 0 ? total * ((cdPorPeriodo[p.key] ?? 0) / cdTotalReal) : 0);
        return r;
    };
    const montoGG = totalPresupuesto * (fin.pctGastosGenerales / 100);
    const montoUT = totalPresupuesto * (fin.pctUtilidad / 100);
    const subTotal = totalPresupuesto + montoGG + montoUT;
    const montoIGV = subTotal * (fin.pctIGV / 100);
    const presupI = subTotal + montoIGV;
    const montoIGVMob = fin.montoMobiliario * (fin.pctIGVMobiliario / 100);
    const subTotalII = fin.montoMobiliario + montoIGVMob;
    const totalI_II = presupI + subTotalII;
    const montoSup = presupI * (fin.pctSupervision / 100);
    const presupTotal = totalI_II + montoSup;

    const header = (titulo: string) => `
        <div class="report-header">
            <div class="logo-box">${logoIzq ? `<img src="${esc(logoIzq)}"/>` : ''}</div>
            <div class="head-center">
                <div class="head-title">${esc(titulo)}</div>
                <div class="head-name">"${esc(getProjectNombre(pd, projectName))}"</div>
                <div>CUI: ${esc(pd.codigo_cui || '-')}; &nbsp; CÓDIGO MODULAR: ${esc(getCodigoModular(pd))}; &nbsp; CÓDIGO LOCAL: ${esc(pd.codigo_local || '-')}</div>
                <div>I.E: ${esc((pd.nombre || projectName || '-').toString().split('-')[0])} &nbsp;&nbsp; UNIDAD EJECUTORA: ${esc((pd.unidad_ejecutora || '-').toString().toUpperCase())}</div>
                <div>UBICACIÓN: ${esc(getUbicacionProyecto(pd, '-'))}; &nbsp; PLAZO: ${esc(calcularDuracionProyecto(pd, options.totalDias))}</div>
            </div>
            <div class="logo-box">${logoDer ? `<img src="${esc(logoDer)}"/>` : ''}</div>
        </div>
        <div class="sep"></div>`;

    const periodHeaders = periodos.map(p => `<th class="th-month ${p.key === mesPicoKey ? 'pico' : ''}">${esc(p.label)}<br><small>${esc(p.labelCal || '')}</small></th>`).join('');
    const itemRows = items.map((it, i) => {
        const isRoot = nivel(it.item || '') === 0;
        const totalF = totalesPorItem[it.id] ?? totalesPorItem[String(it.id)] ?? periodos.reduce((s, p) => s + (it.distribucion?.[p.key]?.monto ?? 0), 0);
        const cls = isRoot ? 'root' : (i % 2 ? 'alt' : '');
        const monthCells = periodos.map(p => {
            const m = it.distribucion?.[p.key]?.monto ?? 0;
            return `<td class="num ${p.key === mesPicoKey ? 'pico-cell' : ''}">${m > 0 ? fmt(m) : ''}</td>`;
        }).join('');
        return `<tr class="${cls}">
            <td class="center">${i + 1}</td><td class="center bold">${esc(it.item)}</td><td class="desc">${esc(it.descripcion || it.description || '')}</td>
            <td class="center">${esc(it.und || it.unidad || '')}</td><td class="num">${it.metrado ? fmt(it.metrado) : ''}</td><td class="num">${it.precio ? fmt(it.precio) : ''}</td>
            <td class="num parcial">${it.parcial ? fmtS(it.parcial) : ''}</td><td class="center muted">${isRoot ? '' : '↗'}</td>${monthCells}<td class="num total">${totalF ? fmtS(totalF) : ''}</td>
        </tr>`;
    }).join('');

    const financialRows = [
        ['COSTO DIRECTO', '', totalPresupuesto, propDist(totalPresupuesto), 'normal'],
        ['GASTOS GENERALES', `${fin.pctGastosGenerales.toFixed(2)}%`, montoGG, propDist(montoGG), 'normal'],
        ['UTILIDAD', `${fin.pctUtilidad.toFixed(2)}%`, montoUT, propDist(montoUT), 'normal'],
        ['SUB TOTAL', '', subTotal, propDist(subTotal), 'sub'],
        ['I.G.V.', `${fin.pctIGV.toFixed(2)}%`, montoIGV, propDist(montoIGV), 'normal'],
        ['PRESUPUESTO DE OBRA INFRAESTRUCTURA COMPONENTE I', '', presupI, propDist(presupI), 'blue'],
        ['MOBILIARIO Y EQUIPAMIENTO COMPONENTE II', 'monto', fin.montoMobiliario, propDist(fin.montoMobiliario), 'normal'],
        ['IGV (MOBILIARIO Y EQUIPAMIENTO)', `${fin.pctIGVMobiliario.toFixed(2)}%`, montoIGVMob, propDist(montoIGVMob), 'normal'],
        ['SUB TOTAL COMPONENTE II', '', subTotalII, propDist(subTotalII), 'sub'],
        ['TOTAL PRESUPUESTO DE OBRA COMPONENTE I+II', '', totalI_II, propDist(totalI_II), 'blue'],
        ['GASTOS DE SUPERVISIÓN Y LIQUIDACIÓN', `${fin.pctSupervision.toFixed(2)}%`, montoSup, propDist(montoSup), 'normal'],
        ['PRESUPUESTO TOTAL', '', presupTotal, propDist(presupI + montoSup), 'final'],
    ].map(([label, pct, total, dist, kind]: any) => {
        const cells = periodos.map(p => `<td class="num ${p.key === mesPicoKey ? 'pico-cell' : ''}">${dist[p.key] ? fmt(dist[p.key]) : ''}</td>`).join('');
        return `<tr class="fin-${kind}"><td></td><td>${esc(pct)}</td><td colspan="4" class="desc bold">${esc(label)}</td><td class="num bold">${total ? fmtS(total) : ''}</td><td></td>${cells}<td class="num total">${total ? fmtS(total) : ''}</td></tr>`;
    }).join('');

    const footer = [
        ['VALORIZACIÓN MENSUAL (S/.)', 'footer-blue', periodos.map(p => totales[p.key]?.monto ?? 0), totalMensualGeneral, '#,##0.00'],
        ['% AVANCE MENSUAL', 'footer-light', periodos.map(p => totales[p.key]?.porcentaje ?? 0), null, 'pct'],
        ['DÍAS TRABAJADOS', 'footer-light', periodos.map(p => options.diasPorMes?.[p.key] ?? ''), null, 'int'],
        ['VALORIZACIÓN ACUMULADA (S/.)', 'footer-green', periodos.map(p => totales[p.key]?.acumuladoMonto ?? 0), totales[lastKey]?.acumuladoMonto ?? totalMensualGeneral, '#,##0.00'],
        ['% AVANCE ACUMULADO (CURVA S)', 'footer-green2', periodos.map(p => totales[p.key]?.acumuladoPorcentaje ?? 0), 100, 'pct'],
    ].map(([label, cls, vals, total, type]: any) => `<tr class="${cls}"><td colspan="8" class="right bold">${label}</td>${vals.map((v: any, i: number) => `<td class="num ${periodos[i]?.key === mesPicoKey ? 'pico-foot' : ''}">${type === 'pct' ? (v ? Number(v).toFixed(2) + '%' : '') : type === 'int' ? (v || '') : (v ? fmt(v) : '')}</td>`).join('')}<td class="num bold">${total ? (type === 'pct' ? Number(total).toFixed(2) + '%' : fmtS(total)) : ''}</td></tr>`).join('');

    const cronogramaTable = `<table class="main-table"><thead><tr><th>N°</th><th>ÍTEM</th><th class="desc">DESCRIPCIÓN</th><th>UND</th><th>METRADO</th><th>P.U. (S/.)</th><th class="parcial-h">PARCIAL (S/.)</th><th>ACC.</th>${periodHeaders}<th class="total-h">TOTAL<br><small>S/. acumulado</small></th></tr></thead><tbody>${itemRows}<tr class="section"><td colspan="${9 + periodos.length}">RESUMEN FINANCIERO DEL PRESUPUESTO</td></tr>${financialRows}<tr class="section"><td colspan="${9 + periodos.length}">VALORIZACIÓN Y AVANCE DE OBRA</td></tr>${footer}</tbody></table>`;

    const desembolsoRows = [`<tr><td>0</td><td class="num">${fmt(dataDes.adelantoDirecto)}</td><td class="num">${fmt(dataDes.adelantoMateriales)}</td><td class="num">${fmt(dataDes.adelantoTotal)}</td><td></td><td></td><td class="num">${fmt(dataDes.adelantoTotal)}</td><td class="num">${((dataDes.adelantoTotal / dataDes.flujoTotal) * 100).toFixed(2)}%</td></tr>`]
        .concat(dataDes.filas.map(f => `<tr><td>${f.diasAcumulados}</td><td class="num">${fmt(f.adelantoEfectivo)}</td><td class="num">${fmt(f.adelantoMateriales)}</td><td class="num">${fmt(f.totalAdelanto)}</td><td class="num">${fmt(f.valorizacion)}</td><td class="num">${f.pctAvance.toFixed(2)}%</td><td class="num">${fmt(f.desembolsoMensual)}</td><td class="num">${(f.pctDesembolso * 100).toFixed(2)}%</td></tr>`)).join('');
    const desembolsoTable = `<table class="des-table"><thead><tr><th>CALENDARIO</th><th>EFECTIVO 10%</th><th>MATERIALES 20%</th><th>TOTAL (1+2)</th><th>PARCIAL PRESUPUESTO</th><th>% AVANCE</th><th>MONTO DESEMBOLSO</th><th>% DE DESEMBOLSO</th></tr></thead><tbody>${desembolsoRows}<tr class="sub"><td>PARCIAL</td><td></td><td></td><td></td><td class="num">${fmt(dataDes.totalValorizacion)}</td><td class="num">100.00%</td><td class="num">${fmt(dataDes.totalValorizacion)}</td><td class="num">100.00%</td></tr></tbody></table>`;

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Cronograma Valorizado PDF</title><style>
    @page{size:A3 landscape;margin:7mm} *{box-sizing:border-box} body{font-family:Arial,Calibri,sans-serif;color:#000;margin:0;background:#fff}.page{page-break-after:always;padding:0}.report-header{display:grid;grid-template-columns:130px 1fr 130px;align-items:center;min-height:90px;border:2px solid #b0b0b0;background:#fff}.logo-box{height:86px;display:flex;align-items:center;justify-content:center}.logo-box img{max-width:120px;max-height:82px;object-fit:contain}.head-center{text-align:center;font-size:10px;font-weight:700;font-style:italic;line-height:1.35}.head-title{font-size:13px;font-weight:900}.head-name{font-size:11px;font-weight:900}.sep{height:5px;background:#64748b;margin-bottom:8px}.title-band{background:#dcebfa;border:1px solid #9dc3e6;color:#1f4e79;font-weight:900;text-align:center;padding:7px;font-size:12px;margin-bottom:8px}.main-table,.des-table{width:100%;border-collapse:collapse;font-size:10px}.main-table th,.main-table td,.des-table th,.des-table td{border:1px solid #9db7d1;padding:5px 6px;vertical-align:middle}.main-table th,.des-table th{background:#dcebfa;text-align:center;font-weight:900}.main-table td{height:24px}.desc{text-align:left!important;min-width:250px}.center{text-align:center}.right{text-align:right}.num{text-align:right;font-family:Calibri,monospace;font-weight:700}.bold{font-weight:900}.muted{color:#64748b}.alt td{background:#f5faff}.root td{background:#d9eaf7;font-weight:900}.parcial,.parcial-h{background:#5b9bd5!important;color:#000;font-weight:900}.total,.total-h{background:#e2f0d9!important;color:#008000;font-weight:900}.pico,.pico-cell,.pico-foot{background:#fff2cc!important;border-color:#ffc000!important}.section td,.section{background:#d9eaf7!important;color:#1f4e79;font-weight:900;text-align:left}.fin-sub td{background:#ddebf7;font-weight:900}.fin-blue td{background:#5b9bd5!important;color:#000;font-weight:900}.fin-final td{background:#1f4e79!important;color:#fff;font-weight:900}.fin-final .total{color:#00b050!important}.footer-blue td{background:#5b9bd5;color:#fff;font-weight:900}.footer-light td{background:#d9eaf7}.footer-green td{background:#70ad47;color:#fff;font-weight:900}.footer-green2 td{background:#e2efda;color:#000}.chart-wrap{border:1px solid #9dc3e6;background:#f7f9fc;padding:10px}.chart-wrap svg{width:100%;height:auto}.note{font-size:10px;margin-top:8px;color:#334155;font-weight:700}@media print{.page{page-break-after:always}}
    </style></head><body>
    <section class="page">${header('CRONOGRAMA DE EJECUCIÓN FÍSICO VALORIZADO')}<div class="title-band">CRONOGRAMA VALORIZADO — DISTRIBUCIÓN MENSUAL, RESUMEN FINANCIERO Y AVANCE DE OBRA</div>${cronogramaTable}</section>
    <section class="page">${header('CRONOGRAMA DE DESEMBOLSOS')}<div class="title-band">CRONOGRAMA DE DESEMBOLSOS</div>${desembolsoTable}<p class="note">* Porcentajes máximos de Adelantos según Artículo 155 del Reglamento de la Ley de Contrataciones del Estado.</p></section>
    <section class="page">${header('GAUSS DE DESEMBOLSOS MENSUALES')}<div class="chart-wrap">${gauss.svg}</div></section>
    <section class="page">${header('CURVA S — DESEMBOLSO ACUMULADO')}<div class="chart-wrap">${curva.svg}</div></section>
    <script>window.onload=()=>setTimeout(()=>window.print(),600)</script></body></html>`;

    const nombrePDF = buildExportFileName('CV', projectName, pd, options, 'pdf');
    const html2pdf = (window as any).html2pdf;
    if (html2pdf) {
        const cont = document.createElement('div');
        cont.innerHTML = html.replace(/<script[\s\S]*?<\/script>/gi, '');
        document.body.appendChild(cont);
        await html2pdf()
            .set({
                margin: 0,
                filename: nombrePDF,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, allowTaint: true, logging: false },
                jsPDF: { unit: 'mm', format: 'a3', orientation: 'landscape' },
                pagebreak: { mode: ['css', 'legacy'] },
            })
            .from(cont)
            .save();
        document.body.removeChild(cont);
        return;
    }

    const win = window.open('', '_blank', 'width=1600,height=1000,menubar=yes');
    if (win) { win.document.write(html); win.document.close(); }
}
function detectImageExt(url: string, blob: Blob): 'png' | 'jpeg' | 'gif' {
    if (blob.type === 'image/jpeg' || /\.jpe?g$/i.test(url)) return 'jpeg'
    if (blob.type === 'image/gif' || /\.gif$/i.test(url)) return 'gif'
    return 'png';
}


