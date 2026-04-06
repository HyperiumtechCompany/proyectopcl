// ═══════════════════════════════════════════════════════════════
// metrado_templates.ts — Plantillas de primera fila por disciplina
//
// Cada disciplina tiene un código base y descripción estándar.
// Al abrir una hoja vacía (Módulo, Exterior, Cisterna o Metrado),
// se inyecta automáticamente una fila plantilla de nivel 1 (grupo)
// para guiar al usuario con la numeración correcta.
// ═══════════════════════════════════════════════════════════════

export type DisciplineKey =
  | 'arquitectura'
  | 'estructuras'
  | 'sanitarias'
  | 'electricas'
  | 'comunicaciones'
  | 'gas';

export interface DisciplineTemplate {
  /** Código numérico base (e.g. '02') */
  code: string;
  /** Número base para numeración (e.g. 2) */
  base: number;
  /** Descripción de la disciplina */
  description: string;
}

/**
 * Mapa maestro de plantillas por disciplina.
 * Los códigos siguen la numeración estándar del proyecto:
 *   02 = Arquitectura
 *   03 = Estructuras
 *   04 = Sanitarias
 *   05 = Eléctricas
 *   06 = Comunicaciones
 *   07 = Gas
 */
export const DISCIPLINE_TEMPLATES: Record<DisciplineKey, DisciplineTemplate> = {
  arquitectura:   { code: '02', base: 2,  description: 'METRADO ARQUITECTURA' },
  estructuras:    { code: '03', base: 3,  description: 'METRADO ESTRUCTURAS' },
  sanitarias:     { code: '04', base: 4,  description: 'METRADO SANITARIAS' },
  electricas:     { code: '05', base: 5,  description: 'METRADO ELÉCTRICAS' },
  comunicaciones: { code: '06', base: 6,  description: 'METRADO COMUNICACIONES' },
  gas:            { code: '07', base: 7,  description: 'METRADO GAS' },
};

/**
 * Genera una fila plantilla (grupo nivel 1) para la disciplina indicada.
 * Esta fila se usa como punto de partida cuando la hoja está vacía.
 */
export function getTemplateRow(discipline: DisciplineKey): Record<string, any> {
  const tpl = DISCIPLINE_TEMPLATES[discipline];
  return {
    partida:     tpl.code,
    descripcion: tpl.description,
    unidad:      null,
    elsim:       null,
    largo:       null,
    ancho:       null,
    alto:        null,
    nveces:      null,
    lon:         null,
    area:        null,
    vol:         null,
    kg:          null,
    und:         null,
    total:       null,
    observacion: null,
    _dbid:       null,
    _level:      1,
    _kind:       'group',
  };
}

/**
 * Si el arreglo de filas está vacío, retorna una fila plantilla
 * de la disciplina indicada. Si ya tiene datos, retorna sin modificar.
 */
export function injectTemplateIfEmpty(
  rows: Record<string, any>[],
  discipline: DisciplineKey,
): Record<string, any>[] {
  if (rows && rows.length > 0) return rows;
  return [getTemplateRow(discipline)];
}

/**
 * Detecta la disciplina a partir del título de la página.
 * Útil para ModularIndex que recibe `titulo` como prop.
 */
export function detectDiscipline(titulo: string): DisciplineKey {
  const t = titulo.toLowerCase();
  if (t.includes('arquitectura'))   return 'arquitectura';
  if (t.includes('estructura'))     return 'estructuras';
  if (t.includes('sanitaria'))      return 'sanitarias';
  if (t.includes('eléctrica') || t.includes('electrica')) return 'electricas';
  if (t.includes('comunicacion'))   return 'comunicaciones';
  if (t.includes('gas'))            return 'gas';
  // Fallback por defecto
  return 'sanitarias';
}
