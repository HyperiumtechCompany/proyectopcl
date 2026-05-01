// balance_constants.ts

// ============================================================================
// ÍNDICES DE COLUMNAS (0-based) 
// ============================================================================
export const CI = {
  _dbid: -1,           // ID de base de datos (columna oculta)
  _kind: -2,           // Tipo de fila (header, ingreso, gasto)
  _level: -3,          // Nivel de indentación
  categoria: -4,
  descripcion: 0,      // Columna A: CONCEPTO
  requerimiento: 1,
  ene: 2,
  febr: 3,
  mar: 4,
  abr: 5,
  may: 6,
  jun: 7,
  jul: 8,
  agos: 9,
  set: 10,
  oct: 11,
  nov: 12,
  dic: 13,
  total: 14,
} as const;

// ============================================================================
// COLS - Alias para lectura clara en resúmenes (alineado con CI)
// ============================================================================
export const COLS = {
  LABEL: CI.descripcion,  // Columna de etiquetas/descripción
  ene: CI.ene,
  febr: CI.febr,
  mar: CI.mar,
  abr: CI.abr,
  may: CI.may,
  jun: CI.jun,
  jul: CI.jul,
  agos: CI.agos,
  set: CI.set,
  oct: CI.oct,
  nov: CI.nov,
  dic: CI.dic,
} as const;

// ============================================================================
//  MESES DEL AÑO
// ============================================================================
export const MONTHS = [
  'ene', 'febr', 'mar', 'abr', 'may', 'jun',
  'jul', 'agos', 'set', 'oct', 'nov', 'dic',
] as const;

export type Month = (typeof MONTHS)[number];

// ============================================================================
//  NOMBRES DE SHEETS CON PREFIJOS 
// ============================================================================
export const SHEETS = {
  // Balance Real
  BR: {
    INGRESOS: 'B. Ingresos',
    GASTOS: 'B. Gastos',
    RESUMEN: 'B. Resumen',
  },
  // Presupuesto
  PR: {
    INGRESOS: 'P. Ingresos',
    GASTOS: 'P. Gastos',
    RESUMEN: 'P. Resumen',
  },
  // Resumen General
  GENERAL: 'Resumen Gral',
} as const;

// ============================================================================
//  FILAS PARA RESUMEN GENERAL 
// ============================================================================
export const ROWS = {
  // Resumen Interno (BR_Resumen / PR_Resumen)
  RESUMEN_INTERNO: {
    START: 0,
    // Ingresos
    INGRESOS_HEADER: 0,
    INGRESOS_PROYECTO: 1,
    INGRESOS_INVERSION: 2,
    INGRESOS_FINANCIAMIENTO: 3,
    INGRESOS_TOTAL: 4,
    // Gastos
    GASTOS_HEADER: 5,
    GASTOS_PROYECTO: 6,
    GASTOS_INVERSION: 7,
    GASTOS_FINANCIAMIENTO: 8,
    GASTOS_TOTAL: 9,
    // Estados
    ESTADOS_HEADER: 10,
    ESTADO_INVERSION: 11,
    ESTADO_FINANCIAMIENTO: 12,
    // Resumen
    RESUMEN_HEADER: 13,
    MONTO: 14,
    RESUMEN_INGRESOS: 15,
    RESUMEN_GASTOS: 16,
    RESUMEN_SALDO: 17,
    AHORRO_NETO: 18,
  },
  
  // Resumen General (TABLA COMPARATIVA)
  RESUMEN_GENERAL: {
    START: 0,
    HEADER: 0,
    INGRESOS_PROYECTO: 1,
    INGRESOS_INVERSION: 2,
    INGRESOS_FINANCIAMIENTO: 3,
    INGRESOS_TOTAL: 4,
    GASTOS_PROYECTO: 5,
    GASTOS_INVERSION: 6,
    GASTOS_FINANCIAMIENTO: 7,
    GASTOS_TOTAL: 8,
    SALDO: 9,
    AHORRO_NETO: 10,
  },
} as const;

// Actualizar columnas para el resumen general comparativo
export const RESUMEN_GENERAL_COLS = {
  LABEL: 0,           // Detalles
  BAL_REAL: 1,        // Balance Real
  PRESUPUESTO: 2,     // Presupuesto
  VARIACION: 3,       // Variación (Real - Presupuesto)
  VARIACION_PCT: 4,   // Variación %
} as const;

// ============================================================================
//  SECCIONES DEL BALANCE 
// ============================================================================
export const SECTIONS = {
  INGRESOS_TOTALES: 'INGRESOS TOTALES',
  INGRESOS_PROYECTOS: 'Ingresos de proyectos ',
  INGRESOS_INVERSION: 'Ingresos de inversion',
  INGRESOS_FINANCIAMIENTO: 'Ingresos de financiamiento',
  GASTOS_TOTALES: 'GASTOS TOTALES',
  TRIBUTOS: 'Tributos',
  ITFS: 'ITFS',
  IGV: 'Igv',
  ESSALUD: 'Essalud',
  AFP: 'Afp',
  SUNAT: 'Sunat',
  PATRIMONIO: 'Patrimonio',
  PROYECTOS: 'Proyectos',
  SUELDOS: 'Sueldos',
  CONTABILIDAD: 'Contabilidad',
  MARKETING: 'Marketing',
  RENTA: 'Renta',
  OPERATIVOS: 'Operativos',
  COMIDA: 'Comida y/o compartir',
  INTERNET: 'Internet',
  AGUA: 'Agua',
  LUZ: 'Luz',
  TELEFONO: 'Telefono',
  TRANSPORTE: 'Transporte',
  COMBUSTIBLE: 'Combustible',
  MANTENIMIENTO_OFICINA: 'Manten. de oficina',
  MANTENIMIENTO_VEHICULAR: 'Manten. vehicular',
  SALUD: 'Salud',
  DONACIONES: 'Donaciones',
  GASTOS_INVERSION: 'Gastos de inversion',
  GASTOS_FINANCIAMIENTO: 'Gastos de financiamiento',
  ESTADO_INVERSION: 'Estado de inversion',
  ESTADO_FINANCIAMIENTO: 'Estado de financiamiento',
  RESUMEN_INGRESOS: 'Ingresos',
  RESUMEN_GASTOS: 'Gastos',
  RESUMEN_SALDO: 'Saldo',
  RESUMEN_AHORRO: 'Ahorro neto',
} as const;

// ============================================================================
//  ESTILOS 
// ============================================================================
export const HEADER_STYLE = {
  bg: '#f87171',        
  cl: '#1e293b',       
  fw: 1,               
  ct: { fa: '@', t: 's' },
  strike: 0,
} as const;

export const SECTION_STYLE = {
  bg: '#6fa9e4',       
  fw: 1,              
} as const;

export const LEAF_STYLE = {
  ht: 50,              
} as const;

export const TOTAL_STYLE = {
  bg: '#e2e8f0',       
  fw: 1,              
} as const;

export const POSITIVE_STYLE = {
  bg: '#dcfce7',       
  cl: { fa: '#166534' }, 
} as const;

export const NEGATIVE_STYLE = {
  bg: '#fee2e2',       
  cl: { fa: '#991b1b' }, 
} as const;

// ============================================================================
//  CONFIGURACIÓN 
// ============================================================================
export const SAVE_DEBOUNCE = 2000; // 2 segundos

export const COLUMN_WIDTHS = {
  [CI.descripcion]: 250,
  [CI.requerimiento]: 120,
  [CI.ene]: 90,
  [CI.febr]: 90,
  [CI.mar]: 90,
  [CI.abr]: 90,
  [CI.may]: 90,
  [CI.jun]: 90,
  [CI.jul]: 90,
  [CI.agos]: 90,
  [CI.set]: 90,
  [CI.oct]: 90,
  [CI.nov]: 90,
  [CI.dic]: 90,
  [CI.total]: 110,
} as const;

// ============================================================================
// LABELS PARA FILAS DE RESUMEN 
// ============================================================================
export const RESUMEN_LABELS = {
  // Ingresos
  INGRESOS: 'Ingresos',
  INGRESOS_PROYECTO: 'Ingresos por proyecto',
  INGRESOS_INVERSION: 'Ingresos de inversion',
  INGRESOS_FINANCIAMIENTO: 'Ingresos de financiamiento',
  INGRESOS_TOTAL: 'TOTAL INGRESOS',
  
  // Gastos
  GASTOS: 'Gastos',
  GASTOS_PROYECTO: 'Gastos por proyecto',
  GASTOS_INVERSION: 'Gastos de inversion',
  GASTOS_FINANCIAMIENTO: 'Gastos de financiamiento',
  GASTOS_TOTAL: 'TOTAL GASTOS',
  
  // Estados
  ESTADO_INVERSION: 'Estado de inversion',
  ESTADO_FINANCIAMIENTO: 'Estado de financiamiento',
  
  // Resumen
  MONTO: 'Monto',
  RESUMEN_INGRESOS: 'Ingresos',
  RESUMEN_GASTOS: 'Gastos',
  RESUMEN_SALDO: 'Saldo',
  AHORRO_NETO: 'Ahorro neto',
  
  // Labels existentes para Resumen General
  ESTADO_CUENTA: 'ESTADO DE CUENTA (-)',
  DIFERENCIA: 'DIFERENCIA DE BALANCES',
} as const;

// ============================================================================
//  Helper para obtener rango de columnas de meses
// ============================================================================
export const getMonthColumnRange = () => {
  return {
    start: COLS.ene,
    end: COLS.dic,
    count: MONTHS.length,
  };
};

// ============================================================================
//  Helper para verificar si una columna es de mes
// ============================================================================
export const isMonthColumn = (colIndex: number): boolean => {
  return colIndex >= COLS.ene && colIndex <= COLS.dic;
};

