import ExcelJS from 'exceljs';

interface RedRiegoData {
    config?: {
        npisoterminado?: number;
        altasumfondotanqueelevado?: number;
    };
    grades?: {
        inicial?: boolean;
        primaria?: boolean;
        secundaria?: boolean;
    };
    tables?: Record<string, any>;  // puede ser array de módulos o { modules: [...] }
    accesoriosConfig?: {
        inicial?: { codo90: string; tee: string; val_compuerta: string; reduccion2: string };
        primaria?: { codo90: string; tee: string; val_compuerta: string; reduccion2: string };
        secundaria?: { codo90: string; tee: string; val_compuerta: string; reduccion2: string };
    };
    totals?: any;
    exterioresData?: any;
    [key: string]: any;
}

export async function exportRedRiegoToExcel(
    data: RedRiegoData,
    fileName: string = 'Red_Riego'
) {
    const workbook = new ExcelJS.Workbook();
    const ws9 = workbook.addWorksheet('9. Red de Riego');

    // 26 columnas: 1 spacer + 25 datos (misma estructura que Tuberias RD)
    ws9.columns = [
        { width: 3  }, // 1  spacer
        { width: 9  }, // 2  segmento
        { width: 7  }, // 3  punto
        { width: 9  }, // 4  cota
        { width: 7  }, // 5  UH parcial
        { width: 7  }, // 6  UH total
        { width: 8  }, // 7  caudal
        { width: 9  }, // 8  longitud
        { width: 11 }, // 9  diámetro
        { width: 5  }, // 10 N° codo90
        { width: 8  }, // 11 codo90 leq
        { width: 5  }, // 12 N° tee
        { width: 8  }, // 13 tee leq
        { width: 5  }, // 14 N° val compuerta
        { width: 8  }, // 15 val compuerta leq
        { width: 5  }, // 16 N° reduccion
        { width: 8  }, // 17 reduccion leq
        { width: 9  }, // 18 longitud total
        { width: 8  }, // 19 coef rug
        { width: 9  }, // 20 S (m/m)
        { width: 8  }, // 21 Hf (m)
        { width: 9  }, // 22 H.Piez
        { width: 9  }, // 23 velocidad
        { width: 9  }, // 24 presión
        { width: 9  }, // 25 verif 1
        { width: 8  }, // 26 verif 2
    ];

    const RR_LAST = 26; // última columna

    // ── Paleta estilo ingeniero (igual que Hoja 7) ─────────────────────────────
    const RR_BLANC  = 'FFFFFFFF';
    const RR_NEGRO  = 'FF000000';
    const RR_TITLE  = 'FF4F4F4F'; // gris oscuro — barra título módulo
    const RR_HDR1   = 'FF595959'; // gris medio oscuro — primera fila header
    const RR_HDR2   = 'FF737373'; // gris medio — segunda fila header
    const RR_YELLOW = 'FFFFC000'; // amarillo — valores clave
    const RR_LYELL  = 'FFFFF2CC'; // amarillo suave — valores calculados
    const RR_LGRAY  = 'FFD9D9D9'; // gris claro — totales / estáticas
    const RR_LBLUE  = 'FFD6E4F0'; // azul claro — filas alternas
    const RR_GREEN  = 'FF70AD47'; // verde — CUMPLE
    const RR_RED    = 'FFFF0000'; // rojo — NO CUMPLE
    const RR_ORANG  = 'FFFCE4D6'; // naranja suave — fila estática
    const RR_SECTB  = 'FF203864'; // azul muy oscuro — barra sección grado

    const rrBT = { style: 'thin'   as ExcelJS.BorderStyle, color: { argb: 'FFA0A0A0' } };
    const rrBM = { style: 'medium' as ExcelJS.BorderStyle, color: { argb: 'FF444444' } };
    const rrBW = { style: 'thin'   as ExcelJS.BorderStyle, color: { argb: 'FFFFFFFF' } };

    // ── Helpers ───────────────────────────────────────────────────────────────
    function rrFill(r: number, bg: string, h = 17) {
        ws9.getRow(r).height = h;
        ws9.getCell(r, 1).fill = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: RR_BLANC } };
        for (let c = 2; c <= RR_LAST; c++)
            ws9.getCell(r, c).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: bg } };
    }

    function rrSep(r: number, h = 10) {
        ws9.getRow(r).height = h;
        for (let c = 1; c <= RR_LAST; c++)
            ws9.getCell(r, c).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: RR_BLANC } };
    }

    function rrC(r: number, c: number, val: any, opts: {
        bold?: boolean; size?: number; bg?: string; color?: string;
        halign?: ExcelJS.Alignment['horizontal']; numFmt?: string;
        wrap?: boolean; border?: 'T' | 'M' | 'W' | false;
        italic?: boolean;
    } = {}) {
        const cell = ws9.getCell(r, c);
        cell.value = val ?? null;
        cell.font  = { bold: opts.bold ?? false, size: opts.size ?? 8,
                       name: 'Arial', italic: opts.italic ?? false,
                       color: { argb: opts.color ?? RR_NEGRO } };
        if (opts.bg) cell.fill = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: opts.bg } };
        cell.alignment = { horizontal: opts.halign ?? 'center', vertical: 'middle',
                           wrapText: opts.wrap ?? false };
        if (opts.border !== false) {
            const b = opts.border === 'M' ? rrBM
                    : opts.border === 'W' ? rrBW
                    : rrBT;
            cell.border = { top: b, left: b, bottom: b, right: b };
        }
        if (opts.numFmt) cell.numFmt = opts.numFmt;
    }

    // Barra de título de módulo (gris oscuro, texto blanco, full-width merge)
    function rrModuleTitle(r: number, text: string) {
        rrFill(r, RR_TITLE, 22);
        ws9.mergeCells(r, 2, r, RR_LAST);
        const cell = ws9.getCell(r, 2);
        cell.value = text;
        cell.font  = { bold: true, size: 9, name: 'Arial', color: { argb: 'FFFFFFFF' } };
        cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RR_TITLE } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { top: rrBM, left: rrBM, bottom: rrBM, right: rrBM };
    }

    // Barra sección grado (azul muy oscuro)
    function rrGradeBar(r: number, text: string) {
        rrFill(r, RR_SECTB, 24);
        ws9.mergeCells(r, 2, r, RR_LAST);
        const cell = ws9.getCell(r, 2);
        cell.value = text;
        cell.font  = { bold: true, size: 10, name: 'Arial', color: { argb: 'FFFFFFFF' } };
        cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RR_SECTB } };
        cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        cell.border = { top: rrBM, left: rrBM, bottom: rrBM, right: rrBM };
    }

    // Barra título principal
    function rrMainTitle(r: number, text: string) {
        rrFill(r, 'FF1F3864', 28);
        ws9.mergeCells(r, 2, r, RR_LAST);
        const cell = ws9.getCell(r, 2);
        cell.value = text;
        cell.font  = { bold: true, size: 12, name: 'Arial', color: { argb: 'FFFFFFFF' } };
        cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } };
        cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        cell.border = { top: rrBM, left: rrBM, bottom: rrBM, right: rrBM };
    }

    // ── Encabezados de tabla (2 filas) ────────────────────────────────────────
    // Devuelve la fila después de los headers
    function rrDrawHeaders(r: number, accLabels: {
        codo90: string; tee: string; val_compuerta: string; reduccion2: string;
    }): number {
        // ── Fila 1 ────────────────────────────────────────────────────────────
        rrFill(r, RR_HDR1, 28);
        const h1: Array<{ c: number; cEnd?: number; text: string }> = [
            { c: 2,  text: 'Segmento' },
            { c: 3,  text: 'Punto' },
            { c: 4,  text: 'Cota' },
            { c: 5,  cEnd: 6,  text: 'U.H.' },
            { c: 7,  text: 'Caudal\n(l/s)' },
            { c: 8,  text: 'Longitud\n(m)' },
            { c: 9,  text: 'Diámetro\nplg' },
            { c: 10, cEnd: 17, text: 'Longitud Equivalente (m)' },
            { c: 18, text: 'Long.\nTotal(m)' },
            { c: 19, text: 'Coef.\nRug.H-W' },
            { c: 20, text: 'S\n(m/m)' },
            { c: 21, text: 'Hf\n(m)' },
            { c: 22, text: 'H. Piez.\n(m)' },
            { c: 23, text: 'Velocidad\n(m/s)' },
            { c: 24, text: 'Presión\n(mca)' },
            { c: 25, cEnd: 26, text: 'VERIFICACIONES' },
        ];
        h1.forEach(({ c, cEnd, text }) => {
            if (cEnd) ws9.mergeCells(r, c, r, cEnd);
            const cell = ws9.getCell(r, c);
            cell.value = text;
            cell.font  = { bold: true, size: 8, name: 'Arial', color: { argb: 'FFFFFFFF' } };
            cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RR_HDR1 } };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.border = { top: rrBW, left: rrBW, bottom: rrBW, right: rrBW };
            if (cEnd) {
                for (let cc = c + 1; cc <= cEnd; cc++) {
                    ws9.getCell(r, cc).fill = { type: 'pattern', pattern: 'solid',
                        fgColor: { argb: RR_HDR1 } };
                }
            }
        });
        r++;

        // ── Fila 2 ────────────────────────────────────────────────────────────
        rrFill(r, RR_HDR2, 24);
        const h2: Array<{ c: number; text: string }> = [
            { c: 2,  text: 'Seg.' },
            { c: 3,  text: 'Pto.' },
            { c: 4,  text: 'Cota\n(m)' },
            { c: 5,  text: 'Parcial' },
            { c: 6,  text: 'Total' },
            { c: 7,  text: 'Q' },
            { c: 8,  text: 'L' },
            { c: 9,  text: 'Ø plg' },
            { c: 10, text: 'N°' },
            { c: 11, text: accLabels.codo90 || 'Codo 90°' },
            { c: 12, text: 'N°' },
            { c: 13, text: accLabels.tee || 'Tee' },
            { c: 14, text: 'N°' },
            { c: 15, text: accLabels.val_compuerta || 'Val. Comp.' },
            { c: 16, text: 'N°' },
            { c: 17, text: accLabels.reduccion2 || 'Reduc. 2' },
            { c: 18, text: 'L. Tot.' },
            { c: 19, text: 'C' },
            { c: 20, text: 'S' },
            { c: 21, text: 'Hf' },
            { c: 22, text: 'Hpz.' },
            { c: 23, text: 'V' },
            { c: 24, text: 'P' },
            { c: 25, text: '0.60<V\n<Adm?' },
            { c: 26, text: 'P>2\nmca?' },
        ];
        h2.forEach(({ c, text }) => {
            const cell = ws9.getCell(r, c);
            cell.value = text;
            cell.font  = { bold: true, size: 7, name: 'Arial', color: { argb: 'FFFFFFFF' } };
            cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RR_HDR2 } };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.border = { top: rrBW, left: rrBW, bottom: rrBW, right: rrBW };
        });
        r++;
        return r;
    }

    // ── Fila de datos ──────────────────────────────────────────────────────────
    function rrDataRow(r: number, row: any, idx: number): void {
        const isStatic = row.isStatic;
        const bg = isStatic ? RR_ORANG : (idx % 2 === 0 ? RR_BLANC : RR_LBLUE);
        rrFill(r, bg, 16);

        const n = (v: any, d = 3) => {
            const f = parseFloat(v);
            return isFinite(f) ? f : null;
        };

        // Verificación coloreada
        const verif = (val: string): { text: string; bg: string; color: string } => {
            if (!val || val === '') return { text: '-', bg: bg, color: RR_NEGRO };
            const v = String(val).toLowerCase();
            if (v === 'cumple' || v === 'ok' || v === 'si' || v === 'sí')
                return { text: 'cumple', bg: 'FFE2EFDA', color: 'FF375623' };
            if (v === 'no cumple' || v === 'no')
                return { text: 'no cumple', bg: 'FFFFC7CE', color: 'FF9C0006' };
            return { text: val, bg: bg, color: RR_NEGRO };
        };

        const cols: Array<{ c: number; val: any; bg2?: string; color?: string;
            bold?: boolean; numFmt?: string; isVerif?: boolean }> = [
            { c: 2,  val: row.segmento    || '' },
            { c: 3,  val: row.punto        || '' },
            { c: 4,  val: n(row.cota),       bg2: isStatic ? RR_LGRAY : RR_LYELL, numFmt: '0.000' },
            { c: 5,  val: isStatic ? '' : (row.uh_parcial !== '' && row.uh_parcial != null ? n(row.uh_parcial) : '') },
            { c: 6,  val: isStatic ? '' : n(row.uh_total),   bg2: RR_LYELL, numFmt: '0.000' },
            { c: 7,  val: isStatic ? '' : n(row.caudal),     bg2: RR_YELLOW, bold: true, numFmt: '0.000' },
            { c: 8,  val: isStatic ? '' : n(row.longitud),   numFmt: '0.00' },
            { c: 9,  val: isStatic ? '' : (row.diametro || '') },
            { c: 10, val: isStatic ? '' : (n(row.n1) ?? '') },
            { c: 11, val: isStatic ? '' : n(row.codo90),     numFmt: '0.000' },
            { c: 12, val: isStatic ? '' : (n(row.n2) ?? '') },
            { c: 13, val: isStatic ? '' : n(row.tee),        numFmt: '0.000' },
            { c: 14, val: isStatic ? '' : (n(row.n3) ?? '') },
            { c: 15, val: isStatic ? '' : n(row.val_compuerta), numFmt: '0.000' },
            { c: 16, val: isStatic ? '' : (n(row.n4) ?? '') },
            { c: 17, val: isStatic ? '' : n(row.reduccion2), numFmt: '0.000' },
            { c: 18, val: isStatic ? '' : n(row.longitudtotal), bg2: RR_LYELL, numFmt: '0.00' },
            { c: 19, val: isStatic ? (n(row.coefrug) ?? '') : n(row.coefrug), numFmt: '0' },
            { c: 20, val: isStatic ? '' : n(row.s),          numFmt: '0.00000' },
            { c: 21, val: isStatic ? '' : n(row.hf),         numFmt: '0.00' },
            { c: 22, val: n(row.hpiez),                       bg2: RR_YELLOW, bold: true, numFmt: '0.000' },
            { c: 23, val: isStatic ? '' : n(row.velocidad),  numFmt: '0.00' },
            { c: 24, val: isStatic ? '' : n(row.presion),    bg2: isStatic ? bg : RR_LYELL, numFmt: '0.000' },
        ];

        cols.forEach(({ c, val, bg2, color, bold, numFmt }) => {
            const cell = ws9.getCell(r, c);
            cell.value = val ?? null;
            cell.font  = { bold: bold ?? false, size: 8, name: 'Arial',
                           color: { argb: color ?? RR_NEGRO } };
            cell.fill  = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: bg2 ?? bg } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = { top: rrBT, left: rrBT, bottom: rrBT, right: rrBT };
            if (numFmt && val !== null && val !== '' && !isNaN(parseFloat(val))) {
                cell.numFmt = numFmt;
            }
        });

        // Verificaciones
        const v1 = verif(row.verificacion1);
        const v2 = verif(row.verificacion2);
        [{ c: 25, v: v1 }, { c: 26, v: v2 }].forEach(({ c, v }) => {
            const cell = ws9.getCell(r, c);
            cell.value = isStatic ? '' : v.text;
            cell.font  = { bold: true, size: 7, name: 'Arial', color: { argb: v.color } };
            cell.fill  = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: isStatic ? bg : v.bg } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = { top: rrBT, left: rrBT, bottom: rrBT, right: rrBT };
        });
    }

    // ── Leer datos ─────────────────────────────────────────────────────────────
    const rrD      = data;
    const rrConfig = rrD.config || { npisoterminado: 0.65, altasumfondotanqueelevado: 13.85 };
    const rrGrades = rrD.grades || { inicial: true, primaria: false, secundaria: false };
    const rrTables = rrD.tables || {};
    const rrAccCfg = rrD.accesoriosConfig || {
        inicial:    { codo90:'codo90', tee:'tee', val_compuerta:'valCompuerta', reduccion2:'reduccion2' },
        primaria:   { codo90:'codo90', tee:'tee', val_compuerta:'valCompuerta', reduccion2:'reduccion2' },
        secundaria: { codo90:'codo90', tee:'tee', val_compuerta:'valCompuerta', reduccion2:'reduccion2' },
    };

    const rrNivel = parseFloat(
        (
            parseFloat(String(rrConfig.npisoterminado || 0.65)) +
            parseFloat(String(rrConfig.altasumfondotanqueelevado || 13.85))
        ).toFixed(3)
    );

    const rrAccNames: Record<string, string> = {
        codo90:'Codo 90°', codo45:'Codo 45°', tee:'Tee',
        valCompuerta:'Val. Comp.', valCheck:'Val. Check',
        canastilla:'Canastilla', reduccion1:'Reduc. 1', reduccion2:'Reduc. 2',
    };

    const rrGradeNames: Record<string, string> = {
        inicial:'INICIAL', primaria:'PRIMARIA', secundaria:'SECUNDARIA',
    };

    const rrSelectedGrades = Object.keys(rrGrades).filter((g) => (rrGrades as any)[g]);

    let rr = 1; // row cursor

    // =========================================================================
    // TÍTULO PRINCIPAL
    // =========================================================================
    rrMainTitle(rr, '9. CÁLCULO DE LA RED DE RIEGO'); rr++;
    rrSep(rr, 14); rr++;

    // =========================================================================
    // CONFIGURACIÓN
    // =========================================================================
    rrFill(rr, RR_HDR1, 22);
    ws9.mergeCells(rr, 2, rr, RR_LAST);
    const rrCfgHdr = ws9.getCell(rr, 2);
    rrCfgHdr.value = 'CONFIGURACIÓN DEL SISTEMA';
    rrCfgHdr.font  = { bold: true, size: 9, name: 'Arial', color: { argb: 'FFFFFFFF' } };
    rrCfgHdr.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RR_HDR1 } };
    rrCfgHdr.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    rrCfgHdr.border = { top: rrBM, left: rrBM, bottom: rrBM, right: rrBM };
    rr++;
    rrSep(rr, 6); rr++;

    // Filas de config para Red de Riego
    const rrCfgRows = [
        { 
            label: 'Nivel de Piso Terminado',
            val: parseFloat(String(rrConfig.npisoterminado || 0.65)), 
            unit: 'm' 
        },
        { 
            label: 'Altura Asumida Fondo Tanque Elevado',
            val: parseFloat(String(rrConfig.altasumfondotanqueelevado || 13.85)), 
            unit: 'm' 
        },
        { 
            label: 'Nivel Asumido Fondo Tanque Elevado (calculado)',
            val: rrNivel, 
            unit: 'm', 
            computed: true 
        },
    ];
    rrCfgRows.forEach((cfg, idx) => {
        const bg = idx % 2 === 0 ? RR_BLANC : 'FFF8F8F8';
        rrFill(rr, bg, 19);
        // Label cols 2-10
        ws9.mergeCells(rr, 2, rr, 10);
        const lc = ws9.getCell(rr, 2);
        lc.value = cfg.label;
        lc.font  = { size: 9, name: 'Arial', color: { argb: RR_NEGRO } };
        lc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        lc.alignment = { horizontal: 'right', vertical: 'middle' };
        lc.border = { top: rrBT, left: rrBT, bottom: rrBT, right: rrBT };
        for (let c = 3; c <= 10; c++) {
            ws9.getCell(rr, c).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: bg } };
            ws9.getCell(rr, c).border = { top: rrBT, bottom: rrBT };
        }
        // Valor col 11
        const vc = ws9.getCell(rr, 11);
        vc.value  = cfg.val;
        vc.numFmt = '0.000';
        vc.font   = { bold: true, size: 10, name: 'Arial', color: { argb: RR_NEGRO } };
        vc.fill   = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: cfg.computed ? RR_BLANC : RR_YELLOW } };
        vc.alignment = { horizontal: 'center', vertical: 'middle' };
        vc.border = { top: rrBT, left: rrBT, bottom: rrBT, right: rrBT };
        // Unidad col 12
        const uc = ws9.getCell(rr, 12);
        uc.value = cfg.unit;
        uc.font  = { size: 8, name: 'Arial', color: { argb: RR_NEGRO } };
        uc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        uc.alignment = { horizontal: 'left', vertical: 'middle' };
        uc.border = { top: rrBT, left: rrBT, bottom: rrBT, right: rrBT };
        // Rest blank
        for (let c = 13; c <= RR_LAST; c++) {
            ws9.getCell(rr, c).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: bg } };
            ws9.getCell(rr, c).border = { top: rrBT, bottom: rrBT,
                right: c === RR_LAST ? rrBM : rrBT };
        }
        rr++;
    });
    rrSep(rr, 16); rr++;

    // =========================================================================
    // TABLAS POR GRADO
    // =========================================================================
    if (rrSelectedGrades.length === 0) {
        rrFill(rr, RR_LYELL, 24);
        ws9.mergeCells(rr, 2, rr, RR_LAST);
        const noData = ws9.getCell(rr, 2);
        noData.value = 'No hay grados seleccionados para exportar.';
        noData.font  = { italic: true, size: 9, name: 'Arial', color: { argb: 'FF996600' } };
        noData.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RR_LYELL } };
        noData.alignment = { horizontal: 'center', vertical: 'middle' };
        rr++;
    }

    rrSelectedGrades.forEach(grade => {
        // Normalizar módulos del grado
        let rrModules: any[] = [];
        const gradeData = rrTables[grade];
        if (gradeData) {
            if (Array.isArray(gradeData)) {
                // formato tablas: [{ nombre, data }]
                rrModules = gradeData;
            } else if (gradeData.modules) {
                // formato tables: { modules: [{ id, nombre, data }] }
                rrModules = gradeData.modules;
            }
        }

        // Barra de grado
        rrGradeBar(rr, `NIVEL ${rrGradeNames[grade]} — RED DE RIEGO`); rr++;
        rrSep(rr, 10); rr++;

        if (rrModules.length === 0) {
            rrFill(rr, RR_LYELL, 20);
            ws9.mergeCells(rr, 2, rr, RR_LAST);
            const noMod = ws9.getCell(rr, 2);
            noMod.value = `Sin módulos para el nivel ${rrGradeNames[grade]}.`;
            noMod.font  = { italic: true, size: 9, name: 'Arial', color: { argb: 'FF888888' } };
            noMod.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RR_LYELL } };
            noMod.alignment = { horizontal: 'center', vertical: 'middle' };
            rr++;
            rrSep(rr, 16); rr++;
            return;
        }

        // Accesorios para este grado
        const gradeAcc = (rrAccCfg as any)[grade] || rrAccCfg.inicial;
        const accLabels = {
            codo90:        (rrAccNames as any)[gradeAcc.codo90]        || 'Codo 90°',
            tee:           (rrAccNames as any)[gradeAcc.tee]           || 'Tee',
            val_compuerta: (rrAccNames as any)[gradeAcc.val_compuerta] || 'Val. Comp.',
            reduccion2:    (rrAccNames as any)[gradeAcc.reduccion2]    || 'Reduc. 2',
        };

        rrModules.forEach((modulo: any, modIdx: number) => {
            const rows: any[] = Array.isArray(modulo.data) ? modulo.data : [];
            const modName = modulo.nombre ||
                `CÁLCULO DE RED DE RIEGO ${modIdx + 1} - ${grade.toUpperCase()}`;

            // Título módulo
            rrModuleTitle(rr, modName); rr++;

            // Encabezados
            rr = rrDrawHeaders(rr, accLabels);

            // Filas de datos
            if (rows.length === 0) {
                rrFill(rr, RR_BLANC, 16);
                ws9.mergeCells(rr, 2, rr, RR_LAST);
                const emptyR = ws9.getCell(rr, 2);
                emptyR.value = 'Sin datos.';
                emptyR.font  = { italic: true, size: 8, name: 'Arial',
                                 color: { argb: 'FF888888' } };
                emptyR.fill  = { type: 'pattern', pattern: 'solid',
                    fgColor: { argb: RR_BLANC } };
                emptyR.alignment = { horizontal: 'center', vertical: 'middle' };
                rr++;
            } else {
                let dataIdx = 0;
                rows.forEach((row: any) => {
                    rrDataRow(rr, row, row.isStatic ? -1 : dataIdx);
                    if (!row.isStatic) dataIdx++;
                    rr++;
                });
            }

            // Separador entre módulos
            rrSep(rr, 14); rr++;
        });

        rrSep(rr, 18); rr++;
    });

    // =========================================================================
    // RESUMEN FINAL
    // =========================================================================
    rrFill(rr, RR_HDR1, 22);
    ws9.mergeCells(rr, 2, rr, RR_LAST);
    const rrResHdr = ws9.getCell(rr, 2);
    rrResHdr.value = 'RESUMEN — RED DE RIEGO';
    rrResHdr.font  = { bold: true, size: 10, name: 'Arial', color: { argb: 'FFFFFFFF' } };
    rrResHdr.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RR_HDR1 } };
    rrResHdr.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    rrResHdr.border = { top: rrBM, left: rrBM, bottom: rrBM, right: rrBM };
    rr++;
    rrSep(rr, 8); rr++;

    // Una fila de resumen por grado
    rrSelectedGrades.forEach((grade, idx) => {
        const gradeData = rrTables[grade];
        let rrMods: any[] = [];
        if (gradeData) {
            if (Array.isArray(gradeData)) rrMods = gradeData;
            else if (gradeData.modules) rrMods = gradeData.modules;
        }
        const totalCircuitos = rrMods.length;
        const bg = idx % 2 === 0 ? RR_BLANC : RR_LBLUE;
        rrFill(rr, bg, 19);

        ws9.mergeCells(rr, 2, rr, 10);
        const gc = ws9.getCell(rr, 2);
        gc.value = `NIVEL ${rrGradeNames[grade]}`;
        gc.font  = { bold: true, size: 9, name: 'Arial', color: { argb: RR_NEGRO } };
        gc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        gc.alignment = { horizontal: 'left', vertical: 'middle', indent: 2 };
        gc.border = { top: rrBT, left: rrBM, bottom: rrBT, right: rrBT };
        for (let c = 3; c <= 10; c++) {
            ws9.getCell(rr, c).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: bg } };
            ws9.getCell(rr, c).border = { top: rrBT, bottom: rrBT };
        }

        ws9.mergeCells(rr, 11, rr, 15);
        const gv = ws9.getCell(rr, 11);
        gv.value = `${totalCircuitos} circuito${totalCircuitos !== 1 ? 's' : ''} / módulo${totalCircuitos !== 1 ? 's' : ''}`;
        gv.font  = { bold: true, size: 9, name: 'Arial', color: { argb: 'FF1F4E78' } };
        gv.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RR_YELLOW } };
        gv.alignment = { horizontal: 'center', vertical: 'middle' };
        gv.border = { top: rrBT, left: rrBT, bottom: rrBT, right: rrBT };
        for (let c = 12; c <= 15; c++) {
            ws9.getCell(rr, c).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: RR_YELLOW } };
            ws9.getCell(rr, c).border = { top: rrBT, bottom: rrBT };
        }
        // config valores
        ws9.mergeCells(rr, 16, rr, 20);
        const gn = ws9.getCell(rr, 16);
        gn.value = `Nivel tanque: ${rrNivel.toFixed(3)} m`;
        gn.font  = { size: 8, name: 'Arial', color: { argb: RR_NEGRO } };
        gn.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        gn.alignment = { horizontal: 'center', vertical: 'middle' };
        gn.border = { top: rrBT, left: rrBT, bottom: rrBT, right: rrBT };
        for (let c = 17; c <= 20; c++) {
            ws9.getCell(rr, c).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: bg } };
            ws9.getCell(rr, c).border = { top: rrBT, bottom: rrBT };
        }
        for (let c = 21; c <= RR_LAST; c++) {
            ws9.getCell(rr, c).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: bg } };
            ws9.getCell(rr, c).border = { top: rrBT, bottom: rrBT,
                right: c === RR_LAST ? rrBM : rrBT };
        }
        rr++;
    });

    rrSep(rr, 16); rr++;

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