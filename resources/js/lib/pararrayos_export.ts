import ExcelJS from 'exceljs';

// ─── Tipos locales (los mismos que usa Show.tsx) ──────────────────────────────

interface DosisReduccion {
    rInicial: number;
    reduccion: number;
    rFinal: number;
    descripcion: string;
}

interface PozoData {
    L: number;
    a: number;
    resistividad: number;
    tipoTerreno: string;
    isCustomA: boolean;
    dosisReduccion: DosisReduccion[];
    resultados: {
        calculado: boolean;
        resistencia: number;
    } | null;
}

interface PararrayoData {
    td: number;
    L: number;
    W: number;
    H: number;
    h: number;
    c1: number;
    c2: number;
    c3: number;
    c4: number;
    c5: number;
    resultados: {
        calculado: boolean;
        nkng: number;
        areaEquivalente: number;
        Nd: number;
        nc: number;
        requiereProteccion: boolean;
        eficienciaRequerida: number;
        nivelProteccion: number;
    } | null;
}

interface HeaderData {
    proyecto: string;
    cui: string;
    codigoModular: string;
    codigoLocal: string;
    unidadEjecutora: string;
    distrito: string;
    provincia: string;
    departamento: string;
}

const terrainDescs: Record<string, string> = {
    GW: 'Grava de buen grado, mezcla de grava y arena',
    GP: 'Grava de bajo grado, mezcla de grava y arena',
    GC: 'Grava con arcilla, mezcla de grava y arcilla',
    SM: 'Arena con limo, mezcla de bajo grado de arena con limo',
    SC: 'Arena con arcilla, mezcla de bajo grado de arena con arcilla',
    ML: 'Arena fina con arcilla de ligera plasticidad',
    MH: 'Arena fina o terreno con limo, terrenos elásticos',
    CL: 'Arcilla pobre con grava, arena, limo',
    CH: 'Arcilla inorgánica de alta plasticidad',
};

// ─── Helper interno: convierte File a ArrayBuffer ─────────────────────────────

const fileToBuffer = (file: File): Promise<ArrayBuffer> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
};

// ─── Helper interno: agrega el encabezado con logos a una hoja ────────────────

const addEncabezado = (
    sheet: ExcelJS.Worksheet,
    workbook: ExcelJS.Workbook,
    l1Buf: ArrayBuffer,
    l1Ext: string,
    l2Buf: ArrayBuffer,
    l2Ext: string,
    header: HeaderData,
) => {
    sheet.getRow(1).height = 100;
    const img1 = workbook.addImage({ buffer: l1Buf, extension: l1Ext as any });
    const img2 = workbook.addImage({ buffer: l2Buf, extension: l2Ext as any });
    sheet.addImage(img1, { tl: { col: 0, row: 0 }, ext: { width: 90, height: 90 } });
    sheet.addImage(img2, { tl: { col: 13, row: 0 }, ext: { width: 90, height: 90 } });

    sheet.mergeCells('B1:M1');
    const cell = sheet.getCell('B1');
    cell.value = `${header.proyecto}\n${header.cui}; ${header.codigoModular}; ${header.codigoLocal}\n${header.unidadEjecutora}`;
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.font = { bold: true, size: 11, name: 'Calibri' };
    sheet.getColumn('A').width = 13;
    sheet.getColumn('N').width = 13;
};

// ─── Función principal exportada ──────────────────────────────────────────────

export interface ExportPararrayosParams {
    logo1: File;
    logo2: File;
    exportOption: 'both' | 'pozo' | 'pararrayo';
    header: HeaderData;
    pozo: PozoData;
    pararrayo: PararrayoData;
    spreadsheetName: string;
}

export const exportToExcel = async ({
    logo1,
    logo2,
    exportOption,
    header,
    pozo,
    pararrayo,
    spreadsheetName,
}: ExportPararrayosParams): Promise<void> => {
    const l1Buf = await fileToBuffer(logo1);
    const l2Buf = await fileToBuffer(logo2);
    const l1Ext = logo1.name.split('.').pop()?.toLowerCase().replace('jpg', 'jpeg') || 'png';
    const l2Ext = logo2.name.split('.').pop()?.toLowerCase().replace('jpg', 'jpeg') || 'png';

    const workbook = new ExcelJS.Workbook();

    // ── Hoja: Pozo a Tierra ─────────────────────────────────────────────────────
    if (exportOption === 'both' || exportOption === 'pozo') {
        const sheet = workbook.addWorksheet('Pozo a Tierra');
        addEncabezado(sheet, workbook, l1Buf, l1Ext, l2Buf, l2Ext, header);

        // Configuración de anchos
        sheet.getColumn('A').width = 6;
        sheet.getColumn('B').width = 30;
        sheet.getColumn('C').width = 22;
        sheet.getColumn('D').width = 50;
        sheet.getColumn('E').width = 30;

        // Título principal
        sheet.addRow([]);
        sheet.addRow([]);
        const titleRow = sheet.addRow(['', 'CÁLCULO DE LA RESISTENCIA DE PUESTA A TIERRA']);
        titleRow.getCell(2).font = { bold: true, size: 16, underline: true };
        sheet.addRow([]);

        // Ecuación de cálculo
        const eqRow = sheet.addRow(['', 'Ecuación de cálculo:']);
        eqRow.getCell(2).font = { bold: true, italic: true };
        sheet.addRow(['', 'R = (ρ / 2πL) × [ ln(4L / a) – 1 ]']);

        sheet.addRow([]);
        sheet.addRow([]);

        // --- CARACTERÍSTICAS DEL TERRENO ---
        const tRow = sheet.addRow(['', 'CARACTERÍSTICAS DEL TERRENO']);
        tRow.getCell(2).font = { bold: true, size: 14, underline: true };
        sheet.addRow([]);

        // Cabecera
        const hTer = sheet.addRow(['', 'I.E. N°', 'Tipo de Terreno', 'ρ (Ω·m)', 'Descripción']);
        hTer.height = 35;
        hTer.eachCell((c, i) => {
            if (i > 1) {
                c.font = { bold: true, size: 12 };
                c.alignment = { horizontal: 'center', vertical: 'middle' };
                c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            }
        });

        // Datos del terreno
        const dataTer = sheet.addRow(['', '64193', pozo.tipoTerreno, pozo.resistividad, terrainDescs[pozo.tipoTerreno]]);
        dataTer.height = 30;
        dataTer.eachCell((c, i) => {
            if (i > 1) {
                c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC000' } };
                c.font = { bold: true, size: 12 };
                c.alignment = { horizontal: 'center', vertical: 'middle' };
                c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            }
        });

        sheet.addRow([]);
        sheet.addRow([]);

        // --- PARÁMETROS DE DISEÑO ---
        const paramRow = sheet.addRow(['', 'PARÁMETROS DE DISEÑO']);
        paramRow.getCell(2).font = { bold: true, size: 14, underline: true };
        sheet.addRow([]);

        const hParam = sheet.addRow(['', 'Construir', 'Longitud L (m)', 'Diámetro Varilla a (m)']);
        hParam.height = 35;
        hParam.eachCell((c, i) => {
            if (i > 1) {
                c.font = { bold: true, size: 12 };
                c.alignment = { horizontal: 'center', vertical: 'middle' };
                c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            }
        });

        const dataParam = sheet.addRow(['', 'Pozo a Tierra', pozo.L, pozo.a]);
        dataParam.height = 30;
        dataParam.eachCell((c, i) => {
            if (i > 1) {
                c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC000' } };
                c.font = { bold: true, size: 12 };
                c.alignment = { horizontal: 'center', vertical: 'middle' };
                c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            }
        });

        sheet.addRow([]);
        sheet.addRow([]);

        // --- RESULTADOS DE CÁLCULO ---
        const resTitleRow = sheet.addRow(['', 'RESULTADOS DE CÁLCULO']);
        resTitleRow.getCell(2).font = { bold: true, size: 14, underline: true };
        sheet.addRow([]);

        const hRes = sheet.addRow(['', 'I.E. N°', 'Terreno', 'ρ (Ω·m)', 'R (Ω)']);
        hRes.height = 35;
        hRes.eachCell((c, i) => {
            if (i > 1) {
                c.font = { bold: true, size: 12 };
                c.alignment = { horizontal: 'center', vertical: 'middle' };
                c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            }
        });

        const dataRes = sheet.addRow(['', '64193', pozo.tipoTerreno, pozo.resistividad, pozo.resultados!.resistencia]);
        dataRes.height = 30;
        dataRes.eachCell((c, i) => {
            if (i > 1) {
                c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC000' } };
                c.font = { bold: true, size: 12 };
                c.alignment = { horizontal: 'center', vertical: 'middle' };
                c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            }
        });

        sheet.addRow([]);
        sheet.addRow([]);

        // --- REDUCCIÓN DE LA RESISTENCIA DE PUESTA A TIERRA ---
        const reducRow = sheet.addRow(['', 'REDUCCIÓN DE LA RESISTENCIA DE PUESTA A TIERRA']);
        reducRow.getCell(2).font = { bold: true, size: 14, underline: true };
        sheet.addRow([]);

        const hRed = sheet.addRow(['', 'R Inicial (Ω)', '% Reducción', 'R Final (Ω)', 'Descripción']);
        hRed.height = 35;
        hRed.eachCell((c, i) => {
            if (i > 1) {
                c.font = { bold: true, size: 12 };
                c.alignment = { horizontal: 'center', vertical: 'middle' };
                c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            }
        });

        pozo.dosisReduccion.forEach((d: DosisReduccion) => {
            const row = sheet.addRow(['', d.rInicial, d.reduccion, d.rFinal, d.descripcion]);
            row.height = 30;
            row.eachCell((c, i) => {
                if (i > 1) {
                    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC000' } };
                    c.font = { bold: true, size: 12 };
                    c.alignment = { horizontal: 'center', vertical: 'middle' };
                    c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                }
            });
        });

        // Ajustes finales de ancho
        sheet.getColumn('B').width = 25;
        sheet.getColumn('C').width = 20;
        sheet.getColumn('D').width = 20;
        sheet.getColumn('E').width = 30;
    }

    // ── Hoja: Pararrayo ─────────────────────────────────────────────────────────
    if (exportOption === 'both' || exportOption === 'pararrayo') {
        const sheet = workbook.addWorksheet('Pararrayo');
        addEncabezado(sheet, workbook, l1Buf, l1Ext, l2Buf, l2Ext, header);

        // Anchos de columnas
        sheet.getColumn('A').width = 6;
        sheet.getColumn('B').width = 30;
        sheet.getColumn('C').width = 22;
        sheet.getColumn('D').width = 50;

        // --- SECCIÓN 1: Frecuencia anual de caída de rayos y Dimensiones ---
        sheet.addRow([]);
        sheet.addRow([]);
        const s1 = sheet.addRow(['', '1 Frecuencia anual de caída de rayos y Dimensiones']);
        s1.getCell(2).font = { bold: true, size: 16, underline: true };
        sheet.addRow([]);

        const tdRow = sheet.addRow(['', 'Td =', pararrayo.td, 'isocerauno']);
        const nkRow = sheet.addRow(['', 'Nk = Ng =', pararrayo.resultados?.nkng, 'rayos/km² año']);

        const rowL = sheet.addRow(['', 'Longitud (L) =', pararrayo.L, 'm']);
        const rowW = sheet.addRow(['', 'Ancho (W) =', pararrayo.W, 'm']);
        const rowH = sheet.addRow(['', 'Altura Estruct. (H) =', pararrayo.H, 'm']);

        [tdRow, nkRow, rowL, rowW, rowH].forEach(row => {
            row.height = 30;
            const valueCell = row.getCell(3);
            row.getCell(2).font = { size: 14, bold: true };
            valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC000' } };
            valueCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            valueCell.alignment = { horizontal: 'center', vertical: 'middle' };
            valueCell.font = { bold: true, size: 14 };
        });

        // --- SECCIÓN 2: Cálculo de Área Equivalente ---
        sheet.addRow([]);
        sheet.addRow([]);
        const s2 = sheet.addRow(['', '2 Cálculo de Área Equivalente']);
        s2.getCell(2).font = { bold: true, size: 16, underline: true };
        sheet.addRow([]);

        const rowAe = sheet.addRow(['', 'Ae =', pararrayo.resultados?.areaEquivalente, 'm²']);
        // Fórmula a la derecha
        sheet.getCell(`D${rowAe.number - 1}`).value = 'Ae = LW + 6H(L + W) + π9H²';
        sheet.getCell(`D${rowAe.number - 1}`).font = { bold: true, size: 16 };

        rowAe.height = 28;
        const aeCell = rowAe.getCell(3);
        rowAe.getCell(2).font = { size: 14, bold: true };
        aeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC000' } };
        aeCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        aeCell.alignment = { horizontal: 'center', vertical: 'middle' };
        aeCell.font = { bold: true, size: 14 };

        // --- SECCIÓN 3: Coeficientes de Riesgo ---
        sheet.addRow([]);
        sheet.addRow([]);
        const s3 = sheet.addRow(['', '3 Coeficientes de Riesgo']);
        s3.getCell(2).font = { bold: true, size: 16, underline: true };
        sheet.addRow([]);

        const coefRow = sheet.addRow(['', 'c1', 'c2', 'c3', 'c4', 'c5']);
        coefRow.height = 30;
        coefRow.eachCell((cell, colNumber) => {
            if (colNumber > 1) {
                cell.font = { bold: true, size: 14 };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            }
        });

        const valoresRow = sheet.addRow([
            '',
            pararrayo.c1,
            pararrayo.c2,
            pararrayo.c3,
            pararrayo.c4,
            pararrayo.c5,
        ]);
        valoresRow.height = 30;
        valoresRow.eachCell((cell, colNumber) => {
            if (colNumber > 1) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC000' } };
                cell.font = { bold: true, size: 14 };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            }
        });

        // --- SECCIÓN 4: Evaluación y comparación de riesgos ---
        sheet.addRow([]);
        sheet.addRow([]);
        sheet.addRow([]);
        const s4 = sheet.addRow(['', 'EVALUACIÓN Y COMPARACIÓN DE RIESGOS']);
        s4.getCell(2).font = { bold: true, italic: true, size: 15 };
        sheet.addRow([]);

        const headerRow = sheet.addRow(['', 'ÁREA (Ae)', 'Nd', 'Nc', 'REQUIERE PROTECCIÓN']);
        headerRow.height = 35;
        headerRow.eachCell((cell, colNumber) => {
            if (colNumber > 1) {
                cell.font = { bold: true, size: 14 };
                cell.fill = { type: 'pattern', pattern: 'none' };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.border = {
                    top: { style: 'medium' }, left: { style: 'medium' },
                    bottom: { style: 'medium' }, right: { style: 'medium' }
                };
            }
        });

        const dataRow = sheet.addRow([
            '',
            pararrayo.resultados?.areaEquivalente,
            pararrayo.resultados?.Nd,
            pararrayo.resultados?.nc,
            pararrayo.resultados?.requiereProteccion ? 'SI' : 'NO',
        ]);
        dataRow.height = 45;
        dataRow.eachCell((cell, colNumber) => {
            if (colNumber > 1) {
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.font = { bold: true, size: 15 };
                cell.border = {
                    top: { style: 'medium' }, left: { style: 'medium' },
                    bottom: { style: 'medium' }, right: { style: 'medium' }
                };
                if (colNumber === 5) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF00' } };
                } else {
                    cell.fill = { type: 'pattern', pattern: 'none' };
                }
            }
        });

        sheet.addRow([]);
        const eficienciaRow = sheet.addRow(['', '', '', '', '', '', 'EFICIENCIA REQUERIDA:', pararrayo.resultados?.eficienciaRequerida]);
        const nivelRow = sheet.addRow(['', '', '', '', '', '', 'NIVEL DE PROTECCIÓN:', pararrayo.resultados?.nivelProteccion]);

        [eficienciaRow, nivelRow].forEach(row => {
            row.getCell(7).font = { bold: true, size: 14 };
            row.getCell(8).font = { bold: true, size: 14, color: { argb: '0070C0' } };
        });
    }

    // ── Descarga ─────────────────────────────────────────────────────────────
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CÁLCULO SPAT PARARRAYOS - ${spreadsheetName}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
};