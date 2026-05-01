// balance_utils.ts
import { 
  CI, COLS, ROWS, SHEETS, MONTHS, SECTIONS, RESUMEN_LABELS, RESUMEN_GENERAL_COLS,
  HEADER_STYLE, SECTION_STYLE, LEAF_STYLE, TOTAL_STYLE,
  getMonthColumnRange, isMonthColumn 
} from './balance_constants';
import type { BalanceRow, BalanceKind, BalanceCategory, Month } from './balance_types';

// ============================================================================
//  TYPES EXPORTADOS (para reuso en hooks/components)
// ============================================================================

export type CellUpdate = {
  r: number;
  c: number;
  v: any;
};

export type MonthlyResult = {
  ingresos: number;
  gastos: number;
  saldo: number;
};

export type SheetCell = {
  v: any;
  m?: string;
  ct?: { fa: string; t: string };
  bg?: string;
  cl?: string | { fa: string };
  fw?: number;
  st?: number;
  bl?: number;
  ht?: number;
  f?: string;
  bd?: Record<string, number>;
};

// ============================================================================
// UTILIDADES NUMÉRICAS Y DE FORMATO
// ============================================================================

/**
 * Convierte cualquier valor a número seguro
 */
export const toNum = (v: any): number => {
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'string') {
    const cleaned = v.replace(/[^0-9.-]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

/**
 * Redondea a 2 decimales (para moneda)
 */
export const r2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Redondea a 4 decimales (para cálculos intermedios)
 */
export const r4 = (n: number): number => Math.round(n * 10000) / 10000;

/**
 * Formato de moneda para Luckysheet (con símbolo S/)
 */
export const formatCurrency = (value: number): SheetCell => ({
  v: value,
  m: `S/ ${Math.abs(value).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`,
  ct: { fa: 'S/ #,##0.00;[Red]-S/ #,##0.00', t: 'n' },
});

/**
 * Formato de guion para celdas vacías/placeholder
 */
export const formatDash = (): SheetCell => ({
  v: 0,
  m: 'S/ -',
  ct: { fa: 'General', t: 's' },
});

/**
 * Celda con fórmula para Luckysheet
 */
export const mkFormula = (formula: string, value: number): SheetCell => ({
  f: formula,
  v: value,
  m: `S/ ${Math.abs(value).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`,
  ct: { fa: 'S/ #,##0.00;[Red]-S/ #,##0.00', t: 'n' },
  ht: 20,
});

/**
 * Celda numérica simple
 */
export const mkNum = (value: number, readonly = false): SheetCell => ({
  v: value,
  m: `S/ ${Math.abs(value).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`,
  ct: { fa: 'S/ #,##0.00;[Red]-S/ #,##0.00', t: 'n' },
  st: readonly ? 1 : 0,
});

/**
 * Celda de texto con estilos opcionales
 */
export const mkTxt = (text: string, style?: Partial<SheetCell>): SheetCell => ({
  v: text,
  m: text,
  ct: { fa: 'General', t: 's' },
  ...style,
});

/**
 * Celda vacía
 */
export const mkBlank = (): SheetCell => ({
  v: '',
  m: '',
  ct: { fa: 'General', t: 'g' },
});

// ============================================================================
//  UTILIDADES DE COLUMNAS Y FILAS
// ============================================================================

/**
 * Convierte índice de columna a letra (A, B, C... AA, AB...)
 */
export const colLetter = (col: number): string => {
  let letter = '';
  let n = col;
  while (n >= 0) {
    letter = String.fromCharCode((n % 26) + 65) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
};

/**
 * Obtiene el rango de columnas de meses (ene-dic)
 */
export const getMonthColumns = () => {
  const { start, end } = getMonthColumnRange();
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
};

// ============================================================================
//  OPERACIONES CON SHEETS (LUCKYSHEET)
// ============================================================================

/**
 * Suma los valores de una columna en un sheet
 * @param sheet - Objeto sheet de Luckysheet
 * @param colIndex - Índice de columna (0-based)
 * @param startRow - Fila inicial (default: 1, para saltar headers)
 * @param endRow - Fila final (default: última fila con datos)
 */
export const sumColumn = (
  sheet: any, 
  colIndex: number, 
  startRow = 1, 
  endRow?: number
): number => {
  if (!sheet?.data) return 0;
  const maxRow = endRow ?? (sheet.data.length - 1);
  let sum = 0;
  for (let r = startRow; r <= maxRow; r++) {
    const val = sheet.data[r]?.[colIndex]?.v ?? 0;
    sum += toNum(val);
  }
  return r2(sum);
};

/**
 * Busca una fila por su label en la columna de descripción
 * @param sheet - Objeto sheet de Luckysheet
 * @param label - Texto a buscar en la columna de descripción
 * @param labelCol - Columna donde buscar el label (default: COLS.LABEL)
 */
export const getRowByLabel = (
  sheet: any, 
  label: string, 
  labelCol = COLS.LABEL
): any | null => {
  if (!sheet?.data) return null;
  return sheet.data.find((row: any) => row?.[labelCol]?.v === label) ?? null;
};

/**
 * Extrae el valor numérico de una celda específica en una fila
 */
export const getValue = (row: any, col: number): number => {
  return toNum(row?.[col]?.v ?? 0);
};

/**
 * Busca un sheet por nombre en un array de sheets
 */
export const getSheetByName = (sheets: any[], name: string): any | null => {
  return sheets.find(s => s.name === name) ?? null;
};

/**
 * Extrae todos los valores de una fila para las columnas de meses
 */
export const getMonthlyValues = (row: any, startCol = COLS.ene): number[] => {
  if (!row) return Array(MONTHS.length).fill(0);
  return MONTHS.map((_, i) => getValue(row, startCol + i));
};

// ============================================================================
//  CÁLCULOS DE NEGOCIO 
// ============================================================================

/**
 * Calcula el resumen mensual combinando Balance Real y Presupuesto
 */
export const calculateMonthlyResumen = ({
  ingresosBR,
  ingresosPR,
  gastosBR,
  gastosPR,
}: {
  ingresosBR: number;
  ingresosPR: number;
  gastosBR: number;
  gastosPR: number;
}): MonthlyResult => {
  const totalIngresos = r2(ingresosBR + ingresosPR);
  const totalGastos = r2(gastosBR + gastosPR);
  return {
    ingresos: totalIngresos,
    gastos: totalGastos,
    saldo: r2(totalIngresos - totalGastos),
  };
};

/**
 * Calcula la diferencia entre dos saldos (ej: Real vs Presupuesto)
 */
export const calculateDiferenciaBalances = (saldoA: number, saldoB: number): number => {
  return r2(saldoA - saldoB);
};

/**
 * Calcula el estado de cuenta (solo Balance Real)
 */
export const calculateEstadoCuenta = (ingresosBR: number, gastosBR: number): number => {
  return r2(ingresosBR - gastosBR);
};

/**
 * Calcula todos los resultados mensuales para el resumen general
 */
export const calculateResumenGeneralData = ({
  brIngresosRow,
  brGastosRow,
  prIngresosRow,
  prGastosRow,
}: {
  brIngresosRow: any;
  brGastosRow: any;
  prIngresosRow: any;
  prGastosRow: any;
}): MonthlyResult[] => {
  return MONTHS.map((_, monthIndex) => {
    const colIndex = COLS.ene + monthIndex;
    
    const ingresosBR = getValue(brIngresosRow, colIndex);
    const gastosBR = getValue(brGastosRow, colIndex);
    const ingresosPR = getValue(prIngresosRow, colIndex);
    const gastosPR = getValue(prGastosRow, colIndex);
    
    return calculateMonthlyResumen({ ingresosBR, ingresosPR, gastosBR, gastosPR });
  });
};

// ============================================================================
//  GENERACIÓN DE UPDATES PARA LUCKYSHEET
// ============================================================================

/**
 * Construye los updates para las filas principales del resumen general
 */
export const buildResumenUpdates = ({
  monthlyResults,
  startRow = ROWS.RESUMEN_GENERAL.START,
  labelCol = COLS.LABEL,
  monthStartCol = COLS.ene,
}: {
  monthlyResults: MonthlyResult[];
  startRow?: number;
  labelCol?: number;
  monthStartCol?: number;
}): CellUpdate[] => {
  const updates: CellUpdate[] = [];

  // === INGRESOS ===
  updates.push({ 
    r: startRow + ROWS.RESUMEN_GENERAL.INGRESOS_TOTAL, 
    c: labelCol, 
    v: mkTxt(RESUMEN_LABELS.INGRESOS) 
  });
  monthlyResults.forEach((result, i) => {
    updates.push({ 
      r: startRow + ROWS.RESUMEN_GENERAL.INGRESOS_TOTAL, 
      c: monthStartCol + i, 
      v: formatCurrency(result.ingresos) 
    });
  });

  // === GASTOS ===
  updates.push({ 
    r: startRow + ROWS.RESUMEN_GENERAL.GASTOS_TOTAL, 
    c: labelCol, 
    v: mkTxt(RESUMEN_LABELS.GASTOS) 
  });
  monthlyResults.forEach((result, i) => {
    updates.push({ 
      r: startRow + ROWS.RESUMEN_GENERAL.GASTOS_TOTAL, 
      c: monthStartCol + i, 
      v: formatCurrency(result.gastos) 
    });
  });

  // === SALDO ===
  updates.push({ 
    r: startRow + ROWS.RESUMEN_GENERAL.SALDO, 
    c: labelCol, 
    v: mkTxt(RESUMEN_LABELS.RESUMEN_SALDO) 
  });
  monthlyResults.forEach((result, i) => {
    updates.push({ 
      r: startRow + ROWS.RESUMEN_GENERAL.SALDO, 
      c: monthStartCol + i, 
      v: { 
        ...formatCurrency(result.saldo), 
        bg: result.saldo >= 0 ? '#e8f5e9' : '#ffebee' 
      } 
    });
  });

  return updates;
};

/**
 * Construye updates para la sección "Estado de Cuenta"
 */
export const buildEstadoCuentaUpdates = ({
  brIngresosRow,
  brGastosRow,
  startRow = ROWS.RESUMEN_GENERAL.ESTADO_CUENTA,
  labelCol = COLS.LABEL,
  monthStartCol = COLS.ene,
}: {
  brIngresosRow: any;
  brGastosRow: any;
  startRow?: number;
  labelCol?: number;
  monthStartCol?: number;
}): CellUpdate[] => {
  const updates: CellUpdate[] = [];

  // Título con estilo
  updates.push({ 
    r: startRow, 
    c: labelCol, 
    v: mkTxt(RESUMEN_LABELS.ESTADO_CUENTA, { 
      bl: 1, 
      bg: '#ffeb3b',
      ct: { fa: 'General', t: 's' }
    }) 
  });

  // Valores mensuales
  MONTHS.forEach((_, i) => {
    const colIndex = monthStartCol + i;
    const ingBR = getValue(brIngresosRow, colIndex);
    const gasBR = getValue(brGastosRow, colIndex);
    const saldo = calculateEstadoCuenta(ingBR, gasBR);
    
    updates.push({ 
      r: startRow, 
      c: colIndex, 
      v: formatCurrency(saldo) 
    });
  });

  return updates;
};

/**
 * Construye updates para la sección "Diferencia de Balances"
 */
export const buildDiferenciaUpdates = ({
  brIngresosRow,
  brGastosRow,
  prIngresosRow,
  prGastosRow,
  startRow = ROWS.RESUMEN_GENERAL.DIFERENCIA,
  labelCol = COLS.LABEL,
  monthStartCol = COLS.ene,
}: {
  brIngresosRow: any;
  brGastosRow: any;
  prIngresosRow: any;
  prGastosRow: any;
  startRow?: number;
  labelCol?: number;
  monthStartCol?: number;
}): CellUpdate[] => {
  const updates: CellUpdate[] = [];

  // Título con estilo
  updates.push({ 
    r: startRow, 
    c: labelCol, 
    v: mkTxt(RESUMEN_LABELS.DIFERENCIA, { 
      bl: 1, 
      bg: '#ff9800',
      ct: { fa: 'General', t: 's' }
    }) 
  });

  // Valores mensuales
  MONTHS.forEach((_, i) => {
    const colIndex = monthStartCol + i;
    
    const saldoBR = getValue(brIngresosRow, colIndex) - getValue(brGastosRow, colIndex);
    const saldoPR = getValue(prIngresosRow, colIndex) - getValue(prGastosRow, colIndex);
    const diff = calculateDiferenciaBalances(saldoBR, saldoPR);
    
    updates.push({ 
      r: startRow, 
      c: colIndex, 
      v: formatCurrency(diff) 
    });
  });

  return updates;
};

// ============================================================================
//  CONSTRUCCIÓN DE FÓRMULAS Y RECÁLCULOS (TU LÓGICA ORIGINAL MEJORADA)
// ============================================================================

/**
 * Construye updates con fórmulas para recalcular totales en hojas de detalle
 * Mantiene compatibilidad con tu implementación original
 */
export const buildRecalcUpdates = (sheetData: any[][]) => {
  const updates: CellUpdate[] = [];
  const startCol = CI.ene;
  const endCol = CI.dic;

  let currentHeaderRow: number | null = null;
  let groupRows: number[] = [];

  const pushHeaderTotals = () => {
    if (currentHeaderRow === null || groupRows.length === 0) return;

    // SUMA POR COLUMNA (ENE → DIC)
    for (let c = startCol; c <= endCol; c++) {
      const colLetterStr = colLetter(c);
      const ranges = groupRows.map(r => `${colLetterStr}${r + 1}`).join(',');

      updates.push({
        r: currentHeaderRow,
        c,
        v: {
          f: `=SUM(${ranges})`,
          ct: { fa: 'S/ #,##0.00;[Red]-S/ #,##0.00', t: 'n' },
        },
      });
    }

    // TOTAL ANUAL DEL HEADER
    const startLetter = colLetter(startCol);
    const endLetter = colLetter(endCol);

    updates.push({
      r: currentHeaderRow,
      c: CI.total,
      v: {
        f: `=SUM(${startLetter}${currentHeaderRow + 1}:${endLetter}${currentHeaderRow + 1})`,
        ct: { fa: 'S/ #,##0.00;[Red]-S/ #,##0.00', t: 'n' },
      },
    });
  };

  for (let r = 1; r < sheetData.length; r++) {
    const row = sheetData[r];
    if (!row) continue;

    const desc = row[CI.descripcion]?.v ?? '';
    const isHeader = desc.includes('TOTALES');

    if (isHeader) {
      pushHeaderTotals();
      currentHeaderRow = r;
      groupRows = [];
      continue;
    }

    // Fórmula para total anual de fila normal
    const startLetter = colLetter(startCol);
    const endLetter = colLetter(endCol);

    updates.push({
      r,
      c: CI.total,
      v: {
        f: `=SUM(${startLetter}${r + 1}:${endLetter}${r + 1})`,
        ct: { fa: 'S/ #,##0.00;[Red]-S/ #,##0.00', t: 'n' },
      },
    });

    if (currentHeaderRow !== null) {
      groupRows.push(r);
    }
  }

  pushHeaderTotals();
  return updates;
};

// ============================================================================
//  BUILDERS DE FILAS Y SHEETS 
// ============================================================================

/**
 * Construye filas por defecto para inicializar un balance vacío
 */
export function buildBalanceRows(): BalanceRow[] {
  const rows: BalanceRow[] = [];

  // === INGRESOS ===
  rows.push(
    { _kind: 'header', descripcion: SECTIONS.INGRESOS_TOTALES, category: 'header', 
      ene: 0, febr: 0, mar: 0, abr: 0, may: 0, jun: 0, 
      jul: 0, agos: 0, set: 0, oct: 0, nov: 0, dic: 0, total: 0 },
    { _kind: 'ingreso', descripcion: SECTIONS.INGRESOS_PROYECTOS, category: 'proyectos', 
      ene: 0, febr: 0, mar: 0, abr: 0, may: 0, jun: 0, 
      jul: 0, agos: 0, set: 0, oct: 0, nov: 0, dic: 0, total: 0 },
    { _kind: 'ingreso', descripcion: SECTIONS.INGRESOS_INVERSION, category: 'inversion', 
      ene: 0, febr: 0, mar: 0, abr: 0, may: 0, jun: 0, 
      jul: 0, agos: 0, set: 0, oct: 0, nov: 0, dic: 0, total: 0 },
    { _kind: 'ingreso', descripcion: SECTIONS.INGRESOS_FINANCIAMIENTO, category: 'financiamiento', 
      ene: 0, febr: 0, mar: 0, abr: 0, may: 0, jun: 0, 
      jul: 0, agos: 0, set: 0, oct: 0, nov: 0, dic: 0, total: 0 },
  );
  
  // === GASTOS ===
  rows.push(
    { _kind: 'header', descripcion: SECTIONS.GASTOS_TOTALES, category: 'header', 
      ene: 0, febr: 0, mar: 0, abr: 0, may: 0, jun: 0, 
      jul: 0, agos: 0, set: 0, oct: 0, nov: 0, dic: 0, total: 0 },
    { _kind: 'gasto', descripcion: SECTIONS.TRIBUTOS, category: 'tributos', 
      ene: 0, febr: 0, mar: 0, abr: 0, may: 0, jun: 0, 
      jul: 0, agos: 0, set: 0, oct: 0, nov: 0, dic: 0, total: 0 },
    { _kind: 'gasto', descripcion: `  ${SECTIONS.ITFS}`, category: 'tributos', 
      ene: 0, febr: 0, mar: 0, abr: 0, may: 0, jun: 0, 
      jul: 0, agos: 0, set: 0, oct: 0, nov: 0, dic: 0, total: 0 },
    { _kind: 'gasto', descripcion: SECTIONS.PROYECTOS, category: 'proyectos', 
      ene: 0, febr: 0, mar: 0, abr: 0, may: 0, jun: 0, 
      jul: 0, agos: 0, set: 0, oct: 0, nov: 0, dic: 0, total: 0 },
    { _kind: 'gasto', descripcion: SECTIONS.SUELDOS, category: 'sueldos', 
      ene: 0, febr: 0, mar: 0, abr: 0, may: 0, jun: 0, 
      jul: 0, agos: 0, set: 0, oct: 0, nov: 0, dic: 0, total: 0 },
    { _kind: 'gasto', descripcion: SECTIONS.CONTABILIDAD, category: 'servicios', 
      ene: 0, febr: 0, mar: 0, abr: 0, may: 0, jun: 0, 
      jul: 0, agos: 0, set: 0, oct: 0, nov: 0, dic: 0, total: 0 },
    { _kind: 'gasto', descripcion: `  ${SECTIONS.RENTA}`, category: 'servicios', 
      ene: 0, febr: 0, mar: 0, abr: 0, may: 0, jun: 0, 
      jul: 0, agos: 0, set: 0, oct: 0, nov: 0, dic: 0, total: 0 },
    { _kind: 'gasto', descripcion: SECTIONS.OPERATIVOS, category: 'operativos', 
      ene: 0, febr: 0, mar: 0, abr: 0, may: 0, jun: 0, 
      jul: 0, agos: 0, set: 0, oct: 0, nov: 0, dic: 0, total: 0 },
    { _kind: 'gasto', descripcion: `  ${SECTIONS.COMIDA}`, category: 'operativos', 
      ene: 0, febr: 0, mar: 0, abr: 0, may: 0, jun: 0, 
      jul: 0, agos: 0, set: 0, oct: 0, nov: 0, dic: 0, total: 0 },
    { _kind: 'gasto', descripcion: `  ${SECTIONS.COMBUSTIBLE}`, category: 'operativos', 
      ene: 0, febr: 0, mar: 0, abr: 0, may: 0, jun: 0, 
      jul: 0, agos: 0, set: 0, oct: 0, nov: 0, dic: 0, total: 0 },
    { _kind: 'gasto', descripcion: SECTIONS.MANTENIMIENTO_OFICINA, category: 'mantenimiento', 
      ene: 0, febr: 0, mar: 0, abr: 0, may: 0, jun: 0, 
      jul: 0, agos: 0, set: 0, oct: 0, nov: 0, dic: 0, total: 0 },
    { _kind: 'gasto', descripcion: `  ${SECTIONS.MANTENIMIENTO_VEHICULAR}`, category: 'mantenimiento', 
      ene: 0, febr: 0, mar: 0, abr: 0, may: 0, jun: 0, 
      jul: 0, agos: 0, set: 0, oct: 0, nov: 0, dic: 0, total: 0 },
    { _kind: 'gasto', descripcion: SECTIONS.SALUD, category: 'sociales', 
      ene: 0, febr: 0, mar: 0, abr: 0, may: 0, jun: 0, 
      jul: 0, agos: 0, set: 0, oct: 0, nov: 0, dic: 0, total: 0 },
    { _kind: 'gasto', descripcion: `  ${SECTIONS.SALUD}`, category: 'sociales', 
      ene: 0, febr: 0, mar: 0, abr: 0, may: 0, jun: 0, 
      jul: 0, agos: 0, set: 0, oct: 0, nov: 0, dic: 0, total: 0 },
    { _kind: 'gasto', descripcion: `  ${SECTIONS.DONACIONES}`, category: 'sociales', 
      ene: 0, febr: 0, mar: 0, abr: 0, may: 0, jun: 0, 
      jul: 0, agos: 0, set: 0, oct: 0, nov: 0, dic: 0, total: 0 },
    { _kind: 'gasto', descripcion: SECTIONS.GASTOS_INVERSION, category: 'inversion', 
      ene: 0, febr: 0, mar: 0, abr: 0, may: 0, jun: 0, 
      jul: 0, agos: 0, set: 0, oct: 0, nov: 0, dic: 0, total: 0 },
    { _kind: 'gasto', descripcion: SECTIONS.GASTOS_FINANCIAMIENTO, category: 'financiamiento', 
      ene: 0, febr: 0, mar: 0, abr: 0, may: 0, jun: 0, 
      jul: 0, agos: 0, set: 0, oct: 0, nov: 0, dic: 0, total: 0 },
  );
  
  return rows;
}

/**
 * Construye filas base para un sheet de resumen interno (BR_Resumen / PR_Resumen)
 */
export function buildResumenRows() {
  const emptyMonth = {
    ene: 0, febr: 0, mar: 0, abr: 0, may: 0, jun: 0,
    jul: 0, agos: 0, set: 0, oct: 0, nov: 0, dic: 0, total: 0,
  };

  return [
    // === INGRESOS ===
    {
      _kind: 'header' as const,
      descripcion: RESUMEN_LABELS.INGRESOS,
      category: 'header',
      ...emptyMonth,
    },
    {
      _kind: 'resumen' as const,
      descripcion: RESUMEN_LABELS.INGRESOS_PROYECTO,
      category: 'proyectos',
      ...emptyMonth,
    },
    {
      _kind: 'resumen' as const,
      descripcion: RESUMEN_LABELS.INGRESOS_INVERSION,
      category: 'inversion',
      ...emptyMonth,
    },
    {
      _kind: 'resumen' as const,
      descripcion: RESUMEN_LABELS.INGRESOS_FINANCIAMIENTO,
      category: 'financiamiento',
      ...emptyMonth,
    },
    {
      _kind: 'header' as const,
      descripcion: RESUMEN_LABELS.INGRESOS_TOTAL,
      category: 'header',
      ...emptyMonth,
    },
    
    // === GASTOS ===
    {
      _kind: 'header' as const,
      descripcion: RESUMEN_LABELS.GASTOS,
      category: 'header',
      ...emptyMonth,
    },
    {
      _kind: 'resumen' as const,
      descripcion: RESUMEN_LABELS.GASTOS_PROYECTO,
      category: 'proyectos',
      ...emptyMonth,
    },
    {
      _kind: 'resumen' as const,
      descripcion: RESUMEN_LABELS.GASTOS_INVERSION,
      category: 'inversion',
      ...emptyMonth,
    },
    {
      _kind: 'resumen' as const,
      descripcion: RESUMEN_LABELS.GASTOS_FINANCIAMIENTO,
      category: 'financiamiento',
      ...emptyMonth,
    },
    {
      _kind: 'header' as const,
      descripcion: RESUMEN_LABELS.GASTOS_TOTAL,
      category: 'header',
      ...emptyMonth,
    },
    
    // === ESTADOS ===
    {
      _kind: 'header' as const,
      descripcion: 'ESTADOS',
      category: 'header',
      ...emptyMonth,
    },
    {
      _kind: 'resumen' as const,
      descripcion: RESUMEN_LABELS.ESTADO_INVERSION,
      category: 'inversion',
      ...emptyMonth,
    },
    {
      _kind: 'resumen' as const,
      descripcion: RESUMEN_LABELS.ESTADO_FINANCIAMIENTO,
      category: 'financiamiento',
      ...emptyMonth,
    },
    
    // === RESUMEN ===
    {
      _kind: 'header' as const,
      descripcion: 'RESUMEN',
      category: 'header',
      ...emptyMonth,
    },
    {
      _kind: 'resumen' as const,
      descripcion: RESUMEN_LABELS.MONTO,
      category: 'otros',
      ...emptyMonth,
    },
    {
      _kind: 'resumen' as const,
      descripcion: RESUMEN_LABELS.RESUMEN_INGRESOS,
      category: 'header',
      ...emptyMonth,
    },
    {
      _kind: 'resumen' as const,
      descripcion: RESUMEN_LABELS.RESUMEN_GASTOS,
      category: 'header',
      ...emptyMonth,
    },
    {
      _kind: 'resumen' as const,
      descripcion: RESUMEN_LABELS.RESUMEN_SALDO,
      category: 'header',
      ...emptyMonth,
    },
    {
      _kind: 'resumen' as const,
      descripcion: RESUMEN_LABELS.AHORRO_NETO,
      category: 'otros',
      ...emptyMonth,
    },
  ];
}

/**
 * Construye updates para recalcular el resumen interno (BR_Resumen / PR_Resumen)
 * Suma las categorías de Ingresos/Gastos desde las hojas de detalle
 */
export const buildResumenInternoUpdates = (
  ingresosSheet: any,
  gastosSheet: any,
  startRow = 0
): CellUpdate[] => {
  const updates: CellUpdate[] = [];
  const monthCols = getMonthColumns();
  
  // Helper para sumar una categoría específica
  const sumCategory = (category: string, sheet: any, monthIndex: number): number => {
    if (!sheet?.data) return 0;
    let sum = 0;
    for (let r = 1; r < sheet.data.length; r++) {
      const row = sheet.data[r];
      const rowCategory = row?.[COLS.LABEL + 1]?.v ?? ''; // columna requerimiento/category
      const desc = row?.[COLS.LABEL]?.v ?? '';
      
      // Verificar si coincide la categoría
      if (desc.toLowerCase().includes(category.toLowerCase())) {
        const colIndex = COLS.ene + monthIndex;
        sum += toNum(row?.[colIndex]?.v ?? 0);
      }
    }
    return r2(sum);
  };

  // === INGRESOS ===
  // Ingresos por proyecto
  monthCols.forEach((col, i) => {
    const val = sumCategory('proyecto', ingresosSheet, i);
    updates.push({
      r: startRow + ROWS.RESUMEN_INTERNO.INGRESOS_PROYECTO,
      c: col,
      v: formatCurrency(val),
    });
  });

  // Ingresos de inversión
  monthCols.forEach((col, i) => {
    const val = sumCategory('inversion', ingresosSheet, i);
    updates.push({
      r: startRow + ROWS.RESUMEN_INTERNO.INGRESOS_INVERSION,
      c: col,
      v: formatCurrency(val),
    });
  });

  // Ingresos de financiamiento
  monthCols.forEach((col, i) => {
    const val = sumCategory('financiamiento', ingresosSheet, i);
    updates.push({
      r: startRow + ROWS.RESUMEN_INTERNO.INGRESOS_FINANCIAMIENTO,
      c: col,
      v: formatCurrency(val),
    });
  });

  // Total Ingresos (suma de las 3 categorías)
  monthCols.forEach((col, i) => {
    const proyecto = sumCategory('proyecto', ingresosSheet, i);
    const inversion = sumCategory('inversion', ingresosSheet, i);
    const financiamiento = sumCategory('financiamiento', ingresosSheet, i);
    const total = r2(proyecto + inversion + financiamiento);
    
    updates.push({
      r: startRow + ROWS.RESUMEN_INTERNO.INGRESOS_TOTAL,
      c: col,
      v: formatCurrency(total),
    });
  });

  // === GASTOS ===
  // Gastos por proyecto
  monthCols.forEach((col, i) => {
    const val = sumCategory('proyecto', gastosSheet, i);
    updates.push({
      r: startRow + ROWS.RESUMEN_INTERNO.GASTOS_PROYECTO,
      c: col,
      v: formatCurrency(val),
    });
  });

  // Gastos de inversión
  monthCols.forEach((col, i) => {
    const val = sumCategory('inversion', gastosSheet, i);
    updates.push({
      r: startRow + ROWS.RESUMEN_INTERNO.GASTOS_INVERSION,
      c: col,
      v: formatCurrency(val),
    });
  });

  // Gastos de financiamiento
  monthCols.forEach((col, i) => {
    const val = sumCategory('financiamiento', gastosSheet, i);
    updates.push({
      r: startRow + ROWS.RESUMEN_INTERNO.GASTOS_FINANCIAMIENTO,
      c: col,
      v: formatCurrency(val),
    });
  });

  // Total Gastos
  monthCols.forEach((col, i) => {
    const proyecto = sumCategory('proyecto', gastosSheet, i);
    const inversion = sumCategory('inversion', gastosSheet, i);
    const financiamiento = sumCategory('financiamiento', gastosSheet, i);
    const total = r2(proyecto + inversion + financiamiento);
    
    updates.push({
      r: startRow + ROWS.RESUMEN_INTERNO.GASTOS_TOTAL,
      c: col,
      v: formatCurrency(total),
    });
  });

  // === RESUMEN ===
  // Ingresos (total)
  monthCols.forEach((col, i) => {
    const totalIngresos = r2(
      sumCategory('proyecto', ingresosSheet, i) +
      sumCategory('inversion', ingresosSheet, i) +
      sumCategory('financiamiento', ingresosSheet, i)
    );
    updates.push({
      r: startRow + ROWS.RESUMEN_INTERNO.RESUMEN_INGRESOS,
      c: col,
      v: formatCurrency(totalIngresos),
    });
  });

  // Gastos (total)
  monthCols.forEach((col, i) => {
    const totalGastos = r2(
      sumCategory('proyecto', gastosSheet, i) +
      sumCategory('inversion', gastosSheet, i) +
      sumCategory('financiamiento', gastosSheet, i)
    );
    updates.push({
      r: startRow + ROWS.RESUMEN_INTERNO.RESUMEN_GASTOS,
      c: col,
      v: formatCurrency(totalGastos),
    });
  });

  // Saldo
  monthCols.forEach((col, i) => {
    const totalIngresos = r2(
      sumCategory('proyecto', ingresosSheet, i) +
      sumCategory('inversion', ingresosSheet, i) +
      sumCategory('financiamiento', ingresosSheet, i)
    );
    const totalGastos = r2(
      sumCategory('proyecto', gastosSheet, i) +
      sumCategory('inversion', gastosSheet, i) +
      sumCategory('financiamiento', gastosSheet, i)
    );
    const saldo = r2(totalIngresos - totalGastos);
    
    updates.push({
      r: startRow + ROWS.RESUMEN_INTERNO.RESUMEN_SALDO,
      c: col,
      v: {
        ...formatCurrency(saldo),
        bg: saldo >= 0 ? '#e8f5e9' : '#ffebee',
      },
    });
  });

  // Ahorro neto (placeholder por ahora)
  monthCols.forEach((col) => {
    updates.push({
      r: startRow + ROWS.RESUMEN_INTERNO.AHORRO_NETO,
      c: col,
      v: formatDash(),
    });
  });

  return updates;
};

/**
 * Construye updates para el Resumen General Comparativo
 * Compara BR_Resumen vs PR_Resumen item por item
 */
export const buildResumenGeneralComparativo = (
  brResumen: any,
  prResumen: any,
  startRow = 0
): CellUpdate[] => {
  const updates: CellUpdate[] = [];
  
  const formatCurrency = (val: number): SheetCell => ({
    v: val,
    m: `S/ ${Math.abs(val).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`,
    ct: { fa: 'S/ #,##0.00;[Red]-S/ #,##0.00', t: 'n' },
  });

  const formatPercent = (val: number): SheetCell => ({
    v: val,
    m: `${val.toFixed(2)}%`,
    ct: { fa: '0.00%;[Red]-0.00%', t: 'n' },
  });

  const formatLabel = (text: string, isHeader = false): SheetCell => ({
    v: text,
    m: text,
    ct: { fa: 'General', t: 's' },
    bg: isHeader ? '#d1ecf1' : undefined,
    fw: isHeader ? 1 : undefined,
    bl: isHeader ? 1 : undefined,
  });

  // Helper para obtener valor total de una fila por label
  const getTotalByLabel = (sheet: any, label: string): number => {
    const row = sheet?.data?.find((r: any) => r?.[COLS.LABEL]?.v === label);
    if (!row) return 0;
    
    // Sumar todos los meses
    let total = 0;
    MONTHS.forEach((_, i) => {
      total += toNum(row?.[COLS.ene + i]?.v ?? 0);
    });
    return r2(total);
  };

  // === HEADER ===
  updates.push({ r: startRow, c: RESUMEN_GENERAL_COLS.LABEL, v: formatLabel('DETALLES', true) });
  updates.push({ r: startRow, c: RESUMEN_GENERAL_COLS.BAL_REAL, v: formatLabel('BAL. REAL', true) });
  updates.push({ r: startRow, c: RESUMEN_GENERAL_COLS.PRESUPUESTO, v: formatLabel('PRESUPUESTO', true) });
  updates.push({ r: startRow, c: RESUMEN_GENERAL_COLS.VARIACION, v: formatLabel('VARIACIÓN', true) });
  updates.push({ r: startRow, c: RESUMEN_GENERAL_COLS.VARIACION_PCT, v: formatLabel('%', true) });

  // === INGRESOS ===
  const ingProyectoBR = getTotalByLabel(brResumen, RESUMEN_LABELS.INGRESOS_PROYECTO);
  const ingProyectoPR = getTotalByLabel(prResumen, RESUMEN_LABELS.INGRESOS_PROYECTO);
  const varIngProyecto = r2(ingProyectoBR - ingProyectoPR);
  const pctIngProyecto = ingProyectoPR !== 0 ? r2((varIngProyecto / ingProyectoPR) * 100) : 0;

  updates.push({ 
    r: startRow + ROWS.RESUMEN_GENERAL.INGRESOS_PROYECTO, 
    c: RESUMEN_GENERAL_COLS.LABEL, 
    v: formatLabel('Ingresos por Proyecto') 
  });
  updates.push({ 
    r: startRow + ROWS.RESUMEN_GENERAL.INGRESOS_PROYECTO, 
    c: RESUMEN_GENERAL_COLS.BAL_REAL, 
    v: formatCurrency(ingProyectoBR) 
  });
  updates.push({ 
    r: startRow + ROWS.RESUMEN_GENERAL.INGRESOS_PROYECTO, 
    c: RESUMEN_GENERAL_COLS.PRESUPUESTO, 
    v: formatCurrency(ingProyectoPR) 
  });
  updates.push({ 
    r: startRow + ROWS.RESUMEN_GENERAL.INGRESOS_PROYECTO, 
    c: RESUMEN_GENERAL_COLS.VARIACION, 
    v: { ...formatCurrency(varIngProyecto), bg: varIngProyecto >= 0 ? '#e8f5e9' : '#ffebee' } 
  });
  updates.push({ 
    r: startRow + ROWS.RESUMEN_GENERAL.INGRESOS_PROYECTO, 
    c: RESUMEN_GENERAL_COLS.VARIACION_PCT, 
    v: { ...formatPercent(pctIngProyecto), bg: pctIngProyecto >= 0 ? '#e8f5e9' : '#ffebee' } 
  });

  // Ingresos Inversión
  const ingInversionBR = getTotalByLabel(brResumen, RESUMEN_LABELS.INGRESOS_INVERSION);
  const ingInversionPR = getTotalByLabel(prResumen, RESUMEN_LABELS.INGRESOS_INVERSION);
  const varIngInversion = r2(ingInversionBR - ingInversionPR);
  const pctIngInversion = ingInversionPR !== 0 ? r2((varIngInversion / ingInversionPR) * 100) : 0;

  updates.push({ 
    r: startRow + ROWS.RESUMEN_GENERAL.INGRESOS_INVERSION, 
    c: RESUMEN_GENERAL_COLS.LABEL, 
    v: formatLabel('Ingresos de Inversión') 
  });
  updates.push({ r: startRow + ROWS.RESUMEN_GENERAL.INGRESOS_INVERSION, c: RESUMEN_GENERAL_COLS.BAL_REAL, v: formatCurrency(ingInversionBR) });
  updates.push({ r: startRow + ROWS.RESUMEN_GENERAL.INGRESOS_INVERSION, c: RESUMEN_GENERAL_COLS.PRESUPUESTO, v: formatCurrency(ingInversionPR) });
  updates.push({ r: startRow + ROWS.RESUMEN_GENERAL.INGRESOS_INVERSION, c: RESUMEN_GENERAL_COLS.VARIACION, v: { ...formatCurrency(varIngInversion), bg: varIngInversion >= 0 ? '#e8f5e9' : '#ffebee' } });
  updates.push({ r: startRow + ROWS.RESUMEN_GENERAL.INGRESOS_INVERSION, c: RESUMEN_GENERAL_COLS.VARIACION_PCT, v: { ...formatPercent(pctIngInversion), bg: pctIngInversion >= 0 ? '#e8f5e9' : '#ffebee' } });

  // Ingresos Financiamiento
  const ingFinBR = getTotalByLabel(brResumen, RESUMEN_LABELS.INGRESOS_FINANCIAMIENTO);
  const ingFinPR = getTotalByLabel(prResumen, RESUMEN_LABELS.INGRESOS_FINANCIAMIENTO);
  const varIngFin = r2(ingFinBR - ingFinPR);
  const pctIngFin = ingFinPR !== 0 ? r2((varIngFin / ingFinPR) * 100) : 0;

  updates.push({ 
    r: startRow + ROWS.RESUMEN_GENERAL.INGRESOS_FINANCIAMIENTO, 
    c: RESUMEN_GENERAL_COLS.LABEL, 
    v: formatLabel('Ingresos de Financiamiento') 
  });
  updates.push({ r: startRow + ROWS.RESUMEN_GENERAL.INGRESOS_FINANCIAMIENTO, c: RESUMEN_GENERAL_COLS.BAL_REAL, v: formatCurrency(ingFinBR) });
  updates.push({ r: startRow + ROWS.RESUMEN_GENERAL.INGRESOS_FINANCIAMIENTO, c: RESUMEN_GENERAL_COLS.PRESUPUESTO, v: formatCurrency(ingFinPR) });
  updates.push({ r: startRow + ROWS.RESUMEN_GENERAL.INGRESOS_FINANCIAMIENTO, c: RESUMEN_GENERAL_COLS.VARIACION, v: { ...formatCurrency(varIngFin), bg: varIngFin >= 0 ? '#e8f5e9' : '#ffebee' } });
  updates.push({ r: startRow + ROWS.RESUMEN_GENERAL.INGRESOS_FINANCIAMIENTO, c: RESUMEN_GENERAL_COLS.VARIACION_PCT, v: { ...formatPercent(pctIngFin), bg: pctIngFin >= 0 ? '#e8f5e9' : '#ffebee' } });

  // Total Ingresos
  const totalIngBR = ingProyectoBR + ingInversionBR + ingFinBR;
  const totalIngPR = ingProyectoPR + ingInversionPR + ingFinPR;
  const varTotalIng = r2(totalIngBR - totalIngPR);
  const pctTotalIng = totalIngPR !== 0 ? r2((varTotalIng / totalIngPR) * 100) : 0;

  updates.push({ 
    r: startRow + ROWS.RESUMEN_GENERAL.INGRESOS_TOTAL, 
    c: RESUMEN_GENERAL_COLS.LABEL, 
    v: formatLabel('TOTAL INGRESOS', true) 
  });
  updates.push({ r: startRow + ROWS.RESUMEN_GENERAL.INGRESOS_TOTAL, c: RESUMEN_GENERAL_COLS.BAL_REAL, v: formatCurrency(totalIngBR) });
  updates.push({ r: startRow + ROWS.RESUMEN_GENERAL.INGRESOS_TOTAL, c: RESUMEN_GENERAL_COLS.PRESUPUESTO, v: formatCurrency(totalIngPR) });
  updates.push({ r: startRow + ROWS.RESUMEN_GENERAL.INGRESOS_TOTAL, c: RESUMEN_GENERAL_COLS.VARIACION, v: { ...formatCurrency(varTotalIng), bg: varTotalIng >= 0 ? '#e8f5e9' : '#ffebee', fw: 1 } });
  updates.push({ r: startRow + ROWS.RESUMEN_GENERAL.INGRESOS_TOTAL, c: RESUMEN_GENERAL_COLS.VARIACION_PCT, v: { ...formatPercent(pctTotalIng), bg: pctTotalIng >= 0 ? '#e8f5e9' : '#ffebee', fw: 1 } });

  // === GASTOS ===
  const gasProyectoBR = getTotalByLabel(brResumen, RESUMEN_LABELS.GASTOS_PROYECTO);
  const gasProyectoPR = getTotalByLabel(prResumen, RESUMEN_LABELS.GASTOS_PROYECTO);
  const varGasProyecto = r2(gasProyectoBR - gasProyectoPR);
  const pctGasProyecto = gasProyectoPR !== 0 ? r2((varGasProyecto / gasProyectoPR) * 100) : 0;

  updates.push({ 
    r: startRow + ROWS.RESUMEN_GENERAL.GASTOS_PROYECTO, 
    c: RESUMEN_GENERAL_COLS.LABEL, 
    v: formatLabel('Gastos por Proyecto') 
  });
  updates.push({ r: startRow + ROWS.RESUMEN_GENERAL.GASTOS_PROYECTO, c: RESUMEN_GENERAL_COLS.BAL_REAL, v: formatCurrency(gasProyectoBR) });
  updates.push({ r: startRow + ROWS.RESUMEN_GENERAL.GASTOS_PROYECTO, c: RESUMEN_GENERAL_COLS.PRESUPUESTO, v: formatCurrency(gasProyectoPR) });
  updates.push({ r: startRow + ROWS.RESUMEN_GENERAL.GASTOS_PROYECTO, c: RESUMEN_GENERAL_COLS.VARIACION, v: { ...formatCurrency(varGasProyecto), bg: varGasProyecto <= 0 ? '#e8f5e9' : '#ffebee' } });
  updates.push({ r: startRow + ROWS.RESUMEN_GENERAL.GASTOS_PROYECTO, c: RESUMEN_GENERAL_COLS.VARIACION_PCT, v: { ...formatPercent(pctGasProyecto), bg: pctGasProyecto <= 0 ? '#e8f5e9' : '#ffebee' } });

  // Gastos Inversión
  const gasInversionBR = getTotalByLabel(brResumen, RESUMEN_LABELS.GASTOS_INVERSION);
  const gasInversionPR = getTotalByLabel(prResumen, RESUMEN_LABELS.GASTOS_INVERSION);
  const varGasInversion = r2(gasInversionBR - gasInversionPR);
  const pctGasInversion = gasInversionPR !== 0 ? r2((varGasInversion / gasInversionPR) * 100) : 0;

  updates.push({ 
    r: startRow + ROWS.RESUMEN_GENERAL.GASTOS_INVERSION, 
    c: RESUMEN_GENERAL_COLS.LABEL, 
    v: formatLabel('Gastos de Inversión') 
  });
  updates.push({ r: startRow + ROWS.RESUMEN_GENERAL.GASTOS_INVERSION, c: RESUMEN_GENERAL_COLS.BAL_REAL, v: formatCurrency(gasInversionBR) });
  updates.push({ r: startRow + ROWS.RESUMEN_GENERAL.GASTOS_INVERSION, c: RESUMEN_GENERAL_COLS.PRESUPUESTO, v: formatCurrency(gasInversionPR) });
  updates.push({ r: startRow + ROWS.RESUMEN_GENERAL.GASTOS_INVERSION, c: RESUMEN_GENERAL_COLS.VARIACION, v: { ...formatCurrency(varGasInversion), bg: varGasInversion <= 0 ? '#e8f5e9' : '#ffebee' } });
  updates.push({ r: startRow + ROWS.RESUMEN_GENERAL.GASTOS_INVERSION, c: RESUMEN_GENERAL_COLS.VARIACION_PCT, v: { ...formatPercent(pctGasInversion), bg: pctGasInversion <= 0 ? '#e8f5e9' : '#ffebee' } });

  // Gastos Financiamiento
  const gasFinBR = getTotalByLabel(brResumen, RESUMEN_LABELS.GASTOS_FINANCIAMIENTO);
  const gasFinPR = getTotalByLabel(prResumen, RESUMEN_LABELS.GASTOS_FINANCIAMIENTO);
  const varGasFin = r2(gasFinBR - gasFinPR);
  const pctGasFin = gasFinPR !== 0 ? r2((varGasFin / gasFinPR) * 100) : 0;

  updates.push({ 
    r: startRow + ROWS.RESUMEN_GENERAL.GASTOS_FINANCIAMIENTO, 
    c: RESUMEN_GENERAL_COLS.LABEL, 
    v: formatLabel('Gastos de Financiamiento') 
  });
  updates.push({ r: startRow + ROWS.RESUMEN_GENERAL.GASTOS_FINANCIAMIENTO, c: RESUMEN_GENERAL_COLS.BAL_REAL, v: formatCurrency(gasFinBR) });
  updates.push({ r: startRow + ROWS.RESUMEN_GENERAL.GASTOS_FINANCIAMIENTO, c: RESUMEN_GENERAL_COLS.PRESUPUESTO, v: formatCurrency(gasFinPR) });
  updates.push({ r: startRow + ROWS.RESUMEN_GENERAL.GASTOS_FINANCIAMIENTO, c: RESUMEN_GENERAL_COLS.VARIACION, v: { ...formatCurrency(varGasFin), bg: varGasFin <= 0 ? '#e8f5e9' : '#ffebee' } });
  updates.push({ r: startRow + ROWS.RESUMEN_GENERAL.GASTOS_FINANCIAMIENTO, c: RESUMEN_GENERAL_COLS.VARIACION_PCT, v: { ...formatPercent(pctGasFin), bg: pctGasFin <= 0 ? '#e8f5e9' : '#ffebee' } });

  // Total Gastos
  const totalGasBR = gasProyectoBR + gasInversionBR + gasFinBR;
  const totalGasPR = gasProyectoPR + gasInversionPR + gasFinPR;
  const varTotalGas = r2(totalGasBR - totalGasPR);
  const pctTotalGas = totalGasPR !== 0 ? r2((varTotalGas / totalGasPR) * 100) : 0;

  updates.push({ 
    r: startRow + ROWS.RESUMEN_GENERAL.GASTOS_TOTAL, 
    c: RESUMEN_GENERAL_COLS.LABEL, 
    v: formatLabel('TOTAL GASTOS', true) 
  });
  updates.push({ r: startRow + ROWS.RESUMEN_GENERAL.GASTOS_TOTAL, c: RESUMEN_GENERAL_COLS.BAL_REAL, v: formatCurrency(totalGasBR) });
  updates.push({ r: startRow + ROWS.RESUMEN_GENERAL.GASTOS_TOTAL, c: RESUMEN_GENERAL_COLS.PRESUPUESTO, v: formatCurrency(totalGasPR) });
  updates.push({ r: startRow + ROWS.RESUMEN_GENERAL.GASTOS_TOTAL, c: RESUMEN_GENERAL_COLS.VARIACION, v: { ...formatCurrency(varTotalGas), bg: varTotalGas <= 0 ? '#e8f5e9' : '#ffebee', fw: 1 } });
  updates.push({ r: startRow + ROWS.RESUMEN_GENERAL.GASTOS_TOTAL, c: RESUMEN_GENERAL_COLS.VARIACION_PCT, v: { ...formatPercent(pctTotalGas), bg: pctTotalGas <= 0 ? '#e8f5e9' : '#ffebee', fw: 1 } });

  // === SALDO ===
  const saldoBR = r2(totalIngBR - totalGasBR);
  const saldoPR = r2(totalIngPR - totalGasPR);
  const varSaldo = r2(saldoBR - saldoPR);
  const pctSaldo = saldoPR !== 0 ? r2((varSaldo / saldoPR) * 100) : 0;

  updates.push({ 
    r: startRow + ROWS.RESUMEN_GENERAL.SALDO, 
    c: RESUMEN_GENERAL_COLS.LABEL, 
    v: formatLabel('SALDO', true) 
  });
  updates.push({ r: startRow + ROWS.RESUMEN_GENERAL.SALDO, c: RESUMEN_GENERAL_COLS.BAL_REAL, v: { ...formatCurrency(saldoBR), bg: saldoBR >= 0 ? '#e8f5e9' : '#ffebee', fw: 1 } });
  updates.push({ r: startRow + ROWS.RESUMEN_GENERAL.SALDO, c: RESUMEN_GENERAL_COLS.PRESUPUESTO, v: { ...formatCurrency(saldoPR), bg: saldoPR >= 0 ? '#e8f5e9' : '#ffebee', fw: 1 } });
  updates.push({ r: startRow + ROWS.RESUMEN_GENERAL.SALDO, c: RESUMEN_GENERAL_COLS.VARIACION, v: { ...formatCurrency(varSaldo), bg: varSaldo >= 0 ? '#e8f5e9' : '#ffebee', fw: 1 } });
  updates.push({ r: startRow + ROWS.RESUMEN_GENERAL.SALDO, c: RESUMEN_GENERAL_COLS.VARIACION_PCT, v: { ...formatPercent(pctSaldo), bg: pctSaldo >= 0 ? '#e8f5e9' : '#ffebee', fw: 1 } });

  return updates;
};

// ============================================================================
//  CONVERSIÓN: ROWS → SHEET (PARA LUCKYSHEET)
// ============================================================================

export function rowsToSheet(rows: BalanceRow[] | any[], name: string, order: number) {
  const celldata: any[] = [];

  // Para el Resumen General comparativo (5 columnas)
  if (name === SHEETS.GENERAL) {
    
    // Sub-header
    celldata.push({
      r: 0, c: 0,
      v: { v: 'DETALLES', m: 'DETALLES', ct: { fa: 'General', t: 's' }, bg: '#d1ecf1', fw: 1, bl: 1 }
    });
    celldata.push({
      r: 0, c: 1,
      v: { v: 'BAL. REAL', m: 'BAL. REAL', ct: { fa: 'General', t: 's' }, bg: '#d1ecf1', fw: 1, bl: 1 }
    });
    celldata.push({
      r: 0, c: 2,
      v: { v: 'PRESUPUESTO', m: 'PRESUPUESTO', ct: { fa: 'General', t: 's' }, bg: '#d1ecf1', fw: 1, bl: 1 }
    });
    celldata.push({
      r: 0, c: 3,
      v: { v: 'VARIACIÓN', m: 'VARIACIÓN', ct: { fa: 'General', t: 's' }, bg: '#d1ecf1', fw: 1, bl: 1 }
    });
    celldata.push({
      r: 0, c: 4,
      v: { v: '%', m: '%', ct: { fa: 'General', t: 's' }, bg: '#d1ecf1', fw: 1, bl: 1 }
    });

    return {
      name,
      order,
      celldata,
      config: {
        rowlen: { 0: 42 },
        columnlen: {
          0: 280,  // Detalles
          1: 120,  // Bal. Real
          2: 120,  // Presupuesto
          3: 120,  // Variación
          4: 90,   // %
        },
      },
      status: order === 0 ? 1 : 0,
    };
  }

  ////////////////////////////////////
  // === HEADERS GENERALES ===
  celldata.push({
    r: 0, c: CI.descripcion,
    v: { v: 'CONCEPTO', m: 'CONCEPTO', ct: { fa: 'General', t: 's' }, bg: '#26793a', fw: 1, bl: 1 }
  });

  celldata.push({
    r: 0, c: CI.requerimiento,
    v: { v: 'REQUERIMIENTO', m: 'REQUERIMIENTO', ct: { fa: 'General', t: 's' }, bg: '#26793a', fw: 1, bl: 1 }
  });
  
  celldata.push({
    r: 0, c: CI.total,
    v: { v: 'TOTAL', m: 'TOTAL', ct: { fa: 'General', t: 's' }, bg: '#26793a', fw: 1, bl: 1 }
  });
  
  // Meses m.toUpperCase(),
  MONTHS.forEach((m, i) => {
    const colIndex = CI.ene + i;
    celldata.push({
      r: 0, c: colIndex,
      v: { 
        v: m.toUpperCase(),
        m: m.toUpperCase(),
        ct: { fa: 'General', t: 's' },
        bg: '#26793a',
        fw: 1,
        bl: 1, 
      }
    });
  });
  
  // === FILAS DE DATOS ===
  rows.forEach((row, ri) => {
    const rowIndex = ri + 1;
    const isSection = row.descripcion?.includes('TOTALES');
    
    // Descripción
    celldata.push({
      r: rowIndex, c: CI.descripcion,
      v: { 
        v: row.descripcion,
        m: row.descripcion,
        ct: { fa: 'General', t: 's' },
        bg: isSection ? '#8fc79c' : undefined,  //80a1c2
        fw: isSection ? 1 : undefined,
        bl: isSection ? 1 : undefined,
      }
    });

    // Requerimiento
    const reqValue = (row as any).requerimiento || ' ';
    celldata.push({
      r: rowIndex,
      c: CI.requerimiento,
      v: {
        v: reqValue,
        m: reqValue,
        ct: { fa: 'General', t: 's' },
      },
    });
    
    // Meses
    MONTHS.forEach((m, i) => {
      const colIndex = CI.ene + i;
      const val = (row as any)[m] ?? 0;
      
      celldata.push({
        r: rowIndex, c: colIndex,
        v: { 
          v: val,
          m: `S/ ${Math.abs(val).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`,
          ct: { fa: 'S/ #,##0.00;[Red]-S/ #,##0.00', t: 'n' },
        }
      });
    });
    
    // Total
    celldata.push({
      r: rowIndex, c: CI.total,
      v: { 
        v: 0,
        m: 'S/ 0.00',
        ct: { fa: 'S/ #,##0.00;[Red]-S/ #,##0.00', t: 'n' },
      }
    });
  });
  
  return {
    name,
    order,
    celldata,  
    config: {
      rowlen: { 0: 42 },
      columnlen: {
        0: 250, 1: 140, 2: 95, 3: 95, 4: 95, 5: 95, 6: 95, 7: 95, 8: 95, 9: 95, 10: 95, 11: 95, 12: 95, 13: 95, 14: 110,
      },
    },
    status: order === 0 ? 1 : 0,
  };
}

// ============================================================================
//  CONVERSIÓN: SHEET → ROWS (PARA GUARDAR/LEER)
// ============================================================================

/**
 * Convierte un sheet de Luckysheet a array de BalanceRow
 * Mantiene compatibilidad con tu estructura original
 */
export const sheetToRows = (sheet: any): BalanceRow[] => {
  const data = sheet.celldata || sheet.data || [];
  
  // Agrupar celdas por fila (índice de fila → array de celdas por columna)
  const rowsByIndex: Record<number, Record<number, any>> = {};
  
  data.forEach((cell: any) => {
    const r = cell.r;
    const c = cell.c;
    if (!rowsByIndex[r]) rowsByIndex[r] = {};
    rowsByIndex[r][c] = cell.v;
  });
  
  // Convertir a BalanceRow, filtrando filas inválidas
  const result: BalanceRow[] = [];
  const seenKeys = new Set<string>(); // Para evitar duplicados exactos
  
  Object.entries(rowsByIndex)
    .slice(1) // Saltar header (fila 0)
    .forEach(([rowIndexStr, row]: [string, Record<number, any>]) => {
      const rowIndex = parseInt(rowIndexStr, 10);
      const descripcion = row?.[CI.descripcion]?.v ?? '';
      
      //  FILTRO 1: Saltar filas sin descripción
      if (!descripcion || !descripcion.trim()) return;
      
      //  FILTRO 2: Evitar duplicados por (descripcion + category)
      const category = row?.[CI.category]?.v ?? 'otros';
      const uniqueKey = `${descripcion.trim()}-${category}`;
      if (seenKeys.has(uniqueKey)) return;
      seenKeys.add(uniqueKey);
      
      //  FILTRO 3: Determinar _kind correctamente
      let _kind: BalanceKind = 'resumen';
      if (descripcion.includes('TOTALES')) {
        _kind = 'header';
      } else if (sheet.name.includes('Ingresos')) {
        _kind = 'ingreso';
      } else if (sheet.name.includes('Gastos')) {
        _kind = 'gasto';
      }
      
      result.push({
        sheet: sheet.name === 'Ingresos' || sheet.name === SHEETS.BR.INGRESOS || sheet.name === SHEETS.PR.INGRESOS 
          ? 'ingresos' 
          : sheet.name === 'Gastos' || sheet.name === SHEETS.BR.GASTOS || sheet.name === SHEETS.PR.GASTOS
            ? 'gastos'
            : sheet.name === 'Estados' 
              ? 'estados' 
              : 'resumen',
        id: row?.[CI._dbid]?.v ?? null, 
        _level: toNum(row?.[CI._level]?.v) || 1,
        _kind,
        category: category,
        descripcion: descripcion.trim(),
        requerimiento: row?.[CI.requerimiento]?.v ?? '',
        ene: toNum(row?.[CI.ene]?.v),
        febr: toNum(row?.[CI.febr]?.v),  
        mar: toNum(row?.[CI.mar]?.v),
        abr: toNum(row?.[CI.abr]?.v),
        may: toNum(row?.[CI.may]?.v),
        jun: toNum(row?.[CI.jun]?.v),
        jul: toNum(row?.[CI.jul]?.v),
        agos: toNum(row?.[CI.agos]?.v),  
        set: toNum(row?.[CI.set]?.v),
        oct: toNum(row?.[CI.oct]?.v),
        nov: toNum(row?.[CI.nov]?.v),
        dic: toNum(row?.[CI.dic]?.v),
        total: toNum(row?.[CI.total]?.v),
      });
    });
  
  return result;
};

// ============================================================================
//  UTILIDADES TESTING 
// ============================================================================

/**
 * Crea un mock de sheet para tests unitarios
 */
export const createMockSheet = (name: string, rows: any[]) => ({
  name,
  order: 0,
  data: rows.map((row, r) => 
    Object.entries(row).map(([key, v]) => ({ v }))
  ),
});

/**
 * Verifica si un valor es un SheetCell válido
 */
export const isValidCell = (cell: any): cell is SheetCell => {
  return cell && typeof cell === 'object' && 'v' in cell;
};

/**
 * Compara dos valores numéricos con tolerancia para floats
 */
export const numbersEqual = (a: number, b: number, epsilon = 0.01): boolean => {
  return Math.abs(a - b) < epsilon;
};