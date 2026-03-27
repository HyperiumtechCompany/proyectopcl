import ExcelJS from 'exceljs';

// ─── Tipos ────────────────────────────────────────────────────────────────────
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
    resultados: { calculado: boolean; resistencia: number } | null;
}

interface PararrayoData {
    td: number;
    L: number;
    W: number;
    H: number;
    h: number;
    c1: number; c2: number; c3: number; c4: number; c5: number;
    resultados: {
        calculado: boolean; nkng: number; areaEquivalente: number;
        Nd: number; nc: number; requiereProteccion: boolean;
        eficienciaRequerida: number; nivelProteccion: number;
    } | null;
}

interface HeaderData {
    proyecto: string; cui: string; codigoModular: string; codigoLocal: string;
    unidadEjecutora: string; distrito: string; provincia: string; departamento: string;
}

// Valores numéricos editables sobre la imagen real (cotas y profundidad)
export interface PozoImagenNumeros {
    cotaSuperiorTotal: string;
    cotaSuperiorSmall: string;
    cotaSuperiorMid: string;
    cotaVerticalTop: string;
    cotaVerticalMid: string;
    profundidadTotal: string;
}

export interface ExportPararrayosParams {
    logo1: File; logo2: File;
    exportOption: 'both' | 'pozo' | 'pararrayo';
    header: HeaderData;
    pozo: PozoData;
    pararrayo: PararrayoData;
    spreadsheetName: string;
    pozoImagenNumeros?: PozoImagenNumeros;      // valores editables de la imagen
    pozoImagenUrl?: string;                     // URL de la imagen real
}

// ─── Datos de terreno ────────────────────────────────────────────────────────
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

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fileToBuffer = (file: File): Promise<ArrayBuffer> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });

const fetchImageBuffer = async (url: string): Promise<ArrayBuffer> => {
    const response = await fetch(url);
    const blob = await response.blob();
    return await blob.arrayBuffer();
};

const addEncabezado = (
    sheet: ExcelJS.Worksheet, workbook: ExcelJS.Workbook,
    l1Buf: ArrayBuffer, l1Ext: string, l2Buf: ArrayBuffer, l2Ext: string,
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

const styleSeccion = (cell: ExcelJS.Cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '002060' } };
    cell.font = { bold: true, color: { argb: 'FFFFFF' }, size: 12 };
    cell.alignment = { horizontal: 'left', vertical: 'middle' };
};

const styleHeader = (cell: ExcelJS.Cell) => {
    cell.font = { bold: true, size: 11 };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D9E1F2' } };
    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
};

const styleDato = (cell: ExcelJS.Cell, highlight = false) => {
    cell.font = { bold: true, size: 11 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: highlight ? 'FFC000' : 'FFFFFF' } };
    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
};

// ─── FUNCIÓN PRINCIPAL ────────────────────────────────────────────────────────
export const exportToExcel = async ({
    logo1, logo2, exportOption, header, pozo, pararrayo, spreadsheetName,
    pozoImagenNumeros, pozoImagenUrl,
}: ExportPararrayosParams): Promise<void> => {

    const l1Buf = await fileToBuffer(logo1);
    const l2Buf = await fileToBuffer(logo2);
    const l1Ext = logo1.name.split('.').pop()?.toLowerCase().replace('jpg', 'jpeg') || 'png';
    const l2Ext = logo2.name.split('.').pop()?.toLowerCase().replace('jpg', 'jpeg') || 'png';

    const workbook = new ExcelJS.Workbook();
    const exportPozo = exportOption === 'both' || exportOption === 'pozo';
    const exportParaRayo = exportOption === 'both' || exportOption === 'pararrayo';

    // ══════════════════════════════════════════════════════════════════════════
    //  HOJA 1 — POZO A TIERRA
    // ══════════════════════════════════════════════════════════════════════════
    if (exportPozo) {
        const sheet = workbook.addWorksheet('Pozo a Tierra');
        addEncabezado(sheet, workbook, l1Buf, l1Ext, l2Buf, l2Ext, header);

        sheet.getColumn('A').width = 6;
        sheet.getColumn('B').width = 30;
        sheet.getColumn('C').width = 22;
        sheet.getColumn('D').width = 50;
        sheet.getColumn('E').width = 30;

        sheet.addRow([]);
        sheet.addRow([]);

        // Título (Sin subrayado azul, solo texto)
        const titleRow = sheet.addRow(['', 'CÁLCULO DE LA RESISTENCIA DE PUESTA A TIERRA']);
        sheet.mergeCells(`B${titleRow.number}:E${titleRow.number}`);
        titleRow.getCell(2).font = { bold: true, size: 16, color: { argb: '002060' } };
        titleRow.getCell(2).alignment = { horizontal: 'center' };
        titleRow.height = 28;
        sheet.addRow([]);

        // Ecuación
        const eqRow = sheet.addRow(['', 'Ecuación de cálculo:']);
        eqRow.getCell(2).font = { bold: true, italic: true, size: 12 };
        const formulaRow = sheet.addRow(['', 'R = (ρ / 2πL) × [ ln(4L / a) – 1 ]']);
        formulaRow.getCell(2).font = { name: 'Courier New', size: 13, bold: true, color: { argb: '002060' } };
        sheet.addRow([]);
        sheet.addRow([]);

        if (pozoImagenUrl) {
            try {
                const imgBuffer = await fetchImageBuffer(pozoImagenUrl);
                const imgId = workbook.addImage({
                    buffer: imgBuffer,
                    extension: 'png',
                });
                const imageRow = sheet.addRow([]);
                imageRow.height = 300;
                sheet.mergeCells(`B${imageRow.number}:E${imageRow.number}`);
                sheet.addImage(imgId, {
                    tl: { col: 1, row: imageRow.number - 1 },
                    ext: { width: 600, height: 400 },
                });
                sheet.addRow([]);
                sheet.addRow([]);
            } catch (err) {
                console.error('Error al cargar la imagen del pozo:', err);
            }
        }

        // ── COTAS EDITABLES (valores numéricos) ──
        if (pozoImagenNumeros) {
            const cotasTitleRow = sheet.addRow(['', 'COTAS DEL DIAGRAMA (editables)']);
            sheet.mergeCells(`B${cotasTitleRow.number}:E${cotasTitleRow.number}`);
            cotasTitleRow.getCell(2).font = { bold: true, size: 12, italic: true };
            cotasTitleRow.height = 24;
            sheet.addRow([]);

            const hCotas = sheet.addRow(['', 'Descripción', 'Valor (m)', '', '']);
            hCotas.height = 28;
            [2, 3].forEach(i => styleHeader(hCotas.getCell(i)));

            const cotasList = [
                { label: 'Cota superior total', value: pozoImagenNumeros.cotaSuperiorTotal },
                { label: 'Cota superior pequeña (0.075)', value: pozoImagenNumeros.cotaSuperiorSmall },
                { label: 'Cota superior media (0.45)', value: pozoImagenNumeros.cotaSuperiorMid },
                { label: 'Cota vertical superior (0.30)', value: pozoImagenNumeros.cotaVerticalTop },
                { label: 'Cota vertical media (0.10)', value: pozoImagenNumeros.cotaVerticalMid },
                { label: 'Profundidad total', value: pozoImagenNumeros.profundidadTotal },
            ];

            cotasList.forEach(({ label, value }) => {
                const row = sheet.addRow(['', label, value, '', '']);
                row.height = 24;
                row.getCell(2).font = { size: 11 };
                const valCell = row.getCell(3);
                valCell.value = value;
                valCell.font = { bold: true, size: 11, color: { argb: '000000' } }; // texto negro
                valCell.alignment = { horizontal: 'center' };
                valCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E9F0FF' } };
                valCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            });
            sheet.addRow([]);
            sheet.addRow([]);
        }

        // ── CARACTERÍSTICAS DEL TERRENO ──
        const tRow = sheet.addRow(['', 'CARACTERÍSTICAS DEL TERRENO']);
        sheet.mergeCells(`B${tRow.number}:E${tRow.number}`);
        // ELIMINADO: styleSeccion(tRow.getCell(2)); 
        tRow.getCell(2).font = { bold: true, size: 12 };
        tRow.height = 28;
        sheet.addRow([]);

        const hTer = sheet.addRow(['', 'I.E. N°', 'Tipo de Terreno', 'ρ (Ω·m)', 'Descripción']);
        hTer.height = 30;
        [2, 3, 4, 5].forEach(i => styleHeader(hTer.getCell(i)));

        const dataTer = sheet.addRow(['', '64193', pozo.tipoTerreno, pozo.resistividad, terrainDescs[pozo.tipoTerreno]]);
        dataTer.height = 28;
        [2, 3, 4, 5].forEach(i => styleDato(dataTer.getCell(i), true));

        sheet.addRow([]);
        const notaRow = sheet.addRow(['', 'Nota: la resistencia de terreno es de acuerdo al estudio de Suelos de perfil estratigráfico Tabla N°1']);
        sheet.mergeCells(`B${notaRow.number}:E${notaRow.number}`);
        notaRow.getCell(2).font = { italic: true, size: 9, color: { argb: '666666' } };
        sheet.addRow([]);
        sheet.addRow([]);

        // ── PARÁMETROS DE DISEÑO ──
        const paramRow = sheet.addRow(['', 'PARÁMETROS DE DISEÑO']);
        sheet.mergeCells(`B${paramRow.number}:E${paramRow.number}`);
        // ELIMINADO: styleSeccion(paramRow.getCell(2));
        paramRow.getCell(2).font = { bold: true, size: 12 };
        paramRow.height = 28;
        sheet.addRow([]);

        const hParam = sheet.addRow(['', 'Construir', 'Longitud L (m)', 'Diámetro Varilla a (m)', '']);
        hParam.height = 30;
        [2, 3, 4].forEach(i => styleHeader(hParam.getCell(i)));

        const dataParam = sheet.addRow(['', 'Pozo a Tierra', pozo.L, pozo.a, '']);
        dataParam.height = 28;
        [2, 3, 4].forEach(i => styleDato(dataParam.getCell(i), true));

        sheet.addRow([]);
        sheet.addRow([]);

        // ── RESULTADOS DE CÁLCULO ──
        const resTR = sheet.addRow(['', 'RESULTADOS DE CÁLCULO']);
        sheet.mergeCells(`B${resTR.number}:E${resTR.number}`);
        // ELIMINADO: styleSeccion(resTR.getCell(2));
        resTR.getCell(2).font = { bold: true, size: 12 };
        resTR.height = 28;
        sheet.addRow([]);

        const hRes = sheet.addRow(['', 'I.E. N°', 'Terreno', 'ρ (Ω·m)', 'R (Ω)']);
        hRes.height = 30;
        [2, 3, 4, 5].forEach(i => styleHeader(hRes.getCell(i)));

        const dataRes = sheet.addRow(['', '64193', pozo.tipoTerreno, pozo.resistividad, pozo.resultados!.resistencia]);
        dataRes.height = 30;
        [2, 3, 4].forEach(i => styleDato(dataRes.getCell(i), true));
        const rCell = dataRes.getCell(5);
        rCell.value = pozo.resultados!.resistencia;
        rCell.font = { bold: true, size: 14, color: { argb: '002060' } };
        rCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF00' } };
        rCell.alignment = { horizontal: 'center', vertical: 'middle' };
        rCell.border = { top: { style: 'medium' }, left: { style: 'medium' }, bottom: { style: 'medium' }, right: { style: 'medium' } };

        sheet.addRow([]);
        sheet.addRow([]);

        // ── REDUCCIÓN DE LA RESISTENCIA ──
        const redTR = sheet.addRow(['', 'REDUCCIÓN DE LA RESISTENCIA DE PUESTA A TIERRA']);
        sheet.mergeCells(`B${redTR.number}:E${redTR.number}`);
        // ELIMINADO: styleSeccion(redTR.getCell(2));
        redTR.getCell(2).font = { bold: true, size: 12 };
        redTR.height = 28;
        sheet.addRow([]);

        const hRed = sheet.addRow(['', 'R Inicial (Ω)', '% Reducción', 'R Final (Ω)', 'Descripción']);
        hRed.height = 30;
        [2, 3, 4, 5].forEach(i => styleHeader(hRed.getCell(i)));

        pozo.dosisReduccion.forEach((d: DosisReduccion) => {
            const row = sheet.addRow(['', d.rInicial, d.reduccion, d.rFinal, d.descripcion]);
            row.height = 28;
            [2, 3].forEach(i => styleDato(row.getCell(i), false));
            const rfCell = row.getCell(4);
            rfCell.value = d.rFinal;
            rfCell.font = { bold: true, size: 12, color: { argb: '00703C' } };
            rfCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2EFDA' } };
            rfCell.alignment = { horizontal: 'center', vertical: 'middle' };
            rfCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            styleDato(row.getCell(5), false);
        });
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  HOJA 2 — PARARRAYO
    // ══════════════════════════════════════════════════════════════════════════
    if (exportParaRayo) {
        const sheet = workbook.addWorksheet('Pararrayo');
        addEncabezado(sheet, workbook, l1Buf, l1Ext, l2Buf, l2Ext, header);

        sheet.getColumn('A').width = 6;
        sheet.getColumn('B').width = 30;
        sheet.getColumn('C').width = 22;
        sheet.getColumn('D').width = 50;

        sheet.addRow([]);
        sheet.addRow([]);

        // Título (Sin subrayados ni colores azules)
        const titleRow = sheet.addRow(['', 'CÁLCULO DEL PARARRAYO']);
        sheet.mergeCells(`B${titleRow.number}:D${titleRow.number}`);
        titleRow.getCell(2).font = { bold: true, size: 16, color: { argb: '002060' } };
        titleRow.getCell(2).alignment = { horizontal: 'center' };
        titleRow.height = 28;
        sheet.addRow([]);

        // ── SECCIÓN 1 ──
        const s1 = sheet.addRow(['', '1 Frecuencia anual de caída de rayos y Dimensiones']);
        sheet.mergeCells(`B${s1.number}:D${s1.number}`);
        // ELIMINADO: styleSeccion(s1.getCell(2)); <- Esto era lo que pintaba azul
        s1.getCell(2).font = { bold: true, size: 12 }; 
        s1.height = 28;
        sheet.addRow([]);

        const tdRow = sheet.addRow(['', 'Td =', pararrayo.td, 'isocerauno']);
        const nkRow = sheet.addRow(['', 'Nk = Ng =', pararrayo.resultados?.nkng ?? '-', 'rayos/km² año']);
        const rowL = sheet.addRow(['', 'Longitud (L) =', pararrayo.L, 'm']);
        const rowW = sheet.addRow(['', 'Ancho (W) =', pararrayo.W, 'm']);
        const rowH = sheet.addRow(['', 'Altura Estruct. (H) =', pararrayo.H, 'm']);

        [tdRow, nkRow, rowL, rowW, rowH].forEach(row => {
            row.height = 28;
            row.getCell(2).font = { size: 12, bold: true };
            const vc = row.getCell(3);
            vc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC000' } };
            vc.font = { bold: true, size: 12 };
            vc.alignment = { horizontal: 'center', vertical: 'middle' };
            vc.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });

        sheet.addRow([]);
        sheet.addRow([]);

        // ── SECCIÓN 2 ──
        const s2 = sheet.addRow(['', '2 Cálculo de Área Equivalente']);
        sheet.mergeCells(`B${s2.number}:D${s2.number}`);
        // ELIMINADO: styleSeccion(s2.getCell(2));
        s2.getCell(2).font = { bold: true, size: 12 };
        s2.height = 28;
        sheet.addRow([]);

        const formulaAe = sheet.addRow(['', 'Ae = LW + 6H(L + W) + π9H²']);
        formulaAe.getCell(2).font = { name: 'Courier New', size: 12, bold: true, color: { argb: '002060' } };

        const rowAe = sheet.addRow(['', 'Ae =', pararrayo.resultados?.areaEquivalente ?? '-', 'm²']);
        rowAe.height = 28;
        rowAe.getCell(2).font = { size: 12, bold: true };
        const aeCell = rowAe.getCell(3);
        aeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC000' } };
        aeCell.font = { bold: true, size: 14 };
        aeCell.alignment = { horizontal: 'center', vertical: 'middle' };
        aeCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

        sheet.addRow([]);
        sheet.addRow([]);

        // ── SECCIÓN 3 ──
        const s3 = sheet.addRow(['', '3 Coeficientes de Riesgo']);
        sheet.mergeCells(`B${s3.number}:D${s3.number}`);
        // ELIMINADO: styleSeccion(s3.getCell(2));
        s3.getCell(2).font = { bold: true, size: 12 };
        s3.height = 28;
        sheet.addRow([]);

        const coefRow = sheet.addRow(['', 'c1', 'c2', 'c3', 'c4', 'c5']);
        coefRow.height = 28;
        [2, 3, 4, 5, 6].forEach(i => styleHeader(coefRow.getCell(i)));

        const valRow = sheet.addRow(['', pararrayo.c1, pararrayo.c2, pararrayo.c3, pararrayo.c4, pararrayo.c5]);
        valRow.height = 28;
        [2, 3, 4, 5, 6].forEach(i => styleDato(valRow.getCell(i), true));

        sheet.addRow([]);
        sheet.addRow([]);
        sheet.addRow([]);

        // ── EVALUACIÓN ──
        const s4 = sheet.addRow(['', 'EVALUACIÓN Y COMPARACIÓN DE RIESGOS']);
        sheet.mergeCells(`B${s4.number}:E${s4.number}`);
        // ELIMINADO: styleSeccion(s4.getCell(2));
        s4.getCell(2).font = { bold: true, size: 12 };
        s4.height = 28;
        sheet.addRow([]);

        const hEv = sheet.addRow(['', 'ÁREA (Ae)', 'Nd', 'Nc', 'REQUIERE PROTECCIÓN']);
        hEv.height = 35;
        [2, 3, 4, 5].forEach(i => styleHeader(hEv.getCell(i)));

        const dataEv = sheet.addRow(['', pararrayo.resultados?.areaEquivalente, pararrayo.resultados?.Nd, pararrayo.resultados?.nc, pararrayo.resultados?.requiereProteccion ? 'SI' : 'NO']);
        dataEv.height = 40;
        [2, 3, 4].forEach(i => styleDato(dataEv.getCell(i), false));
        const protCell = dataEv.getCell(5);
        protCell.value = pararrayo.resultados?.requiereProteccion ? 'SI' : 'NO';
        protCell.font = { bold: true, size: 15, color: { argb: pararrayo.resultados?.requiereProteccion ? 'C00000' : '00703C' } };
        protCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF00' } };
        protCell.alignment = { horizontal: 'center', vertical: 'middle' };
        protCell.border = { top: { style: 'medium' }, left: { style: 'medium' }, bottom: { style: 'medium' }, right: { style: 'medium' } };

        sheet.addRow([]);
        const efRow = sheet.addRow(['', '', '', '', '', '', 'EFICIENCIA REQUERIDA:', pararrayo.resultados?.eficienciaRequerida ?? '-']);
        const nvRow = sheet.addRow(['', '', '', '', '', '', 'NIVEL DE PROTECCIÓN:', pararrayo.resultados?.nivelProteccion ?? '-']);
        [efRow, nvRow].forEach(row => {
            row.getCell(7).font = { bold: true, size: 12 };
            row.getCell(8).font = { bold: true, size: 13, color: { argb: '0070C0' } };
        });
    }

    // ── Descarga ──────────────────────────────────────────────────────────────
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CÁLCULO SPAT PARARRAYOS - ${spreadsheetName}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
};