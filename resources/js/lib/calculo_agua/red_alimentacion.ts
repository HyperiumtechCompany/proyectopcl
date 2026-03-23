import ExcelJS from 'exceljs';

interface RedAlimentacionData {
    volCisterna?: number;
    tiempoLlenado?: number;
    consumoDiario?: number;
    nivelTerreno?: number;
    presionConn?: number;
    presionSalida?: number;
    nivIngCist?: number;
    diamConn?: string;
    micro?: string;
    lTuberia?: number;
    hfMed?: number;
    accs?: any[];
    diaSel?: string;
    diaLTub?: number;
    diaAccs?: any[];
    [key: string]: any;
}

export async function exportRedAlimentacionToExcel(
    data: RedAlimentacionData,
    fileName: string = 'Red_Alimentacion'
) {
    const workbook = new ExcelJS.Workbook();
    const ws4 = workbook.addWorksheet('4. Red Alimentación');

    const RA = 13;
    ws4.columns = [
        { width: 3  }, // 1  
        { width: 30 }, // 2  
        { width: 12 },
        { width: 8  },
        { width: 12 },
        { width: 10 }, 
        { width: 10 }, 
        { width: 13 }, 
        { width: 10 }, 
        { width: 12 }, 
        { width: 14 }, 
        { width: 8  }, 
        { width: 5  }, 
    ];

    const RA_BLANC  = 'FFFFFFFF';
    const RA_NEGRO  = 'FF000000';
    const RA_TITLE  = 'FF4F4F4F'; 
    const RA_HEADER = 'FF6D6D6D'; 
    const RA_YELLOW = 'FFFFC000'; 
    const RA_LYELL  = 'FFFFF2CC'; 
    const RA_LGRAY  = 'FFD9D9D9'; 
    const RA_BLUE   = 'FF1F4E78'; 
    const RA_BLUE2  = 'FF2E75B6';
    const RA_LBLUE  = 'FFD6E4F0';
    const RA_GREEN  = 'FFF0F7EE'; 

    const raBT = { style: 'thin'   as ExcelJS.BorderStyle, color: { argb: 'FFA0A0A0' } };
    const raBM = { style: 'medium' as ExcelJS.BorderStyle, color: { argb: 'FF666666' } };

    function raFill(r: number, bg: string, h = 17) {
        ws4.getRow(r).height = h;
        ws4.getCell(r, 1).fill = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: RA_BLANC } };
        for (let c = 2; c <= RA; c++)
            ws4.getCell(r, c).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: bg } };
    }

    function raCell(r: number, c: number, val: any, opts: {
        bold?: boolean; size?: number; bg?: string; color?: string;
        halign?: ExcelJS.Alignment['horizontal']; numFmt?: string;
        border?: boolean; wrap?: boolean; italic?: boolean;
    } = {}) {
        const cell = ws4.getCell(r, c);
        cell.value = val ?? null;
        cell.font  = { bold: opts.bold ?? false, size: opts.size ?? 9,
                       name: 'Arial', italic: opts.italic ?? false,
                       color: { argb: opts.color ?? RA_NEGRO } };
        if (opts.bg) cell.fill = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: opts.bg } };
        cell.alignment = { horizontal: opts.halign ?? 'left', vertical: 'middle',
                           wrapText: opts.wrap ?? false };
        if (opts.border)
            cell.border = { top: raBT, left: raBT, bottom: raBT, right: raBT };
        if (opts.numFmt) cell.numFmt = opts.numFmt;
    }

    function raSep(r: number, h = 6) {
        ws4.getRow(r).height = h;
        for (let c = 1; c <= RA; c++)
            ws4.getCell(r, c).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: RA_BLANC } };
    }

    // Barra título principal 
    function raTitleBar(r: number, text: string) {
        raFill(r, RA_TITLE, 26);
        ws4.mergeCells(r, 2, r, RA);
        const cell = ws4.getCell(r, 2);
        cell.value = text;
        cell.font  = { bold: true, size: 11, name: 'Arial',
                       color: { argb: 'FFFFFFFF' } };
        cell.fill  = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: RA_TITLE } };
        cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        cell.border = { top: raBM, left: raBM, bottom: raBM, right: raBM };
    }

    // Barra sub-sección 
    function raSubBar(r: number, text: string) {
        raFill(r, RA_HEADER, 24);
        ws4.mergeCells(r, 2, r, RA);
        const cell = ws4.getCell(r, 2);
        cell.value = text;
        cell.font  = { bold: true, size: 10, name: 'Arial',
                       color: { argb: 'FFFFFFFF' } };
        cell.fill  = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: RA_HEADER } };
        cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        cell.border = { top: raBT, left: raBM, bottom: raBT, right: raBM };
    }

    function raLV(r: number, label: string, val: any, unit: string, opts: {
        valBg?: string; labelBg?: string; bold?: boolean;
        numFmt?: string; h?: number;
    } = {}) {
        ws4.getRow(r).height = opts.h ?? 20;
        ws4.getCell(r, 1).fill = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: RA_BLANC } };
        const lb = opts.labelBg ?? RA_BLANC;
        const vb = opts.valBg   ?? RA_YELLOW;
        
        const lc = ws4.getCell(r, 2);
        lc.value = label;
        lc.font  = { size: 9, name: 'Arial', color: { argb: RA_NEGRO } };
        lc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: lb } };
        lc.alignment = { horizontal: 'right', vertical: 'middle' };
        lc.border = { top: raBT, left: raBT, bottom: raBT, right: raBT };
        // valor
        const vc = ws4.getCell(r, 3);
        vc.value = val;
        vc.font  = { bold: opts.bold ?? true, size: 9, name: 'Arial',
                     color: { argb: RA_NEGRO } };
        vc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: vb } };
        vc.alignment = { horizontal: 'center', vertical: 'middle' };
        vc.border = { top: raBT, left: raBT, bottom: raBT, right: raBT };
        if (opts.numFmt) vc.numFmt = opts.numFmt;
        // unidad
        const uc = ws4.getCell(r, 4);
        uc.value = unit;
        uc.font  = { size: 9, name: 'Arial', color: { argb: RA_NEGRO } };
        uc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: lb } };
        uc.alignment = { horizontal: 'left', vertical: 'middle' };
        uc.border = { top: raBT, left: raBT, bottom: raBT, right: raBT };
        
        for (let c = 5; c <= RA; c++) {
            ws4.getCell(r, c).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: RA_BLANC } };
        }
    }

    // Fila dos pares label-valor lado a lado
    function raLV2(r: number,
        l1: string, v1: any, u1: string,
        l2: string, v2: any, u2: string,
        opts: { vb1?: string; vb2?: string; h?: number; nf1?: string; nf2?: string } = {}
    ) {
        ws4.getRow(r).height = opts.h ?? 20;
        ws4.getCell(r, 1).fill = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: RA_BLANC } };
        
        const cells1 = [
            { c: 2, val: l1,  bg: RA_BLANC, halign: 'right' as const, bold: false },
            { c: 3, val: v1,  bg: opts.vb1 ?? RA_YELLOW, halign: 'center' as const, bold: true },
            { c: 4, val: u1,  bg: RA_BLANC, halign: 'left' as const, bold: false },
        ];
        cells1.forEach(({ c, val, bg, halign, bold }) => {
            const cell = ws4.getCell(r, c);
            cell.value = val;
            cell.font  = { bold, size: 9, name: 'Arial', color: { argb: RA_NEGRO } };
            cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
            cell.alignment = { horizontal: halign, vertical: 'middle' };
            cell.border = { top: raBT, left: raBT, bottom: raBT, right: raBT };
            if (c === 3 && opts.nf1) cell.numFmt = opts.nf1;
        });
       
        ws4.getCell(r, 5).fill = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: RA_BLANC } };
        
        if (l2) {
            const cells2 = [
                { c: 6,  val: l2,  bg: RA_BLANC, halign: 'right' as const, bold: false },
                { c: 7,  val: v2,  bg: opts.vb2 ?? RA_YELLOW, halign: 'center' as const, bold: true },
                { c: 8,  val: u2,  bg: RA_BLANC, halign: 'left' as const, bold: false },
            ];
            cells2.forEach(({ c, val, bg, halign, bold }) => {
                const cell = ws4.getCell(r, c);
                cell.value = val;
                cell.font  = { bold, size: 9, name: 'Arial', color: { argb: RA_NEGRO } };
                cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
                cell.alignment = { horizontal: halign, vertical: 'middle' };
                cell.border = { top: raBT, left: raBT, bottom: raBT, right: raBT };
                if (c === 7 && opts.nf2) cell.numFmt = opts.nf2;
            });
        }
        for (let c = (l2 ? 9 : 5); c <= RA; c++) {
            ws4.getCell(r, c).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: RA_BLANC } };
        }
    }

    // Resultado resaltado (fila tipo "Carga Disponible = X m")
    function raResult(r: number, label: string, val: any, unit: string,
                      bg = RA_LYELL) {
        raFill(r, bg, 20);
        ws4.mergeCells(r, 2, r, 8);
        const lc = ws4.getCell(r, 2);
        lc.value = label;
        lc.font  = { bold: true, size: 10, name: 'Arial', color: { argb: RA_NEGRO } };
        lc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        lc.alignment = { horizontal: 'center', vertical: 'middle' };
        lc.border = { top: raBM, left: raBM, bottom: raBM, right: raBM };
        for (let c = 3; c <= 8; c++) {
            ws4.getCell(r, c).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: bg } };
            ws4.getCell(r, c).border = { top: raBM, bottom: raBM };
        }
        // valor
        const vc = ws4.getCell(r, 9);
        vc.value = `${val} ${unit}`;
        vc.font  = { bold: true, size: 11, name: 'Arial', color: { argb: RA_NEGRO } };
        vc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RA_YELLOW } };
        vc.alignment = { horizontal: 'center', vertical: 'middle' };
        vc.border = { top: raBM, left: raBM, bottom: raBM, right: raBM };
        for (let c = 10; c <= RA; c++) {
            ws4.getCell(r, c).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: RA_BLANC } };
        }
    }

    // SVG curva de pérdida 
    async function buildCurvasPNG(qM3h: number, diamMm: number): Promise<string> {
        const datosReales: Record<number, number[][]> = {
            15: [[0.4,0.1],[0.5,0.15],[0.6,0.2],[0.7,0.27],[0.8,0.35],[0.9,0.44],[1,0.5],[1.1,0.58],[1.2,0.7],[1.3,0.82],[1.4,0.95],[1.5,1.1],[1.7,1.4],[2,2],[2.5,3],[3,4.5],[3.5,6.2],[4,8]],
            20: [[0.6,0.1],[0.7,0.12],[0.8,0.15],[0.9,0.19],[1,0.25],[1.2,0.35],[1.4,0.42],[1.5,0.5],[1.7,0.65],[2,0.8],[2.5,1.25],[3,1.8],[3.5,2.4],[4,3.2],[4.5,4.1],[5,5],[6,7.2],[7,9.8],[8,12.5],[9,15.8],[10,19.5]],
            25: [[0.8,0.1],[0.9,0.12],[1,0.15],[1.2,0.22],[1.4,0.26],[1.5,0.3],[1.7,0.38],[2,0.5],[2.5,0.78],[3,1.1],[3.5,1.5],[4,2],[4.5,2.55],[5,3.1],[5.5,3.75],[6,4.5],[7,6.2],[8,8],[9,10.2],[10,12.5],[12,18],[15,28],[18,40],[20,50]],
            32: [[1,0.1],[1.2,0.14],[1.4,0.17],[1.5,0.2],[1.7,0.25],[2,0.3],[2.2,0.38],[2.5,0.48],[3,0.65],[3.5,0.85],[4,1.15],[4.5,1.45],[5,1.8],[5.5,2.2],[6,2.6],[7,3.6],[8,4.6],[9,5.8],[10,7.2],[12,10.5],[15,16],[18,22],[20,28],[25,44],[30,63],[35,86],[40,112]],
            40: [[1.5,0.08],[2,0.1],[2.2,0.12],[2.5,0.15],[3,0.2],[3.5,0.27],[4,0.35],[4.5,0.44],[5,0.55],[5.5,0.67],[6,0.8],[7,1.1],[8,1.4],[9,1.75],[10,2.2],[12,3.2],[15,5],[18,7.2],[20,8.9],[25,14],[30,20],[35,27],[40,35]],
            50: [[2,0.06],[2.5,0.08],[3,0.1],[3.5,0.12],[4,0.15],[4.5,0.19],[5,0.25],[5.5,0.29],[6,0.35],[7,0.48],[8,0.6],[9,0.75],[10,0.95],[12,1.35],[15,2.1],[18,3],[20,3.8],[25,6],[30,8.5],[35,11.5],[40,15],[45,19],[50,23]]
        };
        const colors: Record<number, string> = {
            15: '#e74c3c', 20: '#F44336', 25: '#9C27B0',
            32: '#FF9800', 40: '#2196F3', 50: '#4CAF50'
        };
        const labels: Record<number, string> = {
            15:'Ø 15 mm',20:'Ø 20 mm',25:'Ø 25 mm',
            32:'Ø 32 mm',40:'Ø 40 mm',50:'Ø 50 mm'
        };

        const interpLog = (x: number, pts: number[][]): number | null => {
            if (!pts.length || x <= 0) return null;
            if (x <= pts[0][0]) return pts[0][1];
            if (x >= pts[pts.length-1][0]) return pts[pts.length-1][1];
            for (let i = 0; i < pts.length-1; i++) {
                const [x1,y1] = pts[i], [x2,y2] = pts[i+1];
                if (x >= x1 && x <= x2)
                    return Math.exp(Math.log(y1) +
                        (Math.log(y2)-Math.log(y1)) *
                        (Math.log(x)-Math.log(x1)) /
                        (Math.log(x2)-Math.log(x1)));
            }
            return null;
        };

        // SVG dimensions
        const W = 700, H = 460;
        const ML = 70, MR = 20, MT = 40, MB = 60;
        const PW = W - ML - MR, PH = H - MT - MB;

        // log scale mappers
        const xMin = 0.4, xMax = 50, yMin = 0.05, yMax = 20;
        const xToP = (x: number) => ML + (Math.log(x) - Math.log(xMin)) /
            (Math.log(xMax) - Math.log(xMin)) * PW;
        const yToP = (y: number) => MT + PH - (Math.log(y) - Math.log(yMin)) /
            (Math.log(yMax) - Math.log(yMin)) * PH;

        // X axis ticks
        const xTicks = [0.4,0.5,0.6,0.8,1,2,3,4,5,6,8,10,20,30,40,50];
        const yTicks = [0.05,0.1,0.2,0.5,1,2,5,10,20];

        // Draw each curve
        const curveLines = Object.entries(datosReales).map(([d, pts]) => {
            const color = colors[parseInt(d)] || '#333';
            const pathPts: string[] = [];
            for (let i = 0; i <= 150; i++) {
                const x = xMin * Math.pow(xMax/xMin, i/150);
                const y = interpLog(x, pts);
                if (y !== null && y >= yMin && y <= yMax)
                    pathPts.push(`${i===0?'M':'L'}${xToP(x).toFixed(1)},${yToP(y).toFixed(1)}`);
            }
            return pathPts.length > 1
                ? `<path d="${pathPts.join(' ')}" fill="none" stroke="${color}"
                    stroke-width="2" opacity="0.9"/>
                   <text x="${xToP(xMax) + 4}" y="${yToP(interpLog(xMax, pts) || yMax).toFixed(1)}"
                    font-size="9" fill="${color}" font-family="Arial">${labels[parseInt(d)]}</text>`
                : '';
        }).join('\n');

        // Punto operación
        const perd = interpLog(qM3h, datosReales[diamMm] || datosReales[25]);
        const pointSVG = perd && qM3h > 0 && perd >= yMin && perd <= yMax ? `
            <line x1="${xToP(qM3h).toFixed(1)}" y1="${MT}" x2="${xToP(qM3h).toFixed(1)}"
                y2="${yToP(perd).toFixed(1)}" stroke="#9C27B0" stroke-width="1.5"
                stroke-dasharray="4 3"/>
            <line x1="${ML}" y1="${yToP(perd).toFixed(1)}" x2="${xToP(qM3h).toFixed(1)}"
                y2="${yToP(perd).toFixed(1)}" stroke="#9C27B0" stroke-width="1.5"
                stroke-dasharray="4 3"/>
            <circle cx="${xToP(qM3h).toFixed(1)}" cy="${yToP(perd).toFixed(1)}"
                r="6" fill="#9C27B0" opacity="0.85"/>
            <text x="${(xToP(qM3h)+8).toFixed(1)}" y="${(yToP(perd)-6).toFixed(1)}"
                font-size="9" fill="#9C27B0" font-weight="bold" font-family="Arial">
                Q=${qM3h.toFixed(2)} m³/h</text>
            <text x="${(xToP(qM3h)+8).toFixed(1)}" y="${(yToP(perd)+8).toFixed(1)}"
                font-size="9" fill="#9C27B0" font-weight="bold" font-family="Arial">
                hf=${perd.toFixed(3)} m/m</text>` : '';

        const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
          <rect width="${W}" height="${H}" fill="white"/>
          <!-- Título -->
          <text x="${W/2}" y="24" text-anchor="middle" font-size="13" font-weight="bold"
            fill="#111" font-family="Arial">Curva de Pérdida de Presión</text>
          <!-- Grid -->
          <rect x="${ML}" y="${MT}" width="${PW}" height="${PH}"
            fill="white" stroke="#000" stroke-width="2"/>
          ${xTicks.map(x => `
            <line x1="${xToP(x).toFixed(1)}" y1="${MT}" x2="${xToP(x).toFixed(1)}"
              y2="${MT+PH}" stroke="#ddd" stroke-width="0.8"/>
            <text x="${xToP(x).toFixed(1)}" y="${MT+PH+14}" text-anchor="middle"
              font-size="9" fill="#333" font-family="Arial">${x}</text>`).join('')}
          ${yTicks.map(y => `
            <line x1="${ML}" y1="${yToP(y).toFixed(1)}" x2="${ML+PW}"
              y2="${yToP(y).toFixed(1)}" stroke="#ddd" stroke-width="0.8"/>
            <text x="${ML-6}" y="${(yToP(y)+3).toFixed(1)}" text-anchor="end"
              font-size="9" fill="#333" font-family="Arial">${y}</text>`).join('')}
          <!-- Curvas -->
          ${curveLines}
          <!-- Punto -->
          ${pointSVG}
          <!-- Ejes labels -->
          <text x="${ML+PW/2}" y="${H-8}" text-anchor="middle" font-size="11"
            fill="#333" font-family="Arial">Caudal - m³/h</text>
          <text x="14" y="${MT+PH/2}" text-anchor="middle" font-size="10"
            fill="#333" font-family="Arial"
            transform="rotate(-90 14 ${MT+PH/2})">Pérdida de Presión (m.c.a.)</text>
        </svg>`;

        return new Promise<string>((resolve, reject) => {
            const img  = new Image();
            const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
            const url  = URL.createObjectURL(blob);
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = W * 2; canvas.height = H * 2;
                const ctx = canvas.getContext('2d')!;
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.scale(2, 2);
                ctx.drawImage(img, 0, 0, W, H);
                URL.revokeObjectURL(url);
                resolve(canvas.toDataURL('image/png').split(',')[1]);
            };
            img.onerror = reject;
            img.src = url;
        });
    }

    // Funciones de cálculo
    const raDiamData: Record<string, { mm: number; area: number }> = {
        '1/2 pulg':   { mm: 15, area: 0.50 },
        '3/4 pulg':   { mm: 20, area: 0.74 },
        '1 pulg':     { mm: 25, area: 1 },
        '1 1/4 pulg': { mm: 32, area: 1.25 },
        '1 1/2 pulg': { mm: 40, area: 1.5 },
        '2 pulg':     { mm: 50, area: 2 },
        '2 1/2 pulg': { mm: 50, area: 2.5 },
        '3 pulg':     { mm: 50, area: 3 },
    };

    const raCalcV = (q: number, d: string) => {
        const area = raDiamData[d]?.area;
        if (!area || q <= 0) return 0;
        return +((q/1000) / (Math.PI * Math.pow(area * 2.54/100, 2) / 4)).toFixed(3);
    };

    const raCalcS = (q: number, d: string) => {
        const area = raDiamData[d]?.area;
        if (!area || q <= 0) return 0;
        return +(Math.pow((q/1000 / 0.2785 / 140) /
            Math.pow(area * 2.54/100, 2.63), 1.85)).toFixed(6);
    };

    // ---------- Leer datos ----------
    const raD = data;
    const raVolCist    = parseFloat(String(raD.volCisterna || 2000));
    const raTiempoL    = parseFloat(String(raD.tiempoLlenado || 10));
    const raConsumoDia = parseFloat(String(raD.consumoDiario || 0));
    const raNivTerr    = parseFloat(String(raD.nivelTerreno || 0));
    const raPresConn   = parseFloat(String(raD.presionConn || 10));
    const raPresSal    = parseFloat(String(raD.presionSalida || 2));
    const raNivIngCist = parseFloat(String(raD.nivIngCist || 0));
    
    // Estos son strings, no necesitan parseFloat
    const raDiamConn   = String(raD.diamConn || '1 pulg');
    const raMicro      = String(raD.micro || 'SI');
    
    const raLTuberia   = parseFloat(String(raD.lTuberia || 5.40));
    const raHfMed      = parseFloat(String(raD.hfMed || 1.10));

    // Para los arreglos, aseguramos que los valores internos también sean tratados correctamente
    const raAccs: any[] = Array.isArray(raD.accs) ? raD.accs : [
        { tipo:'codo45',      cantidad:0, leq:0.477 },
        { tipo:'codo90',      cantidad:3, leq:1.023 },
        { tipo:'tee',         cantidad:1, leq:2.045 },
        { tipo:'valCompuerta',cantidad:2, leq:0.216 },
        { tipo:'valCheck',    cantidad:0, leq:2.114 },
        { tipo:'reduccion2',  cantidad:1, leq:1.045 },
    ];

    const raDiaSel  = String(raD.diaSel || '1 pulg');
    const raDiaLTub = parseFloat(String(raD.diaLTub || 15.88));
    
    const raDiaAccs: any[] = Array.isArray(raD.diaAccs) ? raD.diaAccs : [
        { tipo:'codo45',      cantidad:0, leq:0.477 },
        { tipo:'codo90',      cantidad:7, leq:1.023 },
        { tipo:'tee',         cantidad:2, leq:2.045 },
        { tipo:'valCompuerta',cantidad:2, leq:0.216 },
        { tipo:'valCheck',    cantidad:0, leq:2.114 },
        { tipo:'reduccion2',  cantidad:0, leq:1.045 },
    ];

    // Cálculos derivados
    const raQllen      = raTiempoL > 0 ? parseFloat((raVolCist / (raTiempoL * 3600)).toFixed(3)) : 0;
    const raQM3h       = parseFloat((raQllen * 3.6).toFixed(2));
    const raNivTubConn = parseFloat((raNivTerr - 0.70).toFixed(2));
    const raAltEst     = parseFloat((raNivIngCist - raNivTubConn).toFixed(2));
    const raCargaDisp  = parseFloat((raPresConn - raPresSal - raAltEst).toFixed(2));
    const raVel        = raCalcV(raQllen, raDiamConn);
    const raLeqT       = Math.round(raAccs.reduce((s: number, a: any) =>
        s + (a.cantidad||0) * (a.leq||0), 0) * 1000) / 1000;
    const raLTot       = parseFloat((raLeqT + raLTuberia).toFixed(2));
    const raSH         = raCalcS(raQllen, raDiamConn);
    const raHf         = parseFloat((raLTot * raSH).toFixed(2));
    const raHfMedV     = raMicro === 'SI' ? parseFloat(raHfMed.toFixed(2)) : 0;
    const raCDisp      = parseFloat((raCargaDisp - raHfMedV - raHf).toFixed(2));
    const raDVel       = raCalcV(raQllen, raDiaSel);
    const raDLeqT      = Math.round(raDiaAccs.reduce((s: number, a: any) =>
        s + (a.cantidad||0) * (a.leq||0), 0) * 1000) / 1000;
    const raDLTot      = parseFloat((raDLeqT + raDiaLTub).toFixed(2));
    const raDS         = raCalcS(raQllen, raDiaSel);
    const raDHf        = parseFloat((raDLTot * raDS).toFixed(2));
    const raDCDisp     = parseFloat((raCDisp - raDHf).toFixed(2));

    const raAccLabels: Record<string, string> = {
        codo45:'Codo de 45°', codo90:'Codo de 90°', tee:'Tee',
        valCompuerta:'Válvula Compuerta', valCheck:'Válvula Check',
        canastilla:'Canastilla', reduccion1:'Reducción 1', reduccion2:'Reducción 2',
    };

    let rr = 1;

    // ENCABEZADO PRINCIPAL
    raTitleBar(rr, '4. CALCULO DE LA RED DE ALIMENTACIÓN'); rr++;
    raSep(rr, 18); rr++;

    // 3.1. CAUDAL DE ENTRADA
    raSubBar(rr, '4.1. CAUDAL DE ENTRADA'); rr++;
    raSep(rr, 8); rr++;
    raSep(rr, 10); rr++;

    // Fila: Vol Cisterna + Tiempo Llenado
    raLV2(rr,
        'Volumen de la Cisterna =', `${raVolCist.toFixed(3)} L`, '',
        'Tiempo de Llenado=', `${raTiempoL} hrs`, '',
        { vb1: RA_LYELL, vb2: RA_YELLOW }
    ); rr++;
    raSep(rr, 8); rr++;

    // Q llenado 
    raFill(rr, RA_BLANC, 22);
    ws4.mergeCells(rr, 2, rr, 6);
    const raQLbl = ws4.getCell(rr, 2);
    raQLbl.value = `Q llenado = ${raQllen.toFixed(3)} L/s`;
    raQLbl.font  = { bold: true, size: 10, name: 'Arial', color: { argb: RA_NEGRO } };
    raQLbl.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RA_YELLOW } };
    raQLbl.alignment = { horizontal: 'center', vertical: 'middle' };
    raQLbl.border = { top: raBM, left: raBM, bottom: raBM, right: raBM };
    for (let c = 3; c <= 6; c++) {
        ws4.getCell(rr, c).fill = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: RA_YELLOW } };
        ws4.getCell(rr, c).border = { top: raBM, bottom: raBM };
    }
    for (let c = 7; c <= RA; c++)
        ws4.getCell(rr, c).fill = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: RA_BLANC } };
    rr++;
    raSep(rr, 18); rr++;

    // 3.2. CARGA DISPONIBLE
    raSubBar(rr, '4.2. CARGA DISPONIBLE'); rr++;
    raSep(rr, 8); rr++;
    raSep(rr, 8); rr++;

    // Label centrado "Datos de la FACTIBILIDAD DE SERVICIO"
    raFill(rr, 'FFE8F4FD', 18);
    ws4.mergeCells(rr, 2, rr, RA);
    const raFactLbl = ws4.getCell(rr, 2);
    raFactLbl.value = 'Datos de la FACTIBILIDAD DE SERVICIO';
    raFactLbl.font  = { bold: false, size: 9, name: 'Arial', color: { argb: RA_NEGRO } };
    raFactLbl.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F4FD' } };
    raFactLbl.alignment = { horizontal: 'center', vertical: 'middle' };
    rr++;
    raSep(rr, 8); rr++;

    raLV(rr, 'Nivel del terreno donde la cnx. =', `+${raNivTerr.toFixed(2)} m`, '',
        { valBg: RA_LYELL }); rr++;
    raLV(rr, 'Nivel de la tubería de cnx. =', `${raNivTubConn.toFixed(2)} m`, '',
        { valBg: RA_LYELL }); rr++;
    raLV(rr, 'Nivel de tubería de ingreso a cist. =', `+${raNivIngCist.toFixed(2)} m`, '',
        { valBg: RA_LYELL }); rr++;
    raSep(rr, 8); rr++;
    raLV(rr, 'Presión en la CONEXIÓN PÚBLICA =', `+${raPresConn.toFixed(2)} m`, '',
        { valBg: RA_YELLOW }); rr++;
    raLV(rr, 'Presión de salida en tub. de ingreso =', `+${raPresSal.toFixed(2)} m`, '',
        { valBg: RA_YELLOW }); rr++;
    raLV(rr, 'Altura estática entre tub red publica y la cist =',
        `+${raAltEst.toFixed(2)} m`, '', { valBg: RA_LYELL }); rr++;
    raSep(rr, 10); rr++;

    raResult(rr, `Carga Disponible (Hd1) = ${raCargaDisp.toFixed(2)} m`, '', '', RA_YELLOW); rr++;
    raSep(rr, 18); rr++;

    // 3.3. PÉRDIDA DE CARGA: TRAMO RED PÚBLICA - MEDIDOR
    raSubBar(rr, '4.3. PERDIDA DE CARGA: TRAMO RED PUBLICA - MEDIDOR'); rr++;
    raSep(rr, 8); rr++;
    raSep(rr, 10); rr++;

    // Inputs: Diámetro + Micromedidor
    raLV2(rr,
        'Diámetro de la Conexión Domiciliaria =', raDiamConn, 'pulg.',
        'Presenta MICROMEDICION =', raMicro, '',
        { vb1: RA_YELLOW, vb2: RA_YELLOW }
    ); rr++;
    raSep(rr, 10); rr++;

    // Tabla accesorios 3.3 
    const raTblH = { style: 'thin' as ExcelJS.BorderStyle, color: { argb: 'FFFFFFFF' } };

    // Fila 1 headers
    ws4.getRow(rr).height = 18;
    raFill(rr, RA_BLUE, 18);
    const raTH: Array<{ c: number; span: number; text: string }> = [
        { c: 2, span: 1, text: 'Q\n(L/s)' },
        { c: 3, span: 1, text: 'diámetro' },
        { c: 4, span: 1, text: 'V\n(m/s)' },
        { c: 5, span: 4, text: 'L accesorios' },
        { c: 9, span: 1, text: 'L tubería' },
        { c:10, span: 1, text: 'L total' },
        { c:11, span: 1, text: 'S\n(m/m)' },
        { c:12, span: 1, text: 'hf\n(m)' },
    ];
    raTH.forEach(({ c, span, text }) => {
        if (span > 1) ws4.mergeCells(rr, c, rr, c + span - 1);
        const cell = ws4.getCell(rr, c);
        cell.value = text;
        cell.font  = { bold: true, size: 8, name: 'Arial',
                       color: { argb: 'FFFFFFFF' } };
        cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RA_BLUE } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = { top: raTblH, left: raTblH, bottom: raTblH, right: raTblH };
    });
    rr++;

    // Fila 2 sub-headers L accesorios
    ws4.getRow(rr).height = 16;
    raFill(rr, RA_BLUE2, 16);
    for (let c = 2; c <= RA; c++) {
        ws4.getCell(rr, c).fill = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: c >= 5 && c <= 8 ? RA_BLUE2 : RA_BLUE } };
    }
    const raTH2: Array<{ c: number; text: string }> = [
        { c: 5, text: 'accesorios' }, { c: 6, text: '#' },
        { c: 7, text: 'Leq.' },      { c: 8, text: 'Leq. T' },
    ];
    raTH2.forEach(({ c, text }) => {
        const cell = ws4.getCell(rr, c);
        cell.value = text;
        cell.font  = { bold: true, size: 8, name: 'Arial',
                       color: { argb: 'FFFFFFFF' } };
        cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RA_BLUE2 } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { top: raTblH, left: raTblH, bottom: raTblH, right: raTblH };
    });
    rr++;

    // Filas de datos accesorios 3.3
    const raAccStart = rr;
    raAccs.forEach((acc: any, idx: number) => {
        ws4.getRow(rr).height = 20;
        const bg = idx % 2 === 0 ? RA_BLANC : RA_LBLUE;
        raFill(rr, bg, 17);

        // Celdas rowspan 
        if (idx === 0) {
            ws4.mergeCells(rr, 2, rr + raAccs.length - 1, 2);
            const c2 = ws4.getCell(rr, 2);
            c2.value = `${raQllen.toFixed(3)} L/s`;
            c2.font  = { bold: true, size: 9, name: 'Arial', color: { argb: 'FF2563EB' } };
            c2.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RA_BLANC } };
            c2.alignment = { horizontal: 'center', vertical: 'middle' };
            c2.border = { top: raBT, left: raBT, bottom: raBT, right: raBT };

            ws4.mergeCells(rr, 3, rr + raAccs.length - 1, 3);
            const c3 = ws4.getCell(rr, 3);
            c3.value = raDiamConn;
            c3.font  = { bold: true, size: 9, name: 'Arial', color: { argb: RA_NEGRO } };
            c3.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RA_BLANC } };
            c3.alignment = { horizontal: 'center', vertical: 'middle' };
            c3.border = { top: raBT, left: raBT, bottom: raBT, right: raBT };

            ws4.mergeCells(rr, 4, rr + raAccs.length - 1, 4);
            const c4 = ws4.getCell(rr, 4);
            c4.value = raVel;
            c4.font  = { bold: true, size: 9, name: 'Arial', color: { argb: 'FF16A34A' } };
            c4.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RA_BLANC } };
            c4.alignment = { horizontal: 'center', vertical: 'middle' };
            c4.numFmt = '0.000 "m/s"';
            c4.border = { top: raBT, left: raBT, bottom: raBT, right: raBT };

            ws4.mergeCells(rr, 9, rr + raAccs.length - 1, 9);
            const c9 = ws4.getCell(rr, 9);
            c9.value = raLTuberia;
            c9.font  = { bold: true, size: 9, name: 'Arial', color: { argb: RA_NEGRO } };
            c9.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RA_YELLOW } };
            c9.alignment = { horizontal: 'center', vertical: 'middle' };
            c9.numFmt = '0.00 "m"';
            c9.border = { top: raBT, left: raBT, bottom: raBT, right: raBT };

            ws4.mergeCells(rr, 10, rr + raAccs.length - 1, 10);
            const c10 = ws4.getCell(rr, 10);
            c10.value = raLTot;
            c10.font  = { bold: true, size: 9, name: 'Arial', color: { argb: 'FF7C3AED' } };
            c10.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RA_YELLOW } };
            c10.alignment = { horizontal: 'center', vertical: 'middle' };
            c10.numFmt = '0.00 "m"';
            c10.border = { top: raBT, left: raBT, bottom: raBT, right: raBT };

            ws4.mergeCells(rr, 11, rr + raAccs.length - 1, 11);
            const c11 = ws4.getCell(rr, 11);
            c11.value = raSH;
            c11.font  = { size: 8, name: 'Courier New', color: { argb: RA_NEGRO } };
            c11.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RA_BLANC } };
            c11.alignment = { horizontal: 'center', vertical: 'middle' };
            c11.numFmt = '0.000000';
            c11.border = { top: raBT, left: raBT, bottom: raBT, right: raBT };

            ws4.mergeCells(rr, 12, rr + raAccs.length - 1, 12);
            const c12 = ws4.getCell(rr, 12);
            c12.value = raHf;
            c12.font  = { bold: true, size: 9, name: 'Arial', color: { argb: 'FFDC2626' } };
            c12.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RA_YELLOW } };
            c12.alignment = { horizontal: 'center', vertical: 'middle' };
            c12.numFmt = '0.00 "m"';
            c12.border = { top: raBT, left: raBT, bottom: raBT, right: raBT };
        }

        // Celda accesorio
        const c5 = ws4.getCell(rr, 5);
        c5.value = raAccLabels[acc.tipo] || acc.tipo;
        c5.font  = { size: 9, name: 'Arial', color: { argb: RA_NEGRO } };
        c5.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        c5.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        c5.border = { top: raBT, left: raBT, bottom: raBT, right: raBT };

        // Cantidad
        const c6 = ws4.getCell(rr, 6);
        const cantVal = parseFloat(acc.cantidad) || 0;
        c6.value = cantVal;
        c6.font  = { bold: true, size: 9, name: 'Arial', color: { argb: RA_NEGRO } };
        c6.fill  = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: cantVal > 0 ? RA_YELLOW : bg } };
        c6.alignment = { horizontal: 'center', vertical: 'middle' };
        c6.border = { top: raBT, left: raBT, bottom: raBT, right: raBT };
        c6.numFmt = '0';

        // Leq
        const c7 = ws4.getCell(rr, 7);
        c7.value = parseFloat(acc.leq) || 0;
        c7.font  = { size: 9, name: 'Arial', color: { argb: RA_NEGRO } };
        c7.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        c7.alignment = { horizontal: 'center', vertical: 'middle' };
        c7.border = { top: raBT, left: raBT, bottom: raBT, right: raBT };
        c7.numFmt = '0.000';

        // Leq.T
        const leqT33 = parseFloat(((parseFloat(acc.cantidad)||0) * (parseFloat(acc.leq)||0)).toFixed(3));
        const c8 = ws4.getCell(rr, 8);
        c8.value = leqT33;
        c8.font  = { bold: true, size: 9, name: 'Arial', color: { argb: RA_NEGRO } };
        c8.fill  = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: leqT33 > 0 ? RA_LYELL : bg } };
        c8.alignment = { horizontal: 'center', vertical: 'middle' };
        c8.border = { top: raBT, left: raBT, bottom: raBT, right: raBT };
        c8.numFmt = '0.000';

        rr++;
    });

    // Fila LONGITUD TOTAL EQUIVALENTE
    ws4.getRow(rr).height = 20;
    raFill(rr, RA_LGRAY, 20);
    ws4.mergeCells(rr, 2, rr, 7);
    const raLeqLbl = ws4.getCell(rr, 2);
    raLeqLbl.value = 'LONGITUD TOTAL EQUIVALENTE:';
    raLeqLbl.font  = { bold: true, size: 9, name: 'Arial', color: { argb: RA_NEGRO } };
    raLeqLbl.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RA_LGRAY } };
    raLeqLbl.alignment = { horizontal: 'right', vertical: 'middle' };
    raLeqLbl.border = { top: raBT, left: raBT, bottom: raBT, right: raBT };
    for (let c = 3; c <= 7; c++) {
        ws4.getCell(rr, c).fill = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: RA_LGRAY } };
        ws4.getCell(rr, c).border = { top: raBT, bottom: raBT };
    }
    const raLeqVal = ws4.getCell(rr, 8);
    raLeqVal.value = `${raLeqT.toFixed(3)} m`;
    raLeqVal.font  = { bold: true, size: 9, name: 'Arial', color: { argb: 'FF2563EB' } };
    raLeqVal.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RA_LGRAY } };
    raLeqVal.alignment = { horizontal: 'center', vertical: 'middle' };
    raLeqVal.border = { top: raBT, left: raBT, bottom: raBT, right: raBT };
    for (let c = 9; c <= RA; c++) {
        ws4.getCell(rr, c).fill = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: RA_BLANC } };
    }
    rr++;
    raSep(rr, 12); rr++;

    //  GRÁFICO — Curva de Pérdida 
    const raChartH = 320;
    const raChartRows = Math.ceil(raChartH / 17);
    const raChartStart = rr;
    for (let i = 0; i < raChartRows; i++) {
        ws4.getRow(rr).height = 17;
        for (let c = 1; c <= RA; c++)
            ws4.getCell(rr, c).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: RA_BLANC } };
        rr++;
    }
    try {
        const chartPng = await buildCurvasPNG(raQM3h,
            raDiamData[raDiamConn]?.mm || 25);
        const raImgId = workbook.addImage({ base64: chartPng, extension: 'png' });
        ws4.addImage(raImgId, {
            tl:  { nativeCol: 1, nativeRow: raChartStart - 1 },
            ext: { width: 700, height: raChartH },
            editAs: 'oneCell',
        } as any);
    } catch (e) {
        console.warn('Chart error:', e);
    }
    raSep(rr, 14); rr++;

    // Resultados 3.3 
    raLV2(rr,
        'Carga Disponible =', `+${raCargaDisp.toFixed(2)} m`, '',
        'Pérdida de Carga en medidor =', `+${raHfMedV.toFixed(2)} m`, '',
        { vb1: RA_LYELL, vb2: RA_YELLOW }
    ); rr++;
    raLV(rr, 'Pérdida de carga entre la Red Publica y Medidor =',
        `+${raHf.toFixed(2)} m`, '', { valBg: RA_YELLOW }); rr++;
    raSep(rr, 8); rr++;

    // Hd y Long tubería
    raLV2(rr,
        'Hd =', `${raCargaDisp.toFixed(2)} m`, '',
        'Long. tubería =', `${raLTuberia.toFixed(2)} m`, '',
        { vb1: RA_BLANC, vb2: RA_YELLOW }
    ); rr++;
    raSep(rr, 18); rr++;

    // 3.4. PÉRDIDA DE CARGA: MEDIDOR - CISTERNA
    raSubBar(rr, '4.4. PERDIDA DE CARGA: MEDIDOR - CISTERNA'); rr++;
    raSep(rr, 8); rr++;
    raSep(rr, 10); rr++;

    // Tabla accesorios 3.4 
    ws4.getRow(rr).height = 18;
    raFill(rr, RA_BLUE, 18);
    raTH.forEach(({ c, span, text }) => {
        if (span > 1) ws4.mergeCells(rr, c, rr, c + span - 1);
        const cell = ws4.getCell(rr, c);
        cell.value = text;
        cell.font  = { bold: true, size: 8, name: 'Arial', color: { argb: 'FFFFFFFF' } };
        cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RA_BLUE } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = { top: raTblH, left: raTblH, bottom: raTblH, right: raTblH };
    });
    rr++;

    ws4.getRow(rr).height = 16;
    raFill(rr, RA_BLUE2, 16);
    raTH2.forEach(({ c, text }) => {
        const cell = ws4.getCell(rr, c);
        cell.value = text;
        cell.font  = { bold: true, size: 8, name: 'Arial', color: { argb: 'FFFFFFFF' } };
        cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RA_BLUE2 } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { top: raTblH, left: raTblH, bottom: raTblH, right: raTblH };
    });
    for (let c = 2; c <= RA; c++) {
        if (c < 5 || c > 8)
            ws4.getCell(rr, c).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: RA_BLUE } };
    }
    rr++;

    raDiaAccs.forEach((acc: any, idx: number) => {
        ws4.getRow(rr).height = 20;
        const bg = idx % 2 === 0 ? RA_BLANC : RA_LBLUE;
        raFill(rr, bg, 17);

        if (idx === 0) {
          
            [
                { c: 2, val: `${raQllen.toFixed(3)} L/s`, col: 'FF2563EB', bg2: RA_BLANC, fmt: '' },
                { c: 3, val: raDiaSel, col: RA_NEGRO, bg2: RA_BLANC, fmt: '' },
                { c: 4, val: raDVel, col: 'FF16A34A', bg2: RA_BLANC, fmt: '0.000 "m/s"' },
                { c: 9, val: raDiaLTub, col: RA_NEGRO, bg2: RA_YELLOW, fmt: '0.00 "m"' },
                { c:10, val: raDLTot, col: 'FF7C3AED', bg2: RA_YELLOW, fmt: '0.00 "m"' },
                { c:11, val: raDS, col: RA_NEGRO, bg2: RA_BLANC, fmt: '0.000000' },
                { c:12, val: raDHf, col: 'FFDC2626', bg2: RA_YELLOW, fmt: '0.00 "m"' },
            ].forEach(({ c, val, col, bg2, fmt }) => {
                ws4.mergeCells(rr, c, rr + raDiaAccs.length - 1, c);
                const cell = ws4.getCell(rr, c);
                cell.value = val;
                cell.font  = { bold: true, size: 9, name: c === 11 ? 'Courier New' : 'Arial',
                               color: { argb: col } };
                cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg2 } };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.border = { top: raBT, left: raBT, bottom: raBT, right: raBT };
                if (fmt) cell.numFmt = fmt;
            });
        }

        const c5 = ws4.getCell(rr, 5);
        c5.value = raAccLabels[acc.tipo] || acc.tipo;
        c5.font  = { size: 9, name: 'Arial', color: { argb: RA_NEGRO } };
        c5.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        c5.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        c5.border = { top: raBT, left: raBT, bottom: raBT, right: raBT };

        const cant2 = parseFloat(acc.cantidad) || 0;
        const c6 = ws4.getCell(rr, 6);
        c6.value = cant2;
        c6.font  = { bold: true, size: 9, name: 'Arial', color: { argb: RA_NEGRO } };
        c6.fill  = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: cant2 > 0 ? RA_YELLOW : bg } };
        c6.alignment = { horizontal: 'center', vertical: 'middle' };
        c6.border = { top: raBT, left: raBT, bottom: raBT, right: raBT };
        c6.numFmt = '0';

        const c7 = ws4.getCell(rr, 7);
        c7.value = parseFloat(acc.leq) || 0;
        c7.font  = { size: 9, name: 'Arial', color: { argb: RA_NEGRO } };
        c7.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        c7.alignment = { horizontal: 'center', vertical: 'middle' };
        c7.border = { top: raBT, left: raBT, bottom: raBT, right: raBT };
        c7.numFmt = '0.000';

        const leqT34 = parseFloat(((cant2) * (parseFloat(acc.leq)||0)).toFixed(3));
        const c8 = ws4.getCell(rr, 8);
        c8.value = leqT34;
        c8.font  = { bold: true, size: 9, name: 'Arial', color: { argb: RA_NEGRO } };
        c8.fill  = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: leqT34 > 0 ? RA_LYELL : bg } };
        c8.alignment = { horizontal: 'center', vertical: 'middle' };
        c8.border = { top: raBT, left: raBT, bottom: raBT, right: raBT };
        c8.numFmt = '0.000';

        rr++;
    });

    // LONGITUD TOTAL EQUIVALENTE 3.4
    ws4.getRow(rr).height = 20;
    raFill(rr, RA_LGRAY, 20);
    ws4.mergeCells(rr, 2, rr, 7);
    const raLeqLbl2 = ws4.getCell(rr, 2);
    raLeqLbl2.value = 'LONGITUD TOTAL EQUIVALENTE:';
    raLeqLbl2.font  = { bold: true, size: 9, name: 'Arial', color: { argb: RA_NEGRO } };
    raLeqLbl2.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RA_LGRAY } };
    raLeqLbl2.alignment = { horizontal: 'right', vertical: 'middle' };
    raLeqLbl2.border = { top: raBT, left: raBT, bottom: raBT, right: raBT };
    for (let c = 3; c <= 7; c++) {
        ws4.getCell(rr, c).fill = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: RA_LGRAY } };
        ws4.getCell(rr, c).border = { top: raBT, bottom: raBT };
    }
    const raLeqVal2 = ws4.getCell(rr, 8);
    raLeqVal2.value = `${raDLeqT.toFixed(3)} m`;
    raLeqVal2.font  = { bold: true, size: 9, name: 'Arial', color: { argb: 'FF2563EB' } };
    raLeqVal2.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RA_LGRAY } };
    raLeqVal2.alignment = { horizontal: 'center', vertical: 'middle' };
    raLeqVal2.border = { top: raBT, left: raBT, bottom: raBT, right: raBT };
    for (let c = 9; c <= RA; c++)
        ws4.getCell(rr, c).fill = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: RA_BLANC } };
    rr++;
    raSep(rr, 10); rr++;

    // Resultados 3.4
    raLV2(rr,
        'Carga Disponible (Hd 2) =', `+${raCDisp.toFixed(2)} m`, '',
        'Perdida de carga entre el Medidor - Cisterna =', `+${raDHf.toFixed(2)} m`, '',
        { vb1: RA_LYELL, vb2: RA_YELLOW }
    ); rr++;
    raSep(rr, 8); rr++;
    raResult(rr, `Carga Disponible (Hd3) = ${raDCDisp.toFixed(2)}`, '', '', RA_YELLOW); rr++;
    raSep(rr, 18); rr++;

    // 3.5. RESULTADOS
    raSubBar(rr, '4.5. RESULTADOS'); rr++;
    raSep(rr, 8); rr++;
    raSep(rr, 10); rr++;

    raLV(rr, 'Q llenado =', `${raQllen.toFixed(3)} L/s`, '',
        { valBg: RA_YELLOW }); rr++;
    raSep(rr, 8); rr++;
    raLV(rr, 'Diámetro (Tramo Red Publica - Medidor) =',
        `${raDiamConn}`, 'pulg.', { valBg: RA_YELLOW }); rr++;
    raSep(rr, 8); rr++;
    raLV(rr, 'Diámetro (Medidor - Cisterna) =',
        `${raDiaSel}`, 'pulg.', { valBg: RA_YELLOW }); rr++;
    raSep(rr, 18); rr++;

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