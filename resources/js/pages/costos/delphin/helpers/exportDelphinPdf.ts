import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { saveAs } from 'file-saver';
import type { DelphinRow } from '../types';
import type { DelphinExportContent } from './exportDelphin';

// ── Colores RGB para jsPDF ────────────────────────────────────────────────────
type RGB = [number, number, number];
const C: Record<string, RGB> = {
    headerBg: [15,  23,  42],
    nivel1:   [30,  41,  59],
    nivel2:   [51,  65,  85],
    nivel3:   [71,  85,  105],
    leaf:     [255, 255, 255],
    altLeaf:  [248, 250, 252],
    totalBg:  [6,   78,  59],
    fgLight:  [255, 255, 255],
    fgMid:    [226, 232, 240],
    fgDark:   [30,  41,  59],
    totalFg:  [110, 231, 183],
    ganttHd:  [30,  58,  95],
    ganttFg:  [191, 219, 254],
};

const fmtNum = (v: number) =>
    (v ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface RowMeta { bg: RGB; fg: RGB; bold: boolean; indent: number }

function rowMeta(rows: DelphinRow[]): RowMeta[] {
    let altCount = 0;
    return rows.map((row) => {
        const nivel = row.nivel ?? 1;
        const isLeaf = nivel >= 3;
        let bg: RGB, fg: RGB, bold = false;
        if (nivel === 1)      { bg = C.nivel1!; fg = C.fgLight!; bold = true; }
        else if (nivel === 2) { bg = C.nivel2!; fg = C.fgMid!;   bold = true; }
        else if (nivel === 3) { bg = C.nivel3!; fg = C.fgMid!;   }
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

function addPageHeader(doc: jsPDF, projectName: string, subtitle: string) {
    const pageW = doc.internal.pageSize.getWidth();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.setFillColor(...C.headerBg!);
    doc.rect(10, 8, pageW - 20, 14, 'F');
    doc.text(subtitle.toUpperCase(), pageW / 2, 13, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(projectName, pageW / 2, 19, { align: 'center' });
    doc.setTextColor(30, 41, 59);
}

// ── Presupuesto ───────────────────────────────────────────────────────────────
function buildPresupuestoPdf(doc: jsPDF, rows: DelphinRow[]) {
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
        startY: 26,
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
                data.cell.styles.cellPadding = {
                    top: 1.5, right: 2, bottom: 1.5, left: 2 + m.indent,
                };
            }
        },
    });
}

// ── Cronograma ────────────────────────────────────────────────────────────────
function buildCronogramaPdf(doc: jsPDF, rows: DelphinRow[]) {
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
        startY: 26,
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
                data.cell.styles.cellPadding = {
                    top: 1.5, right: 2, bottom: 1.5, left: 2 + m.indent,
                };
            }
        },
    });
}

// ── Entry point ───────────────────────────────────────────────────────────────
export async function exportDelphinPdf(
    content: DelphinExportContent,
    rows: DelphinRow[],
    projectName: string,
    projectData?: any,
    selectedSpecialties?: string[],
): Promise<void> {

    const filteredRows = selectedSpecialties && selectedSpecialties.length > 0
        ? filterRowsBySpecialties(rows, selectedSpecialties)
        : rows;

    const date = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const suffix = {
        budget_only:  'Presupuesto',
        budget_gantt: 'Presupuesto_Cronograma',
        gantt_only:   'Cronograma',
    }[content];

    const fileName = `${projectName.replace(/\s+/g, '_')}_${suffix}_${date.replace(/\//g, '-')}.pdf`;

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    if (content === 'budget_only' || content === 'budget_gantt') {
        addPageHeader(doc, projectName, 'Presupuesto General');
        buildPresupuestoPdf(doc, filteredRows);
    }

    if (content === 'budget_gantt') {
        doc.addPage('a4', 'landscape');
    }

    if (content === 'gantt_only' || content === 'budget_gantt') {
        addPageHeader(doc, projectName, 'Cronograma General');
        buildCronogramaPdf(doc, filteredRows);
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