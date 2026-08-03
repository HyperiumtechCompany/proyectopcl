import type { DxfLevelPackage, DxfNumberedSheet } from '../domain/types';

/**
 * Numera las láminas en orden estable (sección 4.2/14.1): los niveles llegan
 * ya ordenados por `floorIndex` desde `buildDxfDrawingPackage`, y dentro de
 * cada nivel alumbrado siempre va antes que tomacorrientes. No filtra
 * láminas vacías — eso es decisión de la Fase 8 (`includeEmptySheets`).
 */
export function numberDxfSheets(levels: DxfLevelPackage[]): DxfNumberedSheet[] {
    const identities = levels.flatMap((level) => [
        { sceneId: level.sceneId, levelName: level.name, discipline: 'lighting' as const },
        { sceneId: level.sceneId, levelName: level.name, discipline: 'outlets' as const },
    ]);
    const sheetCount = identities.length;
    const pad = Math.max(2, String(sheetCount).length);

    return identities.map((identity, index) => {
        const sheetIndex = index + 1;
        return {
            ...identity,
            sheetIndex,
            sheetCount,
            sheetNumber: `${String(sheetIndex).padStart(pad, '0')}/${String(sheetCount).padStart(pad, '0')}`,
        };
    });
}
