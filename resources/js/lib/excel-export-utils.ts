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
