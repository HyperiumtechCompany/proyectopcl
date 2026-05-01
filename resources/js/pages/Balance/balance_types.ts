// balance_types.ts
import type { Month } from './balance_constants';

// Tipos de.kind para filas
export type BalanceKind = 
  | 'header'        // Headers de sección (INGRESOS TOTALES, GASTOS TOTALES)
  | 'section'       // Sub-secciones (Tributos, Servicios, Operativos, etc.)
  | 'ingreso'       // Items de ingreso
  | 'gasto'         // Items de gasto
  | 'resumen';      // Items de resumen

// Categorías principales
export type BalanceCategory =
  | 'proyectos'
  | 'inversion'
  | 'financiamiento'
  | 'tributos'
  | 'patrimonio'
  | 'sueldos'
  | 'servicios'
  | 'operativos'
  | 'mantenimiento'
  | 'sociales'
  | 'header'
  | 'otros';

// Estructura de una fila del balance
export interface BalanceRow {
  _id?: string | number;          // ID único (opcional, para BD)
  _kind: BalanceKind;             // Tipo de fila
  _sheet?: 'ingresos' | 'gastos' | 'estados' | 'resumen'; // Hoja a la que pertenece
  _level?: number;                // Nivel de indentación (0, 1, 2...)
  descripcion: string;            // Descripción del concepto
  category: BalanceCategory;      // Categoría
  
  // Valores mensuales
  ene: number;
  febr: number;
  mar: number;
  abr: number;
  may: number;
  jun: number;
  jul: number;
  agos: number;
  set: number;
  oct: number;
  nov: number;
  dic: number;
  
  // Total anual
  total: number;
  
  // Campos adicionales para estados y resumen
  estado?: 'activo' | 'inactivo';
  facturado?: boolean;
  pagado?: boolean;
  nota?: string;
}

// Tipo para valores mensuales como objeto
export type MonthlyValues = {
  [K in Month]: number;
} & { total: number };

// Tipo para el balance completo
export interface Balance {
  id: number | string;
  nombre: string;
  descripcion?: string;
  anio: number;
  created_at?: string;
  updated_at?: string;
  items: BalanceRow[];
  metadata?: {
    totalIngresos: number;
    totalGastos: number;
    saldo: number;
    ahorroNeto: number;
  };
}

// Props para la página del balance
export interface BalancePageProps {
  balance: Balance;
  errors?: Record<string, string>;
}

// Tipo para actualizaciones de celdas
export interface CellUpdate {
  r: number;          // Fila
  c: number;          // Columna
  v: any;             // Valor
  order?: number;     // Orden de hoja
}

// Tipo para totales calculados
export interface CalculatedTotals {
  monthly: number[];  // Totales por mes (12 valores)
  grand: number;      // Total general
  byCategory: Record<string, number>; // Totales por categoría
}

// Tipo para el estado del gráfico
export interface ChartDataPoint {
  name: string;
  value: number;
  fill: string;
}

// Tipo para filtros
export interface BalanceFilters {
  category?: BalanceCategory;
  month?: Month;
  kind?: BalanceKind;
  search?: string;
}