// delphin/helpers/exportDelphinExcel.ts

import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import type { DelphinRow } from '../types';
import type { DelphinExportContent } from './exportDelphin';

// ─── ESPECIALIDADES ─────────────────────────────────────────────────────────────

function filterRowsBySpecialties(rows: DelphinRow[], selectedIds: string[]): DelphinRow[] {
    if (!selectedIds || selectedIds.length === 0) return rows;

    const parentIds = new Set(selectedIds.map(id => parseInt(id, 10)));

    if (parentIds.size === 0) return rows;

    const rowById = new Map(rows.map(r => [r.id, r]));
    const result: DelphinRow[] = [];

    rows.forEach(row => {
        if (row.nivel === 1 && parentIds.has(row.id)) {
            result.push(row);
            return;
        }
        let parentId = row.parent_id ?? null;
        while (parentId !== null) {
            if (parentIds.has(parentId)) {
                result.push(row);
                return;
            }
            parentId = rowById.get(parentId)?.parent_id ?? null;
        }
    });

    return result;
}

// ── Colores ARGB ──────────────────────────────────────────────────────────────
const C = {
    headerBg: 'FF1F4E79',
    headerFg: 'FFFFFFFF',
    titulo0Bg: 'FFD9EAF7',
    titulo0Fg: 'FF1F4E79',
    titulo1Bg: 'FFEAF4DD',
    titulo1Fg: 'FF375623',
    titulo2Bg: 'FFF2F2F2',
    titulo2Fg: 'FF404040',
    leafBg: 'FFFFFFFF',
    leafFg: 'FF1E293B',
    altBg: 'FFF5FAFF',
    totalBg: 'FF70AD47',
    totalFg: 'FFFFFFFF',
    ganttHdBg: 'FF1F4E79',
    ganttHdFg: 'FFFFFFFF',
    borde: 'FFCBD5E1',
};

function fill(cell: ExcelJS.Cell, argb: string) {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function font(cell: ExcelJS.Cell, argb: string, bold = false, size = 10) {
    cell.font = { color: { argb }, bold, size, name: 'Calibri' };
}

function border(cell: ExcelJS.Cell) {
    const s: ExcelJS.Border = { style: 'thin', color: { argb: C.borde } };
    cell.border = { top: s, bottom: s, left: s, right: s };
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

function detectImageExt(url: string, blob: Blob): 'png' | 'jpeg' | 'gif' {
    if (blob.type === 'image/jpeg' || url.match(/\.jpe?g$/i)) return 'jpeg';
    if (blob.type === 'image/gif' || url.match(/\.gif$/i)) return 'gif';
    return 'png';
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
    ws.getColumn(1).width = 6;
    ws.getColumn(2).width = 6;
    if (totalColumnas > 2) {
        ws.getColumn(totalColumnas - 1).width = 6;
        ws.getColumn(totalColumnas).width = 6;
    }

    // ── Altura de filas ──
    for (let r = filaActual; r <= filaActual + 3; r++) {
        ws.getRow(r).height = 22;
    }

    const f1 = filaActual;

    // ── Logo izquierdo ──
    if (totalColumnas >= 2) {
        ws.mergeCells(f1, 1, f1 + 3, 2);
        const cell = ws.getCell(f1, 1);
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
        ws.mergeCells(f1, 3, f1 + 3, totalColumnas - 2);
        const cell = ws.getCell(f1, 3);
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
        ws.mergeCells(f1, totalColumnas - 1, f1 + 3, totalColumnas);
        const cell = ws.getCell(f1, totalColumnas - 1);
        cell.value = '';
        cell.border = {
            top: { style: 'medium' },
            bottom: { style: 'medium' },
            left: { style: 'thin' },
            right: { style: 'medium' },
        };
    }

    // ── Agregar logo izquierdo ──
    console.log('🖼️ logoIzq recibido:', logoIzq);
    if (logoIzq && typeof logoIzq === 'string' && logoIzq.trim() !== '') {
        try {
            // Si es base64 (empieza con "data:image")
            if (logoIzq.startsWith('data:image')) {
                console.log('✅ Logo izq es base64');
                const base64Data = logoIzq.split(',')[1];
                const imgId = workbook.addImage({ base64: base64Data, extension: 'png' });
                ws.addImage(imgId, {
                    tl: { col: 0.15, row: f1 - 1 + 0.15 } as any,
                    br: { col: 1.85, row: f1 - 1 + 3.85 } as any,
                    editAs: 'oneCell',
                } as any);
                console.log('✅ Logo izq agregado desde base64');
            } else {
                // Es URL, hacer fetch
                console.log('🖼️ Logo izq es URL, haciendo fetch...');
                const url = logoIzq.startsWith('http') ? logoIzq : `/storage/${logoIzq.replace(/^\//, '')}`;
                console.log('🖼️ URL fetch:', url);
                const response = await fetch(url);
                console.log('🖼️ Respuesta:', response.status, response.ok);
                if (response.ok) {
                    const blob = await response.blob();
                    const base64 = await blobToBase64(blob);
                    const ext = detectImageExt(logoIzq, blob);
                    const imgId = workbook.addImage({ base64, extension: ext });
                    ws.addImage(imgId, {
                        tl: { col: 0.15, row: f1 - 1 + 0.15 } as any,
                        br: { col: 1.85, row: f1 - 1 + 3.85 } as any,
                        editAs: 'oneCell',
                    } as any);
                    console.log('✅ Logo izq agregado desde URL');
                } else {
                    console.log('❌ Error al cargar logo izq:', response.status);
                }
            }
        } catch (e) {
            console.error('❌ Error al agregar logo izq:', e);
        }
    } else {
        console.log('❌ logoIzq es null o undefined');
    }

    // ── Agregar logo derecho ──
    console.log('🖼️ logoDer recibido:', logoDer);
    if (logoDer && typeof logoDer === 'string' && logoDer.trim() !== '') {
        try {
            if (logoDer.startsWith('data:image')) {
                console.log('✅ Logo der es base64');
                const base64Data = logoDer.split(',')[1];
                const imgId = workbook.addImage({ base64: base64Data, extension: 'png' });
                ws.addImage(imgId, {
                    tl: { col: totalColumnas - 2 + 0.15, row: f1 - 1 + 0.15 } as any,
                    br: { col: totalColumnas - 0.15, row: f1 - 1 + 3.85 } as any,
                    editAs: 'oneCell',
                } as any);
                console.log('✅ Logo der agregado desde base64');
            } else {
                console.log('🖼️ Logo der es URL, haciendo fetch...');
                const url = logoDer.startsWith('http') ? logoDer : `/storage/${logoDer.replace(/^\//, '')}`;
                console.log('🖼️ URL fetch:', url);
                const response = await fetch(url);
                console.log('🖼️ Respuesta:', response.status, response.ok);
                if (response.ok) {
                    const blob = await response.blob();
                    const base64 = await blobToBase64(blob);
                    const ext = detectImageExt(logoDer, blob);
                    const imgId = workbook.addImage({ base64, extension: ext });
                    ws.addImage(imgId, {
                        tl: { col: totalColumnas - 2 + 0.15, row: f1 - 1 + 0.15 } as any,
                        br: { col: totalColumnas - 0.15, row: f1 - 1 + 3.85 } as any,
                        editAs: 'oneCell',
                    } as any);
                    console.log('✅ Logo der agregado desde URL');
                } else {
                    console.log('❌ Error al cargar logo der:', response.status);
                }
            }
        } catch (e) {
            console.error('❌ Error al agregar logo der:', e);
        }
    } else {
        console.log('❌ logoDer es null o undefined');
    }

    filaActual = f1 + 4;
    filaActual++;

    // ── Título ──
    ws.mergeCells(filaActual, 1, filaActual, totalColumnas);
    const cellTitulo = ws.getCell(filaActual, 1);
    cellTitulo.value = tituloPersonalizado;
    cellTitulo.font = { bold: true, size: 12, name: 'Calibri', color: { argb: 'FF1A3C5E' } };
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
    // DATOS DEL PROYECTO - CON BORDE EXTERIOR Y CONTENIDO COMPLETO
    // ═══════════════════════════════════════════════════════════════════════
    const fechaFormateada = getFechaFormatoModelo();
    const inicioFila = filaActual;

    // Guardar TODO el contenido en un array ANTES del merge
    const lineasContenido: string[] = [];

    // 1. DATOS DEL PROYECTO
    const datosProyecto = [
        ['Proyecto', nombreProyecto],
        ['Propietario', propietario],
        ['Fecha', fechaFormateada],
        ['Módulo', proyecto?.modulo || 'GENERAL'],
    ];

    for (const [label, value] of datosProyecto) {
        lineasContenido.push(`${label} : ${value}`);
    }

    // 2. HECHO POR / REVISADO POR
    lineasContenido.push(`Hecho por : ${proyecto?.hechoPor || ''}          Revisado por : ${proyecto?.revisadoPor || ''}`);

    // Calcular filas necesarias
    const totalLineas = lineasContenido.length;
    const filaFin = inicioFila + totalLineas - 1;

    // Hacer MERGE de todo el bloque (columnas 1 a 6)
    ws.mergeCells(inicioFila, 1, filaFin, totalColumnas);

    // Escribir TODO el contenido en la celda fusionada
    const cellBloque = ws.getCell(inicioFila, 1);
    let textoCompleto = '';
    for (const linea of lineasContenido) {
        textoCompleto += linea + '\n';
    }
    cellBloque.value = textoCompleto.trimEnd();
    cellBloque.font = { size: 9, name: 'Calibri' };
    cellBloque.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };

    // SOLO BORDE EXTERIOR (sin líneas internas)
    cellBloque.border = {
        top: { style: 'medium', color: { argb: 'FF000000' } },
        bottom: { style: 'medium', color: { argb: 'FF000000' } },
        left: { style: 'medium', color: { argb: 'FF000000' } },
        right: { style: 'medium', color: { argb: 'FF000000' } },
    };

    // Actualizar filaActual
    filaActual = filaFin + 1;

    // Espacio después del recuadro
    filaActual++;
    ws.getRow(filaActual).height = 5;
    filaActual++;

    return filaActual;
} // ⬅️ CIERRE DE buildHeader

// ─── HOJA PRESUPUESTO ──────────────────────────────────────────────────────────
async function buildPresupuestoSheet(
    ws: ExcelJS.Worksheet,
    rows: DelphinRow[],
    proyecto: any,
    projectName: string,
    workbook: ExcelJS.Workbook
) {
    console.log('📦 proyecto en buildPresupuestoSheet:', proyecto);
    console.log('📦 logo izq en buildPresupuestoSheet:', proyecto?.plantilla_logo_izq_url);
    const totalColumnas = 7;
  const columnas = [
        { key: 'no', width: 8 },          // N° - un poco más ancho
        { key: 'desc', width: 70 },       // Descripción - MUCHO más ancho
        { key: 'monomio', width: 18 },    // Monomio - más espacio
        { key: 'coeficiente', width: 22 }, // Coeficiente - más espacio
        { key: 'porcentaje', width: 22 }, // % Total - más espacio
    ];

    columnas.forEach((col, i) => {
        ws.getColumn(i + 1).width = col.width;
    });

    let filaActual = await buildHeader(
        workbook,
        ws,
        projectName,
        proyecto,
        totalColumnas,
        'RESUMEN DE PRESUPUESTO'
    );

    const headers = ['N°', 'Partida', 'Descripción', 'Und.', 'Metrado', 'P. Unit.', 'Total (S/)'];
    for (let i = 0; i < headers.length; i++) {
        const cell = ws.getCell(filaActual, i + 1);
        cell.value = headers[i];
        fill(cell, C.headerBg);
        font(cell, C.headerFg, true, 10);
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        border(cell);
    }
    filaActual++;

    let altIdx = 0;
    rows.forEach((row) => {
        const nivel = row.nivel ?? 1;
        const isLeaf = nivel >= 3;
        const total = row.parcial || (row.metrado * row.precio_unitario) || 0;

        ws.getCell(filaActual, 1).value = row.item_order;
        ws.getCell(filaActual, 2).value = row.partida;
        ws.getCell(filaActual, 3).value = row.descripcion;
        ws.getCell(filaActual, 4).value = isLeaf ? row.unidad : null;
        ws.getCell(filaActual, 5).value = isLeaf ? row.metrado : null;
        ws.getCell(filaActual, 6).value = isLeaf ? row.precio_unitario : null;
        ws.getCell(filaActual, 7).value = total;

        let bg = C.leafBg, fg = C.leafFg, bold = false;
        if (nivel === 1) { bg = C.titulo0Bg; fg = C.titulo0Fg; bold = true; }
        else if (nivel === 2) { bg = C.titulo1Bg; fg = C.titulo1Fg; bold = true; }
        else if (nivel === 3) { bg = C.titulo2Bg; fg = C.titulo2Fg; }
        else if (altIdx % 2 === 1) { bg = C.altBg; }

        for (let c = 1; c <= totalColumnas; c++) {
            const cell = ws.getCell(filaActual, c);
            fill(cell, bg);
            font(cell, fg, bold);
            border(cell);
            if (c >= 5) {
                cell.alignment = { horizontal: 'right', vertical: 'middle' };
                if (typeof cell.value === 'number') cell.numFmt = '#,##0.00';
            } else {
                cell.alignment = { vertical: 'middle' };
            }
        }

        ws.getCell(filaActual, 3).alignment = {
            horizontal: 'left',
            vertical: 'middle',
            wrapText: true,
            indent: Math.max(0, nivel - 1),
        };

        if (isLeaf) altIdx++;
        filaActual++;
    });

    const totalPres = rows
        .filter((r) => (r.nivel ?? 1) === 1)
        .reduce((s, r) => s + (r.parcial || r.metrado * r.precio_unitario || 0), 0);

    const totalRow = filaActual;
    ws.getCell(totalRow, 1).value = '';
    ws.getCell(totalRow, 2).value = '';
    ws.getCell(totalRow, 3).value = 'TOTAL PRESUPUESTO';
    ws.getCell(totalRow, 4).value = '';
    ws.getCell(totalRow, 5).value = '';
    ws.getCell(totalRow, 6).value = '';
    ws.getCell(totalRow, 7).value = totalPres;

    for (let c = 1; c <= totalColumnas; c++) {
        const cell = ws.getCell(totalRow, c);
        fill(cell, C.totalBg);
        font(cell, C.totalFg, true, 10);
        border(cell);
        cell.alignment = { vertical: 'middle', horizontal: c === 7 ? 'right' : 'center' };
        if (c === 7) cell.numFmt = '#,##0.00';
    }

    ws.views = [{ state: 'frozen', ySplit: filaActual - rows.length - 1 }];
}

// ─── HOJA CRONOGRAMA ───────────────────────────────────────────────────────────
async function buildCronogramaSheet(
    ws: ExcelJS.Worksheet,
    rows: DelphinRow[],
    proyecto: any,
    projectName: string,
    workbook: ExcelJS.Workbook
) {
    const totalColumnas = 7;
    const columnas = [
        { key: 'no', width: 6 },
        { key: 'desc', width: 52 },
        { key: 'dur', width: 8 },
        { key: 'ini', width: 12 },
        { key: 'fin', width: 12 },
        { key: 'pred', width: 12 },
        { key: 'costo', width: 16 },
    ];

    columnas.forEach((col, i) => {
        ws.getColumn(i + 1).width = col.width;
    });

    // ✅ Fijar altura de todas las filas
    ws.properties.defaultRowHeight = 18;

    let filaActual = await buildHeader(
        workbook,
        ws,
        projectName,
        proyecto,
        totalColumnas,
        'CRONOGRAMA GENERAL'
    );

    const headers = ['N°', 'Descripción', 'Dur.', 'Inicio', 'Fin', 'Pred.', 'Costo (S/)'];
    for (let i = 0; i < headers.length; i++) {
        const cell = ws.getCell(filaActual, i + 1);
        cell.value = headers[i];
        fill(cell, C.ganttHdBg);
        font(cell, C.ganttHdFg, true, 10);
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        border(cell);
    }
    ws.getRow(filaActual).height = 22;
    filaActual++;

    let altIdx = 0;
    rows.forEach((row) => {
        const nivel = row.nivel ?? 1;
        const isLeaf = nivel >= 3;
        const pred = Array.isArray(row.predecesoras) && row.predecesoras.length > 0
            ? row.predecesoras.map((p: any) => `${p.taskId}${p.tipo !== 'FC' ? p.tipo : ''}`).join(', ')
            : '';

        ws.getCell(filaActual, 1).value = row.item_order;
        ws.getCell(filaActual, 2).value = row.descripcion;

        if (isLeaf) {
            ws.getCell(filaActual, 3).value = row.duracion_dias || '';
            ws.getCell(filaActual, 4).value = row.fecha_inicio || '';
            ws.getCell(filaActual, 5).value = row.fecha_fin || '';
            ws.getCell(filaActual, 6).value = pred;
            ws.getCell(filaActual, 7).value = row.presupuesto || 0;
        } else {
            ws.getCell(filaActual, 3).value = '';
            ws.getCell(filaActual, 4).value = '';
            ws.getCell(filaActual, 5).value = '';
            ws.getCell(filaActual, 6).value = '';
            ws.getCell(filaActual, 7).value = '';
        }

        let bg = C.leafBg, fg = C.leafFg, bold = false;
        if (nivel === 1) { bg = C.titulo0Bg; fg = C.titulo0Fg; bold = true; }
        else if (nivel === 2) { bg = C.titulo1Bg; fg = C.titulo1Fg; bold = true; }
        else if (nivel === 3) { bg = C.titulo2Bg; fg = C.titulo2Fg; }
        else if (altIdx % 2 === 1) { bg = C.altBg; }

        for (let c = 1; c <= totalColumnas; c++) {
            const cell = ws.getCell(filaActual, c);
            fill(cell, bg);
            font(cell, fg, bold);
            border(cell);
            cell.alignment = { vertical: 'middle', horizontal: c === 2 ? 'left' : 'center' };
            if (c === 7 && typeof cell.value === 'number') cell.numFmt = '#,##0.00';
        }

        ws.getCell(filaActual, 2).alignment = {
            horizontal: 'left',
            vertical: 'middle',
            wrapText: false,
            indent: Math.max(0, nivel - 1),
        };


        ws.getRow(filaActual).height = 18;

        if (isLeaf) altIdx++;
        filaActual++;
    });


    for (let i = 1; i <= totalColumnas; i++) {
        const column = ws.getColumn(i);
        // ExcelJS no soporta autoFit directamente en la versión de tipos usada.
        // Se mantiene un ancho mínimo y máximo para evitar columnas demasiado estrechas o anchas.
        if (typeof column.width !== 'number' || column.width < 10) {
            column.width = 10;
        }
        else if (column.width > 70) {
            column.width = 70;
        }
    }

    ws.views = [{ state: 'frozen', ySplit: 7 }];
}

async function buildFormulaPolinomicaSheet(
    ws: ExcelJS.Worksheet,
    formulaData: any,
    proyecto: any,
    projectName: string,
    workbook: ExcelJS.Workbook
) {
    const totalColumnas = 5;  // ✅ Cambiar a 5

    // ✅ ANCHOS DE COLUMNA OPTIMIZADOS
    const columnas = [
        { key: 'no', width: 6 },         // N°
        { key: 'desc', width: 60 },      // Descripción (más ancho)
        { key: 'monomio', width: 14 },   // Monomio
        { key: 'coeficiente', width: 18 }, // Coeficiente
        { key: 'porcentaje', width: 18 }, // % Total
    ];

    columnas.forEach((col, i) => {
        ws.getColumn(i + 1).width = col.width;
    });

    // ── ENCABEZADO ──
    const nombreProyecto = String(projectName || 'PROYECTO');
    let filaActual = await buildHeader(
        workbook,
        ws,
        nombreProyecto,  // ✅ Siempre es un string
        proyecto,
        totalColumnas,
        'FÓRMULA POLINÓMICA'
    );

    // ═══════════════════════════════════════════════════════════════════════
    // BLOQUE DE LA FÓRMULA (K = ...)
    // ═══════════════════════════════════════════════════════════════════════
    ws.mergeCells(filaActual, 1, filaActual + 1, totalColumnas);
    const formulaCell = ws.getCell(filaActual, 1);
    formulaCell.value = formulaData?.formula || 'K = No hay fórmula configurada';
    formulaCell.font = {
        bold: true,
        size: 11,
        name: 'Calibri',
        color: { argb: 'FF1A3C5E' }
    };
    formulaCell.alignment = {
        horizontal: 'left',
        vertical: 'middle',
        wrapText: true
    };
    formulaCell.border = {
        top: { style: 'medium', color: { argb: 'FF1F4E79' } },
        bottom: { style: 'medium', color: { argb: 'FF1F4E79' } },
        left: { style: 'medium', color: { argb: 'FF1F4E79' } },
        right: { style: 'medium', color: { argb: 'FF1F4E79' } },
    };
    ws.getRow(filaActual).height = 28;
    filaActual += 2;

    // ═══════════════════════════════════════════════════════════════════════
    // ENCABEZADOS DE TABLA
    // ═══════════════════════════════════════════════════════════════════════
    const headers = ['N°', 'Descripción', 'Monomio', 'Coeficiente', '% Total'];
    for (let i = 0; i < headers.length; i++) {
        const cell = ws.getCell(filaActual, i + 1);
        cell.value = headers[i];
        fill(cell, C.headerBg);
        font(cell, C.headerFg, true, 10);
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        border(cell);
    }
    ws.getRow(filaActual).height = 22;
    filaActual++;

    // ═══════════════════════════════════════════════════════════════════════
    // DATOS
    // ═══════════════════════════════════════════════════════════════════════
    const monomios = formulaData?.monomios || [];

    if (monomios.length === 0) {
        ws.mergeCells(filaActual, 1, filaActual, totalColumnas);
        const cell = ws.getCell(filaActual, 1);
        cell.value = 'No hay monomios configurados';
        fill(cell, C.leafBg);
        font(cell, C.leafFg, false, 10);
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        return;
    }

    monomios.forEach((monomio: any, index: number) => {
        const bg = index % 2 === 0 ? C.leafBg : C.altBg;

        // N°
        const cell1 = ws.getCell(filaActual, 1);
        cell1.value = index + 1;
        fill(cell1, bg);
        font(cell1, C.leafFg, false, 10);
        border(cell1);
        cell1.alignment = { vertical: 'middle', horizontal: 'center' };

        // Descripción (con wrapText)
        const cell2 = ws.getCell(filaActual, 2);
        cell2.value = monomio.especialidad || monomio.descripcion || 'Sin descripción';
        fill(cell2, bg);
        font(cell2, C.leafFg, false, 10);
        border(cell2);
        cell2.alignment = {
            vertical: 'middle',
            horizontal: 'left',
            wrapText: true
        };

        // Monomio (en negrita)
        const cell3 = ws.getCell(filaActual, 3);
        cell3.value = monomio.monomio || '-';
        fill(cell3, bg);
        font(cell3, C.leafFg, true, 10);
        border(cell3);
        cell3.alignment = { vertical: 'middle', horizontal: 'center' };

        // Coeficiente (3 decimales)
        const cell4 = ws.getCell(filaActual, 4);
        cell4.value = monomio.coeficiente || 0;
        fill(cell4, bg);
        font(cell4, C.leafFg, false, 10);
        border(cell4);
        cell4.alignment = { vertical: 'middle', horizontal: 'right' };
        cell4.numFmt = '#,##0.000';

        // % Total (formato porcentaje)
        const cell5 = ws.getCell(filaActual, 5);
        cell5.value = monomio.incidencia || 0;
        fill(cell5, bg);
        font(cell5, C.leafFg, false, 10);
        border(cell5);
        cell5.alignment = { vertical: 'middle', horizontal: 'right' };
        cell5.numFmt = '0.00"%"';

        ws.getRow(filaActual).height = 18;
        filaActual++;
    });

    // ═══════════════════════════════════════════════════════════════════════
    // TOTAL K
    // ═══════════════════════════════════════════════════════════════════════
    const totalK = formulaData?.totalK || monomios.reduce((sum: number, m: any) => sum + (m.coeficiente || 0), 0);


    ws.getCell(filaActual, 1).value = '';
    ws.getCell(filaActual, 2).value = 'TOTAL K =';
    ws.getCell(filaActual, 3).value = '';
    ws.getCell(filaActual, 4).value = totalK;
    ws.getCell(filaActual, 5).value = 100;

    for (let c = 1; c <= totalColumnas; c++) {
        const cell = ws.getCell(filaActual, c);
        fill(cell, C.totalBg);
        font(cell, C.totalFg, true, 10);
        border(cell);

        if (c === 2) {
            cell.alignment = { vertical: 'middle', horizontal: 'right' };
        } else if (c === 4) {
            cell.alignment = { vertical: 'middle', horizontal: 'right' };
            cell.numFmt = '#,##0.000';
        } else if (c === 5) {
            cell.alignment = { vertical: 'middle', horizontal: 'right' };
            cell.numFmt = '0.00"%"';
        } else {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
        }
    }
    ws.getRow(filaActual).height = 20;


    ws.views = [{ state: 'frozen', ySplit: filaActual - monomios.length - 3 }];
}

// ✅ MANTENER ESTA FUNCIÓN (la que tiene formulaData)
export async function exportDelphinExcel(
    content: DelphinExportContent,
    rows: DelphinRow[],
    projectName: string,
    proyecto?: any,
    selectedSpecialties?: string[],
    formulaData?: any
): Promise<void> {
    // Filtrar filas por especialidades seleccionadas
    const filteredRows = selectedSpecialties && selectedSpecialties.length > 0
        ? filterRowsBySpecialties(rows, selectedSpecialties)
        : rows;

    console.log('📦 Filas originales:', rows.length);
    console.log('📦 Filas filtradas:', filteredRows.length);
    console.log('📦 Especialidades seleccionadas:', selectedSpecialties);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'PCL Costos';
    wb.created = new Date();

    if (content === 'budget_only' || content === 'budget_gantt') {
        const ws = wb.addWorksheet('Presupuesto General');
        await buildPresupuestoSheet(ws, filteredRows, proyecto, projectName, wb);
    }
    if (content === 'gantt_only' || content === 'budget_gantt') {
        const ws = wb.addWorksheet('Cronograma General');
        await buildCronogramaSheet(ws, filteredRows, proyecto, projectName, wb);
    }

    // ✅ NUEVO: Hoja de Fórmula Polinómica
    if (content === 'formula_polinomica' && formulaData) { 
        const ws = wb.addWorksheet('Fórmula Polinómica');   
        await buildFormulaPolinomicaSheet(ws, formulaData, proyecto, projectName, wb); 
    }

    const date = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const suffix = {
        budget_only: 'Presupuesto',
        budget_gantt: 'Presupuesto_Cronograma',
        gantt_only: 'Cronograma',
        formula_polinomica: 'Formula_Polinomica',
    }[content];

    const fileName = `${projectName.replace(/\s+/g, '_')}_${suffix}_${date.replace(/\//g, '-')}.xlsx`;
    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName);
}



