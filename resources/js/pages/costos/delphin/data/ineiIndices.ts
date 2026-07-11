// ─────────────────────────────────────────────────────────────────────────────
// Catálogo oficial de Índices Unificados de Precios (DS 011-79-VC / INEI),
// usado por la Fórmula Polinómica para nombrar columnas/filas por código y
// para agrupar automáticamente los monomios con la nomenclatura estándar de
// la práctica técnica peruana. Códigos en formato de 2 dígitos (sin cero a
// la izquierda salvo "01"–"09"), igual que el resto del módulo Delphin.
// ─────────────────────────────────────────────────────────────────────────────

// Índice especial: Gasto General y Utilidad — obligatorio al final del K.
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
    '01': 'Aceite',
    '02': 'Acero de construcción liso',
    '03': 'Acero de construcción corrugado',
    '04': 'Agregado fino',
    '05': 'Agregado grueso',
    '06': 'Alambre negro recocido',
    '07': 'Alambre de acero galvanizado',
    '08': 'Alambre de púas',
    '09': 'Alcantarilla metálica',
    '10': 'Artefacto de alumbrado exterior',
    '11': 'Artefacto de alumbrado interior',
    '13': 'Asfalto',
    '14': 'Baldosa acústica',
    '15': 'Baldosa asfáltica',
    '16': 'Baldosa vinílica',
    '17': 'Bloque y ladrillo de arcilla',
    '18': 'Bloque y ladrillo de concreto',
    '19': 'Bloque y ladrillo de sílice cal',
    '20': 'Cal porosa',
    '21': 'Cemento Portland Tipo I',
    '22': 'Cemento Portland Tipo II y V',
    '23': 'Cemento adicionado (Blended)',
    '24': 'Cerrajería nacional',
    '25': 'Cerrajería importada',
    '26': 'Clavo para madera',
    '30': 'Combustible (Diésel, Gasolina)',
    '31': 'Conductor de cobre',
    '32': 'Dinamita',
    '34': 'Elementos de acero galvanizado',
    '35': 'Elementos de PVC (tuberías, conexiones)',
    '36': 'Estructuras de hierro y acero',
    '37': 'Herramienta manual',
    '38': 'Agregados',
    [GU_CODE]: 'Gasto General y Utilidad',
    '40': 'Maquinaria y equipo nacional',
    '41': 'Maquinaria y equipo importado',
    '42': 'Mezcladora de concreto',
    '43': 'Motores eléctricos',
    '44': 'Motoniveladora',
    '45': 'Neumáticos',
    '46': 'Tractor de orugas',
    '47': 'Mano de Obra (Operario, Oficial, Peón y Operador de Equipo Liviano)',
    [MANO_DE_OBRA_ESPECIALIZADA_CODE]: 'Personal Técnico de Alta Especialización',
    '48': 'Madera nacional para encofrado y estructura',
    '49': 'Madera nacional para carpintería',
    '50': 'Madera importada para carpintería',
    '51': 'Mayólica',
    '52': 'Microesferas de vidrio',
    '54': 'Parabrisas',
    '55': 'Piedra chancada',
    '56': 'Plancha de acero LAC',
    '57': 'Plancha de acero LAF',
    '58': 'Plancha de acero galvanizada',
    '59': 'Plancha de fibra de vidrio',
    '60': 'Plancha de poliuretano',
    '61': 'Plancha zincada (Calamina)',
    '64': 'Plástico (láminas, polietileno)',
    '65': 'Poliestireno expandido (Tecnopor)',
    '66': 'Geotextil',
    '68': 'Pintura látex',
    '69': 'Perfil de aluminio',
    '70': 'Porcelanato',
    '71': 'Postes de concreto',
    '72': 'Postes de fierro',
    '73': 'Puzolana',
    '77': 'Tubería de acero',
    '78': 'Tubería de concreto',
    '79': 'Tubería de polietileno (HDPE)',
    '80': 'Tubería de fibra de vidrio (GRP)',
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
    { simbolo: 'ACERO', nombre: 'Acero Corrugado / Liso', codigos: ['02', '03', '06'] },
    { simbolo: 'CEM', nombre: 'Cemento', codigos: ['21', '22', '23'] },
    { simbolo: 'AG', nombre: 'Agregados', codigos: ['04', '05', '38', '55'] },
    { simbolo: 'MAQ', nombre: 'Maquinaria Pesada / Importada', codigos: ['40', '41', '44', '46'] },
    { simbolo: 'COMB', nombre: 'Combustibles', codigos: ['30'] },
    { simbolo: 'HER', nombre: 'Herramientas Manuales', codigos: ['37'] },
    { simbolo: 'TUB', nombre: 'Tuberías', codigos: ['35', '77', '78', '79'] },
    { simbolo: 'LAD', nombre: 'Ladrillos / Bloques', codigos: ['17', '18'] },
    { simbolo: 'MAD', nombre: 'Madera', codigos: ['48', '49'] },
    { simbolo: 'CON', nombre: 'Conductores Eléctricos', codigos: ['31'] },
    { simbolo: 'GU', nombre: 'Gastos Generales y Utilidad', codigos: [GU_CODE] },
];
