import ExcelJS from 'exceljs';

// Definición de tipos para los datos de entrada (ajusta según tus datos reales)
interface MaxDemandaSimultaneaData {
    grades?: Record<string, boolean>;
    tables?: Record<string, any>;
    anexo02?: any[];
    exterioresData?: Record<string, any>;
    totals?: any;
    [key: string]: any;
}

export async function exportMaxDemandaSimultaneaToExcel(
    data: MaxDemandaSimultaneaData,
    fileName: string = 'Max_Demanda_Simultanea'
) {
    const workbook = new ExcelJS.Workbook();
    const ws5 = workbook.addWorksheet('5. Max. Demanda');

    // ── Constantes de color ────────────────────────────────────────────────────
    const MD_BLANC  = 'FFFFFFFF';
    const MD_NEGRO  = 'FF000000';
    const MD_TITLE  = 'FF4F4F4F';   // gris oscuro — título principal
    const MD_HEADER = 'FF6D6D6D';   // gris medio — sub-barras
    const MD_YELLOW = 'FFFFC000';   // amarillo — valores destacados
    const MD_LYELL  = 'FFFFF2CC';   // amarillo claro
    const MD_LGRAY  = 'FFD9D9D9';   // gris claro
    const MD_BLUE   = 'FF1F4E78';
    const MD_BLUE2  = 'FF2E75B6';
    const MD_LBLUE  = 'FFD6E4F0';
    const MD_DGREEN = 'FF375623';
    const MD_TEAL   = 'FFE2F0ED';

    // Colores por categoría de accesorio
    const MD_CAT: Record<string, { hdr: string; sub: string; bg: string; bgAlt: string }> = {
        inodoro:   { hdr: 'FF1F4E78', sub: 'FF2E75B6', bg: 'FFD6E4F0', bgAlt: 'FFE8F1F9' },
        urinario:  { hdr: 'FF375623', sub: 'FF548235', bg: 'FFE2EFDA', bgAlt: 'FFEEF5E8' },
        lavatorio: { hdr: 'FF833C00', sub: 'FFC55A11', bg: 'FFFCE4D6', bgAlt: 'FFFEF0E8' },
        lavadero:  { hdr: 'FF833C00', sub: 'FFC55A11', bg: 'FFFCE4D6', bgAlt: 'FFFEF0E8' },
        ducha:     { hdr: 'FF1F3864', sub: 'FF2F5496', bg: 'FFDAE3F3', bgAlt: 'FFEAEFF9' },
        tina:      { hdr: 'FF1F3864', sub: 'FF2F5496', bg: 'FFDAE3F3', bgAlt: 'FFEAEFF9' },
        default:   { hdr: 'FF404040', sub: 'FF606060', bg: 'FFF2F2F2', bgAlt: 'FFF8F8F8' },
    };

    // Bordes
    const mdBT = { style: 'thin'   as ExcelJS.BorderStyle, color: { argb: 'FFA0A0A0' } };
    const mdBM = { style: 'medium' as ExcelJS.BorderStyle, color: { argb: 'FF666666' } };
    const mdBW = { style: 'thin'   as ExcelJS.BorderStyle, color: { argb: 'FFFFFFFF' } };

    // ── Leer datos del frontend ────────────────────────────────────────────────
    const mdD            = data;
    const mdGrades       = mdD.grades || { inicial: true, primaria: false, secundaria: false };
    const mdTables       = mdD.tables || {};
    const mdAnexo02: any[] = Array.isArray(mdD.anexo02) ? mdD.anexo02 : [
        { id:1,  aparatoSanitario:'Inodoro',   tipo:'Con Tanque - Descarga reducida',         total:2.5, afmax:2.5,  acmax:null },
        { id:2,  aparatoSanitario:'Inodoro',   tipo:'Con Tanque',                             total:5,   afmax:5,    acmax:null },
        { id:3,  aparatoSanitario:'Inodoro',   tipo:'C/ Válvula semiautomática y automática', total:8,   afmax:8,    acmax:null },
        { id:4,  aparatoSanitario:'Inodoro',   tipo:'C/ Válv. semiaut. descarga reducida',    total:4,   afmax:4,    acmax:null },
        { id:5,  aparatoSanitario:'Lavatorio', tipo:'Corriente',                              total:2,   afmax:1.5,  acmax:1.5 },
        { id:6,  aparatoSanitario:'Lavatorio', tipo:'Múltiple',                               total:2,   afmax:1.5,  acmax:1.5 },
        { id:7,  aparatoSanitario:'Lavadero',  tipo:'Hotel restaurante',                      total:4,   afmax:3,    acmax:3   },
        { id:8,  aparatoSanitario:'Lavadero',  tipo:'-',                                      total:3,   afmax:2,    acmax:2   },
        { id:9,  aparatoSanitario:'Ducha',     tipo:'-',                                      total:4,   afmax:3,    acmax:3   },
        { id:10, aparatoSanitario:'Tina',      tipo:'-',                                      total:6,   afmax:3,    acmax:3   },
        { id:11, aparatoSanitario:'Urinario',  tipo:'Con Tanque',                             total:3,   afmax:3,    acmax:null },
        { id:12, aparatoSanitario:'Urinario',  tipo:'C/ Válvula semiautomática y automática', total:5,   afmax:5,    acmax:null },
        { id:13, aparatoSanitario:'Urinario',  tipo:'C/ Válv. semiaut. descarga reducida',    total:2.5, afmax:2.5,  acmax:null },
        { id:14, aparatoSanitario:'Urinario',  tipo:'Múltiple',                               total:3,   afmax:3,    acmax:null },
        { id:15, aparatoSanitario:'Bebedero',  tipo:'Simple',                                 total:1,   afmax:1,    acmax:null },
        { id:16, aparatoSanitario:'Bebedero',  tipo:'Múltiple (UG por cada salida)',          total:1,   afmax:1,    acmax:null },
    ];
    const mdExteriores = mdD.exterioresData || {
        inicial:    { nombre:'AREA VERDE - INICIAL',    areaRiego:491.6, salidasRiego:6, caudalPorSalida:0.23, uh:5, uhTotal:30 },
        primaria:   { nombre:'AREA VERDE - PRIMARIA',   areaRiego:41.46, salidasRiego:2, caudalPorSalida:0.23, uh:5, uhTotal:10 },
        secundaria: { nombre:'AREA VERDE - SECUNDARIA', areaRiego:200.0, salidasRiego:4, caudalPorSalida:0.23, uh:5, uhTotal:20 },
    };
    const mdTotals         = mdD.totals || {};
    const mdSelectedGrades = Object.keys(mdGrades).filter(g => mdGrades[g]);

    // ── Categorías extraídas del Anexo02 (igual que el frontend) ──────────────
    const mdCategoryMap: Record<string, string> = {
        inodoro:'inodoro', urinario:'urinario', lavatorio:'lavatorio',
        lavadero:'lavadero', lavadero_con_triturador:'lavatorio',
        bebedero:'lavatorio', ducha:'ducha', tina:'ducha',
    };
    const mdNorm = (t: string) =>
        t.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/_$/,'');

    const mdCats: { key: string; label: string; count: number }[] = [];
    const _mdSeen: Record<string, boolean> = {};
    mdAnexo02.forEach((row: any) => {
        const nk = mdNorm(row.aparatoSanitario);
        const ck = mdCategoryMap[nk] || nk;
        if (!_mdSeen[ck]) {
            _mdSeen[ck] = true;
            mdCats.push({ key: ck, label: ck.charAt(0).toUpperCase() + ck.slice(1).replace(/_/g,' '), count: 0 });
        }
        mdCats.find(c => c.key === ck)!.count++;
    });

    // Columnas: 1(spacer) | 2(descripcion) | 3..N-1(accesorios×2) | N(total UH)
    const MD_DESC_COL  = 2;                          // col descripción
    const MD_ACC_START = 3;                          // primera col de accesorio
    const MD_ACC_COLS  = mdCats.length * 2;
    const MD_TOTAL_COL = MD_ACC_START + MD_ACC_COLS; // col total U.H.
    const MD_LAST      = MD_TOTAL_COL;               // última col de datos

    // ── Anchos de columnas ─────────────────────────────────────────────────────
    const mdColDefs: Partial<ExcelJS.Column>[] = [
        { width: 3  },  // 1 spacer
        { width: 35 },  // 2 descripción (amplia)
    ];
    mdCats.forEach(() => {
        mdColDefs.push({ width: 8 });   // cantidad
        mdColDefs.push({ width: 7 });   // UH/u
    });
    mdColDefs.push({ width: 10 });      // total U.H.
    ws5.columns = mdColDefs;

    // ── Helpers ────────────────────────────────────────────────────────────────
    const gc5 = (r: number, c: number) => ws5.getCell(r, c);

    function md5Fill(r: number, bg: string, h = 17) {
        ws5.getRow(r).height = h;
        gc5(r, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MD_BLANC } };
        for (let c = 2; c <= MD_LAST; c++)
            gc5(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    }
    function md5Sep(r: number, h = 10) {
        ws5.getRow(r).height = h;
        for (let c = 1; c <= MD_LAST; c++)
            gc5(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MD_BLANC } };
    }
    function md5TitleBar(r: number, text: string) {
        md5Fill(r, MD_TITLE, 26);
        ws5.mergeCells(r, 2, r, MD_LAST);
        const cell = gc5(r, 2);
        cell.value = text;
        cell.font  = { bold: true, size: 12, name: 'Arial', color: { argb: 'FFFFFFFF' } };
        cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: MD_TITLE } };
        cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        cell.border = { top: mdBM, left: mdBM, bottom: mdBM, right: mdBM };
    }
    function md5SubBar(r: number, text: string, bg = MD_HEADER) {
        md5Fill(r, bg, 24);
        ws5.mergeCells(r, 2, r, MD_LAST);
        const cell = gc5(r, 2);
        cell.value = text;
        cell.font  = { bold: true, size: 10, name: 'Arial', color: { argb: 'FFFFFFFF' } };
        cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        cell.border = { top: mdBT, left: mdBM, bottom: mdBT, right: mdBM };
    }

    // Calcular UD de un item (misma lógica que frontend)
    const mdCalcUD = (item: any): number => {
        if (!item?.accessories) return parseFloat(item?.udTotal) || 0;
        return mdCats.reduce((sum, cat) => {
            const c = parseFloat(item.accessories?.[cat.key]?.cantidad) || 0;
            const u = parseFloat(item.accessories?.[cat.key]?.uh) || 0;
            return sum + c * u;
        }, 0);
    };

    // Interpolación curva Hunter (igual que frontend)
    const mdUHData: [number, number][] = [
        [0,0],[1,0.12],[2,0.18],[3,0.27],[4,0.36],[5,0.42],[6,0.48],[7,0.54],[8,0.60],
        [10,0.72],[12,0.84],[14,0.96],[16,1.02],[18,1.08],[20,1.14],[25,1.26],[30,1.32],
        [35,1.38],[40,1.44],[45,1.50],[50,1.56],[60,1.68],[70,1.74],[80,1.80],[90,1.86],
        [100,1.92],[120,2.04],[140,2.16],[160,2.22],[180,2.28],[200,2.34],
        [225,2.46],[250,2.52],[275,2.58],[300,2.64],[350,2.76],[400,2.88],
        [450,2.94],[500,3.00],[600,3.18],[700,3.30],[800,3.42],[900,3.54],[1000,3.66],
    ];
    const mdGetFlow = (uh: number): number => {
        const u = parseFloat(String(uh));
        if (!isFinite(u) || u <= 0) return 0;
        const exact = mdUHData.find(([x]) => Math.abs(x - u) < 0.001);
        if (exact) return exact[1];
        let lo: [number,number] | null = null, hi: [number,number] | null = null;
        for (const pt of mdUHData) {
            if (pt[0] < u) lo = pt;
            else if (pt[0] > u) { hi = pt; break; }
        }
        if (lo && hi) return lo[1] + (u - lo[0]) * (hi[1] - lo[1]) / (hi[0] - lo[0]);
        if (hi) return hi[1];
        if (lo) return lo[1];
        return 0;
    };

    // Totales por grado
    const mdGradeTotals: Record<string, number> = {};
    mdSelectedGrades.forEach(grade => {
        const mods = mdTables[grade]?.modules || [];
        mdGradeTotals[grade] = mods.reduce((s: number, mod: any) => {
            const dUD = (mod.details || []).reduce((ds: number, d: any) => ds + mdCalcUD(d), 0);
            const cUD = (mod.children || []).reduce((cs: number, c: any) => {
                const gcUD = (c.details || []).reduce((gs: number, gc: any) => gs + mdCalcUD(gc), 0);
                return cs + mdCalcUD(c) + gcUD;
            }, 0);
            return s + dUD + cUD;
        }, 0);
    });

    const mdOverallUD  = Object.values(mdGradeTotals).reduce((a, b) => a + b, 0);
    const mdExtUD      = mdSelectedGrades.reduce((s, g) => s + (parseFloat(mdExteriores[g]?.uhTotal) || 0), 0);
    const mdQmdsIntF   = parseFloat(mdTotals.sistemasInterior?.qmds)  || mdGetFlow(mdOverallUD);
    const mdQmdsRiegoF = parseFloat(mdTotals.sistemaRiego?.qmdsRiego) || mdGetFlow(mdExtUD);
    const mdQmdsTotalF = parseFloat(mdTotals.qmdsTotal) || mdQmdsIntF + mdQmdsRiegoF;

    // Colores de grado
    const mdGradeColors: Record<string, { bar: string; mod: string; modText: string; child: string; childText: string }> = {
        inicial:    { bar:'FF1B5E20', mod:'FFE8F5E9', modText:'FF1B5E20', child:'FFC8E6C9', childText:'FF1B5E20' },
        primaria:   { bar:'FF0D47A1', mod:'FFE3F2FD', modText:'FF0D47A1', child:'FFBBDEFB', childText:'FF0D47A1' },
        secundaria: { bar:'FF4A148C', mod:'FFF3E5F5', modText:'FF4A148C', child:'FFE1BEE7', childText:'FF4A148C' },
    };
    const mdGradeNames: Record<string, string> = {
        inicial:'INICIAL', primaria:'PRIMARIA', secundaria:'SECUNDARIA',
    };

    // =========================================================================
    // ESCRITURA — cursor mr
    // =========================================================================
    let mr = 1;

    // ── Título principal ───────────────────────────────────────────────────────
    md5TitleBar(mr, '5. CALCULO DE LA MÁXIMA DEMANDA SIMULTÁNEA'); mr++;
    md5Sep(mr, 14); mr++;

    // =========================================================================
    // ANEXO-02 — APARATOS SANITARIOS
    // =========================================================================
    ws5.getRow(mr).height = 25;
    for (let c = 2; c <= 6; c++) {
        gc5(mr, c).fill   = { type:'pattern', pattern:'solid', fgColor:{argb:'FFD4740A'} };
        gc5(mr, c).border = { top:mdBW, bottom:mdBW,
            left: c===2 ? mdBW : mdBT, right: c===6 ? mdBW : mdBT };
    }
    ws5.mergeCells(mr, 2, mr, 6);
    const cellTitAnx     = gc5(mr, 2);
    cellTitAnx.value     = 'ANEXO N° 02';
    cellTitAnx.font      = { bold:true, size:10, name:'Arial', color:{argb:'FFFFFFFF'} };
    cellTitAnx.alignment = { horizontal:'center', vertical:'middle' };
    mr++;
    md5Sep(mr, 8); mr++;

    const mdAnxCols   = ['Aparato Sanitario', 'Tipo', 'Total', 'AF', 'AC'];
    const mdAnxWidths = [22, 55, 10, 10, 10];
    ws5.getRow(mr).height = 20;
    mdAnxCols.forEach((h, i) => {
        ws5.getColumn(2 + i).width = mdAnxWidths[i];
        const cell = gc5(mr, 2 + i);
        cell.value     = h;
        cell.font      = { bold:true, size:9, name:'Arial', color:{argb:'FFFFFFFF'} };
        cell.fill      = { type:'pattern', pattern:'solid', fgColor:{argb:MD_HEADER} };
        cell.alignment = { horizontal: i<2 ? 'left' : 'center', vertical:'middle' };
        cell.border    = { top:mdBW, left:mdBW, bottom:mdBW, right:mdBW };
    });
    mr++;

    mdAnexo02.forEach((row: any, idx: number) => {
        const bg = idx % 2 === 0 ? MD_BLANC : MD_LYELL;
        ws5.getRow(mr).height = 16;
        [row.aparatoSanitario||'', row.tipo||'',
         parseFloat(row.total)||0,
         row.afmax != null ? parseFloat(row.afmax) : '',
         row.acmax != null ? parseFloat(row.acmax) : '-',
        ].forEach((v, i) => {
            const cell = gc5(mr, 2 + i);
            cell.value     = v;
            cell.font      = { size:9, name:'Arial', bold:i===2, color:{argb: i===2?'FF1F4E78':MD_NEGRO} };
            cell.fill      = { type:'pattern', pattern:'solid', fgColor:{argb:bg} };
            cell.alignment = { horizontal: i<2?'left':'center', vertical:'middle', indent: i===0?1:0 };
            cell.border    = { top:mdBT, left:mdBT, bottom:mdBT, right:mdBT };
            if (i===2 && typeof v==='number') cell.numFmt = '0.0';
        });
        mr++;
    });

    const mdTotalUD02 = mdAnexo02.reduce((s: number, r: any) => s + (parseFloat(r.total)||0), 0);
    ws5.getRow(mr).height = 20;
    ws5.mergeCells(mr, 2, mr, 3);
    gc5(mr, 2).value     = 'TOTAL UD';
    gc5(mr, 2).font      = { bold:true, size:9, name:'Arial' };
    gc5(mr, 2).alignment = { horizontal:'right', vertical:'middle' };
    for (let c = 2; c <= 3; c++) {
        gc5(mr, c).fill   = { type:'pattern', pattern:'solid', fgColor:{argb:MD_LGRAY} };
        gc5(mr, c).border = { top:mdBT, bottom:mdBM, left: c===2?mdBM:mdBT, right:mdBT };
    }
    const mdAx02TotV     = gc5(mr, 4);
    mdAx02TotV.value     = mdTotalUD02;
    mdAx02TotV.font      = { bold:true, size:10, name:'Arial', color:{argb:'FF1F4E78'} };
    mdAx02TotV.fill      = { type:'pattern', pattern:'solid', fgColor:{argb:MD_YELLOW} };
    mdAx02TotV.alignment = { horizontal:'center', vertical:'middle' };
    mdAx02TotV.border    = { top:mdBT, left:mdBT, bottom:mdBM, right:mdBT };
    mdAx02TotV.numFmt    = '0.0';
    for (let c = 5; c <= 6; c++) {
        gc5(mr, c).fill   = { type:'pattern', pattern:'solid', fgColor:{argb:MD_LGRAY} };
        gc5(mr, c).border = { top:mdBT, bottom:mdBM, left:mdBT, right: c===6?mdBM:mdBT };
    }
    mr++;
    md5Sep(mr, 18); mr++;

    // =========================================================================
    // TABLAS POR GRADO — diseño imagen
    // =========================================================================
    if (mdSelectedGrades.length === 0) {
        md5Fill(mr, MD_LYELL, 30);
        ws5.mergeCells(mr, 2, mr, MD_LAST);
        const noGrade     = gc5(mr, 2);
        noGrade.value     = 'No hay grados educativos seleccionados.';
        noGrade.font      = { bold:true, size:10, name:'Arial', color:{argb:'FF996600'} };
        noGrade.fill      = { type:'pattern', pattern:'solid', fgColor:{argb:MD_LYELL} };
        noGrade.alignment = { horizontal:'center', vertical:'middle' };
        mr++;
    }

    function md5DrawGrade(grade: string) {
        const colors    = mdGradeColors[grade] || mdGradeColors.inicial;
        const modules   = mdTables[grade]?.modules || [];
        const gradeName = mdGradeNames[grade] || grade.toUpperCase();

        // Barra de grado
        md5SubBar(mr, `CÁLCULOS PARA NIVEL ${gradeName}`, colors.bar); mr++;
        md5Sep(mr, 8); mr++;

        // ── Fila 0: Título "SUMATORIA DE GASTOS POR ACCESORIOS - NIVEL X" ─────
        ws5.getRow(mr).height = 18;
        // Descripción vacía (col 2)
        gc5(mr, 2).fill   = { type:'pattern', pattern:'solid', fgColor:{argb:MD_LGRAY} };
        gc5(mr, 2).border = { top:mdBT, left:mdBM, bottom:mdBT, right:mdBT };
        // Título sobre todas las columnas de accesorios
        const accEnd = MD_ACC_START + MD_ACC_COLS - 1;
        ws5.mergeCells(mr, MD_ACC_START, mr, accEnd);
        const titAcc     = gc5(mr, MD_ACC_START);
        titAcc.value     = `SUMATORIA DE GASTOS POR ACCESORIOS - ${gradeName}`;
        titAcc.font      = { bold:true, size:9, name:'Arial', color:{argb:MD_NEGRO} };
        titAcc.fill      = { type:'pattern', pattern:'solid', fgColor:{argb:MD_LGRAY} };
        titAcc.alignment = { horizontal:'center', vertical:'middle' };
        titAcc.border    = { top:mdBT, left:mdBT, bottom:mdBT, right:mdBT };
        for (let c = MD_ACC_START+1; c <= accEnd; c++) {
            gc5(mr,c).fill   = { type:'pattern', pattern:'solid', fgColor:{argb:MD_LGRAY} };
        }
        // Col U.H.
        gc5(mr, MD_TOTAL_COL).fill   = { type:'pattern', pattern:'solid', fgColor:{argb:MD_LGRAY} };
        gc5(mr, MD_TOTAL_COL).border = { top:mdBT, left:mdBT, bottom:mdBT, right:mdBM };
        mr++;

        // ── Fila 1: DESCRIPCION (rowspan=2) | categorías (span=2 cada una) | U.H.(rowspan=2) ──
        ws5.getRow(mr).height = 20;
        // DESCRIPCION — rowspan 2
        ws5.mergeCells(mr, 2, mr+1, 2);
        const hDesc     = gc5(mr, 2);
        hDesc.value     = 'DESCRIPCION';
        hDesc.font      = { bold:true, size:9, name:'Arial', color:{argb:MD_NEGRO} };
        hDesc.fill      = { type:'pattern', pattern:'solid', fgColor:{argb:MD_LGRAY} };
        hDesc.alignment = { horizontal:'center', vertical:'middle' };
        hDesc.border    = { top:mdBM, left:mdBM, bottom:mdBM, right:mdBT };

        // Cabecera de cada categoría (span 2 cols) con color propio
        mdCats.forEach((cat, ci) => {
            const cStart  = MD_ACC_START + ci * 2;
            const catC    = MD_CAT[cat.key] || MD_CAT.default;
            ws5.mergeCells(mr, cStart, mr, cStart+1);
            const hCat    = gc5(mr, cStart);
            hCat.value    = cat.label;
            hCat.font     = { bold:true, size:8, name:'Arial', color:{argb:'FFFFFFFF'} };
            hCat.fill     = { type:'pattern', pattern:'solid', fgColor:{argb:catC.hdr} };
            hCat.alignment= { horizontal:'center', vertical:'middle', wrapText:true };
            hCat.border   = { top:mdBW, left:mdBW, bottom:mdBW, right:mdBW };
            gc5(mr, cStart+1).fill = { type:'pattern', pattern:'solid', fgColor:{argb:catC.hdr} };
            gc5(mr, cStart+1).border = { top:mdBW, bottom:mdBW };
        });

        // U.H. — rowspan 2
        ws5.mergeCells(mr, MD_TOTAL_COL, mr+1, MD_TOTAL_COL);
        const hUH     = gc5(mr, MD_TOTAL_COL);
        hUH.value     = 'U.H.';
        hUH.font      = { bold:true, size:9, name:'Arial', color:{argb:MD_NEGRO} };
        hUH.fill      = { type:'pattern', pattern:'solid', fgColor:{argb:MD_LGRAY} };
        hUH.alignment = { horizontal:'center', vertical:'middle' };
        hUH.border    = { top:mdBW, left:mdBW, bottom:mdBW, right:mdBM };
        mr++;

        // ── Fila 2: sub-cabeceras # | UH por categoría ────────────────────────
        ws5.getRow(mr).height = 16;
        // col descripcion ya mergeada
        gc5(mr, 2).fill = { type:'pattern', pattern:'solid', fgColor:{argb:MD_LGRAY} };

        mdCats.forEach((cat, ci) => {
            const cStart = MD_ACC_START + ci * 2;
            const catC   = MD_CAT[cat.key] || MD_CAT.default;
            ['#', 'UH'].forEach((lbl, li) => {
                const cell    = gc5(mr, cStart + li);
                cell.value    = lbl;
                cell.font     = { bold:true, size:8, name:'Arial', color:{argb:'FFFFFFFF'} };
                cell.fill     = { type:'pattern', pattern:'solid', fgColor:{argb:catC.sub} };
                cell.alignment= { horizontal:'center', vertical:'middle' };
                cell.border   = { top:mdBW, left:mdBW, bottom:mdBW, right:mdBW };
            });
        });
        // col U.H. ya mergeada
        gc5(mr, MD_TOTAL_COL).fill = { type:'pattern', pattern:'solid', fgColor:{argb:MD_LGRAY} };
        mr++;

        // ── Filas de datos ────────────────────────────────────────────────────
        if (modules.length === 0) {
            md5Fill(mr, MD_LYELL, 18);
            ws5.mergeCells(mr, 2, mr, MD_LAST);
            const empty     = gc5(mr, 2);
            empty.value     = 'Sin módulos para este grado.';
            empty.font      = { italic:true, size:9, name:'Arial', color:{argb:'FF888888'} };
            empty.fill      = { type:'pattern', pattern:'solid', fgColor:{argb:MD_LYELL} };
            empty.alignment = { horizontal:'center', vertical:'middle' };
            mr++;
        }

        modules.forEach((mod: any) => {
            // Calcular total UD del módulo
            const modUD = mdCalcUD(mod) ||
                (mod.details||[]).reduce((s: number, d: any) => s + mdCalcUD(d), 0) +
                (mod.children||[]).reduce((s: number, c: any) =>
                    s + mdCalcUD(c) +
                    (c.details||[]).reduce((gs: number, gc: any) => gs + mdCalcUD(gc), 0), 0);

            // ── Fila módulo — nombre fusionado en color del grado ─────────────
            ws5.getRow(mr).height = 20;
            // Descripción (col 2) con nombre del módulo
            const modCell     = gc5(mr, 2);
            modCell.value     = mod.name || 'MÓDULO';
            modCell.font      = { bold:true, size:9, name:'Arial', color:{argb:colors.modText} };
            modCell.fill      = { type:'pattern', pattern:'solid', fgColor:{argb:colors.mod} };
            modCell.alignment = { horizontal:'left', vertical:'middle', indent:1 };
            modCell.border    = { top:mdBM, left:mdBM, bottom:mdBM, right:mdBT };

            // Celdas de accesorios: color claro de cada categoría, vacías
            mdCats.forEach((cat, ci) => {
                const cStart = MD_ACC_START + ci * 2;
                const catC   = MD_CAT[cat.key] || MD_CAT.default;
                for (let lc = cStart; lc <= cStart+1; lc++) {
                    gc5(mr, lc).fill   = { type:'pattern', pattern:'solid', fgColor:{argb:catC.bg} };
                    gc5(mr, lc).border = { top:mdBM, left:mdBT, bottom:mdBM, right:mdBT };
                }
            });
            // Col U.H. módulo
            const modTot     = gc5(mr, MD_TOTAL_COL);
            modTot.value     = parseFloat(modUD.toFixed(0));
            modTot.font      = { bold:true, size:9, name:'Arial', color:{argb:colors.modText} };
            modTot.fill      = { type:'pattern', pattern:'solid', fgColor:{argb:MD_YELLOW} };
            modTot.alignment = { horizontal:'center', vertical:'middle' };
            modTot.border    = { top:mdBM, left:mdBT, bottom:mdBM, right:mdBM };
            modTot.numFmt    = '0';
            mr++;

            // ── Filas detail del módulo ────────────────────────────────────────
            (mod.details||[]).forEach((det: any, di: number) => {
                ws5.getRow(mr).height = 16;
                const detUD = mdCalcUD(det);
                // Descripcion — alternar blanco/azul muy claro
                const detBg = di % 2 === 0 ? MD_BLANC : MD_LBLUE;
                const dDesc = gc5(mr, 2);
                dDesc.value     = det.descripcion || '';
                dDesc.font      = { size:9, name:'Arial', color:{argb:MD_NEGRO} };
                dDesc.fill      = { type:'pattern', pattern:'solid', fgColor:{argb:detBg} };
                dDesc.alignment = { horizontal:'left', vertical:'middle', indent:2 };
                dDesc.border    = { top:mdBT, left:mdBM, bottom:mdBT, right:mdBT };

                mdCats.forEach((cat, ci) => {
                    const cStart = MD_ACC_START + ci * 2;
                    const catC   = MD_CAT[cat.key] || MD_CAT.default;
                    const cant   = parseFloat(det.accessories?.[cat.key]?.cantidad) || 0;
                    const uh     = parseFloat(det.accessories?.[cat.key]?.uh) || 0;
                    // Cantidad
                    const cCant     = gc5(mr, cStart);
                    cCant.value     = cant > 0 ? cant : null;
                    cCant.font      = { bold:cant>0, size:9, name:'Arial', color:{argb:MD_NEGRO} };
                    cCant.fill      = { type:'pattern', pattern:'solid',
                        fgColor:{argb: cant>0 ? MD_YELLOW : catC.bg} };
                    cCant.alignment = { horizontal:'center', vertical:'middle' };
                    cCant.border    = { top:mdBT, left:mdBT, bottom:mdBT, right:mdBT };
                    if (cant>0) cCant.numFmt = '0';
                    // UH
                    const cUH     = gc5(mr, cStart+1);
                    cUH.value     = uh > 0 ? uh : null;
                    cUH.font      = { size:9, name:'Arial', color:{argb:MD_NEGRO} };
                    cUH.fill      = { type:'pattern', pattern:'solid', fgColor:{argb:catC.bg} };
                    cUH.alignment = { horizontal:'center', vertical:'middle' };
                    cUH.border    = { top:mdBT, left:mdBT, bottom:mdBT, right:mdBT };
                    if (uh>0) cUH.numFmt = '0';
                });
                // Total U.H.
                const dTot     = gc5(mr, MD_TOTAL_COL);
                dTot.value     = detUD > 0 ? parseFloat(detUD.toFixed(0)) : null;
                dTot.font      = { bold:detUD>0, size:9, name:'Arial', color:{argb:'FF1F4E78'} };
                dTot.fill      = { type:'pattern', pattern:'solid', fgColor:{argb: detUD>0?MD_LYELL:detBg} };
                dTot.alignment = { horizontal:'center', vertical:'middle' };
                dTot.border    = { top:mdBT, left:mdBT, bottom:mdBT, right:mdBM };
                if (detUD>0) dTot.numFmt = '0';
                mr++;
            });

            // ── Children (sub-niveles) ─────────────────────────────────────────
            (mod.children||[]).forEach((child: any) => {
                const childUD = mdCalcUD(child);

                // Fila child — nombre del sub-nivel en color child
                ws5.getRow(mr).height = 18;
                const chDesc     = gc5(mr, 2);
                const chLabel    = child.descripcion || child.nivel || '↳ Sub-Nivel';
                chDesc.value     = chLabel;
                chDesc.font      = { bold:true, size:9, name:'Arial', color:{argb:colors.childText} };
                chDesc.fill      = { type:'pattern', pattern:'solid', fgColor:{argb:colors.child} };
                chDesc.alignment = { horizontal:'left', vertical:'middle', indent:2 };
                chDesc.border    = { top:mdBT, left:mdBM, bottom:mdBT, right:mdBT };

                mdCats.forEach((cat, ci) => {
                    const cStart = MD_ACC_START + ci * 2;
                    const catC   = MD_CAT[cat.key] || MD_CAT.default;
                    const cant   = parseFloat(child.accessories?.[cat.key]?.cantidad) || 0;
                    const uh     = parseFloat(child.accessories?.[cat.key]?.uh) || 0;
                    const cCant     = gc5(mr, cStart);
                    cCant.value     = cant > 0 ? cant : null;
                    cCant.font      = { bold:cant>0, size:9, name:'Arial', color:{argb:MD_NEGRO} };
                    cCant.fill      = { type:'pattern', pattern:'solid',
                        fgColor:{argb: cant>0 ? MD_YELLOW : catC.bgAlt} };
                    cCant.alignment = { horizontal:'center', vertical:'middle' };
                    cCant.border    = { top:mdBT, left:mdBT, bottom:mdBT, right:mdBT };
                    if (cant>0) cCant.numFmt = '0';
                    const cUH     = gc5(mr, cStart+1);
                    cUH.value     = uh > 0 ? uh : null;
                    cUH.font      = { size:9, name:'Arial', color:{argb:MD_NEGRO} };
                    cUH.fill      = { type:'pattern', pattern:'solid', fgColor:{argb:catC.bgAlt} };
                    cUH.alignment = { horizontal:'center', vertical:'middle' };
                    cUH.border    = { top:mdBT, left:mdBT, bottom:mdBT, right:mdBT };
                    if (uh>0) cUH.numFmt = '0';
                });
                const chTot     = gc5(mr, MD_TOTAL_COL);
                chTot.value     = childUD > 0 ? parseFloat(childUD.toFixed(0)) : null;
                chTot.font      = { bold:childUD>0, size:9, name:'Arial', color:{argb:'FF1F4E78'} };
                chTot.fill      = { type:'pattern', pattern:'solid',
                    fgColor:{argb: childUD>0?MD_LYELL:colors.child} };
                chTot.alignment = { horizontal:'center', vertical:'middle' };
                chTot.border    = { top:mdBT, left:mdBT, bottom:mdBT, right:mdBM };
                if (childUD>0) chTot.numFmt = '0';
                mr++;

                // Grandchildren
                (child.details||[]).forEach((gch: any, gi: number) => {
                    const gcBg = gi % 2 === 0 ? MD_BLANC : MD_LYELL;
                    const gcUD = mdCalcUD(gch);
                    ws5.getRow(mr).height = 16;
                    const gcDesc     = gc5(mr, 2);
                    gcDesc.value     = gch.descripcion || '';
                    gcDesc.font      = { size:9, name:'Arial', color:{argb:MD_NEGRO} };
                    gcDesc.fill      = { type:'pattern', pattern:'solid', fgColor:{argb:gcBg} };
                    gcDesc.alignment = { horizontal:'left', vertical:'middle', indent:3 };
                    gcDesc.border    = { top:mdBT, left:mdBM, bottom:mdBT, right:mdBT };

                    mdCats.forEach((cat, ci) => {
                        const cStart = MD_ACC_START + ci * 2;
                        const catC   = MD_CAT[cat.key] || MD_CAT.default;
                        const cant   = parseFloat(gch.accessories?.[cat.key]?.cantidad) || 0;
                        const uh     = parseFloat(gch.accessories?.[cat.key]?.uh) || 0;
                        const cCant     = gc5(mr, cStart);
                        cCant.value     = cant > 0 ? cant : null;
                        cCant.font      = { bold:cant>0, size:9, name:'Arial', color:{argb:MD_NEGRO} };
                        cCant.fill      = { type:'pattern', pattern:'solid',
                            fgColor:{argb: cant>0 ? MD_YELLOW : catC.bg} };
                        cCant.alignment = { horizontal:'center', vertical:'middle' };
                        cCant.border    = { top:mdBT, left:mdBT, bottom:mdBT, right:mdBT };
                        if (cant>0) cCant.numFmt = '0';
                        const cUH     = gc5(mr, cStart+1);
                        cUH.value     = uh > 0 ? uh : null;
                        cUH.font      = { size:9, name:'Arial', color:{argb:MD_NEGRO} };
                        cUH.fill      = { type:'pattern', pattern:'solid', fgColor:{argb:catC.bg} };
                        cUH.alignment = { horizontal:'center', vertical:'middle' };
                        cUH.border    = { top:mdBT, left:mdBT, bottom:mdBT, right:mdBT };
                        if (uh>0) cUH.numFmt = '0';
                    });
                    const gcTot     = gc5(mr, MD_TOTAL_COL);
                    gcTot.value     = gcUD > 0 ? parseFloat(gcUD.toFixed(0)) : null;
                    gcTot.font      = { bold:gcUD>0, size:9, name:'Arial', color:{argb:'FF1F4E78'} };
                    gcTot.fill      = { type:'pattern', pattern:'solid',
                        fgColor:{argb: gcUD>0?MD_LYELL:gcBg} };
                    gcTot.alignment = { horizontal:'center', vertical:'middle' };
                    gcTot.border    = { top:mdBT, left:mdBT, bottom:mdBT, right:mdBM };
                    if (gcUD>0) gcTot.numFmt = '0';
                    mr++;
                });
            });
        });

        // ── Fila TOTAL U.D. NIVEL ─────────────────────────────────────────────
        const gradeTotal = mdGradeTotals[grade] || 0;
        ws5.getRow(mr).height = 22;
        ws5.mergeCells(mr, 2, mr, MD_TOTAL_COL - 1);
        const grTotLbl     = gc5(mr, 2);
        grTotLbl.value     = `TOTAL U.D. NIVEL ${gradeName}`;
        grTotLbl.font      = { bold:true, size:10, name:'Arial', color:{argb:MD_NEGRO} };
        grTotLbl.fill      = { type:'pattern', pattern:'solid', fgColor:{argb:MD_LGRAY} };
        grTotLbl.alignment = { horizontal:'right', vertical:'middle' };
        grTotLbl.border    = { top:mdBM, left:mdBM, bottom:mdBM, right:mdBT };
        for (let c = 3; c <= MD_TOTAL_COL - 1; c++) {
            gc5(mr, c).fill   = { type:'pattern', pattern:'solid', fgColor:{argb:MD_LGRAY} };
            gc5(mr, c).border = { top:mdBM, bottom:mdBM };
        }
        const grTotVal     = gc5(mr, MD_TOTAL_COL);
        grTotVal.value     = parseFloat(gradeTotal.toFixed(0));
        grTotVal.font      = { bold:true, size:12, name:'Arial', color:{argb:colors.modText} };
        grTotVal.fill      = { type:'pattern', pattern:'solid', fgColor:{argb:MD_YELLOW} };
        grTotVal.alignment = { horizontal:'center', vertical:'middle' };
        grTotVal.border    = { top:mdBM, left:mdBT, bottom:mdBM, right:mdBM };
        grTotVal.numFmt    = '0';
        mr++;
        md5Sep(mr, 18); mr++;
    }

    mdSelectedGrades.forEach(grade => md5DrawGrade(grade));

    // =========================================================================
    // TABLA EXTERIORES — ÁREAS VERDES
    // =========================================================================
    ws5.getRow(mr).height = 25;
    for (let c = 2; c <= 7; c++) {
        gc5(mr, c).fill   = { type:'pattern', pattern:'solid', fgColor:{argb:'FF00695C'} };
        gc5(mr, c).border = { top:mdBM, bottom:mdBM,
            left: c===2?mdBM:mdBT, right: c===7?mdBM:mdBT };
    }
    ws5.mergeCells(mr, 2, mr, 7);
    const cellTit     = gc5(mr, 2);
    cellTit.value     = 'CÁLCULOS PARA ZONAS EXTERIORES (ÁREAS VERDES)';
    cellTit.font      = { bold:true, size:10, name:'Arial', color:{argb:'FFFFFFFF'} };
    cellTit.alignment = { horizontal:'left', vertical:'middle', indent:1 };
    mr++;
    md5Sep(mr, 8); mr++;

    const mdExtHdrs   = ['Exterior / Zona','Área de Riego (m²)','Salidas de Riego','Caudal por Punto (L/s)','U.H. Unitario','U.H. Total'];
    const mdExtWidths = [30, 18, 16, 20, 14, 14];
    ws5.getRow(mr).height = 20;
    mdExtHdrs.forEach((h, i) => {
        ws5.getColumn(2 + i).width = mdExtWidths[i];
        const cell     = gc5(mr, 2 + i);
        cell.value     = h;
        cell.font      = { bold:true, size:8, name:'Arial', color:{argb:'FFFFFFFF'} };
        cell.fill      = { type:'pattern', pattern:'solid', fgColor:{argb:MD_HEADER} };
        cell.alignment = { horizontal:'center', vertical:'middle', wrapText:true };
        cell.border    = { top:mdBW, left:mdBW, bottom:mdBW, right:mdBW };
    });
    mr++;

    mdSelectedGrades.forEach((grade, idx) => {
        const ext = mdExteriores[grade];
        if (!ext) return;
        const bg = idx % 2 === 0 ? MD_BLANC : MD_TEAL;
        ws5.getRow(mr).height = 18;
        [ext.nombre||'', parseFloat(ext.areaRiego)||0, parseFloat(ext.salidasRiego)||0,
         parseFloat(ext.caudalPorSalida)||0, parseFloat(ext.uh)||0, parseFloat(ext.uhTotal)||0,
        ].forEach((v, i) => {
            const cell     = gc5(mr, 2 + i);
            cell.value     = v;
            cell.font      = { bold:i===5, size:9, name:'Arial',
                color:{argb: i===5?'FF004D40':MD_NEGRO} };
            cell.fill      = { type:'pattern', pattern:'solid',
                fgColor:{argb: i===5?'FFB2DFDB':bg} };
            cell.alignment = { horizontal: i===0?'left':'center', vertical:'middle',
                indent: i===0?1:0 };
            cell.border    = { top:mdBT, left:mdBT, bottom:mdBT, right:mdBT };
            if (typeof v==='number') cell.numFmt = '0.00';
        });
        mr++;
    });

    ws5.getRow(mr).height = 22;
    ws5.mergeCells(mr, 2, mr, 6);
    const mdExtTotLbl     = gc5(mr, 2);
    mdExtTotLbl.value     = 'TOTAL U.H. EXTERIORES';
    mdExtTotLbl.font      = { bold:true, size:10, name:'Arial' };
    mdExtTotLbl.alignment = { horizontal:'right', vertical:'middle' };
    for (let c = 2; c <= 6; c++) {
        gc5(mr, c).fill   = { type:'pattern', pattern:'solid', fgColor:{argb:MD_LGRAY} };
        gc5(mr, c).border = { top:mdBM, bottom:mdBM, left: c===2?mdBM:mdBT, right:mdBT };
    }
    const mdExtTotVal     = gc5(mr, 7);
    mdExtTotVal.value     = parseFloat(mdExtUD.toFixed(2));
    mdExtTotVal.font      = { bold:true, size:12, name:'Arial', color:{argb:'00695C'} };
    mdExtTotVal.fill      = { type:'pattern', pattern:'solid', fgColor:{argb:MD_YELLOW} };
    mdExtTotVal.alignment = { horizontal:'center', vertical:'middle' };
    mdExtTotVal.border    = { top:mdBM, left:mdBT, bottom:mdBM, right:mdBM };
    mdExtTotVal.numFmt    = '0.00';
    mr++;
    md5Sep(mr, 18); mr++;

    // =========================================================================
    // RESUMEN GENERAL DE RESULTADOS
    // =========================================================================
    ws5.getRow(mr).height = 25;
    for (let c = 2; c <= 6; c++) {
        gc5(mr, c).fill   = { type:'pattern', pattern:'solid', fgColor:{argb:MD_BLUE} };
        gc5(mr, c).border = { top:mdBM, bottom:mdBM,
            left: c===2?mdBM:mdBT, right: c===6?mdBM:mdBT };
    }
    ws5.mergeCells(mr, 2, mr, 6);
    const cellResumenTit     = gc5(mr, 2);
    cellResumenTit.value     = 'RESUMEN GENERAL DE RESULTADOS — Q MDS';
    cellResumenTit.font      = { bold:true, size:10, name:'Arial', color:{argb:'FFFFFFFF'} };
    cellResumenTit.alignment = { horizontal:'left', vertical:'middle', indent:1 };
    mr++;
    md5Sep(mr, 10); mr++;

    if (mdSelectedGrades.length > 0) {
        ws5.getRow(mr).height = 20;
        ws5.mergeCells(mr, 2, mr, 5);
        for (let c = 2; c <= 5; c++) {
            gc5(mr, c).value     = c===2 ? 'Nivel Educativo' : null;
            gc5(mr, c).font      = { bold:true, size:9, color:{argb:'FFFFFFFF'} };
            gc5(mr, c).fill      = { type:'pattern', pattern:'solid', fgColor:{argb:MD_HEADER} };
            gc5(mr, c).alignment = { horizontal:'center', vertical:'middle' };
            gc5(mr, c).border    = { top:mdBW, left:mdBW, bottom:mdBW, right:mdBW };
        }
        const cellHdrTot     = gc5(mr, 6);
        cellHdrTot.value     = 'Total U.D. Interior';
        cellHdrTot.font      = { bold:true, size:9, color:{argb:'FFFFFFFF'} };
        cellHdrTot.fill      = { type:'pattern', pattern:'solid', fgColor:{argb:MD_HEADER} };
        cellHdrTot.alignment = { horizontal:'center', vertical:'middle' };
        cellHdrTot.border    = { top:mdBW, left:mdBW, bottom:mdBW, right:mdBW };
        mr++;

        mdSelectedGrades.forEach((grade, idx) => {
            const bg = idx % 2 === 0 ? MD_BLANC : MD_LBLUE;
            ws5.getRow(mr).height = 18;
            ws5.mergeCells(mr, 2, mr, 5);
            const gc2     = gc5(mr, 2);
            gc2.value     = `NIVEL ${mdGradeNames[grade]}`;
            gc2.font      = { bold:true, size:9, name:'Arial', color:{argb:MD_NEGRO} };
            gc2.alignment = { horizontal:'left', vertical:'middle', indent:2 };
            for (let c = 2; c <= 5; c++) {
                gc5(mr, c).fill   = { type:'pattern', pattern:'solid', fgColor:{argb:bg} };
                gc5(mr, c).border = { top:mdBT, bottom:mdBT, left: c===2?mdBM:mdBT, right:mdBT };
            }
            const gv     = gc5(mr, 6);
            gv.value     = parseFloat((mdGradeTotals[grade]||0).toFixed(2));
            gv.font      = { bold:true, size:10, name:'Arial', color:{argb:MD_DGREEN} };
            gv.fill      = { type:'pattern', pattern:'solid', fgColor:{argb:MD_YELLOW} };
            gv.alignment = { horizontal:'center', vertical:'middle' };
            gv.border    = { top:mdBT, left:mdBT, bottom:mdBT, right:mdBM };
            gv.numFmt    = '0.00';
            mr++;
        });
        md5Sep(mr, 10); mr++;
    }

    // Sistema Interior
    ws5.getRow(mr).height = 24;
    for (let c = 2; c <= 11; c++) {
        gc5(mr, c).fill   = { type:'pattern', pattern:'solid', fgColor:{argb:'FFE8F5E9'} };
        gc5(mr, c).border = { top:mdBT, bottom:mdBT,
            left: c===2?mdBM:mdBT, right: c===11?mdBM:mdBT };
    }
    ws5.mergeCells(mr, 2, mr, 5);
    const mdIntLbl     = gc5(mr, 2);
    mdIntLbl.value     = 'SISTEMA INTERIOR';
    mdIntLbl.font      = { bold:true, size:10, name:'Arial', color:{argb:'FF1B5E20'} };
    mdIntLbl.alignment = { horizontal:'left', vertical:'middle', indent:2 };
    ws5.mergeCells(mr, 6, mr, 8);
    const mdIntUDLbl     = gc5(mr, 6);
    mdIntUDLbl.value     = `Suma U.D. Interior = ${mdOverallUD.toFixed(2)}`;
    mdIntUDLbl.font      = { bold:true, size:9, name:'Arial', color:{argb:MD_NEGRO} };
    mdIntUDLbl.fill      = { type:'pattern', pattern:'solid', fgColor:{argb:MD_LYELL} };
    mdIntUDLbl.alignment = { horizontal:'center', vertical:'middle' };
    mdIntUDLbl.border    = { top:mdBT, left:mdBT, bottom:mdBT, right:mdBT };
    ws5.mergeCells(mr, 9, mr, 11);
    const mdQIntVal     = gc5(mr, 9);
    mdQIntVal.value     = `Q MDS Interior = ${mdQmdsIntF.toFixed(2)} L/s`;
    mdQIntVal.font      = { bold:true, size:10, name:'Arial', color:{argb:MD_NEGRO} };
    mdQIntVal.fill      = { type:'pattern', pattern:'solid', fgColor:{argb:MD_YELLOW} };
    mdQIntVal.alignment = { horizontal:'center', vertical:'middle' };
    mdQIntVal.border    = { top:mdBT, left:mdBT, bottom:mdBT, right:mdBM };
    mr++;
    md5Sep(mr, 8); mr++;

    // Sistema Riego
    ws5.getRow(mr).height = 24;
    for (let c = 2; c <= 11; c++) {
        gc5(mr, c).fill   = { type:'pattern', pattern:'solid', fgColor:{argb:'FFE0F7FA'} };
        gc5(mr, c).border = { top:mdBT, bottom:mdBT,
            left: c===2?mdBM:mdBT, right: c===11?mdBM:mdBT };
    }
    ws5.mergeCells(mr, 2, mr, 5);
    const mdRiegoLbl     = gc5(mr, 2);
    mdRiegoLbl.value     = 'SISTEMA RIEGO (EXTERIORES)';
    mdRiegoLbl.font      = { bold:true, size:10, name:'Arial', color:{argb:'FF006064'} };
    mdRiegoLbl.alignment = { horizontal:'left', vertical:'middle', indent:2 };
    ws5.mergeCells(mr, 6, mr, 8);
    const mdRiegoUDLbl     = gc5(mr, 6);
    mdRiegoUDLbl.value     = `Suma U.D. Exterior = ${mdExtUD.toFixed(2)}`;
    mdRiegoUDLbl.font      = { bold:true, size:9, name:'Arial', color:{argb:MD_NEGRO} };
    mdRiegoUDLbl.fill      = { type:'pattern', pattern:'solid', fgColor:{argb:MD_LYELL} };
    mdRiegoUDLbl.alignment = { horizontal:'center', vertical:'middle' };
    mdRiegoUDLbl.border    = { top:mdBT, left:mdBT, bottom:mdBT, right:mdBT };
    ws5.mergeCells(mr, 9, mr, 11);
    const mdQRiegoVal     = gc5(mr, 9);
    mdQRiegoVal.value     = `Q MDS Riego = ${mdQmdsRiegoF.toFixed(2)} L/s`;
    mdQRiegoVal.font      = { bold:true, size:10, name:'Arial', color:{argb:MD_NEGRO} };
    mdQRiegoVal.fill      = { type:'pattern', pattern:'solid', fgColor:{argb:MD_YELLOW} };
    mdQRiegoVal.alignment = { horizontal:'center', vertical:'middle' };
    mdQRiegoVal.border    = { top:mdBT, left:mdBT, bottom:mdBT, right:mdBM };
    mr++;
    md5Sep(mr, 12); mr++;

    // Gran Total
    ws5.getRow(mr).height = 32;
    ws5.mergeCells(mr, 2, mr, 8);
    for (let c = 2; c <= 8; c++) {
        gc5(mr, c).fill   = { type:'pattern', pattern:'solid', fgColor:{argb:MD_BLUE} };
        gc5(mr, c).border = { top:mdBM, bottom:mdBM, left: c===2?mdBM:mdBT, right:mdBT };
    }
    const mdGrandLbl     = gc5(mr, 2);
    mdGrandLbl.value     = 'CAUDAL DE LA MÁXIMA DEMANDA SIMULTÁNEA TOTAL (Q MDS)';
    mdGrandLbl.font      = { bold:true, size:11, name:'Arial', color:{argb:'FFFFFFFF'} };
    mdGrandLbl.alignment = { horizontal:'right', vertical:'middle' };
    ws5.mergeCells(mr, 9, mr, 11);
    for (let c = 9; c <= 11; c++) {
        gc5(mr, c).fill   = { type:'pattern', pattern:'solid', fgColor:{argb:MD_YELLOW} };
        gc5(mr, c).border = { top:mdBM, bottom:mdBM, left:mdBT, right: c===11?mdBM:mdBT };
    }
    const mdGrandVal     = gc5(mr, 9);
    mdGrandVal.value     = `${mdQmdsTotalF.toFixed(2)} L/s`;
    mdGrandVal.font      = { bold:true, size:16, name:'Arial', color:{argb:MD_NEGRO} };
    mdGrandVal.alignment = { horizontal:'center', vertical:'middle' };
    mr++;
    md5Sep(mr, 16); mr++;

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