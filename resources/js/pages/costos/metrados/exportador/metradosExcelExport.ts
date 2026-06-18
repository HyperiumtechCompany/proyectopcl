import ExcelJS from 'exceljs';
import { columnasFijas, camposPorEspecialidad } from './metradosColumnasConfig';


function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function detectImageExt(url: string, blob: Blob): 'png' | 'jpeg' | 'gif' | 'bmp' {
  if (blob.type === 'image/jpeg' || url.match(/\.jpe?g$/i)) return 'jpeg';
  if (blob.type === 'image/gif' || url.match(/\.gif$/i)) return 'gif';
  if (blob.type === 'image/bmp' || url.match(/\.bmp$/i)) return 'bmp';
  return 'png';
}

function getFechaFormatoModelo(): string {
  const meses = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
  const hoy = new Date();
  return `${meses[hoy.getMonth()]} ${hoy.getFullYear()}`;
}

// Función para crear el encabezado en una hoja
async function crearEncabezado(
  workbook: ExcelJS.Workbook,
  worksheet: ExcelJS.Worksheet,
  totalColumnas: number,
  proyecto: any,
  especialidad: string
): Promise<number> {
  const logoIzq = proyecto?.plantilla_logo_izq || proyecto?.logo_izq;
  const logoDer = proyecto?.plantilla_logo_der || proyecto?.logo_der;
  
  const modular = proyecto?.codigos_modulares || '-';
  const codigoLocal = proyecto?.codigo_local || '-';
  const cui = proyecto?.codigo_cui || '-';
  
  let ieNombre = proyecto?.nombre || '';
  let ieCodigo = '';
  const match = ieNombre.match(/N°\s*(\d+)/i);
  if (match) {
    ieCodigo = match[1];
  } else {
    ieCodigo = ieNombre.split('-')[0]?.trim() || '-';
  }
  
  const unidadEjecutora = proyecto?.unidad_ejecutora || '-';

  let filaActual = 1;

  // Ajustar anchos de columnas para logos
  worksheet.getColumn(1).width = 6;
  worksheet.getColumn(2).width = 6;
  if (totalColumnas > 2) {
    worksheet.getColumn(totalColumnas - 1).width = 6;
    worksheet.getColumn(totalColumnas).width = 6;
  }

  // Altura de las filas del encabezado
  for (let r = filaActual; r <= filaActual + 3; r++) {
    worksheet.getRow(r).height = 18;
  }

  const f1 = filaActual;

  // Zona logo izquierdo
  if (totalColumnas >= 2) {
    worksheet.mergeCells(f1, 1, f1 + 3, 2);
    const cellZonaIzq = worksheet.getCell(f1, 1);
    cellZonaIzq.value = '';
    cellZonaIzq.border = {
      top: { style: 'medium' },
      bottom: { style: 'medium' },
      left: { style: 'medium' },
      right: { style: 'thin' },
    };
  }

  // Zona texto central
  if (totalColumnas >= 3) {
    worksheet.mergeCells(f1, 3, f1 + 3, totalColumnas - 2);
    const cellCentro = worksheet.getCell(f1, 3);
    cellCentro.value = {
      richText: [
        { font: { bold: true, size: 10, name: 'Arial' }, text: `"${(proyecto?.nombre || 'PROYECTO').toUpperCase()}"\n` },
        { font: { bold: false, size: 9, name: 'Arial' }, text: `CUI: ${cui}; CÓDIGO MODULAR: ${modular}; CÓDIGO LOCAL: ${codigoLocal}\n` },
        { font: { bold: false, size: 9, name: 'Arial' }, text: `I.E. ${ieCodigo}; UNIDAD EJECUTORA: ${unidadEjecutora}` },
      ],
    };
    cellCentro.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cellCentro.border = {
      top: { style: 'medium' },
      bottom: { style: 'medium' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    };
  }

  // Zona logo derecho
  if (totalColumnas >= 2) {
    worksheet.mergeCells(f1, totalColumnas - 1, f1 + 3, totalColumnas);
    const cellZonaDer = worksheet.getCell(f1, totalColumnas - 1);
    cellZonaDer.value = '';
    cellZonaDer.border = {
      top: { style: 'medium' },
      bottom: { style: 'medium' },
      left: { style: 'thin' },
      right: { style: 'medium' },
    };
  }

  // Logo izquierdo
  if (logoIzq && typeof logoIzq === 'string' && logoIzq.trim() !== '') {
    try {
      const url = logoIzq.startsWith('http') ? logoIzq : `/storage/${logoIzq.replace(/^\//, '')}`;
      const response = await fetch(url);
      if (response.ok) {
        const blob = await response.blob();
        const base64 = await blobToBase64(blob);
        let ext = detectImageExt(logoIzq, blob);
        if (ext === 'bmp') ext = 'png'; // exceljs doesn't accept 'bmp', map to png
        const imgId = workbook.addImage({ base64, extension: ext });
        worksheet.addImage(imgId, ({
          tl: { col: 0.15, row: f1 - 1 + 0.15 },
          br: { col: 1.85, row: f1 - 1 + 3.85 },
          editAs: 'oneCell',
        } as any));
      }
    } catch (e) { console.error('Logo izq:', e); }
  }

  // Logo derecho
  if (logoDer && typeof logoDer === 'string' && logoDer.trim() !== '') {
    try {
      const url = logoDer.startsWith('http') ? logoDer : `/storage/${logoDer.replace(/^\//, '')}`;
      const response = await fetch(url);
      if (response.ok) {
        const blob = await response.blob();
        const base64 = await blobToBase64(blob);
        let ext = detectImageExt(logoDer, blob);
        if (ext === 'bmp') ext = 'png'; // exceljs doesn't accept 'bmp', map to png
        const imgId = workbook.addImage({ base64, extension: ext });
        worksheet.addImage(imgId, ({
          tl: { col: totalColumnas - 2 + 0.15, row: f1 - 1 + 0.15 },
          br: { col: totalColumnas - 0.15, row: f1 - 1 + 3.85 },
          editAs: 'oneCell',
        } as any));
      }
    } catch (e) { console.error('Logo der:', e); }
  }

  filaActual = f1 + 4;
  filaActual++; // separador

  // Título de especialidad
  worksheet.mergeCells(filaActual, 1, filaActual, totalColumnas);
  const cellTitEsp = worksheet.getCell(filaActual, 1);
  cellTitEsp.value = `RESUMEN DE METRADO DE ${especialidad.toUpperCase()}`;
  cellTitEsp.font = { bold: true, size: 12, name: 'Arial' };
  cellTitEsp.alignment = { horizontal: 'center', vertical: 'middle' };
  cellTitEsp.border = {
    top: { style: 'medium' },
    bottom: { style: 'medium' },
    left: { style: 'medium' },
    right: { style: 'medium' },
  };
  worksheet.getRow(filaActual).height = 22;
  filaActual++;
  filaActual++;

  // Ficha del proyecto
  const inicioFicha = filaActual;
  const filasFicha = 7;

  worksheet.mergeCells(inicioFicha, 1, inicioFicha + filasFicha - 1, totalColumnas);
  const cellFicha = worksheet.getCell(inicioFicha, 1);
  cellFicha.value = {
    richText: [
      { font: { size: 10, name: 'Arial' }, text: 'Proyecto      : ' },
      { font: { size: 10, name: 'Arial' }, text: `${proyecto?.nombre || '-'}\n` },
      { font: { size: 10, name: 'Arial' }, text: 'Propietario   : ' },
      { font: { size: 10, name: 'Arial' }, text: `${proyecto?.propietario || unidadEjecutora || '-'}\n` },
      { font: { size: 10, name: 'Arial' }, text: 'Fecha         : ' },
      { font: { size: 10, name: 'Arial' }, text: `${getFechaFormatoModelo()}\n` },
      { font: { size: 10, name: 'Arial' }, text: 'Especialidad  : ' },
      { font: { size: 10, name: 'Arial' }, text: `${especialidad.toUpperCase()}\n` },
      { font: { size: 10, name: 'Arial' }, text: 'Módulo        : ' },
      { font: { size: 10, name: 'Arial' }, text: `${proyecto?.modulo || 'GENERAL'}\n` },
      { font: { size: 10, name: 'Arial' }, text: '\n' },
      { font: { size: 10, name: 'Arial' }, text: 'Hecho por     :              Revisado por   :' },
    ],
  };
  cellFicha.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
  cellFicha.border = {
    top: { style: 'medium' },
    bottom: { style: 'medium' },
    left: { style: 'medium' },
    right: { style: 'medium' },
  };

  filaActual = inicioFicha + filasFicha;
  filaActual++;
  filaActual++;

  return filaActual;
}

// Función principal para exportar múltiples hojas
export async function exportarMetradoExcelMultiSheet(
  especialidad: string,
  sheetsData: Array<{ name: string; items: any[]; esResumen?: boolean }>,
  proyecto: any
): Promise<void> {
  if (!sheetsData.length) {
    throw new Error('No hay datos para exportar');
  }

  const workbook = new ExcelJS.Workbook();

  for (const sheetData of sheetsData) {
    const worksheet = workbook.addWorksheet(sheetData.name);
    worksheet.views = [{ showGridLines: false }];

    // Definir columnas según si es resumen o no
    let fijas: string[];
    let campos: string[];
    
    if (sheetData.esResumen) {
      // Columnas para RESÚMEN
      fijas = ['ÍTEM', 'DESCRIPCIÓN', 'UND', 'Módulo I', 'Módulo II', 'Módulo III', 'Exterior', 'Cisterna', 'TOTAL'];
    } else {
      // Columnas para MÓDULOS, EXTERIOR, CISTERNA
      fijas = [ 'ÍTEM', 'DESCRIPCIÓN', 'UND', 'ELEM.SIMIL.', 'LARGO', 'ANCHO', 'ALTO', 'N° VECES', 'LONG.', 'ÁREA', 'VOL.', 'KG.', 'PARCIAL', 'TOTAL'];
    }

    const totalColumnas = fijas.length;
    
    // Crear encabezado
    let filaActual = await crearEncabezado(workbook, worksheet, totalColumnas, proyecto, especialidad);

    // CABECERA DE LA TABLA
    for (let i = 0; i < fijas.length; i++) {
      const cell = worksheet.getCell(filaActual, i + 1);
      cell.value = fijas[i];
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
    }
    filaActual++;

    // DATOS DE LA TABLA
    for (let idx = 0; idx < sheetData.items.length; idx++) {
      const item = sheetData.items[idx];
      let columna = 1;

      if (sheetData.esResumen) {
        // Formato para RESÚMEN
        worksheet.getCell(filaActual, columna++).value = item.item || '';
        worksheet.getCell(filaActual, columna++).value = item.descripcion || '';
        worksheet.getCell(filaActual, columna++).value = item.und || '';
        worksheet.getCell(filaActual, columna++).value = item.modulo1 || 0;
        worksheet.getCell(filaActual, columna++).value = item.modulo2 || 0;
        worksheet.getCell(filaActual, columna++).value = item.modulo3 || 0;
        worksheet.getCell(filaActual, columna++).value = item.exterior || 0;
        worksheet.getCell(filaActual, columna++).value = item.cisterna || 0;
        worksheet.getCell(filaActual, columna++).value = item.total || 0;
      } else {
        // Formato para MÓDULOS
        worksheet.getCell(filaActual, columna++).value = item.item || '';
        worksheet.getCell(filaActual, columna++).value = item.descripcion || '';
        worksheet.getCell(filaActual, columna++).value = item.und || '';
        worksheet.getCell(filaActual, columna++).value = item.elsim || 0;
        worksheet.getCell(filaActual, columna++).value = item.largo || 0;
        worksheet.getCell(filaActual, columna++).value = item.ancho || 0;
        worksheet.getCell(filaActual, columna++).value = item.alto || 0;
        worksheet.getCell(filaActual, columna++).value = item.nveces || 1;
        worksheet.getCell(filaActual, columna++).value = item.lon || 0;
        worksheet.getCell(filaActual, columna++).value = item.area || 0;
        worksheet.getCell(filaActual, columna++).value = item.vol || 0;
        worksheet.getCell(filaActual, columna++).value = item.kg || 0;
        worksheet.getCell(filaActual, columna++).value = item.parcial || 0;
        worksheet.getCell(filaActual, columna++).value = item.total || 0;
      }

      // Aplicar formato numérico a las columnas que son números
      for (let c = 1; c <= totalColumnas; c++) {
        const cell = worksheet.getCell(filaActual, c);
        if (typeof cell.value === 'number') {
          cell.numFmt = '#,##0.00';
        }
        cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
      }

      // Color alternado de filas
      const colorFondo = (idx + 1) % 2 === 0 ? 'FFF5F5F5' : 'FFFFFFFF';
      for (let c = 1; c <= totalColumnas; c++) {
        const cell = worksheet.getCell(filaActual, c);
        if (!cell.fill || (cell.fill as any)?.fgColor?.argb === 'FFFFFFFF' || (cell.fill as any)?.fgColor?.argb === 'FFFFFF') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorFondo } };
        }
      }
      filaActual++;
    }

    // Ajustar anchos de columna
    for (let i = 0; i < fijas.length; i++) {
      worksheet.getColumn(i + 1).width = fijas[i].length > 15 ? 22 : 12;
    }
  }

  // DESCARGAR
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Metrado_${especialidad}_${proyecto?.nombre || 'proyecto'}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Mantener la función original por compatibilidad (opcional)
export async function exportarMetradoExcel(
  especialidad: string,
  items: any[],
  periodos: any[],
  totales: any,
  proyecto: any,
  totalesPorItem: any
): Promise<void> {
  // Redirigir a la nueva función con una sola hoja
  return exportarMetradoExcelMultiSheet(especialidad, [{ name: especialidad.toUpperCase(), items, esResumen: false }], proyecto);
}