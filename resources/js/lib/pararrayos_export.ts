import ExcelJS from 'exceljs';

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════════════
interface DosisReduccion {
    rInicial: number; reduccion: number; rFinal: number; descripcion: string;
}
interface PozoData {
    L: number; a: number; resistividad: number; tipoTerreno: string;
    isCustomA: boolean; dosisReduccion: DosisReduccion[];
    resultados: { calculado: boolean; resistencia: number } | null;
}
interface PararrayoData {
    td: number; L: number; W: number; H: number; h: number;
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
export interface ExportPararrayosParams {
    logo1: File; logo2: File;
    exportOption: 'both' | 'pozo' | 'pararrayo';
    header: HeaderData; pozo: PozoData; pararrayo: PararrayoData;
    spreadsheetName: string;
    compositeImageBase64?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// DATOS ESTÁTICOS
// ═══════════════════════════════════════════════════════════════════════════
const terrainDescs: Record<string, string> = {
    GW:'Grava de buen grado, mezcla de grava y arena',
    GP:'Grava de bajo grado, mezcla de grava y arena',
    GC:'Grava con arcilla, mezcla de grava y arcilla',
    SM:'Arena con limo, mezcla de bajo grado de arena con limo',
    SC:'Arena con arcilla, mezcla de bajo grado de arena con arcilla',
    ML:'Arena fina con arcilla de ligera plasticidad',
    MH:'Arena fina o terreno con limo, terrenos elásticos',
    CL:'Arcilla pobre con grava, arena, limo',
    CH:'Arcilla inorgánica de alta plasticidad',
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════
const fileBuf = (f: File): Promise<ArrayBuffer> =>
    new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = e => res(e.target?.result as ArrayBuffer);
        r.onerror = rej;
        r.readAsArrayBuffer(f);
    });

const bT = { style: 'thin'   as ExcelJS.BorderStyle };
const bM = { style: 'medium' as ExcelJS.BorderStyle };
const bTG= { style: 'thin'   as ExcelJS.BorderStyle, color:{ argb:'FF888888' } };
const allT : Partial<ExcelJS.Borders> = { top:bT,  left:bT,  bottom:bT,  right:bT  };
const allM : Partial<ExcelJS.Borders> = { top:bM,  left:bM,  bottom:bM,  right:bM  };
const allTG: Partial<ExcelJS.Borders> = { top:bTG, left:bTG, bottom:bTG, right:bTG };

type SCOpts = {
    bold?:boolean; size?:number; italic?:boolean; underline?:boolean;
    color?:string; bg?:string; halign?:ExcelJS.Alignment['horizontal'];
    valign?:ExcelJS.Alignment['vertical']; wrap?:boolean;
    border?:'T'|'M'|'TG'|false; numFmt?:string;
};
function sc(cell: ExcelJS.Cell, val: any, o: SCOpts = {}) {
    if (val !== undefined) cell.value = (val === '' ? null : val);
    cell.font = { name:'Arial', bold:o.bold??false, italic:o.italic??false,
        underline:o.underline??false, size:o.size??9,
        color:{ argb: o.color??'FF000000' } };
    if (o.bg) cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:o.bg } };
    cell.alignment = { horizontal:o.halign??'left', vertical:o.valign??'middle',
        wrapText:o.wrap??false };
    if (o.border==='T')  cell.border = allT;
    if (o.border==='M')  cell.border = allM;
    if (o.border==='TG') cell.border = allTG;
    if (o.border===false) cell.border = {};
    if (o.numFmt) cell.numFmt = o.numFmt;
}

// Encabezado con logos — igual a la imagen de referencia
async function addHeader(
    ws: ExcelJS.Worksheet, wb: ExcelJS.Workbook,
    l1: ArrayBuffer, l1e: string, l2buf: ArrayBuffer, l2ext: string,
    hdr: HeaderData, lastCol: number,
) {
    ws.getRow(1).height = 90;
    ws.addImage(wb.addImage({ buffer: l1 as any, extension: l1e as any }),
        { tl:{ col:0, row:0 }, ext:{ width:90, height:86 } });
    ws.addImage(wb.addImage({ buffer: l2buf as any, extension: l2ext as any }),
        { tl:{ col: lastCol - 1, row:0 }, ext:{ width:90, height:86 } });
    ws.mergeCells(1, 2, 1, lastCol - 1);
    const cell = ws.getCell(1, 2);
    const p  = (hdr.proyecto || '').toUpperCase();
    const l2text = [hdr.cui, hdr.codigoModular, hdr.codigoLocal].filter(s=>s&&s.trim()&&!s.match(/^[A-Z]+ *: *$/)).join(';  ')
             || [hdr.cui, hdr.codigoModular, hdr.codigoLocal].join(';  ');
    const l3 = hdr.unidadEjecutora || '';
    cell.value = [p, l2text, l3].filter(Boolean).join('\n');
    sc(cell, undefined, { bold:true, size:10, halign:'center', wrap:true });
    cell.border = allT;
    for (let c = 3; c <= lastCol - 1; c++) {
        ws.getCell(1, c).border = { top:bT, bottom:bT, right: c===lastCol-1?bT:undefined };
        ws.getCell(1, c).fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFFFFFFF' } };
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// HOJA 1 — POZO A TIERRA
// Igual a Imagen 1: contenido izquierdo + imagen real del pozo a la derecha
// ═══════════════════════════════════════════════════════════════════════════
async function buildPozo(
    wb: ExcelJS.Workbook, pozo: PozoData, hdr: HeaderData,
    l1:ArrayBuffer, l1e:string, l2b:ArrayBuffer, l2e:string,
    compositeBase64?: string,
) {
    const ws = wb.addWorksheet('Pozo a Tierra');

    // Cols: A spacer | B-F contenido izq | G gap | H-O imagen | P logo der
    ws.columns = [
        { width: 3  }, // 1 A spacer
        { width: 20 }, // 2 B label
        { width: 12 }, // 3 C valor
        { width: 10 }, // 4 D extra
        { width: 20 }, // 5 E descripción
        { width: 3  }, // 6 F gap
        { width: 12 }, // 7 G imagen
        { width: 12 }, // 8 H
        { width: 12 }, // 9 I
        { width: 12 }, // 10 J
        { width: 12 }, // 11 K
        { width: 12 }, // 12 L
        { width: 12 }, // 13 M
        { width: 12 }, // 14 N
        { width: 3  }, // 15 O logo der
    ];
    const LAST = 15;
    const IMG_COL_START = 8;  // col H (índice 8 = nativeCol 7)
    const IMG_COL_END   = 15; // col O
    const TXT_LAST = 5;

    await addHeader(ws, wb, l1, l1e, l2b, l2e, hdr, LAST);

    let r = 2;
    const blk = (h=7) => { ws.getRow(r).height = h; r++; };
    const mT  = (c1:number,c2:number,row:number,h=15) => {
        ws.getRow(row).height = h;
        if (c1 !== c2) ws.mergeCells(row, c1, row, c2);
    };
    // Rellena celdas de imagen con blanco para evitar tinte gris
    const clearImgRow = (row:number) => {
        for (let c = IMG_COL_START; c <= IMG_COL_END; c++) {
            ws.getCell(row, c).fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFFFFFFF' } };
        }
    };

    blk();

    // ── TÍTULO ─────────────────────────────────────────────────────────────
    mT(2, TXT_LAST, r, 26);
    sc(ws.getCell(r,2), 'CALCULO DE LA RESISTENCIA DE PUESTA A TIERRA:',
        { bold:true, size:13, halign:'center' });
    clearImgRow(r); r++;
    blk();

    // ── Electrodos Verticales ─────────────────────────────────────────────
    mT(2, TXT_LAST, r, 18);
    sc(ws.getCell(r,2), 'Electrodos Verticales ó Jabalinas', { italic:true, size:10 });
    clearImgRow(r); r++;
    mT(2, TXT_LAST, r, 16);
    sc(ws.getCell(r,2), '    a.  Al nivel del Ancho', { italic:true, size:10 });
    clearImgRow(r); r++;
    blk();

    // ── Fórmula grande ────────────────────────────────────────────────────
    mT(2, TXT_LAST, r, 52);
    const fc = ws.getCell(r,2);
    fc.value = 'R = ρ/(2πL) × [ Ln(4L/a) - 1 ]';
    sc(fc, undefined, { bold:true, size:24, halign:'center' });
    fc.border = { bottom: bT };
    clearImgRow(r); r++;
    blk();

    // ── Donde ─────────────────────────────────────────────────────────────
    mT(2, TXT_LAST, r, 14);
    sc(ws.getCell(r,2), 'Donde:', { bold:true, size:9 });
    clearImgRow(r); r++;
    const aInch = pozo.a > 0 ? (pozo.a * 39.3701).toFixed(5) : '0.015875';
    [
        `L:  Longitud de la varilla de puesta a tierra (electrodos  L = ${pozo.L} Mts)`,
        `d:  Diámetro de la varilla de puesta a tierra Ø=5/8" = ${aInch} mts`,
        `ρ:  Resistividad en ohmios-metro para tipos de terreno, la resistividad del terreno.`,
    ].forEach(txt => {
        mT(2, TXT_LAST, r, 13);
        sc(ws.getCell(r,2), '    ' + txt, { italic:true, size:9, wrap:true });
        clearImgRow(r); r++;
    });
    blk();

    // ── Tabla terreno ─────────────────────────────────────────────────────
    ws.getRow(r).height = 20;
    ['I.E. N°','Tipo de Terreno','(Ohm-m)','R(Ohm)','Descripción'].forEach((h,i) => {
        sc(ws.getCell(r,i+2), h, { bold:i===3, italic:i===3, size:9,
            halign:'center', border:'TG', bg:'FFF5F5F5' });
    });
    clearImgRow(r); r++;

    ws.getRow(r).height = 20;
    [
        { v:'64193' }, { v: pozo.tipoTerreno },
        { v: pozo.resistividad, nf:'0' },
        { v: pozo.resultados?.calculado ? pozo.resultados.resistencia : '-',
          nf: pozo.resultados?.calculado ? '0.00' : undefined, bold:true, italic:true },
        { v: terrainDescs[pozo.tipoTerreno] || '' },
    ].forEach(({ v, nf, bold, italic }:any, i) => {
        sc(ws.getCell(r,i+2), v, { bold:bold??false, italic:italic??false, size:8,
            halign:i<4?'center':'left', border:'TG', numFmt:nf });
    });
    clearImgRow(r); r++;

    // Nota
    mT(2, TXT_LAST, r, 12);
    sc(ws.getCell(r,2),
        'Nota: la resistencia de terreno es de acuerdo al estudio de Suelos de perfil estratigráfico Tabla N°1',
        { italic:true, size:7, wrap:true, color:'FF555555' });
    clearImgRow(r); r++;
    blk(10);

    // ── CONSIDERACIONES DE DISEÑO ─────────────────────────────────────────
    mT(2, TXT_LAST, r, 20);
    sc(ws.getCell(r,2), 'CONSIDERACIONES DE DISEÑO', { bold:true, size:11 });
    clearImgRow(r); r++;
    const eSuffix = pozo.a > 0 ? `${(pozo.a*39.3701).toFixed(2)}" x ${pozo.L} m` : `5/8" x ${pozo.L} m`;
    mT(2, TXT_LAST, r, 14);
    sc(ws.getCell(r,2), `Con electrodo de ${eSuffix}.`, { size:8 });
    clearImgRow(r); r++;
    blk();

    // Tabla resultado pequeña
    ws.getRow(r).height = 17;
    ['','Terreno','(Ohm-m)','R(Ohm)'].forEach((h,i) => {
        sc(ws.getCell(r,i+2), h, { bold:i===3, italic:i===3, size:8,
            halign:'center', border:'TG', bg:'FFF5F5F5' });
    });
    clearImgRow(r); r++;
    ws.getRow(r).height = 22;
    [
        { v:'64193' }, { v: pozo.tipoTerreno },
        { v: pozo.resistividad, nf:'0' },
        { v: pozo.resultados?.calculado ? pozo.resultados.resistencia : '-',
          nf: pozo.resultados?.calculado ? '0.00' : undefined, bold:true, italic:true },
    ].forEach(({ v, nf, bold, italic }:any, i) => {
        sc(ws.getCell(r,i+2), v, { bold:bold??false, italic:italic??false,
            size:8, halign:'center', border:'TG', numFmt:nf });
    });
    clearImgRow(r); r++;
    blk(8);

    // ── Tabla Reducción ───────────────────────────────────────────────────
    ws.getRow(r).height = 20;
    ['R Inicial (Ohm)','% Reducción','R Final (Ohm)','Descripción'].forEach((h,i) => {
        sc(ws.getCell(r,i+2), h, { bold:true, size:9, halign:'center',
            bg:'FFF5F5F5', border:'TG' });
    });
    clearImgRow(r); r++;
    pozo.dosisReduccion.forEach((d, idx) => {
        ws.getRow(r).height = 20;
        const bg = idx%2===0 ? 'FFFFFFFF' : 'FFFAFAFA';
        [
            { v: d.rInicial>0 ? d.rInicial : '', nf:'0.00' },
            { v: d.reduccion>0 ? d.reduccion : '', nf:'0.00' },
            { v: d.rFinal>0 ? d.rFinal : '', nf:'0.00' },
            { v: d.descripcion || '' },
        ].forEach(({ v, nf }:any, i) => {
            sc(ws.getCell(r,i+2), v, { size:9, halign:i<3?'center':'left',
                bg, border:'TG', numFmt:nf });
        });
        clearImgRow(r); r++;
    });

    // Fuente
    mT(2, TXT_LAST, r, 14);
    sc(ws.getCell(r,2), 'Fuente: Catálogo de CEMENTO CONDUCTIVO', { italic:true, size:8 });
    clearImgRow(r); r++;
    blk(10);

    // ── Notas * ───────────────────────────────────────────────────────────
    ['* Para Sistema de Tensión Normal.', '* Para Sistema de Comunicaciones'].forEach(n => {
        mT(2, TXT_LAST, r, 12);
        sc(ws.getCell(r,2), n, { italic:true, size:8 });
        clearImgRow(r); r++;
    });
    blk(10);

    // ── Nota CNE final ────────────────────────────────────────────────────
    mT(2, TXT_LAST, r, 24);
    sc(ws.getCell(r,2),
        'Estos dos últimos resultados R(Ohms) de las resistencias de puesta a tierra están dentro de lo permisible para este tipo de línea  según el C.N.E. SUMINISTRO.',
        { italic:true, size:7, wrap:true });
    clearImgRow(r);
    const contentEndRow = r;
    r++;

    // ── IMAGEN DEL POZO (cols G-N = 7-14, desde fila 3) ───────────────────
    // La imagen flota sobre las celdas de la derecha sin tocar el contenido izquierdo
    if (compositeBase64) {
        try {
            // Calcular alto de la imagen para que cubra el contenido
            const imgStartRow = 3;
            const imgEndRow   = contentEndRow;
            const rowCount    = Math.max(imgEndRow - imgStartRow + 1, 28);

            // Ancho controlado para que no tape columnas de texto
            // 8 cols × 12pt × 7px/pt = 672px, reducimos a 620 para margen
            const imgW = 580;
            const imgH = Math.round(imgW * (760 / 980));

            // Asegurar filas suficientes con altura apropiada
            for (let i = imgStartRow; i <= imgStartRow + rowCount + 2; i++) {
                if (!ws.getRow(i).height || ws.getRow(i).height < 15) {
                    ws.getRow(i).height = 17;
                }
            }

            const imgId = wb.addImage({ base64: compositeBase64, extension: 'png' });
            ws.addImage(imgId, {
                tl: { nativeCol: IMG_COL_START - 1, nativeRow: imgStartRow - 1 },
                ext: { width: imgW, height: imgH },
                br: { nativeCol: IMG_COL_START + 7, nativeRow: imgStartRow + rowCount },
                editAs: 'oneCell',
            } as any);
        } catch(e) { console.warn('Image error:', e); }
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// HOJA 2 — PARARRAYO
// Igual a Imagen 2: secciones 1-5 con celdas amarillas para valores
// ═══════════════════════════════════════════════════════════════════════════
async function buildPararrayo(
    wb: ExcelJS.Workbook, par: PararrayoData, hdr: HeaderData,
    l1:ArrayBuffer, l1e:string, l2b:ArrayBuffer, l2e:string,
) {
    const ws = wb.addWorksheet('Pararrayo');

    ws.columns = [
        { width: 3  }, // 1 A spacer
        { width: 28 }, // 2 B label
        { width: 16 }, // 3 C valor amarillo
        { width: 14 }, // 4 D unidad/extra
        { width: 30 }, // 5 E fórmula/descripción
        { width: 20 }, // 6 F extra derecha
        { width: 3  }, // 7 G logo der
    ];
    const LAST = 7;
    const YELLOW = 'FFFFFF00'; // amarillo puro como imagen
    const LYELL  = 'FFFFF2CC'; // amarillo suave

    await addHeader(ws, wb, l1, l1e, l2b, l2e, hdr, LAST);

    let r = 2;
    const blk = (h=8) => { ws.getRow(r).height=h; r++; };
    const sectionTitle = (row:number, txt:string, h=18) => {
        ws.getRow(row).height=h;
        ws.mergeCells(row,2,row,6);
        sc(ws.getCell(row,2), txt, { bold:true, size:10 });
    };
    // Celda label + celda valor amarillo en la misma fila
    const kvRow = (row:number, label:string, val:any, unit:string,
                   valBg=YELLOW, nf?:string, extraLabel?:string, extraVal?:any) => {
        ws.getRow(row).height=20;
        sc(ws.getCell(row,2), label, { size:9 });
        sc(ws.getCell(row,3), val,   { bold:true, size:10, halign:'center',
            bg: valBg, border:'T', numFmt:nf });
        sc(ws.getCell(row,4), unit,  { size:9 });
        if (extraLabel) {
            sc(ws.getCell(row,5), extraLabel, { size:9 });
            if (extraVal !== undefined)
                sc(ws.getCell(row,6), extraVal, { bold:true, size:10, halign:'center', bg:valBg });
        }
    };
    blk();

    // ══════════════════════════════════════════════════════
    // 1. Frecuencia anual de caída de rayos
    // ══════════════════════════════════════════════════════
    sectionTitle(r, '1   Frecuencia anual de caída de rayos'); r++;
    blk(5);

    kvRow(r, 'Td=', par.td, 'isocerauno', YELLOW, '0');
    r++;
    kvRow(r, 'Nk=Ng=',
        par.resultados?.calculado ? par.resultados.nkng : '-',
        'rayos/km² año', YELLOW, '0.000');
    r++;
    blk();

    // ══════════════════════════════════════════════════════
    // 2. Cálculo de Área Equivalente
    // ══════════════════════════════════════════════════════
    sectionTitle(r, '2   Cálculo de Área Equivalente'); r++;
    blk(5);

    // Fórmula Ae
    ws.getRow(r).height=18;
    ws.mergeCells(r,2,r,4);
    sc(ws.getCell(r,2),'A=LW+6H(L+W)+π9H²',{ size:10, italic:true });
    ws.mergeCells(r,5,r,6);
    sc(ws.getCell(r,5),'Ae = LW + 6H(L+W) + π9H²',{ bold:true, size:10 });
    r++;
    blk(4);

    // Tabla L, W, H, Ae
    [
        { k:'L:', v: par.L,                                    nf:'0.00' },
        { k:'W:', v: par.W,                                    nf:'0.00' },
        { k:'H:', v: par.H,                                    nf:'0.00' },
        { k:'A=', v: par.resultados?.calculado
                     ? par.resultados.areaEquivalente : '-',   nf:'0.00' },
    ].forEach(({ k, v, nf }) => {
        ws.getRow(r).height = 20;
        sc(ws.getCell(r,2), k, { size:10, bold:true });
        sc(ws.getCell(r,3), v, { bold:true, size:11, halign:'center',
            bg: k==='A=' ? LYELL : YELLOW, border:'TG', numFmt:nf });
        // Col 4-6: descripción solo para A=
        sc(ws.getCell(r,4), k==='A=' ? 'Área equivalente (Fuente: Norma NFPA 780)' : '',
            { italic:true, size:8 });
        r++;
    });
    blk();

    // ══════════════════════════════════════════════════════
    // 3. Coeficientes de frecuencia relámpago "Nd"
    // ══════════════════════════════════════════════════════
    sectionTitle(r, '3   COEFICIENTES DE FRECUENCIA RELÁMPAGO  "Nd"'); r++;
    blk(5);

    const nkng = par.resultados?.calculado ? par.resultados.nkng : 0;
    const ae   = par.resultados?.calculado ? par.resultados.areaEquivalente : 0;
    const Nd   = par.resultados?.calculado ? par.resultados.Nd : 0;

    [
        { k:'Ng=',  v: nkng, nf:'0.000', extra:'N° de impactos por año' },
        { k:'Ac=',  v: ae,   nf:'0.00',  extra:'' },
        { k:'C1=',  v: par.c1, nf:'0.0', extra:'' },
        { k:'Nd=',  v: Nd,   nf:'0.0000000', extra:'N° de Impactos por año *' },
    ].forEach(({ k, v, nf, extra }) => {
        ws.getRow(r).height = 20;
        sc(ws.getCell(r,2), k, { size:10, bold:true });
        sc(ws.getCell(r,3), v, { bold:true, size:11, halign:'center',
            bg: YELLOW, border:'TG', numFmt:nf });
        if (extra) {
            ws.mergeCells(r,4,r,6);
            sc(ws.getCell(r,4), extra, { italic:true, size:8 });
        }
        r++;
    });

    // Fórmula Nd
    ws.getRow(r).height = 22;
    ws.mergeCells(r,4,r,6);
    sc(ws.getCell(r,4),'Nd = Ng × Ae × C1 × 10⁻⁶',
        { bold:true, size:11, halign:'center' });
    r++;
    blk(5);

    // Textos descriptivos
    [
        'Nd: Coeficientes de Frecuencia del relámpago.',
        'Ng: Densidad de la descarga atmosférica anual en la estructura.',
        'Ac: Área equivalente de la estructura a proteger.',
        'C1: Coeficiente de localización.',
        'Ng=9.57 es un valor que expresa el número de relámpagos por kilómetro cuadrado por año de la zona a analizar',
        'obtenida del mapa del nivel isoceráunico del Perú.',
    ].forEach(txt => {
        ws.getRow(r).height = 13;
        ws.mergeCells(r,2,r,6);
        sc(ws.getCell(r,2), txt, { size:7, italic:true });
        r++;
    });
    blk();

    // ══════════════════════════════════════════════════════
    // 4. Coeficientes de frecuencia relámpago tolerable "Nc"
    // ══════════════════════════════════════════════════════
    sectionTitle(r, '4   COEFICIENTES DE FRECUENCIA RELÁMPAGO TOLERABLE  "Nc"'); r++;
    blk(5);

    const nc = par.resultados?.calculado ? par.resultados.nc : 0;

    [
        { k:'C2=', v: par.c2, nf:'0.0' },
        { k:'C3=', v: par.c3, nf:'0.0' },
        { k:'C4=', v: par.c4, nf:'0.0' },
        { k:'C5=', v: par.c5, nf:'0.0' },
        { k:'NC=', v: nc,     nf:'0.0000' },
    ].forEach(({ k, v, nf }, idx) => {
        ws.getRow(r).height = 20;
        sc(ws.getCell(r,2), k, { size:10, bold:true });
        sc(ws.getCell(r,3), v, { bold:true, size:11, halign:'center',
            bg: YELLOW, border:'TG', numFmt:nf });
        if (idx === 2) {
            // Fórmula a la derecha
            ws.mergeCells(r,4,r,6);
            sc(ws.getCell(r,4),'Nc = 1.5 × 10⁻³ / (C2 × C3 × C4 × C5)',
                { bold:true, size:11, halign:'center' });
        }
        r++;
    });

    ws.getRow(r).height = 13;
    ws.mergeCells(r,2,r,6);
    sc(ws.getCell(r,2),
        'Coeficiente de frecuencia de relámpago tolerable (Fuente: Norma NFPA 780)',
        { italic:true, size:7 });
    r++;
    blk();

    // ══════════════════════════════════════════════════════
    // 5. Evaluación y comparación de riesgos "Nd" vs "Nc"
    // ══════════════════════════════════════════════════════
    sectionTitle(r, 'ok5   EVALUACIÓN Y COMPARACIÓN DE LOS RIESGOS "Nd" CON LOS RIESGOS TOLERABLES "Nc"'); r++;
    blk(5);

    // Si Nd>Nc / Si Nd<Nc
    ws.getRow(r).height=14;
    ws.mergeCells(r,2,r,4);
    sc(ws.getCell(r,2),'Si Nd > Nc: Requiere Protección.',{ size:8 }); r++;
    ws.getRow(r).height=14;
    ws.mergeCells(r,2,r,4);
    sc(ws.getCell(r,2),'Si Nd < Nc: Protección opcional.',{ size:8 }); r++;
    blk(5);

    // Tabla evaluación
    ws.getRow(r).height=20;
    ['AREA','Nd','Nc','REQUIERE PROTECCION'].forEach((h,i) => {
        sc(ws.getCell(r,i+2), h, { bold:true, size:9, halign:'center',
            bg:'FFF5F5F5', border:'TG' });
    });
    r++;

    ws.getRow(r).height=24;
    if (par.resultados?.calculado) {
        const req = par.resultados.requiereProteccion;
        [
            { v: par.resultados.areaEquivalente, nf:'0.00',      bg:'FFFFFFFF' },
            { v: par.resultados.Nd,              nf:'0.0000000', bg:'FFFFFFFF' },
            { v: par.resultados.nc,              nf:'0.0000',    bg:'FFFFFFFF' },
            { v: req ? 'SI' : 'NO',              nf:undefined,
              bg: req ? YELLOW : 'FFE2EFDA' },
        ].forEach(({ v, nf, bg }, i) => {
            sc(ws.getCell(r,i+2), v, { bold:i===3, size:i===3?12:9,
                halign:'center', bg, border:'TG', numFmt:nf });
        });
    } else {
        ws.mergeCells(r,2,r,5);
        sc(ws.getCell(r,2),'Sin resultados calculados',{ italic:true, halign:'center' });
    }
    r++;
    blk(8);

    // Eficiencia y Nivel de protección
    if (par.resultados?.calculado && par.resultados.requiereProteccion) {
        ws.getRow(r).height=20;
        sc(ws.getCell(r,2),'EFICIENCIA REQUERIDA  E=',{ bold:true, size:9 });
        sc(ws.getCell(r,3), par.resultados.eficienciaRequerida,
            { bold:true, size:11, halign:'center', bg:YELLOW, border:'TG', numFmt:'0.000000' });
        r++;
        ws.getRow(r).height=20;
        sc(ws.getCell(r,2),'NIVEL DE PROTECCION',{ bold:true, size:9 });
        sc(ws.getCell(r,3), par.resultados.nivelProteccion,
            { bold:true, size:14, halign:'center', bg:YELLOW, border:'TG' });
        r++;
    } else if (par.resultados?.calculado) {
        ws.getRow(r).height=18;
        ws.mergeCells(r,2,r,5);
        sc(ws.getCell(r,2),'La estructura NO requiere sistema de protección contra rayos.',
            { bold:true, size:9, color:'FF00703C' });
        r++;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// FUNCIÓN PRINCIPAL EXPORTADA
// ═══════════════════════════════════════════════════════════════════════════
export const exportToExcel = async ({
    logo1, logo2, exportOption, header, pozo, pararrayo,
    spreadsheetName, compositeImageBase64,
}: ExportPararrayosParams): Promise<void> => {
    const l1  = await fileBuf(logo1);
    const l2  = await fileBuf(logo2);
    const l1e = logo1.name.split('.').pop()?.toLowerCase().replace('jpg','jpeg') || 'png';
    const l2e = logo2.name.split('.').pop()?.toLowerCase().replace('jpg','jpeg') || 'png';

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Sistema de Cálculo';
    wb.created  = new Date();

    // Hoja 1: Pozo a Tierra (con imagen del diagrama a la derecha)
    if (exportOption === 'both' || exportOption === 'pozo')
        await buildPozo(wb, pozo, header, l1, l1e, l2, l2e, compositeImageBase64);

    // Hoja 2: Pararrayo
    if (exportOption === 'both' || exportOption === 'pararrayo')
        await buildPararrayo(wb, pararrayo, header, l1, l1e, l2, l2e);

    const buf  = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `CÁLCULO SPAT PARARRAYOS - ${spreadsheetName}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};