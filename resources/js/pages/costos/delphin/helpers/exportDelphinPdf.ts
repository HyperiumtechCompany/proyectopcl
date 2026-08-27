import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { saveAs } from 'file-saver';
import axios from 'axios';
import type { DelphinRow } from '../types';
import type { DelphinExportContent } from './exportDelphin';

// presupuesto_general.partida se guarda sin padding ("4.1.1.1") pero
// presupuesto_acus.partida sí lleva padding de 2 dígitos por segmento
// ("04.01.01.01") — mismo criterio que normalizePartidaCode() en
// CostoDatabaseService.php y normalizedPartida() en InsumosConsolidadosModal.tsx.
// Comparar los strings tal cual nunca coincide y descarta todos los ACUs.
function normalizedPartida(value: string): string {
    return value
        .split('.')
        .filter(Boolean)
        .map((part) => part.padStart(2, '0'))
        .join('.');
}

// ── Colores RGB para jsPDF ────────────────────────────────────────────────────
type RGB = [number, number, number];
const C: Record<string, RGB> = {
    headerBg: [15, 23, 42],
    nivel1: [30, 41, 59],
    nivel2: [51, 65, 85],
    nivel3: [71, 85, 105],
    leaf: [255, 255, 255],
    altLeaf: [248, 250, 252],
    totalBg: [6, 78, 59],
    fgLight: [255, 255, 255],
    fgMid: [226, 232, 240],
    fgDark: [30, 41, 59],
    totalFg: [110, 231, 183],
    ganttHd: [30, 58, 95],
    ganttFg: [191, 219, 254],
    borderDark: [30, 41, 59],
};

const fmtNum = (v: number) =>
    (v ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function getFechaFormatoModelo(): string {
    const meses = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
        'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
    const hoy = new Date();
    return `${meses[hoy.getMonth()]} ${hoy.getFullYear()}`;
}

interface RowMeta { bg: RGB; fg: RGB; bold: boolean; indent: number }

function rowMeta(rows: DelphinRow[]): RowMeta[] {
    let altCount = 0;
    return rows.map((row) => {
        const nivel = row.nivel ?? 1;
        const isLeaf = nivel >= 3;
        let bg: RGB, fg: RGB, bold = false;
        if (nivel === 1) { bg = C.nivel1!; fg = C.fgLight!; bold = true; }
        else if (nivel === 2) { bg = C.nivel2!; fg = C.fgMid!; bold = true; }
        else if (nivel === 3) { bg = C.nivel3!; fg = C.fgMid!; }
        else {
            bg = altCount % 2 === 1 ? C.altLeaf! : C.leaf!;
            fg = C.fgDark!;
        }
        if (isLeaf) altCount++;
        return { bg, fg, bold, indent: Math.max(0, nivel - 1) * 3 };
    });
}

// ── Filtrado por especialidades ───────────────────────────────────────────────
function filterRowsBySpecialties(rows: DelphinRow[], selectedIds: string[]): DelphinRow[] {
    if (!selectedIds || selectedIds.length === 0) return rows;
    const parentIds = new Set(selectedIds.map(id => parseInt(id, 10)));
    if (parentIds.size === 0) return rows;
    const rowById = new Map(rows.map(r => [r.id, r]));
    const result: DelphinRow[] = [];
    rows.forEach(row => {
        if (row.nivel === 1 && parentIds.has(row.id)) { result.push(row); return; }
        let parentId = row.parent_id ?? null;
        while (parentId !== null) {
            if (parentIds.has(parentId)) { result.push(row); return; }
            parentId = rowById.get(parentId)?.parent_id ?? null;
        }
    });
    return result;
}

// ── Helper: cargar imagen desde URL o base64 → base64 ────────────────────────
async function loadImageAsBase64(src: string): Promise<{ data: string; format: string } | null> {
    try {
        if (src.startsWith('data:image')) {
            const format = src.includes('jpeg') || src.includes('jpg') ? 'JPEG' : 'PNG';
            return { data: src, format };
        }
        const url = src.startsWith('http') ? src : `/storage/${src.replace(/^\//, '')}`;
        const resp = await fetch(url);
        if (!resp.ok) return null;
        const blob = await resp.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result as string;
                const format = blob.type.includes('jpeg') ? 'JPEG' : 'PNG';
                resolve({ data: result, format });
            };
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
        });
    } catch {
        return null;
    }
}

// ── Encabezado PDF (replica el del Excel) ────────────────────────────────────
async function addPageHeader(
    doc: jsPDF,
    projectName: string,
    subtitle: string,
    proyecto: any,
): Promise<number> {
    const pageW = doc.internal.pageSize.getWidth();
    const marginX = 10;
    const contentW = pageW - marginX * 2;

    const logoW = 28;
    const logoH = 18;
    const headerH = logoH;
    const headerY = 8;

    // ── Borde exterior del encabezado ──
    doc.setDrawColor(...C.borderDark!);
    doc.setLineWidth(0.4);
    doc.rect(marginX, headerY, contentW, headerH);

    // ── Separadores verticales (logo | texto | logo) ──
    doc.line(marginX + logoW, headerY, marginX + logoW, headerY + headerH);
    doc.line(marginX + contentW - logoW, headerY, marginX + contentW - logoW, headerY + headerH);

    // ── Logo izquierdo ──
    const logoIzq = proyecto?.plantilla_logo_izq_url || proyecto?.plantilla_logo_izq;
    if (logoIzq) {
        const img = await loadImageAsBase64(logoIzq);
        if (img) {
            try {
                doc.addImage(img.data, img.format, marginX + 1, headerY + 1, logoW - 2, logoH - 2);
            } catch { }
        }
    }

    // ── Logo derecho ──
    const logoDer = proyecto?.plantilla_logo_der_url || proyecto?.plantilla_logo_der;
    if (logoDer) {
        const img = await loadImageAsBase64(logoDer);
        if (img) {
            try {
                doc.addImage(img.data, img.format,
                    marginX + contentW - logoW + 1, headerY + 1, logoW - 2, logoH - 2);
            } catch { }
        }
    }

    // ── Texto central ──
    const textX = marginX + logoW;
    const textW = contentW - logoW * 2;
    const textCenterX = textX + textW / 2;

    const cui = proyecto?.codigo_cui || '-';
    const modular = proyecto?.codigos_modulares || '-';
    const codigoLocal = proyecto?.codigo_local || '-';
    const unidadEjecutora = proyecto?.unidad_ejecutora || '-';
    const nombreProyecto = projectName || 'PROYECTO';

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...C.borderDark!);
    doc.text(`"${nombreProyecto.toUpperCase()}"`, textCenterX, headerY + 5, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(
        `CUI: ${cui}  |  CÓDIGO MODULAR: ${modular}  |  CÓDIGO LOCAL: ${codigoLocal}`,
        textCenterX, headerY + 10, { align: 'center' }
    );
    doc.text(
        `UNIDAD EJECUTORA: ${unidadEjecutora}`,
        textCenterX, headerY + 14, { align: 'center' }
    );

    const afterHeader = headerY + headerH + 3;

    // ── Título (subtítulo de la hoja) ──
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...C.borderDark!);
    doc.text(subtitle.toUpperCase(), textCenterX, afterHeader + 4, { align: 'center' });

    const afterTitle = afterHeader + 8;

    // ── Bloque de datos del proyecto ──
    const propietario = proyecto?.propietario || unidadEjecutora || '-';
    const fechaFormateada = getFechaFormatoModelo();
    const modulo = proyecto?.modulo || 'GENERAL';
    const hechoPor = proyecto?.hechoPor || '';
    const revisadoPor = proyecto?.revisadoPor || '';

    const lines = [
        `Proyecto : ${nombreProyecto}`,
        `Propietario : ${propietario}`,
        `Fecha : ${fechaFormateada}`,
        `Módulo : ${modulo}`,
        `Hecho por : ${hechoPor}          Revisado por : ${revisadoPor}`,
    ];

    const bloqueH = lines.length * 4 + 3;
    doc.setDrawColor(...C.borderDark!);
    doc.setLineWidth(0.3);
    doc.rect(marginX, afterTitle, contentW, bloqueH);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...C.borderDark!);
    lines.forEach((line, i) => {
        doc.text(line, marginX + 3, afterTitle + 4 + i * 4);
    });

    const startY = afterTitle + bloqueH + 4;
    return startY;
}

// ── Presupuesto ───────────────────────────────────────────────────────────────
async function buildPresupuestoPdf(doc: jsPDF, rows: DelphinRow[], projectName: string, proyecto: any) {
    const startY = await addPageHeader(doc, projectName, 'Resumen de Presupuesto', proyecto);
    const meta = rowMeta(rows);
    const totalPres = rows
        .filter((r) => (r.nivel ?? 1) === 1)
        .reduce((s, r) => s + (r.parcial || r.metrado * r.precio_unitario || 0), 0);

    const body = rows.map((row) => {
        const nivel = row.nivel ?? 1;
        const isLeaf = nivel >= 3;
        return [
            String(row.item_order ?? ''),
            row.partida ?? '',
            row.descripcion ?? '',
            isLeaf ? (row.unidad ?? '') : '',
            isLeaf ? fmtNum(row.metrado) : '',
            isLeaf ? fmtNum(row.precio_unitario) : '',
            fmtNum(row.parcial || row.metrado * row.precio_unitario || 0),
        ];
    });
    body.push(['', '', 'TOTAL PRESUPUESTO', '', '', '', fmtNum(totalPres)]);

    autoTable(doc, {
        startY,
        margin: { left: 10, right: 10 },
        head: [['N°', 'Partida', 'Descripción', 'Und.', 'Metrado', 'P. Unit.', 'Total (S/)']],
        body,
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: { top: 1.5, right: 2, bottom: 1.5, left: 2 }, font: 'helvetica', overflow: 'linebreak' },
        headStyles: { fillColor: C.headerBg!, textColor: C.fgLight!, fontStyle: 'bold', halign: 'center', fontSize: 7 },
        columnStyles: {
            0: { cellWidth: 10, halign: 'center' },
            1: { cellWidth: 18, halign: 'center' },
            2: { cellWidth: 'auto' },
            3: { cellWidth: 14, halign: 'center' },
            4: { cellWidth: 22, halign: 'right' },
            5: { cellWidth: 24, halign: 'right' },
            6: { cellWidth: 28, halign: 'right' },
        },
        didParseCell: (data) => {
            if (data.section !== 'body') return;
            const i = data.row.index;
            if (i >= rows.length) {
                data.cell.styles.fillColor = C.totalBg!;
                data.cell.styles.textColor = C.totalFg!;
                data.cell.styles.fontStyle = 'bold';
                return;
            }
            const m = meta[i]!;
            data.cell.styles.fillColor = m.bg;
            data.cell.styles.textColor = m.fg;
            data.cell.styles.fontStyle = m.bold ? 'bold' : 'normal';
            if (data.column.index === 2 && m.indent > 0) {
                data.cell.styles.cellPadding = { top: 1.5, right: 2, bottom: 1.5, left: 2 + m.indent };
            }
        },
    });
}

// ── Cronograma ────────────────────────────────────────────────────────────────
async function buildCronogramaPdf(doc: jsPDF, rows: DelphinRow[], projectName: string, proyecto: any) {
    const startY = await addPageHeader(doc, projectName, 'Cronograma General', proyecto);
    const meta = rowMeta(rows);

    const body = rows.map((row) => {
        const pred = Array.isArray(row.predecesoras) && row.predecesoras.length > 0
            ? row.predecesoras.map((p: any) => `${p.taskId}${p.tipo !== 'FC' ? p.tipo : ''}`).join(', ')
            : '';
        return [
            String(row.item_order ?? ''),
            row.descripcion ?? '',
            row.duracion_dias ? String(row.duracion_dias) : '',
            row.fecha_inicio ?? '',
            row.fecha_fin ?? '',
            pred,
            fmtNum(row.presupuesto || 0),
        ];
    });

    autoTable(doc, {
        startY,
        head: [['N°', 'Descripción', 'Dur.', 'Inicio', 'Fin', 'Pred.', 'Costo (S/)']],
        body,
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: { top: 1.5, right: 2, bottom: 1.5, left: 2 }, font: 'helvetica', overflow: 'linebreak' },
        headStyles: { fillColor: C.ganttHd!, textColor: C.ganttFg!, fontStyle: 'bold', halign: 'center', fontSize: 7 },
        columnStyles: {
            0: { cellWidth: 10, halign: 'center' },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 16, halign: 'center' },
            3: { cellWidth: 24, halign: 'center' },
            4: { cellWidth: 24, halign: 'center' },
            5: { cellWidth: 22, halign: 'center' },
            6: { cellWidth: 30, halign: 'right' },
        },
        didParseCell: (data) => {
            if (data.section !== 'body') return;
            const m = meta[data.row.index];
            if (!m) return;
            data.cell.styles.fillColor = m.bg;
            data.cell.styles.textColor = m.fg;
            data.cell.styles.fontStyle = m.bold ? 'bold' : 'normal';
            if (data.column.index === 1 && m.indent > 0) {
                data.cell.styles.cellPadding = { top: 1.5, right: 2, bottom: 1.5, left: 2 + m.indent };
            }
        },
    });
}

// Reemplazar buildFormulaPolinomicaBlock por esta versión
async function buildFormulaPolinomicaBlock(
    doc: jsPDF,
    formulaData: any,
    startY: number
): Promise<number> {
    const pageW = doc.internal.pageSize.getWidth();
    const marginX = 10;
    const contentW = pageW - marginX * 2;
    let y = startY;

    // ── Fórmula K ────────────────────────────────────────────────────────
    doc.setFillColor(217, 234, 247);
    const formulaStr = formulaData?.formula || 'K = (sin datos)';
    const formulaLines = doc.splitTextToSize(`K = ${formulaStr.replace(/^K = /, '')}`, contentW - 6);
    const formulaBlockH = formulaLines.length * 4.5 + 4;
    doc.rect(marginX, y, contentW, formulaBlockH, 'F');
    doc.setDrawColor(31, 78, 121);
    doc.setLineWidth(0.4);
    doc.rect(marginX, y, contentW, formulaBlockH);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(26, 60, 94);
    doc.text(formulaLines, marginX + 3, y + 4.5);
    y += formulaBlockH + 3;

    // ── Tabla ─────────────────────────────────────────────────────────────
    const monomios: any[] = formulaData?.monomios ?? [];
    const totalK = formulaData?.totalK ?? 0;

    const body = monomios.map((row: any) => [
        row.esPadre ? String(row.nro) : '',
        `${'    '.repeat(Number(row.nivel ?? (row.esPadre ? 0 : 1)))}${row.codigo ? `${row.codigo} ` : ''}${row.descripcion ?? ''}`,
        row.esPadre ? (row.monomio ?? '') : '',
        (row.coeficiente ?? 0).toFixed(3),
        (row.incidencia ?? 0).toFixed(1) + '%',
    ]);
    body.push(['', 'TOTAL K =', '', totalK.toFixed(3), '100.0%']);

    autoTable(doc, {
        startY: y,
        margin: { left: marginX, right: marginX },
        head: [['N°', 'Descripción', 'Nomen.', 'Coeficiente', '% Total']],
        body,
        theme: 'grid',
        styles: {
            fontSize: 7.5,
            cellPadding: { top: 1.5, right: 2.5, bottom: 1.5, left: 2.5 },
            font: 'helvetica',
            overflow: 'linebreak',
        },
        headStyles: {
            fillColor: C.headerBg!,
            textColor: C.fgLight!,
            fontStyle: 'bold',
            halign: 'center',
            fontSize: 8,
        },
        columnStyles: {
            0: { cellWidth: 10, halign: 'center' },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 20, halign: 'center' },
            3: { cellWidth: 28, halign: 'right' },
            4: { cellWidth: 24, halign: 'right' },
        },
        didParseCell: (data) => {
            if (data.section !== 'body') return;
            const row = monomios[data.row.index];
            // Fila total
            if (data.row.index >= monomios.length) {
                data.cell.styles.fillColor = C.totalBg!;
                data.cell.styles.textColor = C.totalFg!;
                data.cell.styles.fontStyle = 'bold';
                return;
            }
            if (!row) return;
            if (row.esMonomio ?? row.esPadre) {
                data.cell.styles.fillColor = [217, 234, 247];
                data.cell.styles.textColor = [31, 78, 121];
                data.cell.styles.fontStyle = 'bold';
            } else {
                data.cell.styles.fillColor = [255, 255, 255];
                data.cell.styles.textColor = [30, 41, 59];
            }
            // Nomenclatura de padre en verde
            if (row.esPadre && data.column.index === 2) {
                data.cell.styles.textColor = [5, 150, 105];
            }
        },
    });

    return (doc as any).lastAutoTable.finalY + 4;
}

// ── ACUs ───────────────────────────────────────────────────────────────
async function buildAcusPdf(doc: jsPDF, acusData: any[], filteredRows: DelphinRow[], projectName: string, proyecto: any) {
    let startY = await addPageHeader(doc, projectName, 'ANÁLISIS DE PRECIOS UNITARIOS', proyecto);
    const filteredPartidas = new Set(filteredRows.map(r => normalizedPartida(String(r.partida ?? ''))));
    // presupuesto_acus.partida guarda el código con padding ("04.01.01.01"); se
    // muestra con el mismo formato que la hoja/tabla "Presupuesto General" (sin
    // padding, "4.1.1.1") para que ambas coincidan visualmente.
    const partidaDisplayByNormalized = new Map(
        filteredRows.map(r => [normalizedPartida(String(r.partida ?? '')), String(r.partida ?? '')]),
    );

    for (const acu of acusData) {
        const partidaNorm = normalizedPartida(String(acu.partida ?? ''));
        if (filteredRows.length > 0 && !filteredPartidas.has(partidaNorm)) continue;
        const partidaDisplay = partidaDisplayByNormalized.get(partidaNorm) ?? acu.partida;

        // Add a new page for each ACU if it's too close to the bottom (optional, but good for neatness)
        if (startY > doc.internal.pageSize.getHeight() - 40) {
            doc.addPage('a4', 'landscape');
            startY = await addPageHeader(doc, projectName, 'ANÁLISIS DE PRECIOS UNITARIOS', proyecto);
        }

        // Header for ACU
        autoTable(doc, {
            startY,
            margin: { left: 10, right: 10 },
            theme: 'grid',
            head: [],
            body: [
                [
                    { content: `Partida: ${partidaDisplay}`, colSpan: 1, styles: { fontStyle: 'bold', fillColor: C.nivel1!, textColor: C.fgLight! } },
                    { content: acu.descripcion, colSpan: 2, styles: { fontStyle: 'bold', fillColor: C.nivel1!, textColor: C.fgLight! } },
                    { content: `Rendimiento: ${Number(acu.rendimiento ?? 0).toFixed(2)} ${acu.unidad ?? ''}/Día`, colSpan: 2, styles: { fontStyle: 'bold', fillColor: C.nivel1!, textColor: C.fgLight! } },
                    { content: `Costo unitario por ${acu.unidad ?? ''}: ${Number(acu.costo_unitario_total).toFixed(2)}`, colSpan: 1, styles: { fontStyle: 'bold', halign: 'right', fillColor: C.nivel1!, textColor: C.fgLight! } },
                ]
            ],
            styles: { fontSize: 8, font: 'helvetica' },
        });

        startY = (doc as any).lastAutoTable.finalY + 2;

        const drawSection = (title: string, data: any[]) => {
            if (!data || data.length === 0) return;

            // Group header
            autoTable(doc, {
                startY,
                margin: { left: 10, right: 10 },
                theme: 'grid',
                head: [[{ content: title, colSpan: 8, styles: { fillColor: C.nivel2!, textColor: C.fgLight!, fontStyle: 'bold' } }]],
                body: [],
                styles: { fontSize: 8, font: 'helvetica' },
            });
            startY = (doc as any).lastAutoTable.finalY;

            let subtotal = 0;
            const sectionBody = data.map((row: any) => {
                subtotal += Number(row.parcial);
                // "Ind." y "Cod. Elect." muestran el mismo código INEI (cod_insumo) —
                // así lo confirmó el usuario a partir del reporte de referencia S10.
                const codInsumo = row.cod_insumo ?? row.codigo ?? '';
                return [
                    codInsumo,
                    codInsumo,
                    row.descripcion,
                    row.unidad,
                    row.recursos ? Number(row.recursos) : '',
                    Number(row.cantidad),
                    Number(row.precio_unitario || row.precio_hora || 0),
                    Number(row.parcial),
                ];
            });

            sectionBody.push([
                { content: `Costo de ${title}`, colSpan: 7, styles: { halign: 'right', fontStyle: 'bold' } },
                { content: fmtNum(subtotal), styles: { fontStyle: 'bold' } }
            ]);

            autoTable(doc, {
                startY,
                margin: { left: 10, right: 10 },
                theme: 'grid',
                head: [['Ind.', 'Cod. Elect.', 'Descripción', 'Unidad', 'Cuadrilla', 'Cantidad', 'Precio', 'Parcial']],
                body: sectionBody,
                styles: { fontSize: 7, font: 'helvetica' },
                headStyles: { fillColor: C.ganttHd!, textColor: C.fgLight!, fontStyle: 'bold', halign: 'center' },
                columnStyles: {
                    0: { cellWidth: 12, halign: 'center' },
                    1: { cellWidth: 16, halign: 'center' },
                    2: { cellWidth: 'auto' },
                    3: { cellWidth: 15, halign: 'center' },
                    4: { cellWidth: 15, halign: 'right' },
                    5: { cellWidth: 20, halign: 'right' },
                    6: { cellWidth: 20, halign: 'right' },
                    7: { cellWidth: 25, halign: 'right' },
                },
            });
            startY = (doc as any).lastAutoTable.finalY + 2;
        };

        drawSection('Mano de Obra', acu.mano_de_obra);
        drawSection('Materiales', acu.materiales);
        drawSection('Equipos', acu.equipos);
        drawSection('Subcontratos', acu.subcontratos);
        drawSection('Subpartidas', acu.subpartidas);

        startY += 5;
    }
}

// ── Entry point ───────────────────────────────────────────────────────────────
export async function exportDelphinPdf(
    content: DelphinExportContent,
    rows: DelphinRow[],
    projectName: string,
    projectData?: any,
    selectedSpecialties?: string[],
    formulaData?: any
): Promise<void> {

    const filteredRows = selectedSpecialties && selectedSpecialties.length > 0
        ? filterRowsBySpecialties(rows, selectedSpecialties)
        : rows;

    const date = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const suffix = {
        budget_only: 'Presupuesto',
        budget_gantt: 'Presupuesto_Cronograma',
        gantt_only: 'Cronograma',
        formula_polinomica: 'Formula_Polinomica',

    }[content];

    const fileName = `${projectName.replace(/\s+/g, '_')}_${suffix}_${date.replace(/\//g, '-')}.pdf`;

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    if (content === 'budget_only' || content === 'budget_gantt') {
        await buildPresupuestoPdf(doc, filteredRows, projectName, projectData);

        try {
            const res = await axios.get(`/costos/proyectos/${projectData.id}/presupuesto/acus/export-data`);
            if (res.data?.success && res.data.data) {
                doc.addPage('a4', 'landscape');
                await buildAcusPdf(doc, res.data.data, filteredRows, projectName, projectData);
            }
        } catch (e) {
            console.error("Error fetching ACUs", e);
        }
    }

    if (content === 'budget_gantt') {
        doc.addPage('a4', 'landscape');
    }

    if (content === 'gantt_only' || content === 'budget_gantt') {
        await buildCronogramaPdf(doc, filteredRows, projectName, projectData);
    }
    if (content === 'formula_polinomica') {
    const startY = await addPageHeader(doc, projectName, 'FÓRMULA POLINÓMICA', projectData);

    await buildFormulaPolinomicaBlock(doc, formulaData, startY);
}

    // Page numbers
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(`Pág. ${p} / ${totalPages}`, pageW - 12, pageH - 5, { align: 'right' });
        doc.text(`Generado: ${date}`, 12, pageH - 5);
    }

    const buf = doc.output('arraybuffer');
    saveAs(new Blob([buf], { type: 'application/pdf' }), fileName);
}
