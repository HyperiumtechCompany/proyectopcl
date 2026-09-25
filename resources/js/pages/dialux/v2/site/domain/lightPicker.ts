/**
 * Elige hasta `max` fuentes que cubran BIEN el plano: parte de la de más flujo y
 * añade siempre la más alejada de las ya elegidas (así las luces de un ingreso no
 * dejan sin luz real a los postes de otra zona).
 */
export function pickSpreadSources<T extends { x: number; z: number; lumens: number }>(
    sources: T[],
    max: number,
): T[] {
    if (sources.length <= max) return sources;
    const chosen: T[] = [
        sources.reduce((best, s) => (s.lumens > best.lumens ? s : best), sources[0]),
    ];
    while (chosen.length < max) {
        let far: T | null = null;
        let farD = -1;
        for (const s of sources) {
            if (chosen.includes(s)) continue;
            const d = Math.min(...chosen.map((c) => Math.hypot(c.x - s.x, c.z - s.z)));
            if (d > farD) {
                farD = d;
                far = s;
            }
        }
        if (!far) break;
        chosen.push(far);
    }
    return chosen;
}
