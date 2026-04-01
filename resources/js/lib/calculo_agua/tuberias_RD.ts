import ExcelJS from 'exceljs';

interface TuberiasRDData {
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
    tablas?: Record<string, any>;   // alias
    accesoriosConfig?: {
        inicial?: { codo90: string; tee: string; val_compuerta: string; reduccion2: string };
        primaria?: { codo90: string; tee: string; val_compuerta: string; reduccion2: string };
        secundaria?: { codo90: string; tee: string; val_compuerta: string; reduccion2: string };
    };
    [key: string]: any;
}

export async function exportTuberiasRDToExcel(
    data: TuberiasRDData,
    fileName: string = 'Tuberias_RD'
) {
    const workbook = new ExcelJS.Workbook();
    const ws7 = workbook.addWorksheet('7. Tuberías RD');

    // 26 columnas: 1 spacer + 25 datos
    ws7.columns = [
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

    const RD_LAST = 26; // última columna

    // ── Paleta estilo ingeniero (igual imagen de referencia) ──────────────────
    const RD_BLANC  = 'FFFFFFFF';
    const RD_NEGRO  = 'FF000000';
    const RD_TITLE  = 'FF4F4F4F'; // gris oscuro — barra título módulo
    const RD_HDR1   = 'FF595959'; // gris medio oscuro — primera fila header
    const RD_HDR2   = 'FF737373'; // gris medio — segunda fila header
    const RD_YELLOW = 'FFFFC000'; // amarillo — valores clave
    const RD_LYELL  = 'FFFFF2CC'; // amarillo suave — valores calculados
    const RD_LGRAY  = 'FFD9D9D9'; // gris claro — totales / estáticas
    const RD_LBLUE  = 'FFD6E4F0'; // azul claro — filas alternas
    const RD_GREEN  = 'FF70AD47'; // verde — CUMPLE
    const RD_RED    = 'FFFF0000'; // rojo — NO CUMPLE
    const RD_ORANG  = 'FFFCE4D6'; // naranja suave — fila estática
    const RD_SECTB  = 'FF203864'; // azul muy oscuro — barra sección grado

    const rdBT = { style: 'thin'   as ExcelJS.BorderStyle, color: { argb: 'FFA0A0A0' } };
    const rdBM = { style: 'medium' as ExcelJS.BorderStyle, color: { argb: 'FF444444' } };
    const rdBW = { style: 'thin'   as ExcelJS.BorderStyle, color: { argb: 'FFFFFFFF' } };

    // ── Helpers ───────────────────────────────────────────────────────────────
    function rdFill(r: number, bg: string, h = 17) {
        ws7.getRow(r).height = h;
        ws7.getCell(r, 1).fill = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: RD_BLANC } };
        for (let c = 2; c <= RD_LAST; c++)
            ws7.getCell(r, c).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: bg } };
    }

    function rdSep(r: number, h = 10) {
        ws7.getRow(r).height = h;
        for (let c = 1; c <= RD_LAST; c++)
            ws7.getCell(r, c).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: RD_BLANC } };
    }

    function rdC(r: number, c: number, val: any, opts: {
        bold?: boolean; size?: number; bg?: string; color?: string;
        halign?: ExcelJS.Alignment['horizontal']; numFmt?: string;
        wrap?: boolean; border?: 'T' | 'M' | 'W' | false;
        italic?: boolean;
    } = {}) {
        const cell = ws7.getCell(r, c);
        cell.value = val ?? null;
        cell.font  = { bold: opts.bold ?? false, size: opts.size ?? 8,
                       name: 'Arial', italic: opts.italic ?? false,
                       color: { argb: opts.color ?? RD_NEGRO } };
        if (opts.bg) cell.fill = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: opts.bg } };
        cell.alignment = { horizontal: opts.halign ?? 'center', vertical: 'middle',
                           wrapText: opts.wrap ?? false };
        if (opts.border !== false) {
            const b = opts.border === 'M' ? rdBM
                    : opts.border === 'W' ? rdBW
                    : rdBT;
            cell.border = { top: b, left: b, bottom: b, right: b };
        }
        if (opts.numFmt) cell.numFmt = opts.numFmt;
    }

    // Barra de título de módulo (gris oscuro, texto blanco, full-width merge)
    function rdModuleTitle(r: number, text: string) {
        rdFill(r, RD_TITLE, 22);
        ws7.mergeCells(r, 2, r, RD_LAST);
        const cell = ws7.getCell(r, 2);
        cell.value = text;
        cell.font  = { bold: true, size: 9, name: 'Arial', color: { argb: 'FFFFFFFF' } };
        cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RD_TITLE } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { top: rdBM, left: rdBM, bottom: rdBM, right: rdBM };
    }

    // Barra sección grado (azul muy oscuro)
    function rdGradeBar(r: number, text: string) {
        rdFill(r, RD_SECTB, 24);
        ws7.mergeCells(r, 2, r, RD_LAST);
        const cell = ws7.getCell(r, 2);
        cell.value = text;
        cell.font  = { bold: true, size: 10, name: 'Arial', color: { argb: 'FFFFFFFF' } };
        cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RD_SECTB } };
        cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        cell.border = { top: rdBM, left: rdBM, bottom: rdBM, right: rdBM };
    }

    // Barra título principal
    function rdMainTitle(r: number, text: string) {
        rdFill(r, 'FF1F3864', 28);
        ws7.mergeCells(r, 2, r, RD_LAST);
        const cell = ws7.getCell(r, 2);
        cell.value = text;
        cell.font  = { bold: true, size: 12, name: 'Arial', color: { argb: 'FFFFFFFF' } };
        cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } };
        cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        cell.border = { top: rdBM, left: rdBM, bottom: rdBM, right: rdBM };
    }

    // ── Encabezados de tabla (2 filas) ────────────────────────────────────────
    // Devuelve la fila después de los headers
    function rdDrawHeaders(r: number, accLabels: {
        codo90: string; tee: string; val_compuerta: string; reduccion2: string;
    }): number {
        // ── Fila 1 ────────────────────────────────────────────────────────────
        rdFill(r, RD_HDR1, 28);
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
            if (cEnd) ws7.mergeCells(r, c, r, cEnd);
            const cell = ws7.getCell(r, c);
            cell.value = text;
            cell.font  = { bold: true, size: 8, name: 'Arial', color: { argb: 'FFFFFFFF' } };
            cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RD_HDR1 } };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.border = { top: rdBW, left: rdBW, bottom: rdBW, right: rdBW };
            if (cEnd) {
                for (let cc = c + 1; cc <= cEnd; cc++) {
                    ws7.getCell(r, cc).fill = { type: 'pattern', pattern: 'solid',
                        fgColor: { argb: RD_HDR1 } };
                }
            }
        });
        r++;

        // ── Fila 2 ────────────────────────────────────────────────────────────
        rdFill(r, RD_HDR2, 24);
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
            const cell = ws7.getCell(r, c);
            cell.value = text;
            cell.font  = { bold: true, size: 7, name: 'Arial', color: { argb: 'FFFFFFFF' } };
            cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RD_HDR2 } };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.border = { top: rdBW, left: rdBW, bottom: rdBW, right: rdBW };
        });
        r++;
        return r;
    }

    // ── Fila de datos ──────────────────────────────────────────────────────────
    function rdDataRow(r: number, row: any, idx: number): void {
        const isStatic = row.isStatic;
        const bg = isStatic ? RD_ORANG : (idx % 2 === 0 ? RD_BLANC : RD_LBLUE);
        rdFill(r, bg, 16);

        const n = (v: any, d = 3) => {
            const f = parseFloat(v);
            return isFinite(f) ? f : null;
        };

        // Verificación coloreada
        const verif = (val: string): { text: string; bg: string; color: string } => {
            if (!val || val === '') return { text: '-', bg: bg, color: RD_NEGRO };
            const v = String(val).toLowerCase();
            if (v === 'cumple' || v === 'ok' || v === 'si' || v === 'sí')
                return { text: 'cumple', bg: 'FFE2EFDA', color: 'FF375623' };
            if (v === 'no cumple' || v === 'no')
                return { text: 'no cumple', bg: 'FFFFC7CE', color: 'FF9C0006' };
            return { text: val, bg: bg, color: RD_NEGRO };
        };

        const cols: Array<{ c: number; val: any; bg2?: string; color?: string;
            bold?: boolean; numFmt?: string; isVerif?: boolean }> = [
            { c: 2,  val: row.segmento    || '' },
            { c: 3,  val: row.punto        || '' },
            { c: 4,  val: n(row.cota),       bg2: isStatic ? RD_LGRAY : RD_LYELL, numFmt: '0.000' },
            { c: 5,  val: isStatic ? '' : (row.uh_parcial !== '' && row.uh_parcial != null ? n(row.uh_parcial) : '') },
            { c: 6,  val: isStatic ? '' : n(row.uh_total),   bg2: RD_LYELL, numFmt: '0.000' },
            { c: 7,  val: isStatic ? '' : n(row.caudal),     bg2: RD_YELLOW, bold: true, numFmt: '0.000' },
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
            { c: 18, val: isStatic ? '' : n(row.longitudtotal), bg2: RD_LYELL, numFmt: '0.00' },
            { c: 19, val: isStatic ? (n(row.coefrug) ?? '') : n(row.coefrug), numFmt: '0' },
            { c: 20, val: isStatic ? '' : n(row.s),          numFmt: '0.00000' },
            { c: 21, val: isStatic ? '' : n(row.hf),         numFmt: '0.00' },
            { c: 22, val: n(row.hpiez),                       bg2: RD_YELLOW, bold: true, numFmt: '0.000' },
            { c: 23, val: isStatic ? '' : n(row.velocidad),  numFmt: '0.00' },
            { c: 24, val: isStatic ? '' : n(row.presion),    bg2: isStatic ? bg : RD_LYELL, numFmt: '0.000' },
        ];

        cols.forEach(({ c, val, bg2, color, bold, numFmt }) => {
            const cell = ws7.getCell(r, c);
            cell.value = val ?? null;
            cell.font  = { bold: bold ?? false, size: 8, name: 'Arial',
                           color: { argb: color ?? RD_NEGRO } };
            cell.fill  = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: bg2 ?? bg } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = { top: rdBT, left: rdBT, bottom: rdBT, right: rdBT };
            if (numFmt && val !== null && val !== '' && !isNaN(parseFloat(val))) {
                cell.numFmt = numFmt;
            }
        });

        // Verificaciones
        const v1 = verif(row.verificacion1);
        const v2 = verif(row.verificacion2);
        [{ c: 25, v: v1 }, { c: 26, v: v2 }].forEach(({ c, v }) => {
            const cell = ws7.getCell(r, c);
            cell.value = isStatic ? '' : v.text;
            cell.font  = { bold: true, size: 7, name: 'Arial', color: { argb: v.color } };
            cell.fill  = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: isStatic ? bg : v.bg } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = { top: rdBT, left: rdBT, bottom: rdBT, right: rdBT };
        });
    }

    // ── Leer datos ─────────────────────────────────────────────────────────────
    const rdD      = data;
    const rdConfig = rdD.config || { npisoterminado: 0.65, altasumfondotanqueelevado: 13.85 };
    const rdGrades = rdD.grades || { inicial: true, primaria: false, secundaria: false };
    const rdTables = rdD.tables || rdD.tablas || {};
    const rdAccCfg = rdD.accesoriosConfig || {
        inicial:    { codo90:'codo90', tee:'tee', val_compuerta:'valCompuerta', reduccion2:'reduccion2' },
        primaria:   { codo90:'codo90', tee:'tee', val_compuerta:'valCompuerta', reduccion2:'reduccion2' },
        secundaria: { codo90:'codo90', tee:'tee', val_compuerta:'valCompuerta', reduccion2:'reduccion2' },
    };

    const rdNivel = parseFloat(
        (
            parseFloat(String(rdConfig.npisoterminado || 0.65)) +
            parseFloat(String(rdConfig.altasumfondotanqueelevado || 13.85))
        ).toFixed(3)
    );

    const rdAccNames: Record<string, string> = {
        codo90:'Codo 90°', codo45:'Codo 45°', tee:'Tee',
        valCompuerta:'Val. Comp.', valCheck:'Val. Check',
        canastilla:'Canastilla', reduccion1:'Reduc. 1', reduccion2:'Reduc. 2',
    };

    const rdGradeNames: Record<string, string> = {
        inicial:'INICIAL', primaria:'PRIMARIA', secundaria:'SECUNDARIA',
    };

    const rdSelectedGrades = Object.keys(rdGrades).filter((g) => (rdGrades as any)[g]);

    let rr7 = 1; // row cursor

    // =========================================================================
    // TÍTULO PRINCIPAL
    // =========================================================================
    rdMainTitle(rr7, '6. CÁLCULO DE LA RED DE DISTRIBUCIÓN (TUBERÍAS RD)'); rr7++;
    rdSep(rr7, 14); rr7++;

    // =========================================================================
    // CONFIGURACIÓN
    // =========================================================================
    // Barra config
    rdFill(rr7, RD_HDR1, 22);
    ws7.mergeCells(rr7, 2, rr7, RD_LAST);
    const rdCfgHdr = ws7.getCell(rr7, 2);
    rdCfgHdr.value = 'CONFIGURACIÓN DEL SISTEMA';
    rdCfgHdr.font  = { bold: true, size: 9, name: 'Arial', color: { argb: 'FFFFFFFF' } };
    rdCfgHdr.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RD_HDR1 } };
    rdCfgHdr.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    rdCfgHdr.border = { top: rdBM, left: rdBM, bottom: rdBM, right: rdBM };
    rr7++;
    rdSep(rr7, 6); rr7++;

    // Filas de config
    const rdCfgRows = [
        { 
            label: 'Nivel de Piso Terminado',
            val: parseFloat(String(rdConfig.npisoterminado || 0.65)), 
            unit: 'm' 
        },
        { 
            label: 'Altura Asumida Fondo Tanque Elevado',
            val: parseFloat(String(rdConfig.altasumfondotanqueelevado || 13.85)), 
            unit: 'm' 
        },
        { 
            label: 'Nivel Asumido Fondo Tanque Elevado (calculado)',
            val: rdNivel, 
            unit: 'm', 
            computed: true 
        },
    ];
    rdCfgRows.forEach((cfg, idx) => {
        const bg = idx % 2 === 0 ? RD_BLANC : 'FFF8F8F8';
        rdFill(rr7, bg, 19);
        // Label cols 2-10
        ws7.mergeCells(rr7, 2, rr7, 10);
        const lc = ws7.getCell(rr7, 2);
        lc.value = cfg.label;
        lc.font  = { size: 9, name: 'Arial', color: { argb: RD_NEGRO } };
        lc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        lc.alignment = { horizontal: 'right', vertical: 'middle' };
        lc.border = { top: rdBT, left: rdBT, bottom: rdBT, right: rdBT };
        for (let c = 3; c <= 10; c++) {
            ws7.getCell(rr7, c).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: bg } };
            ws7.getCell(rr7, c).border = { top: rdBT, bottom: rdBT };
        }
        // Valor col 11
        const vc = ws7.getCell(rr7, 11);
        vc.value  = cfg.val;
        vc.numFmt = '0.000';
        vc.font   = { bold: true, size: 10, name: 'Arial', color: { argb: RD_NEGRO } };
        vc.fill   = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: cfg.computed ? RD_BLANC : RD_YELLOW } };
        vc.alignment = { horizontal: 'center', vertical: 'middle' };
        vc.border = { top: rdBT, left: rdBT, bottom: rdBT, right: rdBT };
        // Unidad col 12
        const uc = ws7.getCell(rr7, 12);
        uc.value = cfg.unit;
        uc.font  = { size: 8, name: 'Arial', color: { argb: RD_NEGRO } };
        uc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        uc.alignment = { horizontal: 'left', vertical: 'middle' };
        uc.border = { top: rdBT, left: rdBT, bottom: rdBT, right: rdBT };
        // Rest blank
        for (let c = 13; c <= RD_LAST; c++) {
            ws7.getCell(rr7, c).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: bg } };
            ws7.getCell(rr7, c).border = { top: rdBT, bottom: rdBT,
                right: c === RD_LAST ? rdBM : rdBT };
        }
        rr7++;
    });
    rdSep(rr7, 16); rr7++;

    // =========================================================================
    // TABLAS POR GRADO
    // =========================================================================
    if (rdSelectedGrades.length === 0) {
        rdFill(rr7, RD_LYELL, 24);
        ws7.mergeCells(rr7, 2, rr7, RD_LAST);
        const noData = ws7.getCell(rr7, 2);
        noData.value = 'No hay grados seleccionados para exportar.';
        noData.font  = { italic: true, size: 9, name: 'Arial', color: { argb: 'FF996600' } };
        noData.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RD_LYELL } };
        noData.alignment = { horizontal: 'center', vertical: 'middle' };
        rr7++;
    }

    rdSelectedGrades.forEach(grade => {
        // Normalizar módulos del grado
        let rdModules: any[] = [];
        const gradeData = rdTables[grade];
        if (gradeData) {
            if (Array.isArray(gradeData)) {
                // formato tablas: [{ nombre, data }]
                rdModules = gradeData;
            } else if (gradeData.modules) {
                // formato tables: { modules: [{ id, nombre, data }] }
                rdModules = gradeData.modules;
            }
        }

        // Barra de grado
        rdGradeBar(rr7, `NIVEL ${rdGradeNames[grade]} — RED DE DISTRIBUCIÓN`); rr7++;
        rdSep(rr7, 10); rr7++;

        if (rdModules.length === 0) {
            rdFill(rr7, RD_LYELL, 20);
            ws7.mergeCells(rr7, 2, rr7, RD_LAST);
            const noMod = ws7.getCell(rr7, 2);
            noMod.value = `Sin módulos para el nivel ${rdGradeNames[grade]}.`;
            noMod.font  = { italic: true, size: 9, name: 'Arial', color: { argb: 'FF888888' } };
            noMod.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RD_LYELL } };
            noMod.alignment = { horizontal: 'center', vertical: 'middle' };
            rr7++;
            rdSep(rr7, 16); rr7++;
            return;
        }

       const gradeAcc = (rdAccCfg as any)[grade] || rdAccCfg.inicial;
    
    const accLabels = {
        codo90:        (rdAccNames as any)[gradeAcc.codo90]        || 'Codo 90°',
        tee:           (rdAccNames as any)[gradeAcc.tee]           || 'Tee',
        val_compuerta: (rdAccNames as any)[gradeAcc.val_compuerta] || 'Val. Comp.',
        reduccion2:    (rdAccNames as any)[gradeAcc.reduccion2]    || 'Reduc. 2',
    };
        rdModules.forEach((modulo: any, modIdx: number) => {
            const rows: any[] = Array.isArray(modulo.data) ? modulo.data : [];
            const modName = modulo.nombre ||
                `CALCULO DE LA RED DE DISTRIBUCION ${modIdx + 1} - ${grade.toUpperCase()}`;

            // Título módulo
            rdModuleTitle(rr7, modName); rr7++;

            // Encabezados
            rr7 = rdDrawHeaders(rr7, accLabels);

            // Filas de datos
            if (rows.length === 0) {
                rdFill(rr7, RD_BLANC, 16);
                ws7.mergeCells(rr7, 2, rr7, RD_LAST);
                const emptyR = ws7.getCell(rr7, 2);
                emptyR.value = 'Sin datos.';
                emptyR.font  = { italic: true, size: 8, name: 'Arial',
                                 color: { argb: 'FF888888' } };
                emptyR.fill  = { type: 'pattern', pattern: 'solid',
                    fgColor: { argb: RD_BLANC } };
                emptyR.alignment = { horizontal: 'center', vertical: 'middle' };
                rr7++;
            } else {
                let dataIdx = 0;
                rows.forEach((row: any) => {
                    rdDataRow(rr7, row, row.isStatic ? -1 : dataIdx);
                    if (!row.isStatic) dataIdx++;
                    rr7++;
                });
            }

            // Separador entre módulos
            rdSep(rr7, 14); rr7++;
        });

        rdSep(rr7, 18); rr7++;
    });

    // =========================================================================
    // RESUMEN FINAL
    // =========================================================================
    rdFill(rr7, RD_HDR1, 22);
    ws7.mergeCells(rr7, 2, rr7, RD_LAST);
    const rdResHdr = ws7.getCell(rr7, 2);
    rdResHdr.value = 'RESUMEN — RED DE DISTRIBUCIÓN';
    rdResHdr.font  = { bold: true, size: 10, name: 'Arial', color: { argb: 'FFFFFFFF' } };
    rdResHdr.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RD_HDR1 } };
    rdResHdr.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    rdResHdr.border = { top: rdBM, left: rdBM, bottom: rdBM, right: rdBM };
    rr7++;
    rdSep(rr7, 8); rr7++;

    // Una fila de resumen por grado
    rdSelectedGrades.forEach((grade, idx) => {
        const gradeData = rdTables[grade];
        let rdMods: any[] = [];
        if (gradeData) {
            if (Array.isArray(gradeData)) rdMods = gradeData;
            else if (gradeData.modules) rdMods = gradeData.modules;
        }
        const totalCircuitos = rdMods.length;
        const bg = idx % 2 === 0 ? RD_BLANC : RD_LBLUE;
        rdFill(rr7, bg, 19);

        ws7.mergeCells(rr7, 2, rr7, 10);
        const gc = ws7.getCell(rr7, 2);
        gc.value = `NIVEL ${rdGradeNames[grade]}`;
        gc.font  = { bold: true, size: 9, name: 'Arial', color: { argb: RD_NEGRO } };
        gc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        gc.alignment = { horizontal: 'left', vertical: 'middle', indent: 2 };
        gc.border = { top: rdBT, left: rdBM, bottom: rdBT, right: rdBT };
        for (let c = 3; c <= 10; c++) {
            ws7.getCell(rr7, c).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: bg } };
            ws7.getCell(rr7, c).border = { top: rdBT, bottom: rdBT };
        }

        ws7.mergeCells(rr7, 11, rr7, 15);
        const gv = ws7.getCell(rr7, 11);
        gv.value = `${totalCircuitos} circuito${totalCircuitos !== 1 ? 's' : ''} / módulo${totalCircuitos !== 1 ? 's' : ''}`;
        gv.font  = { bold: true, size: 9, name: 'Arial', color: { argb: 'FF1F4E78' } };
        gv.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RD_YELLOW } };
        gv.alignment = { horizontal: 'center', vertical: 'middle' };
        gv.border = { top: rdBT, left: rdBT, bottom: rdBT, right: rdBT };
        for (let c = 12; c <= 15; c++) {
            ws7.getCell(rr7, c).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: RD_YELLOW } };
            ws7.getCell(rr7, c).border = { top: rdBT, bottom: rdBT };
        }
        // config valores
        ws7.mergeCells(rr7, 16, rr7, 20);
        const gn = ws7.getCell(rr7, 16);
        gn.value = `Nivel tanque: ${rdNivel.toFixed(3)} m`;
        gn.font  = { size: 8, name: 'Arial', color: { argb: RD_NEGRO } };
        gn.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        gn.alignment = { horizontal: 'center', vertical: 'middle' };
        gn.border = { top: rdBT, left: rdBT, bottom: rdBT, right: rdBT };
        for (let c = 17; c <= 20; c++) {
            ws7.getCell(rr7, c).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: bg } };
            ws7.getCell(rr7, c).border = { top: rdBT, bottom: rdBT };
        }
        for (let c = 21; c <= RD_LAST; c++) {
            ws7.getCell(rr7, c).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: bg } };
            ws7.getCell(rr7, c).border = { top: rdBT, bottom: rdBT,
                right: c === RD_LAST ? rdBM : rdBT };
        }
        rr7++;
    });

    rdSep(rr7, 16); rr7++;

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