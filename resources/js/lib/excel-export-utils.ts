import type ExcelJS from 'exceljs';

const fetchImageAsBuffer = async (url: string): Promise<ArrayBuffer | null> => {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        return await blob.arrayBuffer();
    } catch (e) {
        console.error("Error fetching image for Excel:", e);
        return null;
    }
};

export const addProjectHeaderAndFooter = async (
    workbook: ExcelJS.Workbook,
    ws: ExcelJS.Worksheet,
    project: any,
    targetCols: number,
    titleText: string = 'COSTOS Y PRESUPUESTOS'
) => {
    // 1. SPLICE ROWS AT TOP (Push everything down by 5 rows)
    // worksheet.spliceRows(1, 0, [], [], [], [], []); 
    // Wait, spliceRows updates references on cells, which is exactly what we want!
    ws.spliceRows(1, 0, [], [], [], [], []);
    
    // Set heights for the new header rows (1-indexed for styling)
    ws.getRow(1).height = 10;
    ws.getRow(2).height = 60;
    ws.getRow(3).height = 10;
    ws.getRow(4).height = 5;
    ws.getRow(5).height = 10;
    
    // Merge middle cells for Title in row 2
    if (targetCols > 2) {
        ws.mergeCells(2, 2, 2, targetCols - 1);
        const titleCell = ws.getCell(2, 2);
        titleCell.value = titleText;
        titleCell.font = { bold: true, size: 16, name: 'Arial', color: { argb: 'FF000000' } };
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        
        // Add a line below
        for (let c = 1; c <= targetCols; c++) {
            ws.getCell(4, c).border = { bottom: { style: 'thick', color: { argb: 'FF000000' } } };
        }
    }

    // Left Logo
    if (project?.plantilla_logo_izq_url) {
        const buffer = await fetchImageAsBuffer(project.plantilla_logo_izq_url);
        if (buffer) {
            const imgId = workbook.addImage({ buffer, extension: 'png' });
            ws.addImage(imgId, {
                tl: { col: 0, row: 1 }, // 0-indexed for images in exceljs (col A, row 2)
                ext: { width: 70, height: 70 },
                editAs: 'oneCell',
            } as any);
        }
    }

    // Right Logo
    if (project?.plantilla_logo_der_url) {
        const buffer = await fetchImageAsBuffer(project.plantilla_logo_der_url);
        if (buffer) {
            const imgId = workbook.addImage({ buffer, extension: 'png' });
            ws.addImage(imgId, {
                tl: { col: targetCols - 1, row: 1 },
                ext: { width: 70, height: 70 },
                editAs: 'oneCell',
            } as any);
        }
    }
    
    // Fix print titles so it repeats on every page
    ws.pageSetup.printTitlesRow = '1:5';
    
    // 2. Add Footer at bottom
    const bottomRow = ws.rowCount + 2;
    ws.getRow(bottomRow).height = 60;
    
    if (project?.plantilla_firma_url) {
        const buffer = await fetchImageAsBuffer(project.plantilla_firma_url);
        if (buffer) {
            const imgId = workbook.addImage({ buffer, extension: 'png' });
            ws.addImage(imgId, {
                tl: { col: targetCols > 2 ? Math.floor(targetCols / 2) - 1 : 0, row: bottomRow - 1 }, // Place in middle
                ext: { width: 100, height: 60 },
                editAs: 'oneCell',
            } as any);
        }
    }
    
    // Set native footer for page numbers
    if (!ws.headerFooter) ws.headerFooter = {};
    ws.headerFooter.oddFooter = `&R Página &P de &N`;
    ws.headerFooter.evenFooter = `&R Página &P de &N`;
};

export interface ProjectLetterhead {
    nombre: string;
    codigo_cui?: string | null;
    codigo_local?: string | null;
    codigos_modulares?: { inicial?: string; primaria?: string; secundaria?: string } | null;
    unidad_ejecutora?: string | null;
    departamento_nombre?: string | null;
    provincia_nombre?: string | null;
    distrito_nombre?: string | null;
    plantilla_logo_izq_url?: string | null;
    plantilla_logo_der_url?: string | null;
}

function codigoModularTexto(modulares?: ProjectLetterhead['codigos_modulares']): string {
    if (!modulares) return '-';
    const partes = [modulares.inicial, modulares.primaria, modulares.secundaria].filter(Boolean);
    return partes.length ? partes.join('-') : '-';
}

function ubicacionTexto(project: ProjectLetterhead): string {
    const partes = [project.departamento_nombre, project.provincia_nombre, project.distrito_nombre].filter(Boolean);
    return partes.length ? partes.join(' - ').toUpperCase() : '-';
}

// Encabezado institucional compacto (una fila con wrap): logos izq/der + nombre de proyecto +
// CUI/código modular/código local + ubicación/unidad ejecutora — mismo tipo de dato que ya usan
// los demás exportes de Costos (Valorizado, Cronograma de materiales), pero sin la lógica de
// "adivinar" projectData desde localStorage/window: el caller ya manda el prop limpio que vino
// del backend (mismo patrón que CostoProjectController). Devuelve la fila donde debe empezar el
// contenido de la hoja.
export async function addInstitutionalHeader(
    workbook: ExcelJS.Workbook,
    ws: ExcelJS.Worksheet,
    project: ProjectLetterhead,
    totalCols: number,
    title: string,
): Promise<number> {
    const [imgIzq, imgDer] = await Promise.all([
        fetchImageAsBuffer(project.plantilla_logo_izq_url ?? ''),
        fetchImageAsBuffer(project.plantilla_logo_der_url ?? ''),
    ]);
    const tieneLogos = !!(imgIzq || imgDer);
    const logoCols = tieneLogos ? 1 : 0;

    // La hoja ya tiene su cabecera de columnas y sus filas de datos escritas en la fila 1 en
    // adelante (mismo orden que las demás sheets de este proyecto): spliceRows inserta 2 filas
    // en blanco arriba y reajusta automáticamente todas las referencias existentes (merges,
    // fórmulas, etc.), en vez de sobreescribir lo que ya estaba en la fila 1.
    ws.spliceRows(1, 0, [], []);

    ws.getRow(1).height = 78;
    const border: Partial<ExcelJS.Borders> = {
        top: { style: 'medium', color: { argb: 'FFB0B0B0' } },
        bottom: { style: 'medium', color: { argb: 'FFB0B0B0' } },
        left: { style: 'medium', color: { argb: 'FFB0B0B0' } },
        right: { style: 'medium', color: { argb: 'FFB0B0B0' } },
    };

    const cIni = 1 + logoCols;
    const cFin = totalCols - logoCols;
    if (cIni <= cFin) {
        ws.mergeCells(1, cIni, 1, cFin);
    }
    const headerText = [
        title.toUpperCase(),
        `"${project.nombre.toUpperCase()}"`,
        `CUI: ${project.codigo_cui || '-'}  ·  CÓD. MODULAR: ${codigoModularTexto(project.codigos_modulares)}  ·  CÓD. LOCAL: ${project.codigo_local || '-'}`,
        `UBICACIÓN: ${ubicacionTexto(project)}  ·  UNIDAD EJECUTORA: ${(project.unidad_ejecutora || '-').toUpperCase()}`,
    ].join('\n');
    const titleCell = ws.getCell(1, cIni);
    titleCell.value = headerText;
    titleCell.font = { name: 'Arial', bold: true, size: 11, color: { argb: 'FF0F172A' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    titleCell.border = border;

    if (tieneLogos) {
        ws.getCell(1, 1).border = border;
        ws.getCell(1, totalCols).border = border;
        if (imgIzq) {
            const imgId = workbook.addImage({ buffer: imgIzq, extension: 'png' });
            ws.addImage(imgId, { tl: { col: 0, row: 0 }, ext: { width: 64, height: 64 }, editAs: 'oneCell' } as any);
        }
        if (imgDer) {
            const imgId = workbook.addImage({ buffer: imgDer, extension: 'png' });
            ws.addImage(imgId, { tl: { col: totalCols - 1, row: 0 }, ext: { width: 64, height: 64 }, editAs: 'oneCell' } as any);
        }
    }

    ws.getRow(2).height = 4;
    for (let c = 1; c <= totalCols; c++) {
        ws.getCell(2, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF64748B' } };
    }

    return 3;
}
