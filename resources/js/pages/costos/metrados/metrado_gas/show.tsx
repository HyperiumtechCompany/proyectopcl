import { usePage } from '@inertiajs/react'
import React, { useRef } from 'react'
import AppLayout from '@/layouts/app-layout'
import Luckysheet from '@/components/costos/tablas/Luckysheet'

declare global { interface Window { luckysheet: any } }

const COLS = { ITEM: 0, DES: 1, UND: 2, ELEM: 3, L: 4, ANC: 5, ALT: 6, NVEC: 7, TOTAL: 13 };
const HEADERS = ['ITEM', 'DESCRIPCIÓN', 'Und', 'Elem', 'Largo', 'Ancho', 'Alto', 'N° Vec', 'Lon.', 'Área', 'Vol.', 'Kg', 'UndC', 'Total', 'Observaciones'];

export default function Show() {

  const { spreadsheet } = usePage<any>().props;
  const initialCellData = HEADERS.map((h, c) => ({
    r: 0, c, v: { v: h, bl: 1, bg: '#f3f4f6', ht: 0, vt: 0 }
  }));
  // --- 1. FUNCIONES DE LÓGICA ---
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
      ls.setCellValue(r, COLS.TOTAL, resultado.toFixed(2), { order: 0 });
    } else {
      ls.setCellValue(r, COLS.TOTAL, '', { order: 0 });
    }
  };

  const actualizarNumeracionJerarquica = () => {
    const ls = window.luckysheet;
    const data = ls.getSheetData(0);

    let contadorTitulo = 0;
    let contadorSubtitulo = 0;

    data.forEach((row, r) => {
      if (r === 0 || !row) return;

      const descCell = row[COLS.DES];
      const undVal = ls.getCellValue(r, COLS.UND);
      const desc = String(descCell?.v || "").trim();
      const und = String(undVal?.v || undVal || "").trim();

      if (!desc) {
        ls.setCellValue(r, COLS.ITEM, null);
        return;
      }

      const color = descCell?.fc;
      const esTitulo = color === "#ff0000";
      const esSubtitulo = color === "#0000ff";
      const esPartida = !!und;

      if (esTitulo) {
        contadorTitulo++;
        contadorSubtitulo = 0;

        ls.setCellValue(r, COLS.ITEM, `${contadorTitulo}`, { order: 0 });
        return;
      }
      if (esSubtitulo) {

        if (contadorTitulo === 0) {
          ls.setCellValue(r, COLS.ITEM, null);
          return;
        }

        contadorSubtitulo++;

        const numero = `${contadorTitulo}.${String(contadorSubtitulo).padStart(2, '0')}`;
        ls.setCellValue(r, COLS.ITEM, numero, { order: 0 });
        return;
      }

      if (esPartida) {
        ls.setCellValue(r, COLS.ITEM, null, { order: 0 });
      }
    });
  };
  const aplicarUnidadEnBloque = (rowIdx: number, nuevaUnidad: string) => {
    const ls = window.luckysheet;
    const data = ls.getSheetData(0);

    for (let i = rowIdx + 1; i < data.length; i++) {
      const itemVal = ls.getCellValue(i, COLS.ITEM, { sheetIndex: 0 });
      const itemStr = String(itemVal?.v || itemVal || "");

      if (itemStr && !itemStr.includes('.')) break;

      ls.setCellValue(i, COLS.UND, nuevaUnidad, { order: 0 });
      ejecutarCalculo(i);
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
    const sheetIdx = 0;
    const selection = ls.getRange()[0];
    const r = selection ? selection.row[0] : 1;
    const nextItem = getNextItem(type);

    ls.insertRow(r, 1);

    setTimeout(() => {
      try {
        // Usamos { order: 0 } en cada setCellValue para que no se pierda
        if (type === 'T') {
          ls.setCellValue(r, COLS.ITEM, nextItem, { order: 0 });
          ls.setCellValue(r, COLS.DES, 'NUEVO TÍTULO', { order: 0 });
          ls.setCellFormat(r, COLS.DES, "fc", "#ff0000", { order: 0 });
          ls.setCellFormat(r, COLS.DES, "bl", 1, { order: 0 });
        } else if (type === 'S') {
          ls.setCellValue(r, COLS.ITEM, nextItem, { order: 0 });
          ls.setCellValue(r, COLS.DES, 'Nuevo Subtítulo', { order: 0 });
          ls.setCellFormat(r, COLS.DES, "fc", "#0000ff", { order: 0 });
          ls.setCellFormat(r, COLS.DES, "bl", 1, { order: 0 });
        } else {
          ls.setCellValue(r, COLS.DES, 'Nueva Partida', { order: 0 });
          ls.setCellValue(r, COLS.UND, 'und', { order: 0 });
        }
      } catch (e) {
        console.error("Error aplicando formato al título:", e);
      }
    }, 150);
  };

  const generarResumen = () => {
    const ls = window.luckysheet;

    ls.exitEditMode();

    const allSheets = ls.getAllSheets();
    const sheetMetrado = allSheets.find(s => s.name === 'Metrado');
    const sheetResumen = allSheets.find(s => s.name === 'RESUMEN');

    if (!sheetMetrado || !sheetResumen) return;

    const dataPrincipal = ls.getSheetData(sheetMetrado.index);

    //reinicia el resumen 
    const resumenData = [];
    let sumaTotalGeneral = 0;
    let currentTitulo = null;
    let currentSubtitulo = null;

    // PASO 2: Procesamiento con lectura de valor calculado (.v)
    dataPrincipal.forEach((row, r) => {
      if (r === 0 || !row) return;

      const itemVal = ls.getCellValue(r, COLS.ITEM, { sheetIndex: sheetMetrado.index });
      const descCell = ls.getCellValue(r, COLS.DES, { sheetIndex: sheetMetrado.index });
      const totalCell = ls.getCellValue(r, COLS.TOTAL, { sheetIndex: sheetMetrado.index });
      const undVal = ls.getCellValue(r, COLS.UND, { sheetIndex: sheetMetrado.index });

      const itemStr = String(itemVal?.v || itemVal || "").trim();
      const descStr = String(descCell?.v || descCell || "").trim();
      const undStr = String(undVal?.v || undVal || "").trim();

      // Priorizamos .v para que si cambias un dato, el resumen jale el nuevo total
      const total = parseFloat(totalCell?.v ?? totalCell ?? 0) || 0;

      if (!descStr || descStr === "null" || descStr === "") return;

      const esTitulo = itemStr && !itemStr.includes('.');
      const esSubtitulo = itemStr && itemStr.includes('.');
      const esPartida = !itemStr && undStr !== "";

      if (esTitulo) {
        currentTitulo = { item: itemStr, desc: descStr, total: 0, color: '#ff0000' };
        resumenData.push(currentTitulo);
        currentSubtitulo = null;
      }
      else if (esSubtitulo) {
        currentSubtitulo = { item: itemStr, desc: descStr, total: 0, color: '#0000ff' };
        resumenData.push(currentSubtitulo);
      }
      else if (esPartida) {
        if (currentSubtitulo) currentSubtitulo.total += total;
        if (currentTitulo) currentTitulo.total += total;
        sumaTotalGeneral += total;
      }
    });

    // PASO 3: Renderizado con limpieza previa
    ls.setSheetActive(sheetResumen.index);

    setTimeout(() => {
      const rIdx = sheetResumen.index;
      // Limpiamos el área para que no se "congelen" datos viejos
      for (let i = 0; i < 100; i++) {
        for (let j = 0; j < 5; j++) ls.setCellValue(i, j, null, { sheetIndex: rIdx });
      }

      const headers = ["ITEM", "DESCRIPCIÓN", "TOTAL"];
      headers.forEach((h, i) => {
        const col = (i === 2) ? 3 : i;
        ls.setCellValue(0, col, h, { sheetIndex: rIdx });
        ls.setCellFormat(0, col, "bl", 1, { sheetIndex: rIdx });
      });

      resumenData.forEach((data, i) => {
        const row = i + 1;
        ls.setCellValue(row, 0, data.item, { sheetIndex: rIdx });
        ls.setCellValue(row, 1, data.desc, { sheetIndex: rIdx });
        ls.setCellValue(row, 3, data.total.toFixed(2), { sheetIndex: rIdx });

        [0, 1, 3].forEach(c => {
          ls.setCellFormat(row, c, "bl", 1, { sheetIndex: rIdx });
          ls.setCellFormat(row, c, "fc", data.color, { sheetIndex: rIdx });
        });
      });

      const fFinal = resumenData.length + 2;
      ls.setCellValue(fFinal, 1, "TOTAL GENERAL", { sheetIndex: rIdx });
      ls.setCellValue(fFinal, 3, sumaTotalGeneral.toFixed(2), { sheetIndex: rIdx });
      [1, 3].forEach(c => ls.setCellFormat(fFinal, c, "bl", 1, { sheetIndex: rIdx }));

      ls.refresh();
    }, 150); // Bajamos a 150ms para que sea más rápido
  };
  // --- 2. DISEÑO DEL COMPONENTE ---
  return (
    <AppLayout breadcrumbs={[{ title: 'Metrados', href: '#' }, { title: spreadsheet.name, href: '#' }]}>
      <div className="flex h-[calc(100vh-64px)] flex-col bg-white">
        {/* --- TUS BOTONES ORIGINALES --- */}
        <div className="p-2 flex gap-2 justify-end border-b shadow-sm">
          <button
            onClick={() => insertAction('T')}
            className="bg-blue-600 text-white px-3 py-1 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            + Título
          </button>
          <button
            onClick={() => insertAction('S')}
            className="bg-green-600 text-white px-3 py-1 rounded-md text-sm font-medium hover:bg-green-700 transition-colors"
          >
            + Subtítulo
          </button>
          <button
            onClick={() => insertAction('P')}
            className="bg-red-600 text-white px-3 py-1 rounded-md text-sm font-medium hover:bg-red-700 transition-colors"
          >
            + Partida
          </button>
          <button
            onClick={generarResumen}
            className="bg-purple-600 text-white px-3 py-1 rounded-md text-sm font-medium hover:bg-purple-700 transition-colors flex items-center gap-2"
          >
            📊 Ver Resumen
          </button>
        </div>

        {/* --- CONTENEDOR DE LUCKYSHEET --- */}
        <div className="flex-1 overflow-hidden">
          <Luckysheet
            data={[
              {
                name: 'Metrado',
                celldata: initialCellData,
                column: 15,
                row: 100,
                status: 1,
                index: 0
              },
              {
                name: 'RESUMEN',
                column: 5,
                row: 100,
                index: 1
              }
            ]}
            options={{
              showinfobar: false,
              showsheetbar: true,
              lang: 'es',
              hook: {
                cellUpdated: (r, c, oldValue, newValue) => {
                  if (c === COLS.DES) {
                    const textoActual = newValue?.v || "";

                    // Si borraste el texto y diste Enter (o dejaste la celda vacía)
                    if (textoActual.trim() === "") {

                      window.luckysheet.setCellValue(r, COLS.ITEM, null);
                      window.luckysheet.setCellValue(r, COLS.TOTAL, null);
                    }

                    actualizarNumeracionJerarquica();
                  }
                  // Cálculos normales de las partidas
                  if (c >= COLS.ELEM && c <= COLS.NVEC) {
                    ejecutarCalculo(r);
                  }
                  // Cambio de unidades
                  if (c === COLS.UND) {
                    const itemVal = window.luckysheet.getCellValue(r, COLS.ITEM);
                    const itemStr = String(itemVal?.v || itemVal || "");
                    const nuevaUnidad = newValue?.v || newValue;
                    if (itemStr && !itemStr.includes('.')) {
                      aplicarUnidadEnBloque(r, nuevaUnidad);
                    } else {
                      ejecutarCalculo(r);
                    }
                  }
                }
              }
            }}
          />
        </div>

        {/* --- TUS BOTONES DE PIE DE PÁGINA --- */}
        <div className="p-2 border-t bg-gray-50 flex items-center gap-2">
          <button className="px-4 py-1 border rounded bg-white hover:bg-gray-100 text-sm">
            Añadir
          </button>
          <input type="text" className="w-16 border rounded px-2 py-1 text-sm" placeholder="100" />
          <span className="text-xs text-gray-500">(más filas al final)</span>

          {/* NUEVO BOTÓN SEGURO PARA VOLVER A METRADO */}
          <button
            onClick={() => {
              const ls = window.luckysheet;
              // 1. Obligamos a cerrar cualquier edición para que no "arrastre" errores visuales
              ls.exitEditMode();
              // 2. Volvemos a la hoja principal
              ls.setSheetActive(0);
              // 3. Pequeña espera para que Luckysheet redibuje la tabla completa
              setTimeout(() => {
                ls.refresh();
              }, 150);
            }}
            className="ml-4 px-4 py-1 border rounded bg-blue-600 text-white hover:bg-blue-700 text-sm font-bold shadow-sm"
          >
            ⬅ Volver a Metrado
          </button>

          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="ml-auto px-4 py-1 border rounded bg-white hover:bg-gray-100 text-sm"
          >
            Volver arriba
          </button>
        </div>
      </div>
    </AppLayout>
  );
}