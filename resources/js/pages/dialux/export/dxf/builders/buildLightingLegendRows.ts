import { CONDUCTOR_SECTION_OPTIONS, type Conductor, type Fixture, type LightSwitch } from '@/pages/dialux/hooks/types';
import type { DxfDisciplineEntities, DxfLegendRow } from '../domain/types';

/**
 * Leyenda de alumbrado (plan maestro, sección 9.2). Se construye SOLO a
 * partir de las entidades ya clasificadas como 'lighting'/'shared' para este
 * nivel (Fase 2), nunca de todo el catálogo — fuente de verdad de la
 * sección 9.1. Cada fila referencia el mismo símbolo que se dibuja en planta
 * (`symbolRef`, Fase 5); `emitters/legend.ts` (Fase 6/7) lo consume con el
 * mismo renderer, nunca con una letra aproximada (sección 9.3).
 */

const FIXTURE_TYPE_LABELS_ES: Record<Fixture['fixtureType'], string> = {
    recessed: 'Empotrado',
    pendant: 'Colgante',
    surface: 'Superficial',
    spot: 'Spot',
    strip: 'Tira',
    panel: 'Panel',
    tube: 'Tubo',
};

const SWITCH_CODES: Record<LightSwitch['type'], string> = {
    single: 'S',
    double: '2S',
    triple: '3S',
    'two-way': 'Sc',
};

const SWITCH_LABELS_ES: Record<LightSwitch['type'], string> = {
    single: 'Interruptor simple',
    double: 'Interruptor doble',
    triple: 'Interruptor triple',
    'two-way': 'Interruptor conmutado',
};

const AWG_BY_SECTION_MM2: Record<number, string> = Object.fromEntries(
    CONDUCTOR_SECTION_OPTIONS.map((option) => [option.value, option.label.match(/\(([^)]+)\)/)?.[1] ?? '']),
);

/**
 * Identidad técnica de una luminaria (sección 9.2): `productId` si existe;
 * si no, fabricante + número de artículo; en último caso, nombre + potencia
 * + flujo + forma. Nunca agrupa por `catalogSymbol` — dos productos pueden
 * compartir símbolo y deben seguir siendo filas distintas.
 */
function fixtureGroupKey(fixture: Fixture): string {
    if (fixture.productId != null) return `product:${fixture.productId}`;
    if (fixture.brand && fixture.articleNumber) return `brand:${fixture.brand}|${fixture.articleNumber}`;
    return `name:${fixture.name}|${fixture.power ?? ''}|${fixture.lumens}|${fixture.fixtureShape ?? ''}`;
}

function fixtureMountingLabel(fixture: Fixture): string {
    const typeLabel = FIXTURE_TYPE_LABELS_ES[fixture.fixtureType] ?? fixture.fixtureType;
    return fixture.mountingHeight != null ? `${typeLabel} ${fixture.mountingHeight.toFixed(2)}m` : typeLabel;
}

/** Reutilizado por `buildOutletLegendRows.ts` (Fase 7) para no duplicar la lógica de agrupación. */
export function groupBy<T>(items: T[], keyOf: (item: T) => string): Map<string, T[]> {
    const groups = new Map<string, T[]>();
    for (const item of items) {
        const key = keyOf(item);
        const group = groups.get(key);
        if (group) group.push(item);
        else groups.set(key, [item]);
    }
    return groups;
}

function buildFixtureRows(fixtures: Fixture[]): DxfLegendRow[] {
    const normalFixtures = fixtures.filter((fixture) => !fixture.emergencyType || fixture.emergencyType === 'none');
    const groups = groupBy(normalFixtures, fixtureGroupKey);

    return [...groups.values()].map((group) => {
        const representative = group[0]!;
        const description = representative.brand
            ? `${representative.brand} ${representative.articleNumber ?? representative.name}`
            : representative.name;

        return {
            kind: 'fixture',
            symbolRef: { kind: 'fixture', catalogSymbol: representative.catalogSymbol ?? null },
            code: representative.articleNumber ?? representative.name,
            description,
            // Posiciones FIJAS [potencia, flujo, montaje] — la leyenda de
            // alumbrado (`buildDxfMultiSheetDocument.ts`) las lee por índice
            // para columnas POTENCIA/FLUJO/MONTAJE; un `.filter()` que
            // quitara la potencia ausente correría el flujo a la posición 0
            // y lo mostraría en la columna equivocada.
            technicalFields: [
                representative.power != null ? `${representative.power}W` : '',
                `${representative.lumens}lm`,
                fixtureMountingLabel(representative),
            ],
            quantity: group.length,
        };
    });
}

const EMERGENCY_CATALOG_SYMBOL: Record<'emergency' | 'permanent', string> = {
    emergency: 'emergency',
    permanent: 'emergency_perm',
};
const EMERGENCY_LABELS_ES: Record<'emergency' | 'permanent', string> = {
    emergency: 'Emergencia no permanente',
    permanent: 'Emergencia permanente',
};

function buildEmergencyRows(fixtures: Fixture[]): DxfLegendRow[] {
    const emergencyFixtures = fixtures.filter(
        (fixture): fixture is Fixture & { emergencyType: 'emergency' | 'permanent' } =>
            fixture.emergencyType === 'emergency' || fixture.emergencyType === 'permanent',
    );
    const groups = groupBy(emergencyFixtures, (fixture) => fixture.emergencyType);

    return [...groups.entries()].map(([type, group]) => {
        const representative = group[0]!;
        return {
            kind: 'emergency',
            symbolRef: { kind: 'fixture', catalogSymbol: EMERGENCY_CATALOG_SYMBOL[type as 'emergency' | 'permanent'] },
            code: type === 'permanent' ? 'EP' : 'E',
            description: EMERGENCY_LABELS_ES[type as 'emergency' | 'permanent'],
            technicalFields: [fixtureMountingLabel(representative)],
            quantity: group.length,
        };
    });
}

function buildSwitchRows(switches: LightSwitch[]): DxfLegendRow[] {
    const groups = groupBy(switches, (item) => `${item.type}|${item.mountingHeight}`);

    return [...groups.values()].map((group) => {
        const representative = group[0]!;
        return {
            kind: 'switch',
            symbolRef: { kind: 'switch' },
            code: SWITCH_CODES[representative.type],
            description: SWITCH_LABELS_ES[representative.type],
            technicalFields: [`Montaje ${representative.mountingHeight.toFixed(2)}m`],
            quantity: group.length,
        };
    });
}

/** Reutilizado tal cual por `buildOutletLegendRows.ts` (Fase 7): la agrupación de cableado no depende de la disciplina. */
export function buildCableRows(conductors: Conductor[]): DxfLegendRow[] {
    const groups = groupBy(conductors, (item) => `${item.conductorType}|${item.sectionMm2}|${item.tubeSize}`);

    return [...groups.values()].map((group) => {
        const representative = group[0]!;
        const awg = AWG_BY_SECTION_MM2[representative.sectionMm2];
        // Separador ASCII (AC1009/R12 no soporta Unicode — ver `ascii()` en
        // `emitters/primitives.ts`, que sin esto convertía "·" y el
        // superíndice de "mm²" en "?" literales visibles en AutoCAD.
        return {
            kind: 'cable',
            symbolRef: null,
            code: 'C',
            description: `${representative.conductorType}, ${representative.sectionMm2} mm2${awg ? ` (${awg})` : ''}`,
            technicalFields: [`Tubo ${representative.tubeSize}mm`],
            quantity: group.length,
        };
    });
}

/**
 * Filas de la leyenda de alumbrado: luminarias (agrupadas por identidad de
 * producto), alumbrado de emergencia, interruptores usados y cableado de
 * alumbrado. Un nivel sin ninguno de estos elementos produce un arreglo
 * vacío — no es un error, la lámina simplemente no tiene leyenda que mostrar.
 */
export function buildLightingLegendRows(entities: DxfDisciplineEntities): DxfLegendRow[] {
    return [
        ...buildFixtureRows(entities.fixtures),
        ...buildEmergencyRows(entities.fixtures),
        ...buildSwitchRows(entities.lightSwitches),
        ...buildCableRows(entities.conductors),
    ];
}
