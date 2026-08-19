import {
    calculateExactQuantity,
    calculateLumensRequired,
    calculatePolygonArea,
    calculateRoundedQuantity,
    determineCoverage,
    estimateUniformity,
} from './lightingCalculations';
import type { RawNormativeBranch, RawNormativeLeaf } from './normativaData';
import { getNormData } from './normativeEngine';
import type { Fixture, Room } from './types';

export type NormativeStandard =
    | 'en_12464_1'
    | 'en_12464_2'
    | 'en_13201_2'
    | 'en_12193'
    | 'iesna_handbook'
    | 'en_15193'
    | 'rne_peru'
    | 'rne_a130'
    | 'en_1838'
    | 'nfpa101'
    | 'ds024';

export const NORMATIVE_LABELS: Record<NormativeStandard, string> = {
    en_12464_1: 'EN 12464-1 (Interior)',
    en_12464_2: 'EN 12464-2 (Exterior)',
    en_13201_2: 'EN 13201-2 (Vial)',
    en_12193: 'EN 12193 (Deportes)',
    iesna_handbook: 'IESNA / IES HB-10 (EE. UU.)',
    en_15193: 'EN 15193 (Eficiencia EnergÃ©tica)',
    rne_peru: 'RNE EM.010 / CNE (PerÃº)',
    rne_a130: 'RNE A.130 - Alumbrado de emergencia (PerÃº, obligatoria)',
    en_1838: 'EN 1838 - Alumbrado de emergencia (Europa, referencia)',
    nfpa101: 'NFPA 101 - Life Safety Code (EE. UU.)',
    ds024: 'D.S. 024 - MinerÃ­a (PerÃº)',
};

export interface NormativeLeafOption {
    id: string;
    category: string;
    section: string | null;
    activity: string;
    label: string;
    illuminanceLux: number;
    ugr: number | null;
    uniformity: number | null;
    ra: number | null;
    specificRequirements: string | null;
    /** Altura del plano Ãºtil (m) verificada contra DIALux evo para esta actividad â€” `null` si aÃºn no se verificÃ³ (ver `RawNormativeLeaf.workPlaneHeight`). */
    workPlaneHeight: number | null;
}

export interface RoomLightingInputs {
    area: number;
    illuminanceLux: number;
    usefulPlaneHeight: number;
    marginalZone: number;
    fixtureLumens: number;
    fixtureCount: number;
    lumensRequired: number;
    exactQuantity: number;
    roundedQuantity: number;
    estimatedUniformity: number;
    coverage: 'optimal' | 'insufficient' | 'excessive';
    detectedFixtureLumens: number | null;
    normative: NormativeLeafOption | null;
}

function isRawLeaf(
    value: RawNormativeBranch | RawNormativeLeaf,
): value is RawNormativeLeaf {
    return 'iluminancia_lux' in value;
}

function buildLeaf(
    category: string,
    section: string | null,
    leaf: RawNormativeLeaf,
): NormativeLeafOption {
    return {
        id: [category, section, leaf.title].filter(Boolean).join('::'),
        category,
        section,
        activity: leaf.title,
        label: leaf.label,
        illuminanceLux: leaf.iluminancia_lux,
        ugr: leaf.UGR,
        uniformity: leaf.Uo,
        ra: leaf.Ra,
        specificRequirements: leaf.requisitos_especificos,
        workPlaneHeight: leaf.workPlaneHeight ?? null,
    };
}

function flattenNormativeTree(
    branches: RawNormativeBranch[],
): NormativeLeafOption[] {
    return branches.flatMap((category) =>
        (category.subsections ?? []).flatMap((subsection) => {
            if (isRawLeaf(subsection)) {
                return [buildLeaf(category.title, null, subsection)];
            }

            return (subsection.subsubsections ?? []).map((leaf) =>
                buildLeaf(category.title, subsection.title, leaf),
            );
        }),
    );
}

/**
 * Se recalcula en cada llamada (no se cachea a nivel de mÃ³dulo) porque
 * `getNormData` puede devolver el catÃ¡logo sembrado en BD (fuente Ãºnica de
 * verdad, cargado en runtime vÃ­a ensureStandardDataLoaded) en vez del
 * dataset estÃ¡tico â€” cachear aquÃ­ habrÃ­a dejado esta funciÃ³n (y por tanto
 * los dropdowns de WallProps/RoomProps y findNormativeOption) mostrando
 * permanentemente la transcripciÃ³n estÃ¡tica aunque la BD ya hubiera
 * cargado un catÃ¡logo distinto.
 */
export function getNormativeOptions(
    standard: NormativeStandard,
): NormativeLeafOption[] {
    return flattenNormativeTree(getNormData(standard));
}

export function getCategoryOptions(
    standard: NormativeStandard = 'en_12464_1',
): string[] {
    const options = getNormativeOptions(standard);
    return Array.from(new Set(options.map((option) => option.category)));
}

export function getSectionOptions(
    standard: NormativeStandard = 'en_12464_1',
    category: string | undefined,
): string[] {
    if (!category) return [];
    const options = getNormativeOptions(standard);
    return Array.from(
        new Set(
            options
                .filter(
                    (option) => option.category === category && option.section,
                )
                .map((option) => option.section as string),
        ),
    );
}

export function getActivityOptions(
    category: string | undefined,
    section?: string,
): NormativeLeafOption[];
export function getActivityOptions(
    standard: NormativeStandard,
    category: string | undefined,
    section?: string,
): NormativeLeafOption[];
export function getActivityOptions(
    first: NormativeStandard | string | undefined = 'en_12464_1',
    second?: string,
    third?: string,
): NormativeLeafOption[] {
    const hasStandard =
        first === 'en_12464_1' ||
        first === 'ies_na' ||
        first === 'rne_peru' ||
        first === 'en_1838' ||
        first === 'nfpa101' ||
        first === 'ds024';
    const standard = hasStandard ? (first as NormativeStandard) : 'en_12464_1';
    const category = hasStandard ? second : first;
    const section = hasStandard ? third : second;

    if (!category) return [];
    const options = getNormativeOptions(standard);

    return options.filter((option) => {
        if (option.category !== category) return false;
        if (section) return option.section === section;
        return option.section === null;
    });
}

export function findNormativeOption(room: Room): NormativeLeafOption | null {
    const selectedStandard = room.normativeStandard || 'en_12464_1';
    const selectedCategory = room.normativeCategory;
    const selectedSection = room.normativeSection ?? null;
    const selectedActivity = room.normativeActivity;

    if (!selectedCategory || !selectedActivity) return null;

    const options = getNormativeOptions(selectedStandard);

    return (
        options.find(
            (option) =>
                option.category === selectedCategory &&
                option.section === selectedSection &&
                option.activity === selectedActivity,
        ) ?? null
    );
}

export function isFixtureInsideRoom(room: Room, fixture: Fixture) {
    const { vertices } = room;
    if (vertices.length < 3) return false;

    let inside = false;
    let j = vertices.length - 1;

    for (let i = 0; i < vertices.length; i++) {
        const a = vertices[i];
        const b = vertices[j];

        if (
            a.y > fixture.y !== b.y > fixture.y &&
            fixture.x < ((b.x - a.x) * (fixture.y - a.y)) / (b.y - a.y) + a.x
        ) {
            inside = !inside;
        }

        j = i;
    }

    return inside;
}

export function getFixturesForRoom(room: Room, fixtures: Fixture[]) {
    return fixtures.filter((fixture) => {
        if (fixture.roomId) return fixture.roomId === room.id;
        return isFixtureInsideRoom(room, fixture);
    });
}

export function getDominantFixtureLumens(fixtures: Fixture[]): number | null {
    if (fixtures.length === 0) return null;

    const histogram = new Map<number, number>();

    fixtures.forEach((fixture) => {
        histogram.set(fixture.lumens, (histogram.get(fixture.lumens) ?? 0) + 1);
    });

    let dominantLumens = fixtures[0].lumens;
    let maxCount = histogram.get(dominantLumens) ?? 0;

    histogram.forEach((count, lumens) => {
        if (count > maxCount) {
            maxCount = count;
            dominantLumens = lumens;
        }
    });

    return dominantLumens;
}

export function getRoomIlluminanceLux(room: Room): number {
    return room.illuminanceLux ?? room.norma ?? 300;
}

export function getRoomFallbackFixtureLumens(room: Room): number {
    return room.fixtureLumens ?? room.fixtureFlux ?? 4000;
}

function normalizeLabel(value: string | null | undefined): string {
    return (value ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replaceAll(/[\u0300-\u036f]/g, '');
}

export function isCorridorLikeRoom(room: Room): boolean {
    if (room.roomType === 'corridor') {
        return true;
    }

    const label = [
        room.name,
        room.normativeActivity,
        room.normativeLabel,
        room.normativeSection,
    ]
        .map(normalizeLabel)
        .join(' ');

    return /\b(pasillo|corredor|circulacion|hall|transito)\b/.test(label);
}

export function getRoomUsefulPlaneHeight(room: Room): number {
    if (typeof room.usefulPlaneHeight === 'number') {
        return Math.max(0, room.usefulPlaneHeight);
    }

    return isCorridorLikeRoom(room) ? 0 : 0.8;
}

/**
 * Zona marginal segÃºn malla EN 12464-1:2021: `p = 0.2 Ã— 5^log10(d)` (`d` =
 * dimensiÃ³n mayor si largo/ancho âˆˆ[0.5,2], si no la menor; `p`â‰¤10 m â€”
 * fuente: EN 12464-1, resumido en Fagerhult "Number of calculation points",
 * verif. 2026-08-06). `n=round(d/p)` puntos, espaciado real `p'=d/n`, borde
 * sin cubrir `p'/2` â€” reproduce los valores pequeÃ±os/no redondos que
 * reporta DIALux evo (0.135/0.201/0.209 m), a diferencia del 5% fijo sin
 * fuente que usaba antes. Pasadizos (`isCorridorLikeRoom`): 0 m â€”
 * verificado en dos exportaciones reales de DIALux evo ("Zona marginal: 0.000 m").
 */
export function getRoomMarginalZone(room: Room): number {
    if (typeof room.marginalZone === 'number') {
        return Math.max(0, room.marginalZone);
    }

    if (isCorridorLikeRoom(room)) {
        return 0;
    }

    if (room.vertices.length < 3) {
        return 0.1;
    }

    const xs = room.vertices.map((vertex) => vertex.x);
    const ys = room.vertices.map((vertex) => vertex.y);
    const width = Math.max(...xs) - Math.min(...xs);
    const depth = Math.max(...ys) - Math.min(...ys);
    if (width <= 0 || depth <= 0) {
        return 0.1;
    }

    const longer = Math.max(width, depth);
    const shorter = Math.min(width, depth);
    const ratio = longer / shorter;
    const d = ratio >= 2 ? shorter : longer;

    const gridSpacing = Math.min(10, 0.2 * Math.pow(5, Math.log10(d)));
    if (!(gridSpacing > 0)) {
        return 0.1;
    }

    const pointCount = Math.max(1, Math.round(d / gridSpacing));
    const fittedSpacing = d / pointCount;

    return Number((fittedSpacing / 2).toFixed(3));
}

/**
 * UGR cargado a mano para este ambiente â€” ver el doc-comment de
 * `Room.manualUgr` (`types.ts`) para el porquÃ© (mÃ©todo analÃ­tico de
 * posiciÃ³n de Guth fuera de su rango de validez H/Râ‰¤2). `null` = sin
 * override, se usa el UGR calculado tal cual.
 */
export function getRoomManualUgr(room: Room): number | null {
    return typeof room.manualUgr === 'number' ? room.manualUgr : null;
}

export function buildRoomLightingInputs(
    room: Room,
    fixtures: Fixture[],
): RoomLightingInputs {
    const area = calculatePolygonArea(room.vertices);
    const illuminanceLux = getRoomIlluminanceLux(room);
    const usefulPlaneHeight = getRoomUsefulPlaneHeight(room);
    const marginalZone = getRoomMarginalZone(room);
    const detectedFixtureLumens = getDominantFixtureLumens(fixtures);
    const fixtureLumens =
        detectedFixtureLumens ?? getRoomFallbackFixtureLumens(room);
    const lumensRequired = calculateLumensRequired(area, illuminanceLux);
    const exactQuantity = calculateExactQuantity(lumensRequired, fixtureLumens);
    const roundedQuantity = calculateRoundedQuantity(exactQuantity);

    return {
        area,
        illuminanceLux,
        usefulPlaneHeight,
        marginalZone,
        fixtureLumens,
        fixtureCount: fixtures.length,
        lumensRequired,
        exactQuantity,
        roundedQuantity,
        estimatedUniformity: estimateUniformity(roundedQuantity),
        coverage: determineCoverage(
            exactQuantity,
            fixtures.length > 0 ? fixtures.length : roundedQuantity,
        ),
        detectedFixtureLumens,
        normative: findNormativeOption(room),
    };
}

