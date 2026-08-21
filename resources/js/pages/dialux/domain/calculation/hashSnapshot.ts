import { canonicalStringify } from './canonicalStringify';
import type { CalculationSnapshot } from './types';

/**
 * Hashing determinista del snapshot (ADR 0002). SHA-256 vía Web Crypto
 * (`crypto.subtle`, disponible en browser y Node ≥19 sin dependencias
 * nuevas) sobre una serialización canónica (`canonicalStringify`).
 */
async function sha256Hex(input: string): Promise<string> {
    const bytes = new TextEncoder().encode(input);
    if (!crypto.subtle) {
        return fallbackHashHex(input);
    }
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * `crypto.subtle` solo existe en contextos seguros (HTTPS o localhost) — un
 * dominio `.test` de Laragon servido por HTTP lo deja `undefined`, y sin
 * este respaldo CUALQUIER cálculo rompía por completo (el fallback síncrono
 * de `EditorLayout.tsx` ya calcula bien los resultados, pero después
 * crasheaba armando el hash y los resultados nunca llegaban a la pantalla).
 * Este hash SOLO se usa para detectar si el snapshot cambió (ADR 0002),
 * nunca como garantía criptográfica — un hash no criptográfico determinista
 * alcanza. 8 rondas de FNV-1a de 32 bits con semilla distinta cada una,
 * concatenadas, para mantener el mismo formato de salida (64 hex) que
 * SHA-256 y que ningún consumidor (validación, `slice(0,16)` para IDs,
 * regex de tests) necesite distinguir cuál camino produjo el hash.
 */
function fallbackHashHex(input: string): string {
    let out = '';
    for (let round = 0; round < 8; round++) {
        let hash = 0x811c9dc5 ^ round;
        for (let i = 0; i < input.length; i++) {
            hash ^= input.charCodeAt(i);
            hash = Math.imul(hash, 0x01000193);
        }
        out += (hash >>> 0).toString(16).padStart(8, '0');
    }
    return out;
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
        obstacles: snapshot.obstacles,
        partitionPatches: snapshot.partitionPatches,
    };
    return sha256Hex(canonicalStringify(hashable));
}

/**
 * Hash SOLO de geometría (niveles + forma/altura de los objetos de cálculo +
 * obstáculos de oclusión — Fase 6), sin luminarias ni materiales — permite
 * invalidar overlays puramente geométricos (3D) sin recalcular fotometría
 * (ADR 0002, punto 5). Los obstáculos entran aquí porque mover un muro
 * cambia la geometría 3D igual que mover un recinto.
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
        obstacles: snapshot.obstacles,
        partitionPatches: snapshot.partitionPatches,
    };
    return sha256Hex(canonicalStringify(geometryOnly));
}

/** Devuelve el snapshot con `geometryHash` poblado — separado de `buildCalculationSnapshot` porque hashear es async (Web Crypto) y la construcción del snapshot es pura/sync. */
export async function withGeometryHash(snapshot: CalculationSnapshot): Promise<CalculationSnapshot> {
    return { ...snapshot, geometryHash: await hashCalculationGeometry(snapshot) };
}
