import { usePage } from '@inertiajs/react'
import React, { useRef } from 'react'
import AppLayout from '@/layouts/app-layout'
import Luckysheet from '@/components/costos/tablas/Luckysheet'

declare global { interface Window { luckysheet: any } }

// CORRECCIÓN: TOTAL es columna N (Índice 13)
const COLS = { ITEM: 0, DES: 1, UND: 2, ELEM: 3, L: 4, ANC: 5, ALT: 6, NVEC: 7, TOTAL: 13 };
const HEADERS = ['ITEM', 'DESCRIPCIÓN', 'Und', 'Elem', 'Largo', 'Ancho', 'Alto', 'N° Vec', 'Lon.', 'Área', 'Vol.', 'Kg', 'UndC', 'Total', 'Observaciones'];

export default function Show() {
  const { spreadsheet } = usePage<any>().props;
  const calculatingRef = useRef(false);

  const initialCellData = HEADERS.map((h, c) => ({
    r: 0, c, v: { v: h, bl: 1, bg: '#f3f4f6', ht: 0, vt: 0 }
  }));

  const ejecutarCalculo = (r: number) => {
    const ls = window.luckysheet;
    const getV = (col: number) => {
      const cell = ls.getCellValue(r, col);
      const val = cell?.v ?? cell;
      return parseFloat(val) || 0;
    };

    const und = String(ls.getCellValue(r, COLS.UND) || '').toLowerCase().trim();
    const elem = getV(COLS.ELEM) || 1;
    const largo = getV(COLS.L);
    const ancho = getV(COLS.ANC);
    const alto = getV(COLS.ALT);
    const veces = getV(COLS.NVEC) || 1;

    let resultado = 0;
    if (['m', 'ml'].includes(und)) {
      resultado = largo * elem * veces;
    } else if (und === 'm2') {
      resultado = largo * ancho * elem * veces;
    } else if (und === 'm3') {
      resultado = largo * ancho * alto * elem * veces;
    } else if (['und', 'pza'].includes(und)) {
      resultado = elem * veces;
    }

    if (resultado > 0) {
      ls.setCellValue(r, COLS.TOTAL, resultado.toFixed(2));
    } else {
      ls.setCellValue(r, COLS.TOTAL, '');
    }
  };

  const getNextItem = (type: 'T' | 'S' | 'P') => {
    const ls = window.luckysheet;
    const data = ls.getSheetData();
    let maxT = 0, maxS = 0;

    data.forEach((row: any) => {
      const val = row[COLS.ITEM]?.v || row[COLS.ITEM];
      if (!val) return;
      const parts = String(val).split('.');
      const t = parseInt(parts[0]) || 0;
      if (t > maxT) { maxT = t; maxS = 0; }
      if (parts.length >= 2 && t === maxT) {
        const s = parseInt(parts[1]) || 0;
        maxS = Math.max(maxS, s);
      }
    });

    if (type === 'T') return `${maxT + 1}`;
    if (type === 'S') return `${maxT}.${String(maxS + 1).padStart(2, '0')}`;
    return "";
  };

  const insertAction = (type: 'T' | 'S' | 'P') => {
    const ls = window.luckysheet;
    const selection = ls.getRange()[0];
    const r = selection ? selection.row[0] : 1;
    const nextItem = getNextItem(type);

    ls.insertRow(r, 1);

    setTimeout(() => {
      try {
        if (type === 'T') {
          ls.setCellValue(r, COLS.ITEM, nextItem);
          ls.setCellValue(r, COLS.DES, 'NUEVO TÍTULO');
          ls.setCellFormat(r, COLS.DES, "fc", "#ff0000");
          ls.setCellFormat(r, COLS.DES, "bl", 1);
        } else if (type === 'S') {
          ls.setCellValue(r, COLS.ITEM, nextItem);
          ls.setCellValue(r, COLS.DES, 'Nuevo Subtítulo');
          ls.setCellFormat(r, COLS.DES, "fc", "#0000ff");
          ls.setCellFormat(r, COLS.DES, "bl", 1);
        } else {
          ls.setCellValue(r, COLS.DES, 'Nueva Partida');
          ls.setCellValue(r, COLS.UND, 'und');
        }
      } catch (e) {
        console.warn("Reintentando aplicar formato...");
      }
    }, 150);
  };

  const generarResumen = () => {
    const ls = window.luckysheet;
    const allSheets = ls.getAllSheets();

    const sheetPrincipal = allSheets.find(s => s.name === 'Metrado Gas');
    let sheetResumen = allSheets.find(s => s.name === 'Resumen');

    if (!sheetPrincipal) return;

    if (!sheetResumen) {
      ls.setSheetAdd({ name: 'Resumen' });
      return;
    }

    const pIdx = sheetPrincipal.index;
    const rOrder = sheetResumen.order;
    // RECOLECCIÓN DE DATOS (LECTURA)
    const dataPrincipal = ls.getSheetData();
    const resumenData = [];
    let sumaTotalGeneral = 0;

    dataPrincipal.forEach((row, r) => {
      if (r === 0) return;

      const itemVal = ls.getCellValue(r, COLS.ITEM, { sheetIndex: pIdx });
      const itemStr = String(itemVal?.v || itemVal || "");

      if (itemStr && itemStr.split('.').length <= 2) {
        const desc = ls.getCellValue(r, COLS.DES, { sheetIndex: pIdx })?.v || "";
        const und = ls.getCellValue(r, COLS.UND, { sheetIndex: pIdx })?.v || "";
        const totalVal = ls.getCellValue(r, COLS.TOTAL, { sheetIndex: pIdx })?.v || 0;
        const total = parseFloat(totalVal) || 0;

        resumenData.push([itemStr, desc, und, total]);

        if (itemStr.includes('.')) {
          sumaTotalGeneral += total;
        }
      }
    });

    ls.setSheetActive(sheetResumen.index);
    // ESCRITURA CON PROTECCIÓN DE ÍNDICE (order: rIdx)
    setTimeout(() => {
      // Limpieza manual de 4 columnas
      for (let i = 0; i <= 100; i++) {
        for (let j = 0; j <= 3; j++) {
          ls.setCellValue(i, j, null, { order: rOrder });
        }
      }

      // --- Encabezados del Resumen ---
const headers = ["ITEM", "DESCRIPCIÓN", "UND", "TOTAL"];
headers.forEach((h, i) => {
    ls.setCellValue(0, i, h, rOrder);      // escribir valor directamente
    ls.setCellFormat(0, i, "bl", 1, rOrder); // aplicar negrita
});

// --- Datos del Resumen ---
resumenData.forEach((rowData, i) => {
    const rowIdx = i + 1;
    ls.setCellValue(rowIdx, 0, rowData[0], rOrder);
    ls.setCellValue(rowIdx, 1, rowData[1], rOrder);
    ls.setCellValue(rowIdx, 2, rowData[2], rOrder);
    ls.setCellValue(rowIdx, 3, rowData[3], rOrder);

    // si es Título o Subtítulo (no tiene punto) lo ponemos en negrita
    if (!String(rowData[0]).includes('.')) {
        [0, 1, 2, 3].forEach(c => ls.setCellFormat(rowIdx, c, "bl", 1, rOrder));
    }
});

// --- Total General ---
const filaFinal = resumenData.length + 2;
ls.setCellValue(filaFinal, 1, "TOTAL GENERAL", rOrder);
ls.setCellValue(filaFinal, 3, sumaTotalGeneral.toFixed(2), rOrder);
ls.setCellFormat(filaFinal, 1, "bl", 1, rOrder);
ls.setCellFormat(filaFinal, 3, "bl", 1, rOrder);

// --- Ajuste de ancho de columna ---
ls.setColumnWidth({ "1": 400 }, { sheetIndex: sheetResumen.index });
    }, 200);
  }
  return (
    <AppLayout breadcrumbs={[{ title: 'Metrados', href: '#' }, { title: spreadsheet.name, href: '#' }]}>
      <div className="flex h-[calc(100vh-64px)] flex-col bg-white">
        <div className="p-2 flex gap-2 justify-end border-b shadow-sm">
          <button onClick={() => insertAction('T')} className="bg-blue-600 text-white px-4 py-1.5 rounded text-xs font-bold hover:bg-blue-700">+ Título</button>
          <button onClick={() => insertAction('S')} className="bg-green-600 text-white px-4 py-1.5 rounded text-xs font-bold hover:bg-green-700">+ Subtítulo</button>
          <button onClick={() => insertAction('P')} className="bg-red-600 text-white px-4 py-1.5 rounded text-xs font-bold hover:bg-red-700">+ Partida</button>
          <button onClick={generarResumen} className="bg-purple-600 text-white px-4 py-1.5 rounded text-xs font-bold hover:bg-purple-700">📊 Ver Resumen</button>
        </div>

        <div className="flex-1 overflow-hidden">
          <Luckysheet
            data={[
              {
                name: 'Metrado Gas',
                celldata: initialCellData,
                column: 15, row: 100, status: 1
              },
              { name: 'Resumen', column: 5, row: 100 }
            ]}
            options={{
              showinfobar: false,
              hook: {
                cellUpdated: (r, c) => {
                  // Activa el cálculo automático al modificar dimensiones o unidad
                  if (c >= COLS.UND && c <= COLS.NVEC) {
                    ejecutarCalculo(r);
                  }
                }
              }
            }}
          />
        </div>
      </div>
    </AppLayout>
  );
}