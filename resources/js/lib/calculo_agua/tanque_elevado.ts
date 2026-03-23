import ExcelJS from 'exceljs';

interface TanqueData {
    consumoDiario?: number;
    largo?: number;
    ancho?: number;
    alturaAgua?: number;
    alturaUtil?: number;
    alturaLimpieza?: number;
    bordeLibre?: number;
    alturaTotal?: number;
    htecho?: number;
    hingreso?: number;
    hrebose?: number;
    alturalibre?: number;
    nivelFondoTanque?: number;
    porcentajeReserva?: number;
    [key: string]: any;
}

export async function exportTanqueElevadoToExcel(
    data: TanqueData,
    fileName: string = 'Tanque_Elevado'
) {
    const workbook = new ExcelJS.Workbook();
    const ws3 = workbook.addWorksheet('3. Tanque Elevado');
    const TS = 13; 
    ws3.columns = [
        { width: 3  }, 
        { width: 14 }, 
        { width: 14 }, 
        { width: 14 }, 
        { width: 14 }, 
        { width: 14 }, 
        { width: 14 }, 
        { width: 14 }, 
        { width: 14 }, 
        { width: 3  }, 
        { width: 24 }, 
        { width: 14 }, 
        { width: 6  }, 
    ];

    // --- Definición de constantes (igual que en el código original) ---
    const CS_BLANC = 'FFFFFFFF';
    const CS_NEGRO = 'FF000000';
    const CS_BLUE = 'FF0A2A4A';
    const CS_BLUE2 = 'FF2A5A8A';
    const CS_SEC = 'FFdce8f0';
    const CS_OK_BG = 'FFF5F5D8';
    const CS_WARN = 'FFFFF0F0';
    const CS_F4F8 = 'FFF4F8FC';
    const CS_F0F4FA = 'FFF0F4FA';
    const CS_FAFAF4 = 'FFFAFAF4';

    const c2BT = { style: 'thin' as ExcelJS.BorderStyle, color: { argb: 'FFBBBBBB' } };
    const c2BM = { style: 'medium' as ExcelJS.BorderStyle, color: { argb: 'FF888888' } };
    const c2BLU = { style: 'medium' as ExcelJS.BorderStyle, color: { argb: CS_BLUE2 } };
    const c2BBL = { style: 'thick' as ExcelJS.BorderStyle, color: { argb: CS_BLUE2 } };

    // --- Función svgToPngBase64 (copiada de la hoja 2) ---
    async function svgToPngBase64(svgStr: string, w: number, h: number): Promise<string> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = w; canvas.height = h;
                const ctx = canvas.getContext('2d')!;
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, w, h);
                ctx.drawImage(img, 0, 0, w, h);
                URL.revokeObjectURL(url);
                resolve(canvas.toDataURL('image/png').split(',')[1]);
            };
            img.onerror = reject;
            img.src = url;
        });
    }

    // --- Funciones auxiliares locales (c2Fill, c2Sep, c2Wide, pSectionLabel, pInputRow) ---
    function c2Fill(r: number, bg: string, h = 17) {
        ws3.getRow(r).height = h;
        for (let c = 1; c <= TS; c++) {
            ws3.getCell(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: c === 1 ? CS_BLANC : bg } };
        }
    }

    function c2Sep(r: number, h = 8) {
        ws3.getRow(r).height = h;
        for (let c = 1; c <= TS; c++) {
            ws3.getCell(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_BLANC } };
        }
    }

    function c2Wide(r: number, text: string, opts: {
        bg?: string; h?: number; bold?: boolean; size?: number;
        color?: string; halign?: ExcelJS.Alignment['horizontal'];
        italic?: boolean; borderStyle?: 'all' | 'bottom';
    } = {}) {
        const bg = opts.bg ?? CS_BLANC;
        c2Fill(r, bg, opts.h ?? 18);
        ws3.mergeCells(r, 2, r, TS);
        const cell = ws3.getCell(r, 2);
        cell.value = text;
        cell.font = { bold: opts.bold ?? false, size: opts.size ?? 10, name: 'Arial', italic: opts.italic ?? false, color: { argb: opts.color ?? CS_NEGRO } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        cell.alignment = { horizontal: opts.halign ?? 'left', vertical: 'middle', indent: 1, wrapText: true };
        if (opts.borderStyle === 'all')
            cell.border = { top: c2BT, left: c2BM, bottom: c2BT, right: c2BM };
        else if (opts.borderStyle === 'bottom')
            cell.border = { bottom: c2BBL };
    }

    const P = 11;
    const pBT = { style: 'thin' as ExcelJS.BorderStyle, color: { argb: 'FFCCCCCC' } };
    const pBM = { style: 'medium' as ExcelJS.BorderStyle, color: { argb: 'FF90B0CC' } };

    function pSectionLabel(r: number, text: string, bg: string, textColor: string) {
        ws3.getRow(r).height = 18;
        ws3.mergeCells(r, P, r, 13);
        const cell = ws3.getCell(r, P);
        cell.value = text;
        cell.font = { bold: true, size: 8, name: 'Arial', color: { argb: textColor } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        cell.border = { top: pBM, left: pBM, bottom: pBM, right: pBM };
    }

    function pInputRow(r: number, label: string, val: number, highlight: boolean, unit: string = 'm') {
        ws3.getRow(r).height = 20;
        const bg = highlight ? 'FFFFFBE6' : 'FFFFFFFF';
        const bc = highlight
            ? { style: 'medium' as ExcelJS.BorderStyle, color: { argb: 'FFD4A020' } }
            : { style: 'thin' as ExcelJS.BorderStyle, color: { argb: 'FFD0D0D0' } };
        const lc = ws3.getCell(r, P);
        lc.value = label;
        lc.font = { size: 10, name: 'Arial', bold: highlight, color: { argb: 'FF222222' } };
        lc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        lc.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        lc.border = { top: bc, left: bc, bottom: bc };
        const vc = ws3.getCell(r, 12);
        vc.value = val;
        vc.numFmt = '0.00';
        vc.font = { size: 12, bold: true, name: 'Courier New', color: { argb: 'FF000000' } };
        vc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        vc.alignment = { horizontal: 'right', vertical: 'middle' };
        vc.border = { top: bc, bottom: bc };
        const uc = ws3.getCell(r, 13);
        uc.value = unit;
        uc.font = { size: 9, name: 'Arial', color: { argb: 'FF666666' } };
        uc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        uc.alignment = { horizontal: 'left', vertical: 'middle' };
        uc.border = { top: bc, right: bc, bottom: bc };
    }

    // ---------- Datos del tanque ----------
    const tqD = data;
    
    // Usamos String(...) para asegurar que parseFloat reciba el tipo de dato correcto
    const tqConsumo = parseFloat(String(tqD.consumoDiario || 0));
    const tqLargo = parseFloat(String(tqD.largo || 4.40));
    const tqAncho = parseFloat(String(tqD.ancho || 2.70));
    const tqAlturaAgua = parseFloat(String(tqD.alturaAgua ?? tqD.alturaUtil ?? 1.15));
    const tqAlturaLimpieza = parseFloat(String(tqD.alturaLimpieza || 0.10));
    const tqBordeLibre = parseFloat(String(tqD.bordeLibre || 0.45));
    const tqAlturaTotal = parseFloat(String(tqD.alturaTotal || 1.70));
    const tqHtecho = parseFloat(String(tqD.htecho || 0.20));
    const tqHingreso = parseFloat(String(tqD.hingreso || 0.15));
    const tqHrebose = parseFloat(String(tqD.hrebose || 0.10));
    const tqAlturaLibre = parseFloat(String(tqD.alturalibre || 0.10));
    const tqNivelFondo = parseFloat(String(tqD.nivelFondoTanque || 14.70));
    const tqPorcentajeReserva = parseFloat(String(tqD.porcentajeReserva || 25));
    // ---------- Cálculos ----------
    const ceil1 = (v: number) => Math.ceil(v * 10) / 10;
    const volumenTE = ceil1(((1 / 3) * tqConsumo) / 1000);
    const hReservaFactor = 1 + tqPorcentajeReserva / 100;
    const volumenTotal = Math.round((volumenTE * hReservaFactor + Number.EPSILON) * 100) / 100;
    const area = tqLargo * tqAncho;
    const alturaAguaMin = volumenTotal / area;
    const volumenCalc = tqLargo * tqAncho * tqAlturaAgua;
    const ok = volumenCalc >= volumenTE;

    // Niveles calculados
    const fondo = tqNivelFondo;
    const interior_top = fondo + tqAlturaTotal;
    const roof_top = interior_top + tqHtecho;
    const ingreso = interior_top - tqHingreso;
    const rebose = ingreso - tqHrebose;
    const agua_bot = rebose - tqAlturaAgua;
    const salida = fondo + tqAlturaLibre;

    const sign = (v: number) => (v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2));

    // ---------- Construcción de la hoja ----------
    let tr = 1;

    // Título principal
    c2Fill(tr, CS_BLANC, 36);
    ws3.mergeCells(tr, 2, tr, TS);
    const titulo3 = ws3.getCell(tr, 2);
    titulo3.value = '3. TANQUE ELEVADO';
    titulo3.font = { bold: true, size: 16, name: 'Times New Roman', color: { argb: CS_BLUE } };
    titulo3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_BLANC } };
    titulo3.alignment = { horizontal: 'left', vertical: 'bottom' };
    titulo3.border = { bottom: c2BBL };
    tr++;
    c2Sep(tr, 14); tr++;

    // Sección 3.1.1
    c2Fill(tr, CS_SEC, 26);
    ws3.mergeCells(tr, 2, tr, TS);
    const sec311 = ws3.getCell(tr, 2);
    sec311.value = '3.1.1. CÁLCULO DE VOLUMEN DEL TANQUE ELEVADO';
    sec311.font = { bold: true, size: 12, name: 'Arial', color: { argb: CS_NEGRO } };
    sec311.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_SEC } };
    sec311.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    sec311.border = { top: c2BT, left: c2BT, bottom: c2BT, right: c2BT };
    tr++;
    c2Sep(tr, 8); tr++;

    // Fórmula
    c2Fill(tr, CS_FAFAF4, 30);
    ws3.mergeCells(tr, 2, tr, TS);
    const formula = ws3.getCell(tr, 2);
    formula.value = 'VOL. DE TANQUE ELEVADO = 1/3 × CONSUMO DIARIO TOTAL';
    formula.font = { bold: true, size: 13, name: 'Arial', italic: true, color: { argb: CS_NEGRO } };
    formula.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_FAFAF4 } };
    formula.alignment = { horizontal: 'center', vertical: 'middle' };
    formula.border = { top: c2BT, left: c2BT, bottom: c2BT, right: c2BT };
    tr++;
    c2Sep(tr, 8); tr++;

    // Tarjetas de resumen
    ws3.getRow(tr).height = 58;
    for (let c = 1; c <= TS; c++) ws3.getCell(tr, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_BLANC } };
    [
        { lbl: 'CONSUMO DIARIO', val: `${tqConsumo.toFixed(2)} Lt`, bg: 'FFF8FAFC', vc: 'FF1A4A7A' },
        { lbl: 'VOL. DE T.E.', val: `${volumenTE.toFixed(2)} m³`, bg: 'FFEAF0FA', vc: 'FF1A4A7A' },
        { lbl: 'VOL. TOTAL + RESERVA', val: `${volumenTotal.toFixed(2)} m³`, bg: 'FFEAF5EE', vc: 'FF2A6A4A' },
        { lbl: 'ALTURA DE AGUA MÍN.', val: `${alturaAguaMin.toFixed(2)} m`, bg: 'FFFAF0E8', vc: 'FF6A3A1A' },
    ].forEach((card, i) => {
        const cell = ws3.getCell(tr, i + 2);
        cell.value = {
            richText: [
                { text: card.lbl + '\n', font: { size: 8, color: { argb: 'FF666666' }, name: 'Arial' } },
                { text: card.val, font: { size: 14, bold: true, color: { argb: card.vc }, name: 'Arial' } },
            ]
        } as ExcelJS.CellRichTextValue;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: card.bg } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        const bc = { style: 'medium' as ExcelJS.BorderStyle, color: { argb: card.vc } };
        cell.border = { top: bc, left: bc, bottom: bc, right: bc };
    });
    tr++;
    c2Sep(tr, 12); tr++;

    // Consumo Diario Total
    c2Fill(tr, CS_BLANC, 22);
    ws3.mergeCells(tr, 2, tr, 4);
    const conLbl = ws3.getCell(tr, 2);
    conLbl.value = 'Consumo Diario Total (Lt/día):';
    conLbl.font = { size: 11, name: 'Arial', color: { argb: 'FF555555' } };
    conLbl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_BLANC } };
    conLbl.alignment = { horizontal: 'left', vertical: 'middle' };
    const conVal = ws3.getCell(tr, 5);
    conVal.value = tqConsumo;
    conVal.numFmt = '0';
    conVal.font = { size: 12, name: 'Courier New', color: { argb: CS_NEGRO } };
    conVal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F2' } };
    conVal.alignment = { horizontal: 'center', vertical: 'middle' };
    conVal.border = { top: c2BT, left: c2BT, bottom: c2BT, right: c2BT };
    ws3.mergeCells(tr, 6, tr, TS);
    ws3.getCell(tr, 6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_BLANC } };
    tr++;
    c2Sep(tr, 8); tr++; tr++;

    // Texto intro
    c2Wide(tr, 'Tanque Elevado de cuyas dimensiones serán:', { size: 12, h: 22 }); tr++;
    c2Sep(tr, 8); tr++; tr++;

    // Inputs Largo, Ancho, Altura
    const rDimStart = tr;
    [
        { lbl: 'Largo (L) =', v: tqLargo },
        { lbl: 'Ancho (A) =', v: tqAncho },
        { lbl: 'Altura agua (H) =', v: tqAlturaAgua },
    ].forEach(dim => {
        ws3.getRow(tr).height = 26;
        ws3.getCell(tr, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_BLANC } };
        const lc = ws3.getCell(tr, 2);
        lc.value = dim.lbl;
        lc.font = { size: 12, name: 'Times New Roman', color: { argb: CS_NEGRO } };
        lc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_BLANC } };
        lc.alignment = { horizontal: 'right', vertical: 'middle' };
        const vc = ws3.getCell(tr, 3);
        vc.value = dim.v;
        vc.numFmt = '0.00 "m"';
        vc.font = { size: 14, bold: true, name: 'Courier New', color: { argb: CS_NEGRO } };
        vc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_BLANC } };
        vc.alignment = { horizontal: 'right', vertical: 'middle' };
        vc.border = { top: c2BLU, left: c2BLU, bottom: c2BLU, right: c2BLU };
        ws3.getCell(tr, 4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_BLANC } };
        for (let c = 5; c <= TS; c++) ws3.getCell(tr, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_F0F4FA } };
        tr++;
    });
    ws3.mergeCells(rDimStart, 5, tr - 1, TS);
    const noteCell = ws3.getCell(rDimStart, 5);
    noteCell.value = 'Altura asumida como mínimo para mantenimiento y limpieza de tanque elevado';
    noteCell.font = { bold: true, size: 11, name: 'Arial', color: { argb: 'FF0A2A5A' } };
    noteCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_F0F4FA } };
    noteCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    noteCell.border = { top: c2BLU, left: c2BLU, bottom: c2BLU, right: c2BLU };
    c2Sep(tr, 8); tr++; tr++;

    // Caja de volumen
    const volBg = ok ? CS_OK_BG : CS_WARN;
    c2Fill(tr, volBg, 32);
    ws3.mergeCells(tr, 2, tr, TS);
    const volBox = ws3.getCell(tr, 2);
    volBox.value = `VOLUMEN DE TANQUE ELEVADO = ${volumenCalc.toFixed(2)} m³` +
        (ok ? '' : `   ⚠ CORREGIR DIMENSIONES (mín. ${volumenTE.toFixed(2)} m³)`);
    volBox.font = { bold: true, size: 14, name: 'Arial', color: { argb: ok ? CS_NEGRO : 'FFCC0000' } };
    volBox.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: volBg } };
    volBox.alignment = { horizontal: 'center', vertical: 'middle' };
    volBox.border = { top: c2BM, left: c2BM, bottom: c2BM, right: c2BM };
    tr++;
    c2Sep(tr, 18); tr++;

    // Sección 3.1.2
    c2Fill(tr, CS_SEC, 26);
    ws3.mergeCells(tr, 2, tr, TS);
    const sec312 = ws3.getCell(tr, 2);
    sec312.value = '3.1.2. DIMENSIONES DEL TANQUE ELEVADO';
    sec312.font = { bold: true, size: 12, name: 'Arial', color: { argb: CS_NEGRO } };
    sec312.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_SEC } };
    sec312.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    sec312.border = { top: c2BT, left: c2BT, bottom: c2BT, right: c2BT };
    tr++;
    c2Sep(tr, 6); tr++;

    // Tabla de descripciones
    [
        { k: 'ANCHO', d: 'Ancho del Tanque Elevado' },
        { k: 'LARGO', d: 'Largo del Tanque Elevado' },
        { k: 'ALTURA DE AGUA', d: 'Altura de agua del Tanque Elevado' },
        { k: 'ALTURA DE TUB. REBOSE', d: 'La distancia vertical entre los ejes del tubo de rebose y el máximo nivel de agua será igual al diámetro de aquel y nunca inferior a 0,10 m' },
        { k: 'ALTURA DE TUB. DE INGRESO', d: 'La distancia vertical entre los ejes de tubos de rebose y entrada de agua será igual al doble del diámetro del primero y en ningún caso menor de 0,15 m' },
        { k: 'ALTURA DE NIVEL DE TECHO', d: 'La distancia vertical entre el techo del depósito y el eje del tubo de entrada de agua, dependerá del diámetro de este, no pudiendo ser menor de 0,20 m' },
    ].forEach(row => {
        ws3.getRow(tr).height = 34;
        ws3.getCell(tr, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_BLANC } };
        const kc = ws3.getCell(tr, 2);
        kc.value = row.k;
        kc.font = { bold: true, size: 10, name: 'Arial', color: { argb: CS_NEGRO } };
        kc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_F4F8 } };
        kc.alignment = { horizontal: 'left', vertical: 'middle', indent: 1, wrapText: true };
        kc.border = { top: c2BT, left: c2BT, bottom: c2BT, right: c2BT };
        ws3.mergeCells(tr, 3, tr, TS);
        const dc = ws3.getCell(tr, 3);
        dc.value = row.d;
        dc.font = { size: 10, name: 'Arial', color: { argb: CS_NEGRO } };
        dc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_BLANC } };
        dc.alignment = { horizontal: 'left', vertical: 'middle', indent: 1, wrapText: true };
        dc.border = { top: c2BT, left: c2BT, bottom: c2BT, right: c2BT };
        tr++;
    });
    c2Sep(tr, 12); tr++; tr++;

    c2Wide(tr, 'Tanque elevado cuyas dimensiones serán:', { size: 12, h: 22 }); tr++;
    c2Sep(tr, 8); tr++;

    // --- ZONA HÍBRIDA (SVG + panel derecho) ---
    const IMG_W_TANQUE = 820, IMG_H_TANQUE = 520;
    const tqImgStart = tr;
    const tqImgRows = 34;

    for (let i = 0; i < tqImgRows; i++) {
        const r = tr + i;
        ws3.getRow(r).height = 16.5;
        ws3.getCell(r, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_BLANC } };
        for (let c = 2; c <= 9; c++) ws3.getCell(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_BLANC } };
        ws3.getCell(r, 10).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_BLANC } };
        for (let c = 11; c <= 13; c++) ws3.getCell(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_F4F8 } };
    }

    // Insertar imagen SVG
    try {
        function buildTanqueSVG(d: any): string {
            const dim = { 
                largo: parseFloat(d.largo) || 4.40,
                ancho: parseFloat(d.ancho) || 2.70,
                alturaAgua: parseFloat(d.alturaAgua ?? d.alturaUtil) || 1.15,
                alturaLimpieza: parseFloat(d.alturaLimpieza) || 0.10,
                bordeLibre: parseFloat(d.bordeLibre) || 0.45,
                alturaTotal: parseFloat(d.alturaTotal) || 1.70,
                htecho: parseFloat(d.htecho) || 0.20,
                hingreso: parseFloat(d.hingreso) || 0.15,
                hrebose: parseFloat(d.hrebose) || 0.10,
                alturalibre: parseFloat(d.alturalibre) || 0.10,
                nivelFondoTanque: parseFloat(d.nivelFondoTanque) || 14.70,
                porcentajeReserva: parseFloat(d.porcentajeReserva) || 25,
            };
            const parseNum = (v: any, fb = 0) => {
                if (v === '' || v === null || v === undefined) return fb;
                const n = Number(String(v).replace(',', '.'));
                return Number.isFinite(n) ? n : fb;
            };
            const fmt = (v: number, d = 2) => Number.isFinite(v) ? v.toFixed(d) : '0.00';
            const sign = (v: number) => (v >= 0 ? `+${fmt(v)}` : fmt(v));

            const fondo = parseNum(dim.nivelFondoTanque);
            const interior_top = fondo + parseNum(dim.alturaTotal);
            const roof_top = interior_top + parseNum(dim.htecho);
            const ingreso = interior_top - parseNum(dim.hingreso);
            const rebose = ingreso - parseNum(dim.hrebose);
            const agua_bot = rebose - parseNum(dim.alturaAgua);
            const salida = fondo + parseNum(dim.alturalibre);

            const VW = 820, VH = 520;
            const tL = 46, tW = 270;
            const yTop = 72, yBot = 440;
            const span = yBot - yTop;
            const wT = 18, rT = 14;

            const e2y = (e: number) => yTop + ((roof_top - e) / (roof_top - fondo)) * span;

            const yRoof = yTop;
            const yIntTop = e2y(interior_top);
            const yIng = e2y(ingreso);
            const yReb = e2y(rebose);
            const yAguaBot = e2y(agua_bot);
            const ySal = e2y(salida);
            const yFondo = yBot;

            const iL = tL + wT, iR = tL + tW - wT, iW = iR - iL;

            const aX = tL + tW + 30;
            const bW = 32;
            const lX = aX + bW + 12;
            const nBW = 130;
            const nBX = VW - nBW - 6;

            const bracket = (y1: number, y2: number, color: string, lbl: string, sub: string, val: string) => {
                if (!isFinite(y1) || !isFinite(y2) || Math.abs(y2 - y1) < 5) return '';
                const my = (y1 + y2) / 2;
                return `
                    <line x1="${aX}" y1="${y1}" x2="${aX}" y2="${y2}" stroke="${color}" stroke-width="2"/>
                    <line x1="${aX}" y1="${y1}" x2="${aX + bW}" y2="${y1}" stroke="${color}" stroke-width="2"/>
                    <line x1="${aX}" y1="${y2}" x2="${aX + bW}" y2="${y2}" stroke="${color}" stroke-width="2"/>
                    <text x="${lX}" y="${my - 7}" font-size="12" fill="#111" font-family="'Courier New',monospace">${lbl} ${sub}</text>
                    <text x="${lX}" y="${my + 9}" font-size="13" font-weight="bold" fill="#111" font-family="'Courier New',monospace">= ${val} m</text>
                `;
            };

            const nvBox = (y: number, label: string, red = false) => `
                <line x1="${iR + 2}" y1="${y}" x2="${nBX - 8}" y2="${y}"
                    stroke="${red ? '#c00' : '#999'}" stroke-width="${red ? 1.5 : 0.8}" stroke-dasharray="${red ? '0' : '5 3'}"/>
                <line x1="${nBX - 8}" y1="${y}" x2="${nBX}" y2="${y}" stroke="${red ? '#c00' : '#555'}" stroke-width="1.5"/>
                <rect x="${nBX}" y="${y - 11}" width="${nBW}" height="22" rx="2"
                    fill="${red ? '#fff0f0' : 'white'}" stroke="${red ? '#c00' : '#999'}" stroke-width="1.5"/>
                <text x="${nBX + nBW / 2}" y="${y + 1}" text-anchor="middle" dominant-baseline="middle"
                    font-size="11" fill="${red ? '#c00' : '#222'}" font-family="'Courier New',monospace" font-weight="${red ? 'bold' : 'normal'}">
                    Nivel = ${label} m
                </text>
            `;

            return `<svg viewBox="0 0 ${VW} ${VH}" width="${VW}" height="${VH}" xmlns="http://www.w3.org/2000/svg">
                <rect width="${VW}" height="${VH}" fill="white"/>
                <defs>
                    <pattern id="hatch" patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(45)">
                        <line x1="0" y1="0" x2="0" y2="7" stroke="#999" stroke-width="1" opacity="0.5"/>
                    </pattern>
                </defs>
                <text x="${tL}" y="${yTop - 13}" font-size="13" fill="#111" font-family="'Courier New',monospace" font-weight="bold">
                    Nivel = ${sign(roof_top)} m
                </text>
                <rect x="${tL}" y="${yRoof}" width="${tW}" height="${yFondo - yRoof + rT}" fill="#c8c8c0" stroke="#666" stroke-width="2" rx="3"/>
                <rect x="${tL}" y="${yFondo}" width="${tW}" height="${rT}" fill="#b8b8b0" stroke="#666" stroke-width="2"/>
                <rect x="${tL}" y="${yRoof}" width="${wT}" height="${yFondo - yRoof}" fill="url(#hatch)"/>
                <rect x="${iR}" y="${yRoof}" width="${wT}" height="${yFondo - yRoof}" fill="url(#hatch)"/>
                <rect x="${tL}" y="${yRoof}" width="${tW}" height="${yIntTop - yRoof}" fill="url(#hatch)"/>
                <rect x="${tL}" y="${yFondo}" width="${tW}" height="${rT}" fill="url(#hatch)"/>
                <rect x="${iL}" y="${yIntTop}" width="${iW}" height="${yFondo - yIntTop}" fill="white"/>
                <rect x="${iL}" y="${yIntTop}" width="${iW}" height="${Math.max(yReb - yIntTop, 0)}" fill="#f0f0ea"/>
                <rect x="${iL}" y="${yReb}" width="${iW}" height="${Math.max(yAguaBot - yReb, 0)}" fill="#c5e5f8"/>
                ${(ySal - yAguaBot) > 0 ? `<rect x="${iL}" y="${yAguaBot}" width="${iW}" height="${Math.max(ySal - yAguaBot, 0)}" fill="#f0edcc" opacity="0.7"/>` : ''}
                <rect x="${iL}" y="${yIntTop}" width="${iW}" height="${yFondo - yIntTop}" fill="none" stroke="#888" stroke-width="1.5"/>
                ${(yReb - yIntTop) > 28 ? `<text x="${iL + iW / 2}" y="${(yIntTop + yReb) / 2}" font-size="20" font-family="'Courier New',monospace" font-weight="bold" fill="#bbb" text-anchor="middle" dominant-baseline="middle" transform="rotate(-20,${iL + iW / 2},${(yIntTop + yReb) / 2})" letter-spacing="3" opacity="0.7">BORDE LIBRE</text>` : ''}
                <line x1="${iL + 4}" y1="${yIng}" x2="${iR - 4}" y2="${yIng}" stroke="#cc7744" stroke-width="1.5" stroke-dasharray="8 5"/>
                <line x1="${iL + 4}" y1="${yReb}" x2="${iR - 4}" y2="${yReb}" stroke="#559944" stroke-width="1.5" stroke-dasharray="8 5"/>
                <line x1="${iL + 4}" y1="${yAguaBot}" x2="${iR - 4}" y2="${yAguaBot}" stroke="#4488bb" stroke-width="1.5" stroke-dasharray="8 5"/>
                <line x1="${iL + 4}" y1="${ySal}" x2="${iR - 4}" y2="${ySal}" stroke="#999999" stroke-width="1.5" stroke-dasharray="8 5"/>
                <rect x="${iR + 1}" y="${yIng - 12}" width="7" height="24" fill="#cc7744" stroke="#994422" stroke-width="1"/>
                <rect x="${iR - 8}" y="${yIng - 8}" width="20" height="16" fill="#cc7744" stroke="#994422" stroke-width="1.5" rx="2"/>
                <rect x="${iR + 1}" y="${yReb - 12}" width="7" height="24" fill="#559944" stroke="#337722" stroke-width="1"/>
                <rect x="${iR - 8}" y="${yReb - 8}" width="20" height="16" fill="#559944" stroke="#337722" stroke-width="1.5" rx="2"/>
                <rect x="${iR + 1}" y="${ySal - 10}" width="7" height="20" fill="#aab0b8" stroke="#7a8088" stroke-width="1"/>
                <rect x="${iR - 8}" y="${ySal - 7}" width="20" height="14" fill="#aab0b8" stroke="#7a8088" stroke-width="1.5" rx="2"/>
                ${bracket(yIntTop, yIng, '#994422', 'H. techo', '(Ht)', fmt(dim.htecho))}
                ${bracket(yIng, yReb, '#337722', 'H. ingreso', '(Hi)', fmt(dim.hingreso))}
                ${bracket(ySal, yFondo, '#7a8088', 'Altura Libre', '(HL)', fmt(dim.alturalibre))}
                ${(yAguaBot - yReb) > 20 ? `<text x="${lX}" y="${(yReb + yAguaBot) / 2}" dominant-baseline="middle" font-size="13" fill="#111" font-family="'Courier New',monospace">Altura de agua (Ha) = <tspan font-weight="bold">${fmt(dim.alturaAgua)} m</tspan></text>` : ''}
                ${nvBox(yIntTop, sign(interior_top))}
                ${nvBox(yIng, sign(ingreso))}
                ${nvBox(yReb, sign(rebose))}
                ${nvBox(ySal, sign(salida), true)}
                ${nvBox(yFondo, sign(fondo))}
                <line x1="${iL}" y1="${yFondo + 32}" x2="${iR}" y2="${yFondo + 32}" stroke="#333" stroke-width="1.5"/>
                <line x1="${iL}" y1="${yFondo + 26}" x2="${iL}" y2="${yFondo + 38}" stroke="#333" stroke-width="1.5"/>
                <line x1="${iR}" y1="${yFondo + 26}" x2="${iR}" y2="${yFondo + 38}" stroke="#333" stroke-width="1.5"/>
                <text x="${(iL + iR) / 2}" y="${yFondo + 50}" text-anchor="middle" font-size="12" fill="#333" font-family="'Courier New',monospace">L = ${fmt(dim.largo)} m</text>
                <line x1="${tL - 22}" y1="${yIntTop}" x2="${tL - 22}" y2="${yFondo}" stroke="#333" stroke-width="1.5"/>
                <line x1="${tL - 30}" y1="${yIntTop}" x2="${tL - 14}" y2="${yIntTop}" stroke="#333" stroke-width="1.5"/>
                <line x1="${tL - 30}" y1="${yFondo}" x2="${tL - 14}" y2="${yFondo}" stroke="#333" stroke-width="1.5"/>
                <text x="${tL - 38}" y="${(yIntTop + yFondo) / 2}" text-anchor="middle" transform="rotate(-90,${tL - 38},${(yIntTop + yFondo) / 2})" font-size="12" fill="#333" font-family="'Courier New',monospace">HT = ${fmt(dim.alturaTotal)} m</text>
            </svg>`;
        }

        const svgStr = buildTanqueSVG(tqD);
        const pngB64 = await svgToPngBase64(svgStr, IMG_W_TANQUE, IMG_H_TANQUE);
        const imgId = workbook.addImage({ base64: pngB64, extension: 'png' });
        ws3.addImage(imgId, {
            tl: { nativeCol: 1, nativeRow: tqImgStart - 1 },
            ext: { width: IMG_W_TANQUE, height: IMG_H_TANQUE },
            editAs: 'oneCell',
        } as any);
    } catch (e) {
        console.warn('SVG tanque error:', e);
    }

    // --- Panel derecho ---
    let pr = tqImgStart;

    pSectionLabel(pr, '📐  Predimensionamiento', CS_F4F8, 'FF0A2A4A'); pr++;

    const okArgb = ok ? 'FFE8F5E8' : 'FFFEEAEA';
    const okTxtArg = ok ? 'FF2A6A2A' : 'FFCC0000';
    const okBordA = ok ? 'FF4A8A4A' : 'FFCC4444';
    const okBord2 = { style: 'medium' as ExcelJS.BorderStyle, color: { argb: okBordA } };

    ws3.getRow(pr).height = 20;
    ws3.mergeCells(pr, P, pr, 13);
    const okTit = ws3.getCell(pr, P);
    okTit.value = ok ? '✓  Volumen OK' : '✗  Revisar volumen';
    okTit.font = { bold: true, size: 11, name: 'Arial', color: { argb: okTxtArg } };
    okTit.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: okArgb } };
    okTit.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    okTit.border = { top: okBord2, left: okBord2, right: okBord2 };
    pr++;

    [
        { lbl: 'Requerido:', val: `${volumenTE.toFixed(2)} m³` },
        { lbl: `Reserva (${tqPorcentajeReserva}%):`, val: `${(volumenTotal - volumenTE).toFixed(2)} m³` },
        { lbl: 'Calculado:', val: `${volumenCalc.toFixed(2)} m³` },
        { lbl: 'Área base:', val: `${area.toFixed(2)} m²` },
    ].forEach((kv, ki) => {
        ws3.getRow(pr).height = 15;
        const lc = ws3.getCell(pr, P);
        lc.value = kv.lbl;
        lc.font = { size: 9, name: 'Arial', color: { argb: 'FF555555' } };
        lc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: okArgb } };
        lc.alignment = { horizontal: 'left', vertical: 'middle', indent: 2 };
        lc.border = { left: okBord2, ...(ki === 3 ? { bottom: okBord2 } : {}) };
        ws3.mergeCells(pr, 12, pr, 13);
        const vc = ws3.getCell(pr, 12);
        vc.value = kv.val;
        vc.font = { size: 9, bold: true, name: 'Courier New', color: { argb: 'FF333333' } };
        vc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: okArgb } };
        vc.alignment = { horizontal: 'right', vertical: 'middle' };
        vc.border = { right: okBord2, ...(ki === 3 ? { bottom: okBord2 } : {}) };
        pr++;
    });

    ws3.getRow(pr).height = 6;
    for (let c = P; c <= 13; c++) ws3.getCell(pr, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_F4F8 } };
    pr++;

    pInputRow(pr, '% Reserva', tqPorcentajeReserva, false, '%'); pr++;

    pSectionLabel(pr, '★  GEOMETRÍA PRINCIPAL', CS_F4F8, 'FF1A4A7A'); pr++;
    pInputRow(pr, 'Largo (L)', tqLargo, true); pr++;
    pInputRow(pr, 'Ancho (A)', tqAncho, true); pr++;
    pInputRow(pr, 'Altura Agua (H)', tqAlturaAgua, true); pr++;
    pInputRow(pr, 'Alt. Limpieza', tqAlturaLimpieza, false); pr++;
    pInputRow(pr, 'Borde Libre (bl)', tqBordeLibre, false); pr++;
    pInputRow(pr, 'Altura Total (HT)', tqAlturaTotal, false); pr++;

    ws3.getRow(pr).height = 6;
    for (let c = P; c <= 13; c++) ws3.getCell(pr, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_F4F8 } };
    pr++;

    pSectionLabel(pr, 'NIVEL Y TUBERÍAS', CS_F4F8, 'FF1A4A7A'); pr++;
    pInputRow(pr, 'Nivel Fondo (m)', tqNivelFondo, false); pr++;
    pInputRow(pr, 'H. Techo (Ht)', tqHtecho, false); pr++;
    pInputRow(pr, 'H. Ingreso (Hi)', tqHingreso, false); pr++;
    pInputRow(pr, 'H. Rebose (Hr)', tqHrebose, false); pr++;
    pInputRow(pr, 'Altura Libre (HL)', tqAlturaLibre, false); pr++;

    while (pr < tqImgStart + tqImgRows) {
        ws3.getRow(pr).height = 16.5;
        for (let c = P; c <= 13; c++) ws3.getCell(pr, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_F4F8 } };
        pr++;
    }

    tr = tqImgStart + tqImgRows;
    c2Sep(tr, 16); tr++;

    // --- RESUMEN FINAL ---
    c2Wide(tr, 'Tanque Elevado de Concreto de cuyas dimensiones serán:', { size: 12, h: 22 }); tr++;
    c2Sep(tr, 8); tr++;

    [
        { lbl: 'Largo (L) =', v: tqLargo },
        { lbl: 'Ancho (A) =', v: tqAncho },
        { lbl: 'Altura del Agua (H) =', v: tqAlturaAgua },
        { lbl: 'Altura de Limpieza (hl) =', v: tqAlturaLimpieza },
        { lbl: 'Borde Libre (bl) =', v: tqBordeLibre },
        { lbl: 'Altura total (HT) =', v: tqAlturaTotal },
    ].forEach((row, idx) => {
        ws3.getRow(tr).height = 22;
        ws3.getCell(tr, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_BLANC } };
        ws3.mergeCells(tr, 2, tr, 4);
        const sl = ws3.getCell(tr, 2);
        sl.value = row.lbl;
        sl.font = { size: 12, name: 'Times New Roman', color: { argb: CS_NEGRO } };
        sl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_BLANC } };
        sl.alignment = { horizontal: 'right', vertical: 'middle' };
        const sv = ws3.getCell(tr, 5);
        sv.value = `${row.v.toFixed(2)} m`;
        sv.font = { size: 13, bold: true, name: 'Courier New', color: { argb: CS_NEGRO } };
        sv.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_BLANC } };
        sv.alignment = { horizontal: 'left', vertical: 'middle' };
        ws3.mergeCells(tr, 6, tr, TS);
        const sn = ws3.getCell(tr, 6);
        sn.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_BLANC } };
        if (idx === 1) {
            sn.value = 'Diámetro de rebose según el RNE es de 4"';
            sn.font = { size: 11, name: 'Arial', color: { argb: 'FF444444' } };
            sn.alignment = { horizontal: 'left', vertical: 'middle', indent: 2 };
        }
        tr++;
    });
    c2Sep(tr, 16); tr++;

    // Generar archivo
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}