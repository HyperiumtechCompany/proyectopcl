import { canonicalStringify } from './canonicalStringify';
import type { CalculationSnapshot } from './types';

/**
 * Hashing determinista del snapshot (ADR 0002). SHA-256 vía Web Crypto
 * (`crypto.subtle`, disponible en browser y Node ≥19 sin dependencias
 * nuevas) sobre una serialización canónica (`canonicalStringify`).
 */
async function sha256Hex(input: string): Promise<string> {
    const bytes = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Qué entra al hash completo del snapshot (ADR 0002, punto 4): geometría,
 * materiales, luminarias (incl. fotometría), escenas y `schemaVersion`.
 * NO entra `geometryHash` en sí mismo (evita autoreferencia) ni ningún
 * metadato de UI — el tipo `CalculationSnapshot` ya no carga metadatos de UI,
 * así que basta con excluir el campo `geometryHash`.
 */
export async function hashCalculationSnapshot(snapshot: CalculationSnapshot): Promise<string> {
    const hashable: Omit<CalculationSnapshot, 'geometryHash'> = {
        schemaVersion: snapshot.schemaVersion,
        projectId: snapshot.projectId,
        levels: snapshot.levels,
        materials: snapshot.materials,
        luminaires: snapshot.luminaires,
        scenes: snapshot.scenes,
        calculationObjects: snapshot.calculationObjects,
    };
    return sha256Hex(canonicalStringify(hashable));
}

/**
 * Hash SOLO de geometría (niveles + forma/altura de los objetos de cálculo),
 * sin luminarias ni materiales — permite invalidar overlays puramente
 * geométricos (3D) sin recalcular fotometría (ADR 0002, punto 5).
 */
export async function hashCalculationGeometry(snapshot: CalculationSnapshot): Promise<string> {
    const geometryOnly = {
        levels: snapshot.levels,
        objects: snapshot.calculationObjects.map((object) => ({
            id: object.id,
            levelId: object.levelId,
            vertices: object.vertices,
            height: object.height,
            roomType: object.roomType,
        })),
    };
    return sha256Hex(canonicalStringify(geometryOnly));
}

/** Devuelve el snapshot con `geometryHash` poblado — separado de `buildCalculationSnapshot` porque hashear es async (Web Crypto) y la construcción del snapshot es pura/sync. */
export async function withGeometryHash(snapshot: CalculationSnapshot): Promise<CalculationSnapshot> {
    return { ...snapshot, geometryHash: await hashCalculationGeometry(snapshot) };
}
