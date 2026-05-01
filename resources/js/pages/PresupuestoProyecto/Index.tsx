import React, { useCallback, useRef, useState, useEffect } from "react";
import { router, usePage } from "@inertiajs/react";
import { AlertCircle, CheckCircle2, Loader2, Save, X } from "lucide-react";
import Luckysheet from '@/components/costos/tablas/Luckysheet';
import { cn } from '@/lib/utils';
import Decimal from 'decimal.js';

const MONTHS = [
  "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
  "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"
];

export default function Index() {
  const { project } = usePage().props as any;
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingChanges = useRef<any[]>([]);

  const progCount = useRef(0);

  // Estados para el modal
  const [showConfigModal, setShowConfigModal] = useState(true);
  const [projectName, setProjectName] = useState(project?.name || '');
  const [startMonth, setStartMonth] = useState<number>(0); // 0 = ENERO
  const [endMonth, setEndMonth] = useState<number>(5); // 5 = JUNIO (por defecto 6 meses)

  const colToLetter = (col: number): string => {
    let letter = '';
    while (col >= 0) {
      letter = String.fromCharCode((col % 26) + 65) + letter;
      col = Math.floor(col / 26) - 1;
    }
    return letter;
  };

  function useLuckysheet() {
    const ls = () => (window as any).luckysheet;

    const getActive = () => {
      const sheets = ls()?.getAllSheets?.() ?? [];
      return sheets.find((s: any) => s.status === 1) ?? sheets[0];
    };

    const setCells = (updates: any[], order: number) => {
      const inst = ls();
      if (!inst || !updates.length) return;

      updates.forEach((u, i) => {
        inst.setCellValue(u.r, u.c, u.v, {
          order,
          isRefresh: i === updates.length - 1,
        });
      });
    };

    return { ls, getActive, setCells };
  }

  // Generar array de meses basado en el rango seleccionado
  const generateMonthsArray = () => {
    const months = [];
    for (let i = startMonth; i <= endMonth; i++) {
      months.push(MONTHS[i]);
    }
    return months;
  };

  const handleGenerateSheet = () => {
    if (!projectName.trim()) {
      alert('Por favor ingrese el nombre del proyecto');
      return;
    }
    setShowConfigModal(false);
  };


  const generatePresupuestoBase = () => {
    const projectName = project?.name || 'CHINCHAVITO';
    const months = ["DICIEMBRE", "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO"];
    const INCOME_OFFSET = 15;

    const cells: any[] = [];
    const merge: any = {};
    let row = 0;

    // HEADER PRINCIPAL
    cells.push({
      r: row, c: 0,
      v: { v: `PROYECTO ${projectName}`, bl: 1, fc: "#ffffff", bg: "#F39C12", fs: 14, ht: 30 },
      ct: { fa: "General", t: "s" }
    });
    merge[`0_0`] = { r: 0, c: 0, rs: 1, cs: 5 + months.length };
    row++;

    // HEADERS DE COLUMNAS
    const headers = ["", "", "RESP.", "PRESUP.", "EJECUTADO", ...months];
    headers.forEach((h, c) => {
      cells.push({
        r: row, c,
        v: { v: h, bl: 1, bg: "#D9D9D9", fs: 9, ht: 25, tb: 2 },
        ct: { fa: "General", t: "s" }
      });
    });
    merge[`${row}_0`] = { r: row, c: 0, rs: 1, cs: 2 };
    row++;

    // ==========================================
    // INSUMOS
    // ==========================================
    const insumosData = [
      { desc: "IMPRESIONES", meses: [120, 0, 0, 0, 0, 0] },
      { desc: "FIRMA - ING CIVIL", meses: [20, 0, 0, 0, 0, 0] },
      { desc: "FIRMA - ARQUITECTO", meses: [50, 0, 0, 0, 0, 0] },
      { desc: "IGV", meses: [10, 0, 0, 0, 0, 0] },
    ];

    const insumosStartRow = row + 1; 
    const insumosEndRow = insumosStartRow + insumosData.length - 1;
    const insumosHeaderRow = row;

    // Header INSUMOS
    cells.push({ 
      r: insumosHeaderRow, c: 0, 
      v: { v: "INSUMOS", bl: 1, bg: "#E6B8C7", fs: 10 }, 
      ct: { fa: "General", t: "s" }
    });

    // Formula para EJECUTADO (Columna E)
    cells.push({
      r: insumosHeaderRow, c: 4,
      v: {
        f: `=SUM(E${insumosStartRow + 1}:E${insumosEndRow + 1})`
      },
      ct: { fa: "S/ #,##0.00;[Red]-S/ #,##0.00", t: "n" },
      st: 1
    });

    // Formulas para cada Mes (Columnas F-K)
    months.forEach((_, mIdx) => {
      const colLetter = String.fromCharCode(70 + mIdx); // F, G...
      cells.push({
        r: insumosHeaderRow, c: 5 + mIdx,
        v: {
          f: `=SUM(${colLetter}${insumosStartRow + 1}:${colLetter}${insumosEndRow + 1})`
        },
        ct: { fa: "S/ #,##0.00;[Red]-S/ #,##0.00", t: "n" },
        st: 1
      });
    });
    
    row++;

    // Items INSUMOS
    insumosData.forEach((item) => {
      cells.push({ r: row, c: 1, v: { v: item.desc }, ct: { fa: "General", t: "s" } });
      
      const startColLetter = "F";
      const endColLetter = "K";

      // EJECUTADO: Suma horizontal de meses
      cells.push({
        r: row, c: 4,
        v: {
          f: `=SUM(F${row + 1}:K${row + 1})`
        },
        ct: { fa: "S/ #,##0.00;[Red]-S/ #,##0.00", t: "n" },
        st: 0
      });

      // Meses
      item.meses.forEach((val, mIdx) => {
        cells.push({
          r: row, c: 5 + mIdx,
          v: val,

          ct: { fa: "S/ #,##0.00;[Red]-S/ #,##0.00", t: "n" },
          st: 0
        });
      });
      row++;
    });

    // ==========================================
    // SUELDOS
    // ==========================================
    const sueldosData = [
      { desc: "COORDINACIÓN", meses: [0, 0, 0, 0, 0, 0] },
      { desc: "ADMINISTRACIÓN", meses: [0, 0, 0, 0, 0, 0] },
      { desc: "JEFE DE ÁREA", meses: [0, 0, 0, 0, 0, 0] },
      { desc: "GERENTE", meses: [0, 0, 0, 0, 0, 0] },
    ];

    const sueldosStartRow = row + 1;
    const sueldosEndRow = sueldosStartRow + sueldosData.length - 1;
    const sueldosHeaderRow = row;

    cells.push({ r: sueldosHeaderRow, c: 0, v: { v: "SUELDOS", bl: 1, bg: "#E6B8C7", fs: 10 }, ct: { fa: "General", t: "s" } });

    // EJECUTADO Total
    cells.push({
      r: sueldosHeaderRow, c: 4,
      v: {
        f: `=SUM(E${sueldosStartRow + 1}:E${sueldosEndRow + 1})`
      },
      ct: { fa: "S/ #,##0.00;[Red]-S/ #,##0.00", t: "n" },
      st: 1
    });

    // Meses Totales
    months.forEach((_, mIdx) => {
      const colLetter = String.fromCharCode(70 + mIdx);
      cells.push({
        r: sueldosHeaderRow, c: 5 + mIdx,
        v: {
          f: `=SUM(${colLetter}${sueldosStartRow + 1}:${colLetter}${sueldosEndRow + 1})`
        },
        ct: { fa: "S/ #,##0.00;[Red]-S/ #,##0.00", t: "n" },
        st: 1
      });
    });
    row++;

    sueldosData.forEach(item => {
      cells.push({ r: row, c: 1, v: { v: item.desc }, ct: { fa: "General", t: "s" } });
      
      const startColLetter = "F";
      const endColLetter = "K";
      
      cells.push({
        r: row, c: 3,
        v: {
          f: `=SUM(F${row + 1}:K${row + 1})`
        },
        ct: { fa: "S/ #,##0.00;[Red]-S/ #,##0.00", t: "n" },
        st: 0
      });

      cells.push({
        r: row, c: 4,
        v: {
          f: `=SUM(F${row + 1}:K${row + 1})`
        },
        ct: { fa: "S/ #,##0.00;[Red]-S/ #,##0.00", t: "n" },
        st: 0
      });

      item.meses.forEach((val, mIdx) => {
        cells.push({ r: row, c: 5 + mIdx, v: val, ct: { fa: "S/ #,##0.00;[Red]-S/ #,##0.00", t: "n" }, st: 0 });
      });
      row++;
    });

    // ==========================================
    // SUBCONTRATOS
    // ==========================================
    const subcontratosData = [
      { entregable: "", desc: "TOPOGRAFÍA Y SUELO", resp: "PCL", presup: 600, meses: [0, 191.17, 341.68, 0, 0, 0], items: [] },
      { entregable: "PRIMER ENTREGABLE", desc: "ARQUITECTURA", resp: "DML", presup: 3000, meses: [0, 173.67, 1125.22, 1815.38, 0, 0], items: [] },
      { entregable: "SEGUNDO ENTREGABLE", desc: "ESTRUCTURAS", resp: "PCL", presup: 3000, meses: [0, 0, 0, 0, 0, 0], items: [] },
      { entregable: "SEGUNDO ENTREGABLE", desc: "INSTALACIONES SANITARIAS", resp: "PCL", presup: 1000, meses: [0, 0, 0, 0, 625, 0], items: [] },
      { entregable: "SEGUNDO ENTREGABLE", desc: "INSTALACIONES ELECTRICAS", resp: "PCL", presup: 1000, meses: [0, 0, 0, 0, 625, 0], items: [] },
      { entregable: "SEGUNDO ENTREGABLE", desc: "COSTOS Y PRESUPUESTOS", resp: "PCL", presup: 1000, meses: [0, 0, 0, 0, 150, 0], items: [] },
    ];

    let subcontratosRowCount = subcontratosData.length;
    const subcontratosStartRow = row + 1;
    const subcontratosEndRow = subcontratosStartRow + subcontratosRowCount - 1;
    const subcontratosHeaderRow = row;

    cells.push({ r: subcontratosHeaderRow, c: 0, v: { v: "SUBCONTRATOS", bl: 1, bg: "#E6B8C7", fs: 10 }, ct: { fa: "General", t: "s" } });

    // EJECUTADO Total
    cells.push({
      r: subcontratosHeaderRow, c: 4,
      v: {
        f: `=SUM(E${subcontratosStartRow + 1}:E${subcontratosEndRow + 1})`
      },
      ct: { fa: '"S/ " #,##0.00', t: "n" },
      st: 1
    });

    // Meses Totales
    months.forEach((_, mIdx) => {
      const colLetter = String.fromCharCode(70 + mIdx);
      cells.push({
        r: subcontratosHeaderRow, c: 5 + mIdx,
        v: {
          f: `=SUM(${colLetter}${subcontratosStartRow + 1}:${colLetter}${subcontratosEndRow + 1})`
        },
        ct: { fa: "S/ #,##0.00;[Red]-S/ #,##0.00", t: "n" },
        st: 1
      });
    });
    row++;

    subcontratosData.forEach(item => {
      if (item.entregable) cells.push({ r: row, c: 0, v: { v: item.entregable }, ct: { fa: "General", t: "s" } });
      cells.push({ r: row, c: 1, v: { v: item.desc }, ct: { fa: "General", t: "s" } });
      cells.push({ r: row, c: 2, v: { v: item.resp }, ct: { fa: "General", t: "s" } });
      
      cells.push({ r: row, c: 3, v: { v: item.presup }, ct: { fa: "S/ #,##0.00;[Red]-S/ #,##0.00", t: "n" }, st: 0 });
      
      cells.push({
        r: row, c: 4,
        v: {
          f: `=SUM(F${row + 1}:K${row + 1})`
        },
        ct: { fa: "S/ #,##0.00;[Red]-S/ #,##0.00", t: "n" },
        st: 0
      });

      item.meses.forEach((val, mIdx) => {
        cells.push({ r: row, c: 5 + mIdx, v: val, ct: { fa: "S/ #,##0.00;[Red]-S/ #,##0.00", t: "n" }, st: 0 });
      });
      row++;
    });

    // ==========================================
    // SERVICIOS
    // ==========================================
    const serviciosData = [
      { desc: "PASAJES", meses: [500, 0, 500, 0, 0, 0] },
      { desc: "VIÁTICO", meses: [74.5, 0, 58.5, 0, 16, 0] },
      { desc: "COMBUSTIBLE", meses: [0, 0, 0, 0, 0, 0] },
    ];

    const serviciosStartRow = row + 1;
    const serviciosEndRow = serviciosStartRow + serviciosData.length - 1;
    const serviciosHeaderRow = row;

    cells.push({ r: serviciosHeaderRow, c: 0, v: { v: "SERVICIOS", bl: 1, bg: "#E6B8C7", fs: 10 }, ct: { fa: "General", t: "s" } });

    // EJECUTADO Total
    cells.push({
      r: serviciosHeaderRow, c: 4,
      v: {
        f: `=SUM(E${serviciosStartRow + 1}:E${serviciosEndRow + 1})`
      },
      ct: { fa: "S/ #,##0.00;[Red]-S/ #,##0.00", t: "n" },
      st: 1
    });

    // Meses Totales
    months.forEach((_, mIdx) => {
      const colLetter = String.fromCharCode(70 + mIdx);
      cells.push({
        r: serviciosHeaderRow, c: 5 + mIdx,
        v: {
          f: `=SUM(${colLetter}${serviciosStartRow + 1}:${colLetter}${serviciosEndRow + 1})`
        },
        ct: { fa: "S/ #,##0.00;[Red]-S/ #,##0.00", t: "n" },
        st: 1
      });
    });
    row++;

    serviciosData.forEach(item => {
      cells.push({ r: row, c: 1, v: { v: item.desc }, ct: { fa: "General", t: "s" } });
      
      cells.push({
        r: row, c: 3,
        v: {
          f: `=SUM(F${row + 1}:K${row + 1})`
        },
        ct: { fa: "S/ #,##0.00;[Red]-S/ #,##0.00", t: "n" },
        st: 0
      });

      cells.push({
        r: row, c: 4,
        v: {
          f: `=SUM(F${row + 1}:K${row + 1})`
        },
        ct: { fa: "S/ #,##0.00;[Red]-S/ #,##0.00", t: "n" },
        st: 0
      });

      item.meses.forEach((val, mIdx) => {
        cells.push({ r: row, c: 5 + mIdx, v: val, ct: { fa: "S/ #,##0.00;[Red]-S/ #,##0.00", t: "n" }, st: 0 });
      });
      row++;
    });

    // ==========================================
    // TOTAL GENERAL
    // ==========================================
    row += 1;
    const totalRow = row;

    cells.push({ 
      r: row, c: 2, 
      v: { v: "TOTAL", bl: 1, bg: "#FFC7CE", fs: 11, tb: 2 }, 
      ct: { fa: "General", t: "s" } 
    });

    // Suma de los headers de EJECUTADO
    cells.push({ 
      r: totalRow, c: 4, 
      v: {
        f: `=SUM(E3,E${sueldosHeaderRow + 1},E${subcontratosHeaderRow + 1},E${serviciosHeaderRow + 1})`
      },
      ct: { fa: "S/ #,##0.00;[Red]-S/ #,##0.00", t: "n" }, 
      st: 1 
    });

    // Suma de los headers de Meses
    for (let m = 0; m < months.length; m++) {
      const colLetter = String.fromCharCode(70 + m);
      cells.push({ 
        r: totalRow, c: 5 + m, 
        v: {
          f: `=SUM(${colLetter}3,${colLetter}${sueldosHeaderRow + 1},${colLetter}${subcontratosHeaderRow + 1},${colLetter}${serviciosHeaderRow + 1})`
        },
        ct: { fa: "S/ #,##0.00;[Red]-S/ #,##0.00", t: "n" }, 
        st: 1 
      });
    }
    row++;

    // ==========================================
    // PORCENTAJE FINANCIERO
    const totalPresupuestoBase: number = 15600;
    row++;
    cells.push({ 
      r: row, c: 2, 
      v: { v: "PORCENTAJE FINANCIERO", bl: 1, bg: "#F4D03F", fs: 10 }, 
      ct: { fa: "General", t: "s" } 
    });
    cells.push({ 
      r: row, c: 3, 
      v: { v: totalPresupuestoBase }, 
      ct: { fa: "S/ #,##0.00;[Red]-S/ #,##0.00", t: "n" }, 
      st: 1 
    });

    for (let m = 0; m < months.length; m++) {
      const colLetter = String.fromCharCode(70 + m);
      const totalCell = `${colLetter}${totalRow + 1}`; 
      const baseCell = `D${row + 1}`;

      cells.push({ 
        r: row, c: 5 + m, 
        v: {
          f: `=IF(${baseCell}=0,"0.00%",TEXT(ROUND(DIVIDE(${totalCell},${baseCell}),4),"0.00%"))`
        },
        ct: { t: "s" }, 
        st: 1 
      });
    }

    row += 3;

    // ==========================================
    // 9. TABLA INGRESOS
    // ==========================================
    const ingresosStartRow = row + 1;
    const ingresosData = [
      { num: 1, desc: "ELABORACIÓN DE CHINCHAVITO", monto: 20000, ejecutado: [6000, 0, 0, 0, 0, 0] },
      { num: 2, desc: "UTILIDADES", monto: 4400, ejecutado: [0, 0, 0, 0, 0, 0] },
    ];
    const ingresosEndRow = ingresosStartRow + ingresosData.length - 1;

    // Header verde
    cells.push({
      r: row, c: 0,
      v: { v: "PROYECTO SUPERVISIÓN - ELABORACIÓN - INGRESOS", bl: 1, fc: "#ffffff", bg: "#27AE60", fs: 12, ht: 32, ha: 2, va: 2 },
      ct: { fa: "General", t: "s" }
    });
    merge[`${row}_0`] = { r: row, c: 0, rs: 1, cs: 7 + months.length }; 
    row++;

    // Headers de columnas - ✅ Agregada columna vacía en índice 5
    const incomeHeaders = ["N°", "DESCRIPCIÓN", "", "INGRESOS", "", ...months];
    incomeHeaders.forEach((h, c) => {
      cells.push({
        r: row, c,
        v: { v: h, bl: 1, bg: "#D9D9D9", fs: 10, ht: 28, ha: c < 2 ? 2 : 2, va: 2 },
        ct: { fa: "General", t: "s" }
      });
    });
    merge[`${row}_2`] = { r: row, c: 2, rs: 1, cs: 1 };
    row++;

    // Datos de ingresos
    ingresosData.forEach((item, idx) => {
      const isUtilidades = idx === 1;
      
      cells.push({ 
        r: row, c: 0, 
        v: { v: item.num, ht: 28, ha: 2, bg: isUtilidades ? "#D5E8D4" : undefined }, 
        ct: { fa: "General", t: "n" } 
      });
      cells.push({ 
        r: row, c: 1, 
        v: { v: item.desc, ht: 28, ha: 1, bg: isUtilidades ? "#D5E8D4" : undefined }, 
        ct: { fa: "General", t: "s" } 
      });
      
      cells.push({ 
        r: row, c: 3, 
        v: { 
          v: item.monto, 
          ht: 28, 
          ha: 2, 
          bg: isUtilidades ? "#92D050" : undefined,
          fc: isUtilidades ? "#FFFFFF" : undefined,
          bl: isUtilidades ? 1 : undefined
        }, 
        ct: { fa: "S/ #,##0.00", t: "n" } 
      });

      item.ejecutado.forEach((val, mIdx) => {
        cells.push({
          r: row, c: 6 + mIdx, 
          v: { v: val, ht: 28, ha: 2 },
          ct: { fa: "S/ #,##0.00", t: "n" }
        });
      });
      row++;
    });

    // INGRESO (suma de ingresos por mes)
    const ingresoRow = row;
    cells.push({ r: row, c: 3, v: { v: "INGRESO", bl: 1, bg: "#e08888", fs: 10, ht: 28, ha: 2, va: 2, fc: "#FFFFFF" } });
    for (let m = 0; m < months.length; m++) {
      const colLetter = String.fromCharCode(71 + m); 
      cells.push({ 
        r: row, c: 6 + m, 
        v: { f: `=SUM(${colLetter}${ingresosStartRow + 1}:${colLetter}${ingresosEndRow + 1})`, ht: 28, ha: 2, bg: "#D5E8D4" }, 
        ct: { fa: "S/ #,##0.00", t: "n" } 
      });
    }
    row++;

    // INGRESO - EGRESO
    const ingresoEgresoRow = row;
    cells.push({ r: row, c: 3, v: { v: "INGR-EGRESO", bl: 1, bg: "#FFC7CE", fs: 10, ht: 28, ha: 2, va: 2 } });
    for (let m = 0; m < months.length; m++) {
      const colLetter = String.fromCharCode(71 + m); 
      const ingresoCell = `${colLetter}${ingresoRow + 1}`;
      const egresoCell = `${colLetter}${totalRow + 1}`;
      
      cells.push({ 
        r: row, c: 6 + m, 
        v: { f: `=${ingresoCell}+${egresoCell}`, ht: 28, ha: 2 }, 
        ct: { fa: "S/ #,##0.00;[Red]-S/ #,##0.00", t: "n" } 
      });
    }
    row++;

    // ACUMULADO
    const acumuladoRow = row;
    cells.push({ r: row, c: 3, v: { v: "ACUMULADO", bl: 1, bg: "#FFD966", fs: 10, ht: 28, ha: 2, va: 2 } });
    for (let m = 0; m < months.length; m++) {
      const colLetter = String.fromCharCode(71 + m); 
      const currentNet = `${colLetter}${ingresoEgresoRow + 1}`;
      
      if (m === 0) {
        cells.push({ 
          r: row, c: 6 + m, 
          v: { f: `=${currentNet}`, ht: 28, ha: 2, bg: "#FFD966" }, 
          ct: { fa: "S/ #,##0.00", t: "n" } 
        });
      } else {
        const prevColLetter = String.fromCharCode(70 + m); 
        const prevAcumulado = `${prevColLetter}${acumuladoRow + 1}`;
        cells.push({ 
          r: row, c: 6 + m, 
          v: { f: `=${prevAcumulado}+${currentNet}`, ht: 28, ha: 2, bg: "#FFD966" }, 
          ct: { fa: "S/ #,##0.00", t: "n" } 
        });
      }
    }
    row++;

    return {
      name: `PRESUPUESTO - ${projectName}`,
      celldata: cells,
      config: { merge, freeze: { row: 2, col: 3 } },
      status: 1
    };
  };

  const scheduleSave = useCallback((r: number, c: number, value: any, mapping: any) => {
    pendingChanges.current.push({ row: r, col: c, value: new Decimal(value || 0).toFixed(2), mapping });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setSaving(true);
      setSaveError(null);
      try {
        const csrf = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';
        const url = `/presupuesto-proyecto`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': csrf,
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify({ data: pendingChanges.current, project_id: project?.id }),
        });
        if (!response.ok) throw new Error(`Error ${response.status}`);
        setLastSaved(new Date());
        pendingChanges.current = [];
      } catch (error: any) {
        setSaveError(error.message || 'Error de red');
      } finally {
        setSaving(false);
      }
    }, 1000);
  }, [project]);

  const handleCellUpdated = useCallback((r: number, c: number, value: any) => {
    if (typeof value === 'string' && value.startsWith('=')) return;
    const inst = (window as any).luckysheet;
    if (!inst) return;
    const sheet = inst.getSheet();
    const cell = sheet?.data?.[r]?.[c];
    if (cell?.st === 1) return;
    const isIncomeTable = c >= 15;
    scheduleSave(r, c, value, { table: isIncomeTable ? 'income' : 'expense', projectCode: project?.code || 'CHINCHAVITO' });
  }, [scheduleSave, project]);

  const data = [generatePresupuestoBase()];

  useEffect(() => {
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, []);
  
  const { ls, getActive, setCells } = useLuckysheet();

  const recalc = useCallback(() => {
    if (progCount.current > 2) return;

    const inst = ls();
    if (!inst) return;

    const active = getActive();
    if (!active) return;

    const data = active.data || [];
    const updates: any[] = [];

    for (let r = 0; r < data.length; r++) { 
      const row = data[r];
      if (!row) continue;

      let sum = 0;

      // 🔥 columnas meses (F → K)
      for (let c = 5; c <= 10; c++) {
        const val = Number(row?.[c]?.v || 0);
        sum += val;
      }

      // EJECUTADO (columna E = index 4)
      updates.push({
        r,
        c: 4,
        v: { v: sum, ct: { fa: "S/ #,##0.00", t: "n" } }
      });
    }

    if (!updates.length) return;

    progCount.current++;

    setCells(updates, active.order ?? 0);

    setTimeout(() => {
      progCount.current--;
    }, 100);

  }, []);

  return (
    <div className="flex h-screen w-full flex-col bg-slate-50 dark:bg-gray-950">
      {/* MODAL DE CONFIGURACIÓN */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-gray-100">
                Configuración del Proyecto
              </h2>
              <button
                onClick={() => setShowConfigModal(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-gray-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Nombre del Proyecto */}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-gray-300">
                  Nombre del Proyecto *
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Ej: CHINCHAVITO"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>

              {/* Mes de Inicio */}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-gray-300">
                  Mes de Inicio *
                </label>
                <select
                  value={startMonth}
                  onChange={(e) => {
                    const newStart = parseInt(e.target.value);
                    setStartMonth(newStart);
                    if (newStart > endMonth) {
                      setEndMonth(newStart);
                    }
                  }}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                >
                  {MONTHS.map((month, idx) => (
                    <option key={idx} value={idx}>{month}</option>
                  ))}
                </select>
              </div>

              {/* Mes de Fin */}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-gray-300">
                  Mes de Fin *
                </label>
                <select
                  value={endMonth}
                  onChange={(e) => setEndMonth(parseInt(e.target.value))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                >
                  {MONTHS.map((month, idx) => (
                    <option key={idx} value={idx} disabled={idx < startMonth}>
                      {month}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  Duración: {endMonth - startMonth + 1} mes(es)
                </p>
              </div>

              {/* Resumen */}
              <div className="rounded-md bg-slate-50 p-3 dark:bg-gray-800">
                <p className="text-xs text-slate-600 dark:text-gray-400">
                  <span className="font-semibold">Meses seleccionados:</span>
                </p>
                <p className="mt-1 text-sm font-medium text-slate-900 dark:text-gray-100">
                  {generateMonthsArray().join(' → ')}
                </p>
              </div>

              {/* Botón Generar */}
              <button
                onClick={handleGenerateSheet}
                className="w-full rounded-md bg-orange-500 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              >
                Generar Presupuesto
              </button>
            </div>
          </div>
        </div>
    )}

    <div className="flex h-screen w-full flex-col bg-slate-50 dark:bg-gray-950">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 py-2 backdrop-blur-md dark:border-gray-800/60 dark:bg-gray-900/90">
        <div className="flex items-center gap-3">
          <button onClick={() => router.get('/costos')} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors">← Volver</button>
          <div>
            <h1 className="text-sm font-bold text-slate-900 dark:text-gray-100">Presupuesto Proyecto</h1>
            <p className="text-[10px] uppercase text-slate-400">{project?.name || ''} {project?.code ? `• ${project.code}` : ''}</p>
          </div>
          <button
          onClick={recalc}
          className="ml-3 rounded bg-blue-500 px-3 py-1 text-white text-xs hover:bg-blue-600"
        >
          Calcular
        </button>
        </div>
        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-semibold transition-colors",
          saving ? "bg-amber-100 text-amber-600" : saveError ? "bg-red-100 text-red-600" : lastSaved ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400")}>
          {saving ? <><Loader2 className="h-3 w-3 animate-spin" /> Guardando</> :
           saveError ? <><AlertCircle className="h-3 w-3" /> {saveError}</> :
           lastSaved ? <><CheckCircle2 className="h-3 w-3" /> {lastSaved.toLocaleTimeString('es-PE')}</> :
           <><Save className="h-3 w-3" /> Sin cambios</>}
        </span>
      </header>
      <main className="flex-1 overflow-hidden p-2">

        <Luckysheet
          data={data}
          height="calc(100vh - 80px)"
          options={{
            title: `Presupuesto - ${project?.name || 'Proyecto'}`,
            lang: 'es',
            showinfobar: false,
            sheetFormulaBar: true,
            showstatisticBar: true,
            allowEdit: true,
            forceCalculation: true,
            calcChain: true,
            afterChange: () => {
              if (progCount.current > 0) return;

              setTimeout(() => {
                recalc();
              }, 50);
            },
            hook: {
              workbookCreateAfter: () => {
                const inst = (window as any).luckysheet;
                if (inst) {
                  setTimeout(() => recalc(), 200);
                }
              },

              cellUpdated: (r: number, c: number, oldValue: any, newValue: any) => {
                if (progCount.current > 0) return;

                handleCellUpdated(r, c, newValue);

                setTimeout(() => {
                  recalc();
                }, 50);
              }
            }
          }}
        />
        </main>
      </div>
    </div>
  );
}