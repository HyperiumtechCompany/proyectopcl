/**
 * Exportación a Excel del módulo eléctrico (Fase 7 del plan).
 * Genera un libro con hojas: Proyecto, Ambientes, Luminarias, Tomacorrientes,
 * Circuitos, Tableros, Alimentadores, Cuadro de Cargas, Metrados y Datos DIALux.
 * Client-side con exceljs + file-saver (mismo patrón que caida-tension-export).
 */

import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import type { ElectricalCatalogs, ElectricalDerived, ElectricalDocument } from '../engine/types';

const CLR = {
    headerBg: 'FF1F2937',
    headerFg: 'FFFFFFFF',
    subHeaderBg: 'FFDCE6F1',
    ok: 'FFC6EFCE',
    warn: 'FFFFEB9C',
    bad: 'FFFFC7CE',
    zebra: 'FFF7F7F7',
};

function thin(): ExcelJS.Border {
    return { style: 'thin', color: { argb: 'FFB0B0B0' } };
}

function styleHeaderRow(row: ExcelJS.Row): void {
    row.eachCell((cell) => {
        cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: CLR.headerFg } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CLR.headerBg } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = { top: thin(), bottom: thin(), left: thin(), right: thin() };
    });
    row.height = 26;
}

function styleDataRow(row: ExcelJS.Row, zebra: boolean): void {
    row.eachCell((cell) => {
        cell.font = { name: 'Arial', size: 9 };
        cell.alignment = { vertical: 'middle' };
        cell.border = { top: thin(), bottom: thin(), left: thin(), right: thin() };
        if (zebra) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CLR.zebra } };
        }
    });
}

function statusFill(cell: ExcelJS.Cell, status: string): void {
    const map: Record<string, string> = {
        cumple: CLR.ok,
        ok: CLR.ok,
        advertencia: CLR.warn,
        exceso: CLR.warn,
        no_cumple: CLR.bad,
        error: CLR.bad,
    };
    const color = map[status];
    if (color) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
    }
}

interface SheetSpec {
    name: string;
    columns: { header: string; key: string; width: number; numFmt?: string }[];
    rows: Record<string, unknown>[];
    /** columna (key) cuyo valor de estado colorea la celda. */
    statusKey?: string;
}

function addTableSheet(wb: ExcelJS.Workbook, spec: SheetSpec): ExcelJS.Worksheet {
    const ws = wb.addWorksheet(spec.name, { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = spec.columns.map((c) => ({ key: c.key, width: c.width }));

    const headerRow = ws.addRow(spec.columns.map((c) => c.header));
    styleHeaderRow(headerRow);

    spec.rows.forEach((rowData, i) => {
        const row = ws.addRow(spec.columns.map((c) => rowData[c.key] ?? ''));
        styleDataRow(row, i % 2 === 1);
        spec.columns.forEach((c, colIdx) => {
            if (c.numFmt) {
                row.getCell(colIdx + 1).numFmt = c.numFmt;
            }
        });
        if (spec.statusKey) {
            const statusColIdx = spec.columns.findIndex((c) => c.key === spec.statusKey);
            if (statusColIdx >= 0) {
                statusFill(row.getCell(statusColIdx + 1), String(rowData[spec.statusKey] ?? ''));
            }
        }
    });

    if (spec.rows.length > 0) {
        ws.autoFilter = {
            from: { row: 1, column: 1 },
            to: { row: 1, column: spec.columns.length },
        };
    }

    return ws;
}

interface ExportArgs {
    projectName: string;
    doc: ElectricalDocument;
    derived: ElectricalDerived;
    catalogs: ElectricalCatalogs;
}

export async function exportElectricalExcel({ projectName, doc, derived, catalogs }: ExportArgs): Promise<void> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Módulo Eléctrico DIALux';
    wb.created = new Date();

    const floorName = (floorId: string | null | undefined) => doc.floors.find((f) => f.id === floorId)?.name ?? '—';
    const roomById = new Map(doc.rooms.map((r) => [r.id, r]));
    const typeById = new Map(doc.luminaireTypes.map((t) => [t.id, t]));
    const panelById = new Map(doc.panels.map((p) => [p.id, p]));
    const circuitById = new Map(doc.circuits.map((c) => [c.id, c]));

    // ─── Hoja 1: Proyecto ────────────────────────────────────────────────────
    const wsInfo = wb.addWorksheet('Proyecto');
    wsInfo.columns = [{ width: 32 }, { width: 48 }];
    const infoRows: [string, string | number][] = [
        ['Proyecto', projectName],
        ['Norma de referencia eléctrica', doc.settings.referenceStandard],
        ['Norma de iluminación', 'EM.010 RNE Perú'],
        ['Tensión (V)', doc.settings.voltageV],
        ['Sistema', doc.settings.phases === 3 ? 'Trifásico' : 'Monofásico'],
        ['Frecuencia (Hz)', doc.settings.frequencyHz],
        ['Factor de potencia', doc.settings.powerFactor],
        ['Factor de reserva de cable', doc.settings.cableReserveFactor],
        ['Fecha de generación', new Date().toLocaleString('es-PE')],
        ['Versión del documento', doc.version],
        ['', ''],
        ['Ambientes', derived.totals.rooms],
        ['Luminarias', derived.totals.luminaires],
        ['Tomacorrientes', derived.totals.outlets],
        ['Tableros', derived.totals.panels],
        ['Potencia instalada (kW)', Number((derived.totals.installedPowerW / 1000).toFixed(2))],
        ['Potencia demandada (kW)', Number((derived.totals.demandPowerW / 1000).toFixed(2))],
        ['Cable total (m)', Number(derived.totals.cableTotalM.toFixed(1))],
    ];
    infoRows.forEach(([label, value], i) => {
        const row = wsInfo.addRow([label, value]);
        row.getCell(1).font = { name: 'Arial', size: 9, bold: true };
        row.getCell(2).font = { name: 'Arial', size: 9 };
        if (i === 0) {
            row.getCell(2).font = { name: 'Arial', size: 11, bold: true };
        }
    });

    // ─── Hoja 2: Ambientes ───────────────────────────────────────────────────
    addTableSheet(wb, {
        name: 'Ambientes',
        columns: [
            { header: 'Piso', key: 'floor', width: 14 },
            { header: 'Ambiente', key: 'name', width: 24 },
            { header: 'Tipo', key: 'type', width: 16 },
            { header: 'Largo (m)', key: 'length', width: 10, numFmt: '0.00' },
            { header: 'Ancho (m)', key: 'width', width: 10, numFmt: '0.00' },
            { header: 'Alto (m)', key: 'height', width: 9, numFmt: '0.00' },
            { header: 'Área (m²)', key: 'area', width: 10, numFmt: '0.00' },
            { header: 'Perímetro (m)', key: 'perimeter', width: 12, numFmt: '0.00' },
            { header: 'Lux requerido', key: 'lux', width: 12, numFmt: '0' },
            { header: 'CU', key: 'cu', width: 7, numFmt: '0.00' },
            { header: 'FM', key: 'fm', width: 7, numFmt: '0.00' },
            { header: 'Normativa (EM.010)', key: 'normative', width: 46 },
            { header: 'Observaciones', key: 'obs', width: 28 },
        ],
        rows: doc.rooms.map((r) => {
            const geo = derived.roomGeometry[r.id];
            return {
                floor: floorName(r.floorId),
                name: r.name,
                type: r.roomType,
                length: r.lengthM,
                width: r.widthM,
                height: r.heightM,
                area: geo?.areaM2 ?? 0,
                perimeter: geo?.perimeterM ?? 0,
                lux: r.requiredLux,
                cu: r.utilizationFactor,
                fm: r.maintenanceFactor,
                // Antes solo incluía Em_lux — UGRL/Uo/Ra quedaban guardados en
                // `room.normative` pero nunca llegaban a la memoria de cálculo
                // exportada, la única referencia normativa citable del documento.
                normative: r.normative
                    ? `${r.normative.category} — ${r.normative.areaName} (Em ${r.normative.emLux ?? '—'} lx` +
                      `${r.normative.ugrl != null ? `, UGR≤${r.normative.ugrl}` : ''}` +
                      `${r.normative.uo != null ? `, Uo≥${r.normative.uo}` : ''}` +
                      `${r.normative.ra != null ? `, Ra≥${r.normative.ra}` : ''})`
                    : '',
                obs: r.observations ?? '',
            };
        }),
    });

    // ─── Hoja 3: Cálculo de luminarias ───────────────────────────────────────
    addTableSheet(wb, {
        name: 'Luminarias',
        columns: [
            { header: 'Ambiente', key: 'room', width: 22 },
            { header: 'Luminaria', key: 'lum', width: 24 },
            { header: 'Potencia (W)', key: 'power', width: 11, numFmt: '0' },
            { header: 'Flujo (lm)', key: 'lumens', width: 11, numFmt: '0' },
            { header: 'Cant. mínima', key: 'minQty', width: 11, numFmt: '0' },
            { header: 'Cant. seleccionada', key: 'qty', width: 14, numFmt: '0' },
            { header: 'Filas', key: 'rows', width: 7, numFmt: '0' },
            { header: 'Columnas', key: 'cols', width: 9, numFmt: '0' },
            { header: 'Lux estimado', key: 'estLux', width: 12, numFmt: '0.0' },
            { header: 'Lux requerido', key: 'reqLux', width: 12, numFmt: '0' },
            { header: '% cumplimiento', key: 'pct', width: 13, numFmt: '0.0' },
            { header: 'Potencia total (W)', key: 'totalPower', width: 14, numFmt: '0' },
            { header: 'Estado', key: 'status', width: 12 },
            { header: 'Lux DIALux', key: 'dialuxLux', width: 11, numFmt: '0.0' },
            { header: 'Δ vs DIALux (%)', key: 'delta', width: 13, numFmt: '0.0' },
        ],
        statusKey: 'status',
        rows: derived.roomLuminaires.map((res) => {
            const rl = doc.roomLuminaires.find((x) => x.id === res.roomLuminaireId);
            const type = typeById.get(res.luminaireTypeId);
            const verified = rl?.dialuxVerifiedLux ?? null;
            return {
                room: roomById.get(res.roomId)?.name ?? '—',
                lum: type ? `${type.code}${type.brand ? ` ${type.brand}` : ''}${type.model ? ` ${type.model}` : ''}` : '—',
                power: type?.powerW ?? 0,
                lumens: type?.lumens ?? 0,
                minQty: res.minQty,
                qty: res.selectedQty,
                rows: res.suggestedRows,
                cols: res.suggestedCols,
                estLux: res.estimatedLux,
                reqLux: res.requiredLux,
                pct: res.compliancePct,
                totalPower: res.totalPowerW,
                status: res.status,
                dialuxLux: verified ?? '',
                delta: verified != null && res.estimatedLux > 0 ? ((verified - res.estimatedLux) / res.estimatedLux) * 100 : '',
            };
        }),
    });

    // ─── Hoja 4: Tomacorrientes ──────────────────────────────────────────────
    addTableSheet(wb, {
        name: 'Tomacorrientes',
        columns: [
            { header: 'Ambiente', key: 'room', width: 22 },
            { header: 'Tipo', key: 'type', width: 22 },
            { header: 'Regla aplicada', key: 'rule', width: 22 },
            { header: 'Cant. automática', key: 'auto', width: 13, numFmt: '0' },
            { header: 'Cant. final', key: 'qty', width: 10, numFmt: '0' },
            { header: 'Altura (m)', key: 'height', width: 10 },
            { header: 'Muro / zona', key: 'wall', width: 16 },
            { header: 'VA total', key: 'va', width: 10, numFmt: '0' },
            { header: 'Especial', key: 'special', width: 9 },
            { header: 'Circuito', key: 'circuit', width: 10 },
        ],
        rows: derived.roomOutlets.map((res) => {
            const group = doc.roomOutlets.find((g) => g.id === res.roomOutletId);
            return {
                room: roomById.get(res.roomId)?.name ?? '—',
                type: catalogs.outletTypes.find((t) => t.code === res.outletTypeCode)?.name ?? res.outletTypeCode,
                rule: res.ruleApplied,
                auto: res.autoQty,
                qty: res.finalQty,
                height: res.heightM ?? 'Según proyecto',
                wall: group?.wallOrZone ?? '',
                va: res.totalPowerVA,
                special: group?.isSpecial ? 'Sí' : 'No',
                circuit: group?.circuitId ? (circuitById.get(group.circuitId)?.code ?? '—') : '—',
            };
        }),
    });

    // ─── Hoja 5: Circuitos ───────────────────────────────────────────────────
    addTableSheet(wb, {
        name: 'Circuitos',
        columns: [
            { header: 'Código', key: 'code', width: 9 },
            { header: 'Tipo', key: 'type', width: 14 },
            { header: 'Tablero', key: 'panel', width: 10 },
            { header: 'Longitud (m)', key: 'length', width: 11, numFmt: '0.0' },
            { header: 'Luminarias', key: 'lums', width: 10, numFmt: '0' },
            { header: 'Tomacorrientes', key: 'outs', width: 13, numFmt: '0' },
            { header: 'Potencia (W)', key: 'power', width: 11, numFmt: '0' },
            { header: 'F. demanda', key: 'fd', width: 10, numFmt: '0.00' },
            { header: 'P. demandada (W)', key: 'demand', width: 14, numFmt: '0' },
            { header: 'Corriente (A)', key: 'current', width: 11, numFmt: '0.00' },
            { header: 'I diseño (A)', key: 'design', width: 11, numFmt: '0.00' },
            { header: 'Conductor', key: 'conductor', width: 26 },
            { header: 'ITM (A)', key: 'breaker', width: 8, numFmt: '0' },
            { header: 'ΔV (%)', key: 'vd', width: 8, numFmt: '0.00' },
            { header: 'ΔV máx (%)', key: 'vdMax', width: 10, numFmt: '0.00' },
            { header: 'Estado', key: 'status', width: 12 },
            { header: 'Observaciones', key: 'warnings', width: 40 },
        ],
        statusKey: 'status',
        rows: derived.circuits.map((res) => ({
            code: res.code,
            type: res.type === 'lighting' ? 'Alumbrado' : res.type === 'outlets' ? 'Tomacorrientes' : 'Especial',
            panel: panelById.get(res.panelId)?.code ?? '—',
            length: circuitById.get(res.circuitId)?.lengthM ?? 0,
            lums: res.connectedLuminaires,
            outs: res.connectedOutlets,
            power: res.totalPowerW,
            fd: res.demandFactor,
            demand: res.demandPowerW,
            current: res.currentA,
            design: res.designCurrentA,
            conductor: res.conductorLabel,
            breaker: res.breakerA,
            vd: res.voltageDropPct,
            vdMax: res.maxVoltageDropPct,
            status: res.status,
            warnings: res.warnings.join(' | '),
        })),
    });

    // ─── Hoja 6: Tableros (cuadro de cargas) ─────────────────────────────────
    addTableSheet(wb, {
        name: 'Tableros',
        columns: [
            { header: 'Código', key: 'code', width: 9 },
            { header: 'Nombre', key: 'name', width: 22 },
            { header: 'Piso', key: 'floor', width: 12 },
            { header: 'Alimentado por', key: 'parent', width: 13 },
            { header: 'Circuitos', key: 'circuits', width: 9, numFmt: '0' },
            { header: 'P. instalada (kW)', key: 'installed', width: 14, numFmt: '0.00' },
            { header: 'P. demandada (kW)', key: 'demand', width: 15, numFmt: '0.00' },
            { header: 'Corriente (A)', key: 'current', width: 11, numFmt: '0.00' },
            { header: 'Reserva (%)', key: 'reserve', width: 10, numFmt: '0' },
            { header: 'ITM principal (A)', key: 'breaker', width: 14, numFmt: '0' },
            { header: 'Ubicación', key: 'location', width: 20 },
            { header: 'Observaciones', key: 'warnings', width: 36 },
        ],
        rows: derived.panels.map((res) => {
            const panel = panelById.get(res.panelId);
            return {
                code: res.code,
                name: panel?.name ?? '—',
                floor: floorName(panel?.floorId),
                parent: panel?.parentPanelId ? (panelById.get(panel.parentPanelId)?.code ?? '—') : 'Red / Medidor',
                circuits: res.circuitCount,
                installed: res.installedPowerW / 1000,
                demand: res.demandPowerW / 1000,
                current: res.currentA,
                reserve: panel?.reservePct ?? 0,
                breaker: res.mainBreakerA,
                location: panel?.location ?? '',
                warnings: res.warnings.join(' | '),
            };
        }),
    });

    // ─── Hoja 7: Alimentadores ───────────────────────────────────────────────
    addTableSheet(wb, {
        name: 'Alimentadores',
        columns: [
            { header: 'Desde', key: 'from', width: 10 },
            { header: 'Hacia', key: 'to', width: 10 },
            { header: 'Longitud (m)', key: 'length', width: 11, numFmt: '0.0' },
            { header: 'P. demandada (kW)', key: 'demand', width: 15, numFmt: '0.00' },
            { header: 'Corriente (A)', key: 'current', width: 11, numFmt: '0.00' },
            { header: 'I diseño (A)', key: 'design', width: 11, numFmt: '0.00' },
            { header: 'Conductor', key: 'conductor', width: 26 },
            { header: 'ITM (A)', key: 'breaker', width: 8, numFmt: '0' },
            { header: 'ΔV (%)', key: 'vd', width: 8, numFmt: '0.00' },
            { header: 'Estado', key: 'status', width: 12 },
            { header: 'Observaciones', key: 'warnings', width: 40 },
        ],
        statusKey: 'status',
        rows: derived.feeders.map((res) => {
            const feeder = doc.feeders.find((f) => f.id === res.feederId);
            return {
                from: res.fromPanelCode,
                to: res.toPanelCode,
                length: feeder?.lengthM ?? 0,
                demand: res.demandPowerW / 1000,
                current: res.currentA,
                design: res.designCurrentA,
                conductor: res.conductorLabel,
                breaker: res.breakerA,
                vd: res.voltageDropPct,
                status: res.status,
                warnings: res.warnings.join(' | '),
            };
        }),
    });

    // ─── Hoja 8: Metrados ────────────────────────────────────────────────────
    const wsTakeoff = addTableSheet(wb, {
        name: 'Metrados',
        columns: [
            { header: 'Categoría', key: 'category', width: 16 },
            { header: 'Descripción', key: 'description', width: 44 },
            { header: 'Unidad', key: 'unit', width: 8 },
            { header: 'Cantidad', key: 'quantity', width: 11, numFmt: '0.00' },
            { header: 'Precio unit. (S/)', key: 'unitPrice', width: 13, numFmt: '0.00' },
            { header: 'Subtotal (S/)', key: 'subtotal', width: 12, numFmt: '0.00' },
        ],
        rows: derived.takeoff.map((item) => ({
            category: item.category,
            description: item.description,
            unit: item.unit,
            quantity: item.quantity,
            unitPrice: item.unitPrice ?? '',
            subtotal: item.subtotal ?? '',
        })),
    });
    if (derived.takeoff.length > 0) {
        const totalRow = wsTakeoff.addRow(['', 'TOTAL PRESUPUESTO REFERENCIAL', '', '', '', derived.totals.takeoffTotal ?? '']);
        totalRow.eachCell((cell) => {
            cell.font = { name: 'Arial', size: 9, bold: true };
            cell.border = { top: { style: 'double', color: { argb: 'FF000000' } } };
        });
        totalRow.getCell(6).numFmt = '0.00';
    }

    // ─── Hoja 9: Datos para DIALux (Fase 8) ──────────────────────────────────
    addTableSheet(wb, {
        name: 'Datos DIALux',
        columns: [
            { header: 'Ambiente', key: 'room', width: 22 },
            { header: 'Largo (m)', key: 'length', width: 10, numFmt: '0.00' },
            { header: 'Ancho (m)', key: 'width', width: 10, numFmt: '0.00' },
            { header: 'Alto (m)', key: 'height', width: 9, numFmt: '0.00' },
            { header: 'Área (m²)', key: 'area', width: 10, numFmt: '0.00' },
            { header: 'Iluminancia requerida (lx)', key: 'reqLux', width: 20, numFmt: '0' },
            { header: 'Luminaria', key: 'lum', width: 24 },
            { header: 'Flujo (lm)', key: 'lumens', width: 10, numFmt: '0' },
            { header: 'Potencia (W)', key: 'power', width: 11, numFmt: '0' },
            { header: 'Cantidad', key: 'qty', width: 9, numFmt: '0' },
            { header: 'Filas', key: 'rows', width: 7, numFmt: '0' },
            { header: 'Columnas', key: 'cols', width: 9, numFmt: '0' },
            { header: 'Altura montaje (m)', key: 'mount', width: 15, numFmt: '0.00' },
            { header: 'Factor mantenimiento', key: 'fm', width: 17, numFmt: '0.00' },
            { header: 'Lux estimado (app)', key: 'estLux', width: 15, numFmt: '0.0' },
            { header: 'Lux validado (DIALux)', key: 'dialuxLux', width: 17, numFmt: '0.0' },
            { header: 'Diferencia (%)', key: 'delta', width: 12, numFmt: '0.0' },
        ],
        rows: derived.roomLuminaires.map((res) => {
            const rl = doc.roomLuminaires.find((x) => x.id === res.roomLuminaireId);
            const room = roomById.get(res.roomId);
            const type = typeById.get(res.luminaireTypeId);
            const geo = derived.roomGeometry[res.roomId];
            const verified = rl?.dialuxVerifiedLux ?? null;
            return {
                room: room?.name ?? '—',
                length: room?.lengthM ?? 0,
                width: room?.widthM ?? 0,
                height: room?.heightM ?? 0,
                area: geo?.areaM2 ?? 0,
                reqLux: res.requiredLux,
                lum: type ? `${type.code}${type.brand ? ` ${type.brand}` : ''}` : '—',
                lumens: type?.lumens ?? 0,
                power: type?.powerW ?? 0,
                qty: res.selectedQty,
                rows: res.suggestedRows,
                cols: res.suggestedCols,
                mount: type?.mountingHeightM ?? '',
                fm: room?.maintenanceFactor ?? 0,
                estLux: res.estimatedLux,
                dialuxLux: verified ?? '',
                delta: verified != null && res.estimatedLux > 0 ? ((verified - res.estimatedLux) / res.estimatedLux) * 100 : '',
            };
        }),
    });

    const buffer = await wb.xlsx.writeBuffer();
    const safeName = projectName.replace(/[^\w\sáéíóúñÁÉÍÓÚÑ-]/gi, '').trim() || 'proyecto';
    saveAs(
        new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        `Calculo_Electrico_${safeName}_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
}
