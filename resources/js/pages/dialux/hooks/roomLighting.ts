import {
    calculateExactQuantity,
    calculateLumensRequired,
    calculatePolygonArea,
    calculateRoomIndex,
    calculateRoundedQuantity,
    determineCoverage,
    estimateUniformity,
} from './lightingCalculations';
import type { RawNormativeBranch, RawNormativeLeaf } from './normativaData';
import { getNormData } from './normativeEngine';
import type { Fixture, Room } from './types';

export type NormativeStandard =
    | 'en_12464'
    | 'ies_na'
    | 'rne_peru'
    | 'rne_a130'
    | 'en_1838'
    | 'nfpa101'
    | 'ds024';

export const NORMATIVE_LABELS: Record<NormativeStandard, string> = {
    en_12464: 'EN 12464-1 (Europa)',
    ies_na: 'IESNA / IES HB-10 (EE. UU.)',
    rne_peru: 'RNE EM.010 / CNE (Perú)',
    rne_a130: 'RNE A.130 - Alumbrado de emergencia (Perú, obligatoria)',
    en_1838: 'EN 1838 - Alumbrado de emergencia (Europa, referencia)',
    nfpa101: 'NFPA 101 - Life Safety Code (EE. UU.)',
    ds024: 'DS-024-2016-EM - Minería (Perú)',
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
    /** Altura del plano útil (m) verificada contra DIALux evo para esta actividad — `null` si aún no se verificó (ver `RawNormativeLeaf.workPlaneHeight`). */
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
 * Se recalcula en cada llamada (no se cachea a nivel de módulo) porque
 * `getNormData` puede devolver el catálogo sembrado en BD (fuente única de
 * verdad, cargado en runtime vía ensureStandardDataLoaded) en vez del
 * dataset estático — cachear aquí habría dejado esta función (y por tanto
 * los dropdowns de WallProps/RoomProps y findNormativeOption) mostrando
 * permanentemente la transcripción estática aunque la BD ya hubiera
 * cargado un catálogo distinto.
 */
export function getNormativeOptions(
    standard: NormativeStandard,
): NormativeLeafOption[] {
    return flattenNormativeTree(getNormData(standard));
}

export function getCategoryOptions(
    standard: NormativeStandard = 'en_12464',
): string[] {
    const options = getNormativeOptions(standard);
    return Array.from(new Set(options.map((option) => option.category)));
}

export function getSectionOptions(
    standard: NormativeStandard = 'en_12464',
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
    first: NormativeStandard | string | undefined = 'en_12464',
    second?: string,
    third?: string,
): NormativeLeafOption[] {
    const hasStandard =
        first === 'en_12464' ||
        first === 'ies_na' ||
        first === 'rne_peru' ||
        first === 'en_1838' ||
        first === 'nfpa101' ||
        first === 'ds024';
    const standard = hasStandard ? (first as NormativeStandard) : 'en_12464';
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
    const selectedStandard = room.normativeStandard || 'en_12464';
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

export function getRoomMarginalZone(room: Room): number {
    if (typeof room.marginalZone === 'number') {
        return Math.max(0, room.marginalZone);
    }

    if (room.vertices.length < 3) {
        return 0.1;
    }

    const xs = room.vertices.map((vertex) => vertex.x);
    const ys = room.vertices.map((vertex) => vertex.y);
    const minDimension = Math.min(
        Math.max(...xs) - Math.min(...xs),
        Math.max(...ys) - Math.min(...ys),
    );

    return Number(
        Math.min(0.2, Math.max(0.05, minDimension * 0.05)).toFixed(3),
    );
}

/** Índice del local (k) a partir del bbox del recinto y la altura de montaje sobre el plano de trabajo. */
export function calculateRoomIndexForRoom(
    room: Room,
    usefulPlaneHeight: number,
): number {
    if (room.vertices.length < 3) {
        return 0;
    }

    const xs = room.vertices.map((vertex) => vertex.x);
    const ys = room.vertices.map((vertex) => vertex.y);
    const length = Math.max(...xs) - Math.min(...xs);
    const width = Math.max(...ys) - Math.min(...ys);
    const mountingHeight = Math.max(0.3, room.height - usefulPlaneHeight);

    return calculateRoomIndex(length, width, mountingHeight);
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
    const roomIndex = calculateRoomIndexForRoom(room, usefulPlaneHeight);
    const lumensRequired = calculateLumensRequired(area, illuminanceLux, {
        roomIndex,
        reflectances: {
            ceiling: room.ceilingReflectance ?? 0.7,
            wall: room.wallReflectance ?? 0.5,
            floor: room.floorReflectance ?? 0.2,
        },
    });
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
