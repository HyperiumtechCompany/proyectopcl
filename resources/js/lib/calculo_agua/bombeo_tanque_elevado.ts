import ExcelJS from 'exceljs';

interface BombeoTanqueElevadoData {
    volumenTE?: number;
    tiempoLlenadobomb?: number;
    QMDS?: number;
    longitudTuberiaSuccion?: number;
    longitudTuberiaImpulsion?: number;
    nivelFondoTanque?: number;
    nivelAguaTanque?: number;
    nivelFondoCisterna?: number;
    presionSalida?: number;
    eficiencia?: number;
    potenciaManual?: number;
    accesoriosSuccion?: any[];
    accesoriosImpulsion?: any[];
    [key: string]: any;
}

export async function exportBombeoTanqueElevadoToExcel(
    data: BombeoTanqueElevadoData,
    fileName: string = 'Bombeo_Tanque_Elevado'
) {
    const workbook = new ExcelJS.Workbook();
    const ws6 = workbook.addWorksheet('6. Bombeo');

    const B6_BLANC  = 'FFFFFFFF';
    const B6_NEGRO  = 'FF000000';
    const B6_GRAY1  = 'FF4F4F4F'; 
    const B6_GRAY2  = 'FF6D6D6D'; 
    const B6_GRAY3  = 'FFD9D9D9';
    const B6_GRAY4  = 'FFF2F2F2'; 
    const B6_TABHDR = 'FF808080';
    const B6_YELLOW = 'FFFFC000'; 
    const B6_LYELL  = 'FFFFF2CC'; 
    const B6_ROWALL = 'FFF7F7F7'; 

    const b6BT = { style: 'thin'   as ExcelJS.BorderStyle, color: { argb: 'FFB0B0B0' } };
    const b6BM = { style: 'medium' as ExcelJS.BorderStyle, color: { argb: 'FF888888' } };
    const b6BW = { style: 'thin'   as ExcelJS.BorderStyle, color: { argb: 'FFFFFFFF' } };
    const b6BD = { style: 'dotted' as ExcelJS.BorderStyle, color: { argb: 'FFCCCCCC' } };

   
// ---------- Leer datos de bombeo ----------
    const b6D = data;
    const b6VolTE         = parseFloat(String(b6D.volumenTE || 13682));
    const b6TiempoLlenado = parseFloat(String(b6D.tiempoLlenadobomb || 2));
    const b6QMDS          = parseFloat(String(b6D.QMDS || 0));
    const b6LongSuc       = parseFloat(String(b6D.longitudTuberiaSuccion || 4.25));
    const b6LongImp       = parseFloat(String(b6D.longitudTuberiaImpulsion || 16.95));
    const b6NivFondoTanq  = parseFloat(String(b6D.nivelFondoTanque || 13.85));
    const b6NivAguaTanq   = parseFloat(String(b6D.nivelAguaTanque || 15.75));
    const b6NivFondoCist  = parseFloat(String(b6D.nivelFondoCisterna || -1.95));
    const b6PresionSalida = parseFloat(String(b6D.presionSalida || 2.00));
    const b6Eficiencia    = parseFloat(String(b6D.eficiencia || 0.6));
    
    const b6PotManual     = b6D.potenciaManual != null
        ? parseFloat(String(b6D.potenciaManual)) 
        : null;

    const b6AccSuc: any[] = Array.isArray(b6D.accesoriosSuccion) ? b6D.accesoriosSuccion : [
        { tipo: 'codo45',       cantidad: 0, leq: 0.477 },
        { tipo: 'codo90',       cantidad: 0, leq: 1.203 },
        { tipo: 'codo90',       cantidad: 1, leq: 2.577 },
        { tipo: 'valCompuerta', cantidad: 1, leq: 0.544 },
        { tipo: 'canastilla',   cantidad: 1, leq: 1.52  },
        { tipo: 'reduc2',       cantidad: 0, leq: 2.634 },
    ];
    const b6AccImp: any[] = Array.isArray(b6D.accesoriosImpulsion) ? b6D.accesoriosImpulsion : [
        { tipo: 'codo45',       cantidad: 0, leq: 0.954 },
        { tipo: 'codo90',       cantidad: 2, leq: 2.045 },
        { tipo: 'tee',          cantidad: 2, leq: 4.091 },
        { tipo: 'valCompuerta', cantidad: 2, leq: 0.432 },
        { tipo: 'valCheck',     cantidad: 0, leq: 5.682 },
        { tipo: 'reduc2',       cantidad: 0, leq: 2.091 },
    ];

    const b6AccLabels: Record<string, string> = {
        codo45:       'Codo de 45°',
        codo90:       'Codo 90°',
        tee:          'Tee',
        valCompuerta: 'Val. Compuerta',
        valCheck:     'Val. Chec.',
        canastilla:   'Canastilla',
        reduccion1:   'Reducción 1(D≠d)',
        reduc2:       'Reducción 2(D≠d)',
        reduccion2:   'Reducción 2(D≠d)',
    };

    const b6DiamSucTabla: Record<string, string> = {
        '0.00':'1 pulg','0.50':'1 1/4 pulg','1.00':'1 1/2 pulg',
        '1.60':'2 pulg','3.00':'2 1/2 pulg','5.00':'3 pulg',
        '8.00':'4 pulg','15.0':'6 pulg','25.0':'8 pulg',
    };
    const b6DiamImpTabla: Record<string, string> = {
        '0.00':'3/4 pulg','0.50':'1 pulg','1.00':'1 1/4 pulg',
        '1.60':'1 1/2 pulg','3.00':'2 pulg','5.00':'2 1/2 pulg',
        '8.00':'3 pulg','15.0':'4 pulg','25.0':'6 pulg',
    };
    const b6DiamMM: Record<string, number> = {
        '1/2 pulg':0.5,'3/4 pulg':0.75,'1 pulg':1,'1 1/4 pulg':1.25,
        '1 1/2 pulg':1.5,'2 pulg':2,'2 1/2 pulg':2.5,'3 pulg':3,
        '4 pulg':4,'6 pulg':6,'8 pulg':8,
    };

    function b6GetDiam(q: number, tabla: Record<string,string>): string {
        let best = ''; let minDif = Infinity;
        for (const k in tabla) {
            const d = Math.abs(parseFloat(k) - q);
            if (d < minDif) { minDif = d; best = k; }
        }
        return tabla[best] || Object.values(tabla)[0];
    }
    function b6Vel(q: number, diam: string): number {
        const mm = b6DiamMM[diam]; if (!mm) return 0;
        const dm = mm * 2.54 / 100;
        return parseFloat(((q/1000) / (Math.PI * dm * dm / 4)).toFixed(2));
    }
    function b6Pend(q: number, diam: string): number {
        const mm = b6DiamMM[diam]; if (!mm) return 0;
        const dm = mm * 2.54 / 100;
        const den = 0.2785 * 140 * Math.pow(dm, 2.63);
        if (den === 0) return 0;
        return parseFloat(Math.pow((q/1000) / den, 1.85).toFixed(4));
    }
    function b6CeilHalf(v: number): number { return Math.ceil(v * 2) / 2; }

    // Cálculos 
    const b6QLlen   = (b6TiempoLlenado > 0 && b6VolTE > 0)
        ? parseFloat((b6VolTE / (b6TiempoLlenado * 3600)).toFixed(2)) : 0;
    const b6Qimp    = parseFloat(Math.max(b6QLlen, b6QMDS).toFixed(2));

    const b6DiamSuc = b6GetDiam(b6Qimp, b6DiamSucTabla);
    const b6VelSuc  = b6Vel(b6Qimp, b6DiamSuc);
    const b6LeqSuc  = parseFloat(b6AccSuc.reduce((s,a) => s + a.cantidad * a.leq, 0).toFixed(3));
    const b6LTotSuc = parseFloat((b6LeqSuc + b6LongSuc).toFixed(2));
    const b6SSuc    = b6Pend(b6Qimp, b6DiamSuc);
    const b6HfSuc   = parseFloat((b6LTotSuc * b6SSuc).toFixed(2));

    const b6DiamImp = b6GetDiam(b6Qimp, b6DiamImpTabla);
    const b6VelImp  = b6Vel(b6Qimp, b6DiamImp);
    const b6LeqImp  = parseFloat(b6AccImp.reduce((s,a) => s + a.cantidad * a.leq, 0).toFixed(3));
    const b6LTotImp = parseFloat((b6LeqImp + b6LongImp).toFixed(2));
    const b6SImp    = b6Pend(b6Qimp, b6DiamImp);
    const b6HfImp   = parseFloat((b6LTotImp * b6SImp).toFixed(2));

    const b6HDT    = parseFloat(
        Math.max(b6HfImp + b6HfSuc + b6PresionSalida + (b6NivAguaTanq - b6NivFondoCist), 0).toFixed(2)
    );
    const b6HDTInt = Math.ceil(b6HDT);
    const b6Pot    = b6Eficiencia > 0 ? (b6Qimp * b6HDT) / (75 * b6Eficiencia) : 0;
    const b6PotRed = b6CeilHalf(b6Pot);
    const b6PotFin: number = (b6PotManual !== null && !isNaN(b6PotManual as number))
        ? (b6PotManual as number) : b6PotRed;

    ws6.columns = [
        { width: 2  },  
        { width: 12 }, 
        { width: 16 }, 
        { width: 10 },  
        { width: 24 }, 
        { width: 9  },  
        { width: 10 },  
        { width: 10 }, 
        { width: 12 }, 
        { width: 12 }, 
        { width: 12 }, 
        { width: 12 },  
    ];

    const _C1 = 2;
    const _CN = 12;

    const _gc = (r: number, c: number) => ws6.getCell(r, c);

    function _fill(r: number, bg: string, h = 18) {
        ws6.getRow(r).height = h;
        _gc(r, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_BLANC } };
        for (let c = _C1; c <= _CN; c++)
            _gc(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    }

    function _sep(r: number, h = 10) {
        ws6.getRow(r).height = h;
        for (let c = 1; c <= _CN; c++)
            _gc(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_BLANC } };
    }

    // Barra de título 
    function _titleBar(r: number, text: string) {
        _fill(r, B6_GRAY1, 26);
        ws6.mergeCells(r, _C1, r, _CN);
        const cell = _gc(r, _C1);
        cell.value = text;
        cell.font  = { bold: true, size: 11, name: 'Arial', color: { argb: 'FFFFFFFF' } };
        cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_GRAY1 } };
        cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        cell.border = { top: b6BM, left: b6BM, bottom: b6BM, right: b6BM };
    }

    // Barra de sub-sección 
    function _secBar(r: number, text: string) {
        _fill(r, B6_GRAY2, 22);
        ws6.mergeCells(r, _C1, r, _CN);
        const cell = _gc(r, _C1);
        cell.value = text;
        cell.font  = { bold: true, size: 10, name: 'Arial', color: { argb: 'FFFFFFFF' } };
        cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_GRAY2 } };
        cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        cell.border = { top: b6BT, left: b6BM, bottom: b6BT, right: b6BM };
    }

    function _paramRow(r: number, label: string, val: string,
        bgRow = B6_BLANC, bgVal = B6_BLANC, bold = false, h = 20) {
        _fill(r, bgRow, h);
        ws6.mergeCells(r, _C1, r, 8);
        const lc = _gc(r, _C1);
        lc.value = label;
        lc.font  = { bold, size: 10, name: 'Arial', color: { argb: B6_GRAY1 } };
        lc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgRow } };
        lc.alignment = { horizontal: 'left', vertical: 'middle', indent: 3 };
        lc.border = { top: b6BT, left: b6BM, bottom: b6BT, right: b6BD };
        for (let c = _C1 + 1; c <= 8; c++) {
            _gc(r, c).fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgRow } };
            _gc(r, c).border = { top: b6BT, bottom: b6BT };
        }
        ws6.mergeCells(r, 9, r, _CN);
        const vc = _gc(r, 9);
        vc.value = val;
        vc.font  = { bold, size: 10, name: 'Arial', color: { argb: B6_NEGRO } };
        vc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgVal } };
        vc.alignment = { horizontal: 'right', vertical: 'middle', indent: 2 };
        vc.border = { top: b6BT, left: b6BD, bottom: b6BT, right: b6BM };
        for (let c = 10; c <= _CN; c++) {
            _gc(r, c).fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgVal } };
            _gc(r, c).border = { top: b6BT, bottom: b6BT,
                right: c === _CN ? b6BM : b6BT };
        }
    }

    // Tabla de pérdida de carga 
    function _buildAccTable(
        startRow: number, accesorios: any[],
        qImpul: number, diam: string, vel: number,
        lTub: number, lTot: number, leqTot: number,
        S: number, hf: number,
    ): number {
        let r = startRow;
        const N = accesorios.length;

        ws6.getRow(r).height = 22;
        _fill(r, B6_TABHDR, 22);

        const h1: { label: string; c: number; span: number; rs: boolean }[] = [
            { label: 'Q\n(L/s)',       c: 2,  span: 1, rs: true  },
            { label: 'diámetro',       c: 3,  span: 1, rs: true  },
            { label: 'V\n(m/s)',       c: 4,  span: 1, rs: true  },
            { label: 'L accesorios',   c: 5,  span: 4, rs: false },
            { label: 'L tubería\n(m)', c: 9,  span: 1, rs: true  },
            { label: 'L total\n(m)',   c: 10, span: 1, rs: true  },
            { label: 'S\n(m/m)',       c: 11, span: 1, rs: true  },
            { label: 'hf\n(m)',        c: 12, span: 1, rs: true  },
        ];
        h1.forEach(h => {
            if (h.rs) ws6.mergeCells(r, h.c, r + 1, h.c);
            else      ws6.mergeCells(r, h.c, r, h.c + h.span - 1);
            const cell = _gc(r, h.c);
            cell.value = h.label;
            cell.font  = { bold: true, size: 9, name: 'Arial', color: { argb: 'FFFFFFFF' } };
            cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_TABHDR } };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.border = { top: b6BW, left: b6BW, bottom: b6BW, right: b6BW };
            for (let ci = h.c + 1; ci < h.c + h.span; ci++)
                _gc(r, ci).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_TABHDR } };
        });
        r++;

        ws6.getRow(r).height = 18;
        _fill(r, B6_TABHDR, 18);
        ['accesorios', '#', 'Leq', 'Leq. T'].forEach((h, i) => {
            const cell = _gc(r, 5 + i);
            cell.value = h;
            cell.font  = { bold: true, size: 9, name: 'Arial', color: { argb: 'FFFFFFFF' } };
            cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_TABHDR } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = { top: b6BW, left: b6BW, bottom: b6BW, right: b6BW };
        });
        [2, 3, 4, 9, 10, 11, 12].forEach(c =>
            _gc(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_TABHDR } });
        r++;

        // Filas de accesorios
        accesorios.forEach((acc: any, idx: number) => {
            const bg   = idx % 2 === 0 ? B6_BLANC : B6_ROWALL;
            const leqT = parseFloat((acc.cantidad * acc.leq).toFixed(3));
            const lbl  = b6AccLabels[acc.tipo] || acc.tipo || '-';
            ws6.getRow(r).height = 20;
            _fill(r, bg, 20);

            if (idx === 0) {
                ws6.mergeCells(r, 2, r + N - 1, 2);
                const c2 = _gc(r, 2);
                c2.value = parseFloat(qImpul.toFixed(2));
                c2.numFmt = '0.00 "L/s"';
                c2.font  = { bold: true, size: 10, name: 'Arial', color: { argb: B6_NEGRO } };
                c2.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_BLANC } };
                c2.alignment = { horizontal: 'center', vertical: 'middle' };
                c2.border = { top: b6BT, left: b6BM, bottom: b6BT, right: b6BT };
            }

            if (idx === 0) {
                ws6.mergeCells(r, 3, r + N - 1, 3);
                const c3 = _gc(r, 3);
                c3.value = diam;
                c3.font  = { size: 10, name: 'Arial', color: { argb: B6_NEGRO } };
                c3.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_BLANC } };
                c3.alignment = { horizontal: 'center', vertical: 'middle' };
                c3.border = { top: b6BT, left: b6BT, bottom: b6BT, right: b6BT };
            }

            if (idx === 0) {
                ws6.mergeCells(r, 4, r + N - 1, 4);
                const c4 = _gc(r, 4);
                c4.value = vel;
                c4.numFmt = '0.00';
                c4.font  = { size: 10, name: 'Arial', color: { argb: B6_NEGRO } };
                c4.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_BLANC } };
                c4.alignment = { horizontal: 'center', vertical: 'middle' };
                c4.border = { top: b6BT, left: b6BT, bottom: b6BT, right: b6BT };
            }
            // Accesorio nombre
            const c5 = _gc(r, 5);
            c5.value = lbl;
            c5.font  = { size: 10, name: 'Arial', color: { argb: B6_NEGRO } };
            c5.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
            c5.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
            c5.border = { top: b6BT, left: b6BT, bottom: b6BT, right: b6BT };
            // Cantidad
            const c6 = _gc(r, 6);
            c6.value = acc.cantidad > 0 ? acc.cantidad : null;
            c6.numFmt = '0';
            c6.font  = { bold: acc.cantidad > 0, size: 10, name: 'Arial', color: { argb: B6_NEGRO } };
            c6.fill  = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: acc.cantidad > 0 ? B6_YELLOW : bg } };
            c6.alignment = { horizontal: 'center', vertical: 'middle' };
            c6.border = { top: b6BT, left: b6BT, bottom: b6BT, right: b6BT };

            const c7 = _gc(r, 7);
            c7.value = parseFloat(acc.leq.toFixed(3));
            c7.numFmt = '0.000';
            c7.font  = { size: 10, name: 'Arial', color: { argb: B6_NEGRO } };
            c7.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
            c7.alignment = { horizontal: 'center', vertical: 'middle' };
            c7.border = { top: b6BT, left: b6BT, bottom: b6BT, right: b6BT };

            const c8 = _gc(r, 8);
            c8.value = leqT > 0 ? leqT : null;
            c8.numFmt = '0.000';
            c8.font  = { bold: leqT > 0, size: 10, name: 'Arial', color: { argb: B6_NEGRO } };
            c8.fill  = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: leqT > 0 ? B6_LYELL : bg } };
            c8.alignment = { horizontal: 'center', vertical: 'middle' };
            c8.border = { top: b6BT, left: b6BT, bottom: b6BT, right: b6BT };

            if (idx === 0) {
                ws6.mergeCells(r, 9, r + N - 1, 9);
                const c9 = _gc(r, 9);
                c9.value = lTub;
                c9.numFmt = '0.00 "m"';
                c9.font  = { bold: true, size: 10, name: 'Arial', color: { argb: B6_NEGRO } };
                c9.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_YELLOW } };
                c9.alignment = { horizontal: 'center', vertical: 'middle' };
                c9.border = { top: b6BT, left: b6BT, bottom: b6BT, right: b6BT };
            }

            if (idx === 0) {
                ws6.mergeCells(r, 10, r + N - 1, 10);
                const c10 = _gc(r, 10);
                c10.value = lTot;
                c10.numFmt = '0.00 "m"';
                c10.font  = { bold: true, size: 10, name: 'Arial', color: { argb: B6_NEGRO } };
                c10.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_GRAY3 } };
                c10.alignment = { horizontal: 'center', vertical: 'middle' };
                c10.border = { top: b6BT, left: b6BT, bottom: b6BT, right: b6BT };
            }

            if (idx === 0) {
                ws6.mergeCells(r, 11, r + N - 1, 11);
                const c11 = _gc(r, 11);
                c11.value = S;
                c11.numFmt = '0.0000';
                c11.font  = { size: 9, name: 'Arial', color: { argb: B6_GRAY2 } };
                c11.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_BLANC } };
                c11.alignment = { horizontal: 'center', vertical: 'middle' };
                c11.border = { top: b6BT, left: b6BT, bottom: b6BT, right: b6BT };
            }

            if (idx === 0) {
                ws6.mergeCells(r, 12, r + N - 1, 12);
                const c12 = _gc(r, 12);
                c12.value = hf;
                c12.numFmt = '0.0000';
                c12.font  = { bold: true, size: 10, name: 'Arial', color: { argb: B6_NEGRO } };
                c12.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_BLANC } };
                c12.alignment = { horizontal: 'center', vertical: 'middle' };
                c12.border = { top: b6BT, left: b6BT, bottom: b6BT, right: b6BM };
            }
            r++;
        });

        // LONGITUD TOTAL EQUIVALENTES
        ws6.getRow(r).height = 20;
        _fill(r, B6_GRAY3, 20);
        ws6.mergeCells(r, _C1, r, 8);
        const leqL = _gc(r, _C1);
        leqL.value = 'LONGITUD TOTAL EQUIVALENTES';
        leqL.font  = { bold: true, size: 10, name: 'Arial', color: { argb: B6_NEGRO } };
        leqL.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_GRAY3 } };
        leqL.alignment = { horizontal: 'right', vertical: 'middle' };
        leqL.border = { top: b6BT, left: b6BM, bottom: b6BM, right: b6BT };
        for (let c = _C1 + 1; c <= 8; c++) {
            _gc(r, c).fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_GRAY3 } };
            _gc(r, c).border = { top: b6BT, bottom: b6BM };
        }
        const leqV = _gc(r, 9);
        leqV.value = parseFloat(leqTot.toFixed(2));
        leqV.numFmt = '0.00 "m"';
        leqV.font  = { bold: true, size: 11, name: 'Arial', color: { argb: B6_NEGRO } };
        leqV.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_YELLOW } };
        leqV.alignment = { horizontal: 'center', vertical: 'middle' };
        leqV.border = { top: b6BT, left: b6BM, bottom: b6BM, right: b6BT };
        for (let c = 10; c <= _CN; c++) {
            _gc(r, c).fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_GRAY3 } };
            _gc(r, c).border = { top: b6BT, bottom: b6BM,
                right: c === _CN ? b6BM : b6BT };
        }
        r++;
        return r;
    }

    let br = 1;

    // Título principal
    _titleBar(br, '6. CALCULO DEL SISTEMA DE BOMBEO AL TANQUE ELEVADO'); br++;
    _sep(br, 10); br++;

    // 6.1 CAUDAL DE IMPULSIÓN
    _secBar(br, '6.1. CAUDAL DE IMPULSION'); br++;

    _fill(br, B6_GRAY4, 34);
    ws6.mergeCells(br, _C1, br, _CN);
    const notaImp = _gc(br, _C1);
    notaImp.value =
        'En el inciso d) del ITEM 2.5. ELEVACION, el caudal de bombeo debe ser equivalente a la máxima ' +
        'demanda simultánea y en ningún caso inferior a la necesaria para llenar el tanque elevado en dos horas.';
    notaImp.font  = { italic: true, size: 9, name: 'Arial', color: { argb: B6_GRAY2 } };
    notaImp.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_GRAY4 } };
    notaImp.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true, indent: 2 };
    notaImp.border = { top: b6BT, left: b6BM, bottom: b6BT, right: b6BM };
    br++;
    _sep(br, 10); br++;

    _paramRow(br, 'Volumen del Tanque Elevado  =',  `${b6VolTE.toFixed(2)} L`,   B6_BLANC, B6_BLANC); br++;
    _paramRow(br, 'Tiempo de llenado del Tanque Elevado  =', `${b6TiempoLlenado} hrs`,
        B6_BLANC, B6_YELLOW, true); br++;
    _sep(br, 8); br++;
    _paramRow(br, 'Q llenado  =',  `${b6QLlen.toFixed(2)} L/s`, B6_BLANC, B6_BLANC); br++;
    _paramRow(br, 'Q MDS  =',      `${b6QMDS.toFixed(2)} L/s`,  B6_BLANC, B6_BLANC); br++;
    _sep(br, 6); br++;

    _fill(br, B6_YELLOW, 26);
    ws6.mergeCells(br, _C1, br, 8);
    const qImpLbl = _gc(br, _C1);
    qImpLbl.value = 'Q impul  =';
    qImpLbl.font  = { bold: true, size: 11, name: 'Arial', color: { argb: B6_NEGRO } };
    qImpLbl.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_YELLOW } };
    qImpLbl.alignment = { horizontal: 'right', vertical: 'middle' };
    qImpLbl.border = { top: b6BM, left: b6BM, bottom: b6BM, right: b6BT };
    for (let c = _C1 + 1; c <= 8; c++) {
        _gc(br, c).fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_YELLOW } };
        _gc(br, c).border = { top: b6BM, bottom: b6BM };
    }
    ws6.mergeCells(br, 9, br, _CN);
    const qImpVal = _gc(br, 9);
    qImpVal.value = `${b6Qimp.toFixed(2)} L/s`;
    qImpVal.font  = { bold: true, size: 13, name: 'Arial', color: { argb: B6_NEGRO } };
    qImpVal.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_YELLOW } };
    qImpVal.alignment = { horizontal: 'center', vertical: 'middle' };
    qImpVal.border = { top: b6BM, left: b6BT, bottom: b6BM, right: b6BM };
    for (let c = 10; c <= _CN; c++) {
        _gc(br, c).fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_YELLOW } };
        _gc(br, c).border = { top: b6BM, bottom: b6BM, right: c === _CN ? b6BM : b6BT };
    }
    br++;
    _sep(br, 14); br++;

    // 6.2 PÉRDIDA DE CARGA
    _secBar(br, '6.2. PERDIDA DE CARGA'); br++;
    _sep(br, 8); br++;

    // Diámetro tubería Succión
    _fill(br, B6_GRAY4, 20);
    ws6.mergeCells(br, _C1, br, 6);
    const dSucLbl = _gc(br, _C1);
    dSucLbl.value = 'Diametro tub. Succión';
    dSucLbl.font  = { size: 10, name: 'Arial', color: { argb: B6_GRAY1 } };
    dSucLbl.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_GRAY4 } };
    dSucLbl.alignment = { horizontal: 'left', vertical: 'middle', indent: 2 };
    dSucLbl.border = { top: b6BT, left: b6BM, bottom: b6BT, right: b6BD };
    for (let c = _C1 + 1; c <= 6; c++) {
        _gc(br, c).fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_GRAY4 } };
        _gc(br, c).border = { top: b6BT, bottom: b6BT };
    }
    _gc(br, 7).value = 'Ø =';
    _gc(br, 7).font  = { bold: true, size: 10, name: 'Arial', color: { argb: B6_GRAY1 } };
    _gc(br, 7).fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_GRAY4 } };
    _gc(br, 7).alignment = { horizontal: 'right', vertical: 'middle' };
    _gc(br, 7).border = { top: b6BT, bottom: b6BT };
    ws6.mergeCells(br, 8, br, _CN);
    const dSucVal = _gc(br, 8);
    dSucVal.value = b6DiamSuc;
    dSucVal.font  = { bold: true, size: 10, name: 'Arial', color: { argb: B6_NEGRO } };
    dSucVal.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_GRAY4 } };
    dSucVal.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    dSucVal.border = { top: b6BT, left: b6BD, bottom: b6BT, right: b6BM };
    br++;
    _sep(br, 4); br++;

    br = _buildAccTable(br, b6AccSuc,
        b6Qimp, b6DiamSuc, b6VelSuc,
        b6LongSuc, b6LTotSuc, b6LeqSuc, b6SSuc, b6HfSuc);
    _sep(br, 12); br++;

    // Diámetro tubería Impulsión
    _fill(br, B6_GRAY4, 20);
    ws6.mergeCells(br, _C1, br, 6);
    const dImpLbl = _gc(br, _C1);
    dImpLbl.value = 'Diametro tub. Impulsión';
    dImpLbl.font  = { size: 10, name: 'Arial', color: { argb: B6_GRAY1 } };
    dImpLbl.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_GRAY4 } };
    dImpLbl.alignment = { horizontal: 'left', vertical: 'middle', indent: 2 };
    dImpLbl.border = { top: b6BT, left: b6BM, bottom: b6BT, right: b6BD };
    for (let c = _C1 + 1; c <= 6; c++) {
        _gc(br, c).fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_GRAY4 } };
        _gc(br, c).border = { top: b6BT, bottom: b6BT };
    }
    _gc(br, 7).value = 'Ø =';
    _gc(br, 7).font  = { bold: true, size: 10, name: 'Arial', color: { argb: B6_GRAY1 } };
    _gc(br, 7).fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_GRAY4 } };
    _gc(br, 7).alignment = { horizontal: 'right', vertical: 'middle' };
    _gc(br, 7).border = { top: b6BT, bottom: b6BT };
    ws6.mergeCells(br, 8, br, _CN);
    const dImpVal = _gc(br, 8);
    dImpVal.value = b6DiamImp;
    dImpVal.font  = { bold: true, size: 10, name: 'Arial', color: { argb: B6_NEGRO } };
    dImpVal.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_GRAY4 } };
    dImpVal.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    dImpVal.border = { top: b6BT, left: b6BD, bottom: b6BT, right: b6BM };
    br++;
    _sep(br, 4); br++;

    br = _buildAccTable(br, b6AccImp,
        b6Qimp, b6DiamImp, b6VelImp,
        b6LongImp, b6LTotImp, b6LeqImp, b6SImp, b6HfImp);
    _sep(br, 16); br++;

    // 6.3 ALTURA DINÁMICA TOTAL — HDT
    _secBar(br, '6.3. ALTURA DINAMICA TOTAL - HDT'); br++;
    _sep(br, 8); br++;

    [
        { label: 'Nivel de Fondo del Tanque Elevado  =',  val: `+${b6NivFondoTanq.toFixed(2)} m` },
        { label: 'Nivel de Agua del Tanque Elevado  =',   val: `+${b6NivAguaTanq.toFixed(2)} m`  },
        { label: 'Nivel de Fondo de Cisterna  =',          val: `${b6NivFondoCist.toFixed(2)} m`  },
        { label: 'Presion de Salida  =',                   val: `${b6PresionSalida.toFixed(2)} m` },
        { label: 'Perdida de carga Tub. Succion  =',       val: `${b6HfSuc.toFixed(2)} m`         },
        { label: 'Perdida de carga Tub. Impulsion  =',     val: `${b6HfImp.toFixed(2)} m`         },
    ].forEach((p, i) => {
        _paramRow(br, p.label, p.val, i % 2 === 0 ? B6_BLANC : B6_ROWALL);
        br++;
    });
    _sep(br, 10); br++;

    _fill(br, B6_YELLOW, 28);
    ws6.mergeCells(br, _C1, br, _CN);
    const hdtCell = _gc(br, _C1);
    hdtCell.value = `HDT  =  ${b6HDTInt.toFixed(2)}`;
    hdtCell.font  = { bold: true, size: 14, name: 'Arial', color: { argb: B6_NEGRO } };
    hdtCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_YELLOW } };
    hdtCell.alignment = { horizontal: 'center', vertical: 'middle' };
    hdtCell.border = { top: b6BM, left: b6BM, bottom: b6BM, right: b6BM };
    br++;
    _sep(br, 16); br++;

    // 6.4 CÁLCULO DEL SISTEMA DE BOMBEO
    _secBar(br, '6.4. CALCULO DEL SISTEMA DE BOMBEO'); br++;
    _sep(br, 8); br++;

    _paramRow(br, 'Caudal de Impulsion  =',  `${b6Qimp.toFixed(2)} L/s`,  B6_BLANC, B6_YELLOW, true); br++;
    _paramRow(br, 'Altura Dinamica Total  =', `${b6HDTInt.toFixed(2)} m`,  B6_BLANC, B6_YELLOW, true); br++;
    _paramRow(br, 'Eficiencia  =',            `${(b6Eficiencia*100).toFixed(0)} %`,
        B6_BLANC, B6_YELLOW, true); br++;
    _sep(br, 10); br++;

    // Fórmula potencia 
    _fill(br, B6_GRAY4, 20);
    ws6.mergeCells(br, _C1, br, _CN);
    const fn1 = _gc(br, _C1);
    fn1.value = `POTENCIA  :        ${b6Qimp.toFixed(2)} L/s  ×  ${b6HDTInt.toFixed(2)} m`;
    fn1.font  = { italic: true, size: 10, name: 'Arial', color: { argb: B6_GRAY2 } };
    fn1.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_GRAY4 } };
    fn1.alignment = { horizontal: 'center', vertical: 'middle' };
    fn1.border = { top: b6BT, left: b6BM, bottom: b6BD, right: b6BM };
    br++;

    _fill(br, B6_GRAY4, 20);
    ws6.mergeCells(br, _C1, br, _CN);
    const fn2 = _gc(br, _C1);
    fn2.value = `75  ×  ${b6Eficiencia}`;
    fn2.font  = { italic: true, size: 10, name: 'Arial', color: { argb: B6_GRAY2 } };
    fn2.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_GRAY4 } };
    fn2.alignment = { horizontal: 'center', vertical: 'middle' };
    fn2.border = { top: b6BD, left: b6BM, bottom: b6BT, right: b6BM };
    br++;
    _sep(br, 8); br++;

    // POTENCIA 
    _fill(br, B6_YELLOW, 28);
    ws6.mergeCells(br, _C1, br, 7);
    const potLbl = _gc(br, _C1);
    potLbl.value = `POTENCIA (POT)  =  ${b6Pot.toFixed(2)}   →`;
    potLbl.font  = { bold: true, size: 11, name: 'Arial', color: { argb: B6_NEGRO } };
    potLbl.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_YELLOW } };
    potLbl.alignment = { horizontal: 'right', vertical: 'middle' };
    potLbl.border = { top: b6BM, left: b6BM, bottom: b6BM, right: b6BT };
    for (let c = _C1 + 1; c <= 7; c++) {
        _gc(br, c).fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_YELLOW } };
        _gc(br, c).border = { top: b6BM, bottom: b6BM };
    }
    ws6.mergeCells(br, 8, br, _CN);
    const potVal = _gc(br, 8);
    potVal.value = `${b6PotFin}  HP`;
    potVal.font  = { bold: true, size: 14, name: 'Arial', color: { argb: B6_NEGRO } };
    potVal.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_YELLOW } };
    potVal.alignment = { horizontal: 'center', vertical: 'middle' };
    potVal.border = { top: b6BM, left: b6BT, bottom: b6BM, right: b6BM };
    for (let c = 9; c <= _CN; c++) {
        _gc(br, c).fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_YELLOW } };
        _gc(br, c).border = { top: b6BM, bottom: b6BM, right: c === _CN ? b6BM : b6BT };
    }
    br++;
    _sep(br, 12); br++;

    // Nota final
    _fill(br, B6_GRAY4, 40);
    ws6.getRow(br).height = 40;
    ws6.mergeCells(br, _C1, br, _CN);
    const notaFin = _gc(br, _C1);
    notaFin.value =
        `De acuerdo a la existencia en el mercado con los diámetros más similares a la de succión ` +
        `(${b6DiamSuc}) e impulsión (${b6DiamImp}) requeridos, se asume la potencia de la bomba es de  ${b6PotFin} HP.`;
    notaFin.font  = { size: 10, name: 'Arial', color: { argb: B6_GRAY1 } };
    notaFin.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_GRAY4 } };
    notaFin.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true, indent: 2 };
    notaFin.border = {
        top:    b6BT,
        left:   { style: 'medium', color: { argb: 'FF888888' } },
        bottom: b6BT,
        right:  b6BM,
    };
    br++;
    _sep(br, 14); br++;

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