// ─────────────────────────────────────────────────────────────────────────────
// Catálogo oficial de Índices Unificados de Precios (DS 011-79-VC / INEI),
// usado por la Fórmula Polinómica para nombrar columnas/filas por código y
// para agrupar automáticamente los monomios con la nomenclatura estándar de
// la práctica técnica peruana. Códigos en formato de 2 dígitos (sin cero a
// la izquierda salvo "01"–"09"), igual que el resto del módulo Delphin.
// ─────────────────────────────────────────────────────────────────────────────

// Índice especial 39 del catálogo oficial INEI 2026, obligatorio al final del K.
export const GU_CODE = '39';

// Código sintético (no forma parte del catálogo INEI real) para separar, dentro
// de Mano de Obra, al personal técnico de alta especialización (topógrafos,
// especialistas) del resto de la cuadrilla (operario/oficial/peón/operador de
// equipo liviano). No existe un campo en los datos que distinga ambos casos —
// se infiere por palabras clave en la descripción (ver isPersonalEspecializado).
export const MANO_DE_OBRA_ESPECIALIZADA_CODE = '47-1';

const PALABRAS_PERSONAL_ESPECIALIZADO = ['topografo', 'especialista'];

const normalize = (s: string) =>
    String(s ?? '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase();

/** True si la descripción del recurso de mano de obra corresponde a personal
 *  técnico de alta especialización (código 47-1) y no a la cuadrilla estándar
 *  (código 47). */
export function isPersonalEspecializado(descripcion: string): boolean {
    const n = normalize(descripcion);
    return PALABRAS_PERSONAL_ESPECIALIZADO.some((w) => n.includes(w));
}

export const INEI_NOMBRES: Record<string, string> = {
    '01': 'Aceite y lubricante',
    '02': 'Acero de construcción liso',
    '03': 'Acero de construcción corrugado',
    '04': 'Agregado fino',
    '05': 'Agregado grueso',
    '06': 'Alambre y cable de cobre desnudo',
    '07': 'Alambre y cable tipo TW, THW, LSOH',
    '08': 'Alambre y cable tipo WP, CPI',
    '09': 'Alcantarilla metálica y guardavías',
    '10': 'Aparato sanitario con grifería',
    '11': 'Artefacto de alumbrado exterior',
    '12': 'Artefacto de alumbrado interior',
    '13': 'Asfalto',
    '14': 'Baldosa acústica',
    '16': 'Baldosa vinílica y PVC',
    '17': 'Bloque y ladrillo',
    '18': 'Cable telefónico y de red',
    '19': 'Cable NYY, N2XY, NPT, N2XOH, N2XSY',
    '20': 'Cemento asfáltico',
    '21': 'Cemento Portland e hidráulico',
    '22': 'Cemento Portland tipo II',
    '23': 'Cemento Portland tipo V',
    '24': 'Cerámica y porcelanato',
    '26': 'Cerrajería',
    '27': 'Detonante',
    '28': 'Dinamita',
    '30': 'Dólar más inflación mercado USA',
    '31': 'Prefabricado de concreto',
    '32': 'Flete terrestre',
    '33': 'Flete aéreo',
    '34': 'Gasohol y gasolina',
    '37': 'Herramienta manual',
    '38': 'Hormigón y afirmado',
    [GU_CODE]: 'Índice de Precios al Consumidor (INEI)',
    '40': 'Loseta y terrazo',
    '41': 'Madera nacional en tiras para piso',
    '42': 'Madera importada para encofrado y carpintería',
    '43': 'Madera nacional para encofrado y carpintería',
    '44': 'Madera terciada nacional',
    '45': 'Madera terciada para encofrado',
    '46': 'Malla de acero',
    '47': 'Mano de obra (incluye leyes sociales)',
    [MANO_DE_OBRA_ESPECIALIZADA_CODE]: 'Mano de obra de alta especialización (incluye leyes sociales)',
    '48': 'Maquinaria y equipo de construcción liviano',
    '49': 'Maquinaria y equipo de construcción pesado',
    '50': 'Marco y tapa de fierro',
    '51': 'Perfil de acero al carbono',
    '52': 'Perfil de aluminio',
    '53': 'Petróleo diésel',
    '54': 'Pintura látex',
    '55': 'Pintura temple',
    '56': 'Plancha de acero LAC',
    '57': 'Plancha de acero LAF',
    '59': 'Plancha de fibrocemento y yeso',
    '60': 'Plancha de poliuretano, poliestireno y termoaislante',
    '61': 'Plancha galvanizada',
    '62': 'Poste de concreto',
    '64': 'Terrazo',
    '65': 'Tubería de acero negro y/o galvanizado',
    '66': 'Tubería de PVC para la red de agua potable y alcantarillado',
    '68': 'Tubería de cobre',
    '69': 'Tubería de concreto simple',
    '70': 'Tubería de concreto reforzado',
    '71': 'Tubería de hierro fundido y dúctil',
    '72': 'Tubería de PVC para redes interiores',
    '73': 'Ducto telefónico de PVC',
    '77': 'Válvula de bronce y latón',
    '78': 'Válvula de hierro y acero',
    '79': 'Vidrio',
    '80': 'Concreto premezclado',
    '81': 'Aditivo de concreto y similar',
    '82': 'Alambre y cable de aluminio',
    '83': 'Implemento y accesorio de seguridad',
    '84': 'Madera terciada importada',
    '85': 'Perfil de acero galvanizado',
    '86': 'Pintura esmalte y epóxica',
    '87': 'Plancha con cubierta aluzinc',
    '88': 'Plancha y cobertura plástica',
    '89': 'Poste y tubería de fibra de vidrio',
    '90': 'Tubería de polietileno',
    '91': 'Geomembrana y geotextil',
    '92': 'Flete fluvial',
    '93': 'Bienes y servicios auxiliares',
    '94': 'Encofrado y andamio prefabricado',
    '95': 'Equipamiento permanente de obra',
};

/** Devuelve el nombre oficial INEI para un código si existe en el catálogo. */
export function resolveIneiNombre(code: string): string | null {
    return INEI_NOMBRES[code] ?? null;
}

export interface GrupoOficial {
    simbolo: string;
    nombre: string;
    codigos: string[];
}

// Agrupación estándar aceptada por la práctica técnica (máx. 3 índices por
// monomio según DS 011-79-VC art.2 — "Maquinaria Pesada/Importada" y
// "Agregados" exceden ese límite con 4 códigos cada una y se reparten en más
// de un monomio automáticamente si hiciera falta, ver buildAutoMonomios en
// FormulaPolinomicaBuilder.tsx). GU siempre va al final del polinomio.
export const GRUPOS_OFICIALES: GrupoOficial[] = [
    { simbolo: 'MO', nombre: 'Mano de Obra', codigos: ['47', MANO_DE_OBRA_ESPECIALIZADA_CODE] },
    { simbolo: 'ACERO', nombre: 'Acero Corrugado / Liso', codigos: ['02', '03'] },
    { simbolo: 'CEM', nombre: 'Cemento', codigos: ['21', '22', '23'] },
    { simbolo: 'AG', nombre: 'Agregados', codigos: ['04', '05', '38'] },
    { simbolo: 'MAQ', nombre: 'Maquinaria y Equipo', codigos: ['48', '49'] },
    { simbolo: 'COMB', nombre: 'Combustibles', codigos: ['34', '53'] },
    { simbolo: 'HER', nombre: 'Herramientas Manuales', codigos: ['37'] },
    { simbolo: 'TUB', nombre: 'Tuberías', codigos: ['65', '66', '68', '69', '70', '71', '72', '90'] },
    { simbolo: 'LAD', nombre: 'Ladrillos / Bloques', codigos: ['17'] },
    { simbolo: 'MAD', nombre: 'Madera', codigos: ['41', '42', '43', '44', '45', '84'] },
    { simbolo: 'CON', nombre: 'Conductores Eléctricos', codigos: ['06', '07', '08', '19', '82'] },
    { simbolo: 'GU', nombre: 'Índice de Precios al Consumidor (INEI)', codigos: [GU_CODE] },
];
