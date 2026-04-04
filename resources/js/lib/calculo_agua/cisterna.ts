import type ExcelJS from 'exceljs';

// Interfaz para mantener el tipado en tu ASUS TUF
interface AguaData {
    cisterna?: any;
}

export async function exportCisternaToExcel(workbook: ExcelJS.Workbook, dataSheet: AguaData) {
    const ws2 = workbook.addWorksheet('2. Cisterna');
    
        const CS = 13;
        ws2.columns = [
            { width: 3  }, // 1  
            { width: 14 }, // 2  
            { width: 14 }, // 3  
            { width: 14 }, // 4  
            { width: 14 }, // 5  
            { width: 14 }, // 6  
            { width: 14 }, // 7  
            { width: 14 }, // 8  
            { width: 14 }, // 9  
            { width: 3  }, // 10 
            { width: 24 }, // 11 
            { width: 14 }, // 12 
            { width: 6  }, // 13 
        ];
    
        const CS_BLANC  = 'FFFFFFFF';
        const CS_NEGRO  = 'FF000000';
        const CS_BLUE   = 'FF0A2A4A';
        const CS_BLUE2  = 'FF2A5A8A';
        const CS_SEC    = 'FFdce8f0';
        const CS_OK_BG  = 'FFF5F5D8';
        const CS_WARN   = 'FFFFF0F0';
        const CS_F4F8   = 'FFF4F8FC';
        const CS_F0F4FA = 'FFF0F4FA';
        const CS_FAFAF4 = 'FFFAFAF4';
    
        const c2BT  = { style: 'thin'   as ExcelJS.BorderStyle, color: { argb: 'FFBBBBBB' } };
        const c2BM  = { style: 'medium' as ExcelJS.BorderStyle, color: { argb: 'FF888888' } };
        const c2BLU = { style: 'medium' as ExcelJS.BorderStyle, color: { argb: CS_BLUE2  } };
        const c2BBL = { style: 'thick'  as ExcelJS.BorderStyle, color: { argb: CS_BLUE2  } };
    
        function c2Sep(r: number, h = 8) {
            ws2.getRow(r).height = h;
            for (let c = 1; c <= CS; c++)
                ws2.getCell(r, c).fill = { type: 'pattern', pattern: 'solid',
                    fgColor: { argb: CS_BLANC } };
        }
    
        function c2Fill(r: number, bg: string, h = 17) {
            ws2.getRow(r).height = h;
            for (let c = 1; c <= CS; c++)
                ws2.getCell(r, c).fill = { type: 'pattern', pattern: 'solid',
                    fgColor: { argb: c === 1 ? CS_BLANC : bg } };
        }
    
        function c2Wide(r: number, text: string, opts: {
            bg?: string; h?: number; bold?: boolean; size?: number;
            color?: string; halign?: ExcelJS.Alignment['horizontal'];
            italic?: boolean; borderStyle?: 'all' | 'bottom';
        } = {}) {
            const bg = opts.bg ?? CS_BLANC;
            c2Fill(r, bg, opts.h ?? 18);
            ws2.mergeCells(r, 2, r, CS);
            const cell = ws2.getCell(r, 2);
            cell.value = text;
            cell.font  = { bold: opts.bold ?? false, size: opts.size ?? 10,
                           name: 'Arial', italic: opts.italic ?? false,
                           color: { argb: opts.color ?? CS_NEGRO } };
            cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
            cell.alignment = { horizontal: opts.halign ?? 'left', vertical: 'middle',
                               indent: 1, wrapText: true };
            if (opts.borderStyle === 'all')
                cell.border = { top: c2BT, left: c2BM, bottom: c2BT, right: c2BM };
            else if (opts.borderStyle === 'bottom')
                cell.border = { bottom: c2BBL };
        }
    
        // SVG → PNG 
        async function svgToPngBase64(svgStr: string, w: number, h: number): Promise<string> {
            return new Promise((resolve, reject) => {
                const img  = new Image();
                const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
                const url  = URL.createObjectURL(blob);
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
    
        // SVG DIAGRAMA 
        function buildCisternaSVG(d: any): string {
            const top      = parseFloat(d.nivelagua)   || 0.65;
            const altUtil  = parseFloat(d.alturaUtil)   || 1.90;
            const altTecho = parseFloat(d.alturaTecho)  || 0.20;
            const largo    = parseFloat(d.largo)        || 4.40;
            const altIng   = altUtil <= 12 ? 0.15 : altUtil <= 30 ? 0.20 : 0.30;
            const hrVal    = altUtil > 30  ? 0.15 : 0.10;
            const n1 = +(top - 0.20).toFixed(4);
            const n2 = +(n1 - altTecho).toFixed(4);
            const n3 = +(n2 - altIng).toFixed(4);
            const n4 = +(n3 - hrVal).toFixed(4);
            const n5 = +(n4 - altUtil).toFixed(4);
    
            const VW = 820, VH = 560;
            const tL = 50, tW = 260, svgTop = 70, svgBot = 460;
            const span = svgBot - svgTop, wT = 18, slabT = 18;
            const elevMin = n5 - 0.15, elevMax = top + 0.05;
            const e2y = (e: number) => svgTop + ((elevMax - e) / (elevMax - elevMin)) * span;
            const yTop = e2y(top), yIntTop = e2y(n1), yN2 = e2y(n2), yN3 = e2y(n3);
            const yN4 = e2y(n4), yN5 = e2y(n5), yFondo = yN5 + slabT, yNTN = e2y(0);
            const iL = tL + wT, iR = tL + tW - wT, iW = iR - iL;
            const aX = tL + tW + 30, bW = 28, lX = aX + bW + 10;
            const nBW = 138, nBX = VW - nBW - 6;
            const f2 = (v: number) => (isFinite(v) ? v : 0).toFixed(2);
            const sg = (v: number) => `${v >= 0 ? '+' : ''}${f2(v)}`;
    
            const bracket = (y1: number, y2: number, color: string,
                             lbl: string, sub: string, val: string) => {
                if (!isFinite(y1)||!isFinite(y2)||Math.abs(y2-y1)<5) return '';
                const my = (y1+y2)/2;
                return `
                  <line x1="${aX}" y1="${y1}" x2="${aX}" y2="${y2}" stroke="${color}" stroke-width="2"/>
                  <line x1="${aX}" y1="${y1}" x2="${aX+bW}" y2="${y1}" stroke="${color}" stroke-width="2"/>
                  <line x1="${aX}" y1="${y2}" x2="${aX+bW}" y2="${y2}" stroke="${color}" stroke-width="2"/>
                  <text x="${lX}" y="${my-7}" font-size="12" fill="#111"
                    font-family="Courier New,monospace">${lbl} ${sub}</text>
                  <text x="${lX}" y="${my+10}" font-size="13" font-weight="bold"
                    fill="#111" font-family="Courier New,monospace">= ${val} m</text>`;
            };
    
            const nvBox = (y: number, lbl: string, red = false) => `
              <line x1="${iR+3}" y1="${y}" x2="${nBX-6}" y2="${y}"
                stroke="${red?'#c00':'#aaa'}" stroke-width="${red?2:1}"
                stroke-dasharray="${red?'0':'6 3'}"/>
              <line x1="${nBX-6}" y1="${y}" x2="${nBX}" y2="${y}"
                stroke="${red?'#c00':'#555'}" stroke-width="1.5"/>
              <rect x="${nBX}" y="${y-12}" width="${nBW}" height="24" rx="3"
                fill="${red?'#fff0f0':'white'}"
                stroke="${red?'#c00':'#999'}" stroke-width="${red?2:1.5}"/>
              <text x="${nBX+nBW/2}" y="${y+1}" text-anchor="middle"
                dominant-baseline="middle" font-size="11"
                fill="${red?'#c00':'#222'}" font-family="Courier New,monospace"
                font-weight="${red?'bold':'normal'}">Nivel = ${lbl} m</text>`;
    
            return `<svg viewBox="0 0 ${VW} ${VH}" width="${VW}" height="${VH}"
                  xmlns="http://www.w3.org/2000/svg">
              <rect width="${VW}" height="${VH}" fill="white"/>
              <defs>
                <pattern id="hatch" patternUnits="userSpaceOnUse" width="8" height="8"
                  patternTransform="rotate(45)">
                  <line x1="0" y1="0" x2="0" y2="8" stroke="#999" stroke-width="1" opacity="0.5"/>
                </pattern>
              </defs>
              <line x1="${tL-50}" y1="${yNTN}" x2="${tL+tW+55}" y2="${yNTN}"
                stroke="#555" stroke-width="1.5" stroke-dasharray="10 4"/>
              <text x="${tL-48}" y="${yNTN-6}" font-size="11" fill="#555"
                font-family="Courier New,monospace">NTN</text>
              <rect x="${tL-50}" y="${yNTN}" width="46" height="${yFondo-yNTN+22}" fill="#e8e0c8" opacity="0.4"/>
              <rect x="${tL+tW+4}" y="${yNTN}" width="46" height="${yFondo-yNTN+22}" fill="#e8e0c8" opacity="0.4"/>
              <rect x="${tL}" y="${yTop}" width="${tW}" height="${yFondo-yTop}"
                fill="#c8c8c0" stroke="#666" stroke-width="2.5" rx="2"/>
              <rect x="${tL}" y="${yTop}" width="${wT}" height="${yFondo-yTop}" fill="url(#hatch)"/>
              <rect x="${iR}" y="${yTop}" width="${wT}" height="${yFondo-yTop}" fill="url(#hatch)"/>
              <rect x="${tL}" y="${yTop}" width="${tW}" height="${yIntTop-yTop}" fill="url(#hatch)"/>
              <rect x="${tL}" y="${yN5}" width="${tW}" height="${slabT}" fill="url(#hatch)"/>
              <rect x="${iL}" y="${yIntTop}" width="${iW}" height="${yN5-yIntTop}" fill="white"/>
              <rect x="${iL}" y="${yIntTop}" width="${iW}" height="${Math.max(yN4-yIntTop,0)}" fill="#f0f0ea"/>
              <rect x="${iL}" y="${yN4}" width="${iW}" height="${Math.max(yN5-yN4,0)}" fill="#c5e5f8"/>
              <rect x="${iL}" y="${yIntTop}" width="${iW}" height="${yN5-yIntTop}"
                fill="none" stroke="#888" stroke-width="2"/>
              ${(yN4-yIntTop)>35?`<text x="${iL+iW/2}" y="${(yIntTop+yN4)/2}"
                font-size="20" font-family="Courier New,monospace" font-weight="bold"
                fill="#bbb" text-anchor="middle" dominant-baseline="middle"
                transform="rotate(-18,${iL+iW/2},${(yIntTop+yN4)/2})"
                letter-spacing="3" opacity="0.6">BORDE LIBRE</text>`:''}
              <line x1="${iL+4}" y1="${yN2}" x2="${iR-4}" y2="${yN2}" stroke="#cc7744" stroke-width="2" stroke-dasharray="9 5"/>
              <line x1="${iL+4}" y1="${yN3}" x2="${iR-4}" y2="${yN3}" stroke="#4488cc" stroke-width="2" stroke-dasharray="9 5"/>
              <line x1="${iL+4}" y1="${yN4}" x2="${iR-4}" y2="${yN4}" stroke="#c03030" stroke-width="2" stroke-dasharray="9 5"/>
              <line x1="${iL+4}" y1="${yN5}" x2="${iR-4}" y2="${yN5}" stroke="#aaa"    stroke-width="2" stroke-dasharray="9 5"/>
              <rect x="${iR+1}" y="${yN2-13}" width="8" height="26" fill="#cc7744" stroke="#994422" stroke-width="1.5"/>
              <rect x="${iR-9}" y="${yN2-8}"  width="22" height="16" fill="#cc7744" stroke="#994422" stroke-width="2" rx="2"/>
              <rect x="${iR+1}" y="${yN3-13}" width="8" height="26" fill="#559944" stroke="#337722" stroke-width="1.5"/>
              <rect x="${iR-9}" y="${yN3-8}"  width="22" height="16" fill="#559944" stroke="#337722" stroke-width="2" rx="2"/>
              <rect x="${tL}" y="${yTop-22}" width="128" height="22" rx="3" fill="#1a1a1a"/>
              <text x="${tL+64}" y="${yTop-11}" text-anchor="middle" dominant-baseline="middle"
                font-size="12" fill="white" font-family="Courier New,monospace" font-weight="bold">
                Nivel = ${sg(top)} m</text>
              <rect x="${aX+10}" y="${yNTN-13}" width="108" height="24" rx="3"
                fill="white" stroke="#c00" stroke-width="2"/>
              <text x="${aX+64}" y="${yNTN-1}" text-anchor="middle" dominant-baseline="middle"
                font-size="12" fill="#c00" font-family="Courier New,monospace" font-weight="bold">
                NTN = +0.00 m</text>
              ${bracket(yIntTop,yN2,'#994422','H. techo',  '(Ht)',f2(altTecho))}
              ${bracket(yN2,    yN3,'#4488cc','H. ingreso','(Hi)',f2(altIng))}
              ${bracket(yN3,    yN4,'#c03030','H. rebose', '(Hr)',f2(hrVal))}
              ${(yN5-yN4)>18?`<text x="${lX}" y="${(yN4+yN5)/2}" dominant-baseline="middle"
                font-size="13" fill="#111" font-family="Courier New,monospace">
                Altura de agua (Ha) = <tspan font-weight="bold">${f2(altUtil)} m</tspan>
              </text>`:''}
              ${nvBox(yIntTop,sg(n1))}${nvBox(yN2,sg(n2))}${nvBox(yN3,sg(n3))}
              ${nvBox(yN4,sg(n4),true)}${nvBox(yN5,sg(n5))}
              <line x1="${tL-25}" y1="${yIntTop}" x2="${tL-25}" y2="${yN5}" stroke="#333" stroke-width="2"/>
              <line x1="${tL-33}" y1="${yIntTop}" x2="${tL-17}" y2="${yIntTop}" stroke="#333" stroke-width="2"/>
              <line x1="${tL-33}" y1="${yN5}"     x2="${tL-17}" y2="${yN5}"     stroke="#333" stroke-width="2"/>
              <text x="${tL-43}" y="${(yIntTop+yN5)/2}" text-anchor="middle"
                transform="rotate(-90,${tL-43},${(yIntTop+yN5)/2})"
                font-size="15" font-weight="bold" fill="#333"
                font-family="Courier New,monospace">H</text>
              <line x1="${iL}" y1="${yFondo+24}" x2="${iR}" y2="${yFondo+24}" stroke="#333" stroke-width="2"/>
              <line x1="${iL}" y1="${yFondo+17}" x2="${iL}" y2="${yFondo+31}" stroke="#333" stroke-width="2"/>
              <line x1="${iR}" y1="${yFondo+17}" x2="${iR}" y2="${yFondo+31}" stroke="#333" stroke-width="2"/>
              <text x="${(iL+iR)/2}" y="${yFondo+46}" text-anchor="middle"
                font-size="13" fill="#333" font-family="Courier New,monospace">
                L = ${f2(largo)} m</text>
            </svg>`;
        }
    
        // Leer datos 
        const csD        = dataSheet.cisterna || {};
        const csConsumo  = parseFloat(csD.consumoDiario)    || 0;
        const csLargo    = parseFloat(csD.largo)            || 4.40;
        const csAncho    = parseFloat(csD.ancho)            || 2.70;
        const csAltUtil  = parseFloat(csD.alturaUtil)       || 1.90;
        const csBL       = parseFloat(csD.bordeLibre)       || 0.50;
        const csNivAgua  = parseFloat(csD.nivelagua)        || 0.65;
        const csAltTecho = parseFloat(csD.alturaTecho)      || 0.20;
        const csVolCist  = parseFloat(csD.volumenCisterna)  ||
            Math.ceil((3/4) * csConsumo / 1000 * 10) / 10;
        const csVolCalc  = parseFloat(csD.volumenCalculado) || csLargo * csAncho * csAltUtil;
        const csAltTot   = parseFloat(csD.alturaTotal)      || csAltUtil + csBL + csAltTecho;
        const csArea     = csLargo * csAncho;
        const csAltAMin  = csArea > 0 ? csVolCist / csArea : 0;
        const csAltIng   = parseFloat(csD.altIng) ||
            (csAltUtil <= 12 ? 0.15 : csAltUtil <= 30 ? 0.20 : 0.30);
        const csHrVal    = parseFloat(csD.hrVal) || (csAltUtil > 30 ? 0.15 : 0.10);
        const csN1 = parseFloat(csD.n1) || +(csNivAgua - 0.20).toFixed(4);
        const csN2 = parseFloat(csD.n2) || +(csN1 - csAltTecho).toFixed(4);
        const csN3 = parseFloat(csD.n3) || +(csN2 - csAltIng).toFixed(4);
        const csN4 = parseFloat(csD.n4) || +(csN3 - csHrVal).toFixed(4);
        const csN5 = parseFloat(csD.n5) || +(csN4 - csAltUtil).toFixed(4);
        const csOk = csVolCalc >= csVolCist;
    
        let cr = 1;
    
        // TÍTULO "2.1. CISTERNA" 
        c2Fill(cr, CS_BLANC, 36);
        ws2.mergeCells(cr, 2, cr, CS);
        const csTit = ws2.getCell(cr, 2);
        csTit.value = '2.1. CISTERNA';
        csTit.font  = { bold: true, size: 16, name: 'Times New Roman',
                        color: { argb: CS_BLUE } };
        csTit.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_BLANC } };
        csTit.alignment = { horizontal: 'left', vertical: 'bottom' };
        csTit.border = { bottom: c2BBL };
        cr++;
        c2Sep(cr, 14); cr++;
    
        // 2.1.1 barra sección 
        c2Fill(cr, CS_SEC, 26);
        ws2.mergeCells(cr, 2, cr, CS);
        const cs11 = ws2.getCell(cr, 2);
        cs11.value = '2.1.1. CALCULO DE VOLUMEN DE LA CISTERNA';
        cs11.font  = { bold: true, size: 12, name: 'Arial', color: { argb: CS_NEGRO } };
        cs11.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_SEC } };
        cs11.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        cs11.border = { top: c2BT, left: c2BT, bottom: c2BT, right: c2BT };
        cr++;
        c2Sep(cr, 8); cr++;
    
        // Fórmula box 
        c2Fill(cr, CS_FAFAF4, 30);
        ws2.mergeCells(cr, 2, cr, CS);
        const csForm = ws2.getCell(cr, 2);
        csForm.value = 'VOL. DE CISTERNA  =  3/4  ×  CONSUMO DIARIO TOTAL';
        csForm.font  = { bold: true, size: 13, name: 'Arial', italic: true,
                         color: { argb: CS_NEGRO } };
        csForm.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_FAFAF4 } };
        csForm.alignment = { horizontal: 'center', vertical: 'middle' };
        csForm.border = { top: c2BT, left: c2BT, bottom: c2BT, right: c2BT };
        cr++;
        c2Sep(cr, 8); cr++;
    
        // 4 Cards 
        ws2.getRow(cr).height = 58;
        for (let c = 1; c <= CS; c++)
            ws2.getCell(cr, c).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: CS_BLANC } };
        [
            { lbl: 'CONSUMO DIARIO',      val: `${csConsumo.toFixed(2)} Lt`,
              bg: 'FFF8FAFC', vc: 'FF1A4A7A' },
            { lbl: 'VOL. DE CISTERNA',    val: `${csVolCist.toFixed(2)} m³`,
              bg: 'FFEAF0FA', vc: 'FF1A4A7A' },
            { lbl: 'VOL. TOTAL MÍNIMO',   val: `${csVolCist.toFixed(2)} m³`,
              bg: 'FFEAF5EE', vc: 'FF2A6A4A' },
            { lbl: 'ALTURA DE AGUA MÍN.', val: `${csAltAMin.toFixed(2)} m`,
              bg: 'FFFAF0E8', vc: 'FF6A3A1A' },
        ].forEach((card, i) => {
            const cell = ws2.getCell(cr, i + 2);
            cell.value = {
                richText: [
                    { text: card.lbl + '\n',
                      font: { size: 8, color: { argb: 'FF666666' }, name: 'Arial' } },
                    { text: card.val,
                      font: { size: 14, bold: true,
                              color: { argb: card.vc }, name: 'Arial' } },
                ]
            } as ExcelJS.CellRichTextValue;
            cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: card.bg } };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            const bc = { style: 'medium' as ExcelJS.BorderStyle, color: { argb: card.vc } };
            cell.border = { top: bc, left: bc, bottom: bc, right: bc };
        });
        cr++;
        c2Sep(cr, 12); cr++;
    
        // Consumo Diario Total 
        c2Fill(cr, CS_BLANC, 22);
        ws2.mergeCells(cr, 2, cr, 4);
        const csConLbl = ws2.getCell(cr, 2);
        csConLbl.value = 'Consumo Diario Total (Lt/día):';
        csConLbl.font  = { size: 11, name: 'Arial', color: { argb: 'FF555555' } };
        csConLbl.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_BLANC } };
        csConLbl.alignment = { horizontal: 'left', vertical: 'middle' };
        const csConVal = ws2.getCell(cr, 5);
        csConVal.value  = csConsumo;
        csConVal.numFmt = '0';
        csConVal.font   = { size: 12, name: 'Courier New', color: { argb: CS_NEGRO } };
        csConVal.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F2' } };
        csConVal.alignment = { horizontal: 'center', vertical: 'middle' };
        csConVal.border = { top: c2BT, left: c2BT, bottom: c2BT, right: c2BT };
        ws2.mergeCells(cr, 6, cr, CS);
        ws2.getCell(cr, 6).fill = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: CS_BLANC } };
        cr++;
        c2Sep(cr, 8); cr++;
        cr++;
    
        // Texto intro dims 
        c2Wide(cr, 'Cisterna de Concreto de cuyas dimensiones serán:',
            { size: 12, h: 22 }); cr++;
        c2Sep(cr, 8); cr++;
        cr++;
    
        // Inputs 
        const rDimS = cr;
        [
            { lbl: 'Largo (L) =',       v: csLargo   },
            { lbl: 'Ancho (A) =',       v: csAncho   },
            { lbl: 'Altura agua (H) =', v: csAltUtil },
        ].forEach(dim => {
            ws2.getRow(cr).height = 26;
            ws2.getCell(cr, 1).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: CS_BLANC } };
            const lc = ws2.getCell(cr, 2);
            lc.value = dim.lbl;
            lc.font  = { size: 12, name: 'Times New Roman', color: { argb: CS_NEGRO } };
            lc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_BLANC } };
            lc.alignment = { horizontal: 'right', vertical: 'middle' };
            const vc = ws2.getCell(cr, 3);
            vc.value  = dim.v;
            vc.numFmt = '0.00 "m"';
            vc.font   = { size: 14, bold: true, name: 'Courier New', color: { argb: CS_NEGRO } };
            vc.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_BLANC } };
            vc.alignment = { horizontal: 'right', vertical: 'middle' };
            vc.border = { top: c2BLU, left: c2BLU, bottom: c2BLU, right: c2BLU };
            ws2.getCell(cr, 4).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: CS_BLANC } };
            // fondo callout cols 5-CS
            for (let c = 5; c <= CS; c++)
                ws2.getCell(cr, c).fill = { type: 'pattern', pattern: 'solid',
                    fgColor: { argb: CS_F0F4FA } };
            cr++;
        });
        // Callout note merge cols 5-CS
        ws2.mergeCells(rDimS, 5, cr - 1, CS);
        const csNote = ws2.getCell(rDimS, 5);
        csNote.value = 'Altura asumida como mínimo para mantenimiento y limpieza de la cisterna';
        csNote.font  = { bold: true, size: 11, name: 'Arial', color: { argb: 'FF0A2A5A' } };
        csNote.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_F0F4FA } };
        csNote.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        csNote.border = { top: c2BLU, left: c2BLU, bottom: c2BLU, right: c2BLU };
        c2Sep(cr, 8); cr++;
        cr++;
    
        // VOLUMEN box centrado 
        const csVolBg2 = csOk ? CS_OK_BG : CS_WARN;
        c2Fill(cr, csVolBg2, 32);
        ws2.mergeCells(cr, 2, cr, CS);
        const csVolBox = ws2.getCell(cr, 2);
        csVolBox.value = `VOLUMEN DE CISTERNA = ${csVolCalc.toFixed(2)} m³` +
            (csOk ? '' : `   ⚠ CORREGIR (mín. ${csVolCist.toFixed(2)} m³)`);
        csVolBox.font  = { bold: true, size: 14, name: 'Arial',
            color: { argb: csOk ? CS_NEGRO : 'FFCC0000' } };
        csVolBox.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: csVolBg2 } };
        csVolBox.alignment = { horizontal: 'center', vertical: 'middle' };
        csVolBox.border = { top: c2BM, left: c2BM, bottom: c2BM, right: c2BM };
        cr++;
        c2Sep(cr, 18); cr++;
    
        // 2.1.2 barra sección 
        c2Fill(cr, CS_SEC, 26);
        ws2.mergeCells(cr, 2, cr, CS);
        const cs12 = ws2.getCell(cr, 2);
        cs12.value = '2.1.2. DIMENSIONES DE LA CISTERNA';
        cs12.font  = { bold: true, size: 12, name: 'Arial', color: { argb: CS_NEGRO } };
        cs12.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_SEC } };
        cs12.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        cs12.border = { top: c2BT, left: c2BT, bottom: c2BT, right: c2BT };
        cr++;
        c2Sep(cr, 6); cr++;
    
        //  Tabla 2 
        [
            { k: 'ANCHO',
              d: 'Ancho de la Cisterna' },
            { k: 'LARGO',
              d: 'Largo de la Cisterna' },
            { k: 'ALTURA DE AGUA',
              d: 'Altura de agua de la Cisterna' },
            { k: 'ALTURA DE TUB. REBOSE',
              d: 'La distancia vertical entre los ejes del tubo de rebose y el máximo nivel de agua será igual al diámetro de aquel y nunca inferior a 0,10 m' },
            { k: 'ALTURA DE TUB. DE INGRESO',
              d: 'La distancia vertical entre los ejes de tubos de rebose y entrada de agua será igual al doble del diámetro del primero y en ningún caso menor de 0,15 m' },
            { k: 'ALTURA DE NIVEL DE TECHO',
              d: 'La distancia vertical entre el techo del depósito y el eje del tubo de entrada de agua, dependerá del diámetro de este, no pudiendo ser menor de 0,20 m' },
        ].forEach(row => {
            ws2.getRow(cr).height = 34;
            ws2.getCell(cr, 1).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: CS_BLANC } };
            const kc = ws2.getCell(cr, 2);
            kc.value = row.k;
            kc.font  = { bold: true, size: 10, name: 'Arial', color: { argb: CS_NEGRO } };
            kc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_F4F8 } };
            kc.alignment = { horizontal: 'left', vertical: 'middle', indent: 1, wrapText: true };
            kc.border = { top: c2BT, left: c2BT, bottom: c2BT, right: c2BT };
            ws2.mergeCells(cr, 3, cr, CS);
            const dc = ws2.getCell(cr, 3);
            dc.value = row.d;
            dc.font  = { size: 10, name: 'Arial', color: { argb: CS_NEGRO } };
            dc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_BLANC } };
            dc.alignment = { horizontal: 'left', vertical: 'middle', indent: 1, wrapText: true };
            dc.border = { top: c2BT, left: c2BT, bottom: c2BT, right: c2BT };
            cr++;
    
        });
        c2Sep(cr, 12); cr++;
        cr++;
    
        c2Wide(cr, 'Cisterna cuyas dimensiones serán:', { size: 12, h: 22 }); cr++;
        c2Sep(cr, 8); cr++;
    
        // ZONA HÍBRIDA:
        const IMG_W = 820, IMG_H = 560;
        const csImgStart = cr;
        const csImgRows  = 34; 
    
        const P   = 11;
        const pBT = { style: 'thin'   as ExcelJS.BorderStyle, color: { argb: 'FFCCCCCC' } };
        const pBM = { style: 'medium' as ExcelJS.BorderStyle, color: { argb: 'FF90B0CC' } };
    
        function pSectionLabel(r: number, text: string, bg: string, textColor: string) {
            ws2.getRow(r).height = 18;
            ws2.mergeCells(r, P, r, 13);
            const cell = ws2.getCell(r, P);
            cell.value = text;
            cell.font  = { bold: true, size: 8, name: 'Arial', color: { argb: textColor } };
            cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
            cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
            cell.border = { top: pBM, left: pBM, bottom: pBM, right: pBM };
        }
    
        function pKVRow(r: number, label: string, val: string, opts: {
            labelBg?: string; valBg?: string; valColor?: string;
            labelColor?: string; h?: number;
        } = {}) {
            ws2.getRow(r).height = opts.h ?? 16;
            const lb = opts.labelBg ?? 'FFFFFFFF';
            const vb = opts.valBg   ?? 'FFFFFFFF';
            // col 11: label
            const lc = ws2.getCell(r, P);
            lc.value = label;
            lc.font  = { size: 9, name: 'Arial',
                         color: { argb: opts.labelColor ?? 'FF555555' } };
            lc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: lb } };
            lc.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
            lc.border = { top: pBT, left: pBT, bottom: pBT };
            // col 12: valor
            const vc = ws2.getCell(r, 12);
            vc.value = val;
            vc.font  = { size: 10, bold: true, name: 'Courier New',
                         color: { argb: opts.valColor ?? 'FF1A4A7A' } };
            vc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: vb } };
            vc.alignment = { horizontal: 'right', vertical: 'middle' };
            vc.border = { top: pBT, bottom: pBT };
            
            const uc = ws2.getCell(r, 13);
            uc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: lb } };
            uc.border = { top: pBT, right: pBT, bottom: pBT };
        }
    
        function pInputRow(r: number, label: string, val: number, highlight: boolean) {
            ws2.getRow(r).height = 20;
            const bg = highlight ? 'FFFFFBE6' : 'FFFFFFFF';
            const bc = highlight
                ? { style: 'medium' as ExcelJS.BorderStyle, color: { argb: 'FFD4A020' } }
                : { style: 'thin'   as ExcelJS.BorderStyle, color: { argb: 'FFD0D0D0' } };
            // col 11: label
            const lc = ws2.getCell(r, P);
            lc.value = label;
            lc.font  = { size: 10, name: 'Arial', bold: highlight, color: { argb: 'FF222222' } };
            lc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
            lc.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
            lc.border = { top: bc, left: bc, bottom: bc };
           
            const vc = ws2.getCell(r, 12);
            vc.value  = val;
            vc.numFmt = '0.00';
            vc.font   = { size: 12, bold: true, name: 'Courier New',
                          color: { argb: 'FF000000' } };
            vc.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
            vc.alignment = { horizontal: 'right', vertical: 'middle' };
            vc.border = { top: bc, bottom: bc };
            // col 13: unidad m
            const uc = ws2.getCell(r, 13);
            uc.value = 'm';
            uc.font  = { size: 9, name: 'Arial', color: { argb: 'FF666666' } };
            uc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
            uc.alignment = { horizontal: 'left', vertical: 'middle' };
            uc.border = { top: bc, right: bc, bottom: bc };
        }
    
        // Preparar todas las filas de la zona híbrida 
        for (let i = 0; i < csImgRows; i++) {
            const r = cr + i;
            ws2.getRow(r).height = 16.5;
            ws2.getCell(r, 1).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: CS_BLANC } };
    
            for (let c = 2; c <= 9; c++)
                ws2.getCell(r, c).fill = { type: 'pattern', pattern: 'solid',
                    fgColor: { argb: CS_BLANC } }
    
            ws2.getCell(r, 10).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: CS_BLANC } };
           
            for (let c = 11; c <= 13; c++)
                ws2.getCell(r, c).fill = { type: 'pattern', pattern: 'solid',
                    fgColor: { argb: CS_F4F8 } };
        }
    
        //  Insertar imagen diagrama 
        try {
            const svgStr = buildCisternaSVG(csD);
            const pngB64 = await svgToPngBase64(svgStr, IMG_W, IMG_H);
            const imgId  = workbook.addImage({ base64: pngB64, extension: 'png' });
            ws2.addImage(imgId, {
                tl:  { nativeCol: 1, nativeRow: csImgStart - 1 },
                ext: { width: IMG_W, height: IMG_H },
                editAs: 'oneCell',
            } as any);
        } catch (e) {
            console.warn('SVG cisterna error:', e);
        }
    
        // Panel derecho
        let pr = csImgStart;
    
        // Header Predimensionamiento
        ws2.getRow(pr).height = 24;
        ws2.mergeCells(pr, P, pr, 13);
        const pHdr = ws2.getCell(pr, P);
        pHdr.value = '📐  Predimensionamiento';
        pHdr.font  = { bold: true, size: 11, name: 'Arial', color: { argb: 'FF0A2A4A' } };
        pHdr.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_F4F8 } };
        pHdr.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        pHdr.border = { bottom: pBM };
        pr++;
    
        // Caja Volumen OK
        const okArgb   = csOk ? 'FFE8F5E8' : 'FFFEEAEA';
        const okTxtArg = csOk ? 'FF2A6A2A' : 'FFCC0000';
        const okBordA  = csOk ? 'FF4A8A4A' : 'FFCC4444';
        const okBord2  = { style: 'medium' as ExcelJS.BorderStyle, color: { argb: okBordA } };
    
        ws2.getRow(pr).height = 20;
        ws2.mergeCells(pr, P, pr, 13);
        const okTit = ws2.getCell(pr, P);
        okTit.value = csOk ? '✓  Volumen OK' : '✗  Revisar volumen';
        okTit.font  = { bold: true, size: 11, name: 'Arial', color: { argb: okTxtArg } };
        okTit.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: okArgb } };
        okTit.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        okTit.border = { top: okBord2, left: okBord2, right: okBord2 };
        pr++;
    
        [
            { lbl: 'Requerido:', val: `${csVolCist.toFixed(2)} m³` },
            { lbl: 'Calculado:', val: `${csVolCalc.toFixed(2)} m³` },
            { lbl: 'Área base:', val: `${csArea.toFixed(2)} m²`    },
            { lbl: 'H. total:',  val: `${csAltTot.toFixed(2)} m`   },
        ].forEach((kv, ki) => {
            ws2.getRow(pr).height = 15;
            const lc = ws2.getCell(pr, P);
            lc.value = kv.lbl;
            lc.font  = { size: 9, name: 'Arial', color: { argb: 'FF555555' } };
            lc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: okArgb } };
            lc.alignment = { horizontal: 'left', vertical: 'middle', indent: 2 };
            lc.border = { left: okBord2, ...(ki === 3 ? { bottom: okBord2 } : {}) };
            ws2.mergeCells(pr, 12, pr, 13);
            const vc = ws2.getCell(pr, 12);
            vc.value = kv.val;
            vc.font  = { size: 9, bold: true, name: 'Courier New', color: { argb: 'FF333333' } };
            vc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: okArgb } };
            vc.alignment = { horizontal: 'right', vertical: 'middle' };
            vc.border = { right: okBord2, ...(ki === 3 ? { bottom: okBord2 } : {}) };
            pr++;
        });
    
        // gap
        ws2.getRow(pr).height = 6;
        for (let c = P; c <= 13; c++)
            ws2.getCell(pr, c).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: CS_F4F8 } };
        pr++;
    
        // NIVELES CALCULADOS
        pSectionLabel(pr, 'NIVELES CALCULADOS', CS_F4F8, 'FF2A5A8A'); pr++;
        [
            { lbl: 'Nivel Top slab:', val: csN1, red: false },
            { lbl: 'Nivel Techo:',    val: csN2, red: false },
            { lbl: 'Nivel Ingreso:',  val: csN3, red: false },
            { lbl: 'Nivel Rebose:',   val: csN4, red: true  },
            { lbl: 'Nivel Fondo:',    val: csN5, red: false },
        ].forEach(row => {
            const bg = row.red ? 'FFFFF0F0' : 'FFFFFFFF';
            pKVRow(pr, row.lbl,
                `${row.val >= 0 ? '+' : ''}${row.val.toFixed(2)} m`,
                { labelBg: bg, valBg: bg,
                  valColor:   row.red ? 'FFCC0000' : 'FF1A4A7A',
                  labelColor: row.red ? 'FFCC0000' : 'FF555555' });
            pr++;
        });
    
        // gap
        ws2.getRow(pr).height = 6;
        for (let c = P; c <= 13; c++)
            ws2.getCell(pr, c).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: CS_F4F8 } };
        pr++;
    
        // GEOMETRÍA PRINCIPAL
        pSectionLabel(pr, '★  GEOMETRÍA PRINCIPAL', CS_F4F8, 'FF1A4A7A'); pr++;
        pInputRow(pr, 'Largo (L)',        csLargo,    true);  pr++;
        pInputRow(pr, 'Ancho (A)',        csAncho,    true);  pr++;
        pInputRow(pr, 'Altura Útil (H)', csAltUtil,  true);  pr++;
        pInputRow(pr, 'Borde Libre (bl)', csBL,       false); pr++;
    
        // gap
        ws2.getRow(pr).height = 6;
        for (let c = P; c <= 13; c++)
            ws2.getCell(pr, c).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: CS_F4F8 } };
        pr++;
    
        // NIVEL Y TECHO
        pSectionLabel(pr, 'NIVEL Y TECHO', CS_F4F8, 'FF1A4A7A'); pr++;
        pInputRow(pr, 'Nivel agua (m)', csNivAgua,  false); pr++;
        pInputRow(pr, 'H. Techo (Ht)',  csAltTecho, false); pr++;
    
        // Rellenar filas restantes del panel con fondo
        while (pr < csImgStart + csImgRows) {
            ws2.getRow(pr).height = 16.5;
            for (let c = P; c <= 13; c++)
                ws2.getCell(pr, c).fill = { type: 'pattern', pattern: 'solid',
                    fgColor: { argb: CS_F4F8 } };
            pr++;
        }
    
        cr = csImgStart + csImgRows;
        c2Sep(cr, 16); cr++;
    
        // RESUMEN FINAL 
        c2Wide(cr, 'Cisterna de Concreto de cuyas dimensiones serán:',
            { size: 12, h: 22 }); cr++;
        c2Sep(cr, 8); cr++;
    
        [
            { lbl: 'Largo (L) =',               v: csLargo   },
            { lbl: 'Ancho (A) =',               v: csAncho   },
            { lbl: 'Altura Útil de Agua (H) =', v: csAltUtil },
            { lbl: 'Borde Libre (bl) =',        v: csBL      },
            { lbl: 'Altura total (HT) =',       v: csAltTot  },
        ].forEach((row, idx) => {
            ws2.getRow(cr).height = 22;
            ws2.getCell(cr, 1).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: CS_BLANC } };
            ws2.mergeCells(cr, 2, cr, 4);
            const sl = ws2.getCell(cr, 2);
            sl.value = row.lbl;
            sl.font  = { size: 12, name: 'Times New Roman', color: { argb: CS_NEGRO } };
            sl.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_BLANC } };
            sl.alignment = { horizontal: 'right', vertical: 'middle' };
            const sv = ws2.getCell(cr, 5);
            sv.value = `${row.v.toFixed(2)} m`;
            sv.font  = { size: 13, bold: true, name: 'Courier New', color: { argb: CS_NEGRO } };
            sv.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_BLANC } };
            sv.alignment = { horizontal: 'left', vertical: 'middle' };
            ws2.mergeCells(cr, 6, cr, CS);
            const sn = ws2.getCell(cr, 6);
            sn.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_BLANC } };
            if (idx === 1) {
                sn.value = 'Diametro de rebose según el RNE es de 4"';
                sn.font  = { size: 11, name: 'Arial', color: { argb: 'FF444444' } };
                sn.alignment = { horizontal: 'left', vertical: 'middle', indent: 2 };
            }
            cr++;
        });
        c2Sep(cr, 16); cr++;
        
}