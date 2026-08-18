/**
 * Puerto TS puro (sin red, sin DOM) de
 * `app/Services/ProductImportService.php::buildPolarSvg()` — Fase 15 del
 * plan maestro ("CDL polar sin dependencia de red"). Permite generar el
 * diagrama polar en el navegador cuando `fixture.reportAssets.polar_svg`
 * no está persistido y el catálogo remoto no respondió, usando solo la
 * matriz fotométrica que ya viaja en el snapshot del proyecto.
 */

interface PolarMatrixInput {
    c_angles?: number[] | null;
    gamma_angles?: number[] | null;
    candela?: number[][] | null;
    reference_lumens?: number | null;
}

function escapeXml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * Encuentra, entre los planos C realmente almacenados, el más cercano a
 * `targetDeg` o a su opuesto (`targetDeg + 180`) — un solo plano mirado y
 * reflejado ya dibuja el corte completo "C/C+180" (misma convención que
 * DIALux: un archivo con simetría rotacional (Isym=1, un solo plano C)
 * produce curvas C0/C180 y C90/C270 idénticas superpuestas).
 */
function findClosestCPlane(
    cAngles: number[] | null | undefined,
    targetDeg: number,
    exclude: Set<number>,
    maxDeltaDeg = Infinity,
): number | null {
    if (!Array.isArray(cAngles) || cAngles.length === 0) return null;
    let bestIndex: number | null = null;
    let bestDelta = Infinity;
    cAngles.forEach((c, index) => {
        if (exclude.has(index)) return;
        const normalized = ((c % 360) + 360) % 360;
        const deltaToTarget = Math.min(Math.abs(normalized - targetDeg), 360 - Math.abs(normalized - targetDeg));
        const opposite = (targetDeg + 180) % 360;
        const deltaToOpposite = Math.min(Math.abs(normalized - opposite), 360 - Math.abs(normalized - opposite));
        const delta = Math.min(deltaToTarget, deltaToOpposite);
        if (delta < bestDelta) {
            bestDelta = delta;
            bestIndex = index;
        }
    });
    // Sin tolerancia, un archivo con solo C0/C180 (sin C90) elegiría el
    // plano C180 "de sobra" como si fuera C90/C270 — mal etiquetado, porque
    // en realidad pertenece al mismo eje que el plano primario. Se exige que
    // el candidato esté razonablemente cerca de 90°/270° antes de aceptarlo.
    return bestDelta <= maxDeltaDeg ? bestIndex : null;
}

export function buildPolarSvgFromMatrix(web: PolarMatrixInput | null | undefined, title: string): string | null {
    const angles = web?.gamma_angles;
    const candela = web?.candela;
    const primaryIndex = findClosestCPlane(web?.c_angles, 0, new Set()) ?? 0;
    const rawPlane = candela?.[primaryIndex];
    if (!Array.isArray(angles) || !Array.isArray(rawPlane) || rawPlane.length === 0) {
        return null;
    }

    // Ronda 21m: candela expresada en cd/1000 lm (mismo convenio que
    // `IntensityTable.tsx` y el LDT Editor de DIALux, "Dimension unit: cd /
    // 1000 lm"), no cd absoluta — antes el usuario comparaba este gráfico
    // (candela absoluta al flujo actual del producto) contra una captura de
    // DIALux evo (siempre cd/klm) y los números impresos no coincidían,
    // aunque la matriz almacenada fuera idéntica byte a byte (confirmado con
    // el lector LDT independiente del usuario). La FORMA de la curva es
    // matemáticamente invariante a este cambio (es un radio relativo,
    // `valor/máximo`, el mismo factor de escala se cancela) — este cambio
    // solo corrige las etiquetas numéricas impresas, no afecta ningún
    // cálculo real (el motor de iluminancia usa `photometricWeb.candela`
    // directamente, nunca este SVG de previsualización).
    const klmScale = web?.reference_lumens && web.reference_lumens > 0 ? 1000 / web.reference_lumens : 1;
    const plane = rawPlane.map((v) => v * klmScale);

    const secondaryIndex = findClosestCPlane(web?.c_angles, 90, new Set([primaryIndex]), 30);
    const rawSecondaryPlane = secondaryIndex !== null ? candela?.[secondaryIndex] : undefined;
    const hasSecondPlane = Array.isArray(rawSecondaryPlane) && rawSecondaryPlane.length > 0;
    const secondaryPlane = hasSecondPlane ? rawSecondaryPlane!.map((v) => v * klmScale) : undefined;

    const maxCandela = Math.max(0, ...plane, ...(hasSecondPlane ? secondaryPlane! : []));
    if (maxCandela <= 0) {
        return null;
    }

    const toPoint = (angleDeg: number, candelaValue: number): string => {
        const angleRad = (angleDeg * Math.PI) / 180;
        const radius = 120 * (candelaValue / maxCandela);
        const x = 160 + Math.sin(angleRad) * radius;
        const y = 160 + Math.cos(angleRad) * radius;
        return `${Math.round(x * 100) / 100},${Math.round(y * 100) / 100}`;
    };

    const buildCurvePath = (values: number[]): string => {
        const points = values.map((candelaValue, index) => toPoint(angles[index] ?? index, candelaValue));
        const mirrored = [...values]
            .map((candelaValue, index) => toPoint(-(angles[index] ?? index), candelaValue))
            .reverse();
        return 'M ' + [...points, ...mirrored].join(' L ');
    };

    // C0/C180 se dibuja primero (rojo, como en el lector LDT de DIALux) y
    // C90/C270 encima (azul) — en una luminaria rotacionalmente simétrica
    // ambas curvas coinciden exactamente y solo se ve la azul, igual que en
    // DIALux, en vez de mostrar solo un plano y descartar el resto en silencio.
    const secondaryCurvePath = hasSecondPlane ? buildCurvePath(secondaryPlane!) : null;
    const primaryCurvePath = buildCurvePath(plane);

    const safeTitle = escapeXml(title);
    const safeMax = maxCandela.toLocaleString('en-US', { maximumFractionDigits: 1 });
    const fluxSuffix =
        typeof web?.reference_lumens === 'number' && web.reference_lumens > 0
            ? ` · Φ ${Math.round(web.reference_lumens).toLocaleString('en-US')} lm`
            : '';

    // Todo el dibujo son `<path>` — nunca `<circle>`/`<line>`/`<polyline>`.
    // dompdf (motor PHP que rasteriza este SVG a PDF en el servidor) solo
    // tiene probado soporte de SVG para paths/curvas/arcos (ver el resto de
    // diagramas de este export, que sí funcionan y solo usan `<path>`/`<rect>`);
    // `<circle>` y `<line>` nunca se habían usado en ningún otro SVG de la
    // app — con ellos, TODO el dibujo (incluida la curva) salía invisible en
    // el PDF aunque el SVG se viera perfecto en un navegador — verificado
    // contra un export real y contra el SVG persistido en la base de datos.
    const circlePath = (r: number) =>
        `M ${160 + r} 160 A ${r} ${r} 0 1 0 ${160 - r} 160 A ${r} ${r} 0 1 0 ${160 + r} 160`;
    const gridAttrs = 'stroke="#d7dde6" stroke-width="0.7" fill="none"';
    const ringLabels = [40, 80, 120]
        .map((r) => {
            const value = Math.round(maxCandela * (r / 120)).toLocaleString('en-US');
            return `<text x="156" y="${160 + r + 3}" font-family="Arial, sans-serif" font-size="7" fill="#94a3b8" text-anchor="end">${value}</text>`;
        })
        .join('\n        ');
    const angleLabels = [0, 30, 60, 90]
        .map((deg) => {
            const rad = (deg * Math.PI) / 180;
            const labelRadius = 131;
            const x = 160 + Math.sin(rad) * labelRadius;
            const y = 160 + Math.cos(rad) * labelRadius;
            if (deg === 0) {
                return `<text x="${x}" y="${y + 5}" font-family="Arial, sans-serif" font-size="7" fill="#94a3b8" text-anchor="middle">0°</text>`;
            }
            const mirroredX = 160 - Math.sin(rad) * labelRadius;
            return [
                `<text x="${x}" y="${y + 2}" font-family="Arial, sans-serif" font-size="7" fill="#94a3b8" text-anchor="middle">${deg}°</text>`,
                `<text x="${mirroredX}" y="${y + 2}" font-family="Arial, sans-serif" font-size="7" fill="#94a3b8" text-anchor="middle">${deg}°</text>`,
            ].join('\n        ');
        })
        .join('\n        ');
    const legend = hasSecondPlane
        ? `<path d="M 220 12 L 232 12" stroke="#dc2626" stroke-width="2"/>
    <text x="235" y="14" font-family="Arial, sans-serif" font-size="7" fill="#64748b">C0/C180</text>
    <path d="M 275 12 L 287 12" stroke="#2563eb" stroke-width="2"/>
    <text x="290" y="14" font-family="Arial, sans-serif" font-size="7" fill="#64748b">C90/C270</text>`
        : '';

    return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="520" viewBox="0 0 320 260">
    <rect width="320" height="260" fill="#ffffff"/>
    ${legend}
    <g transform="translate(0 -30)">
        <path d="${circlePath(40)}" ${gridAttrs}/>
        <path d="${circlePath(80)}" ${gridAttrs}/>
        <path d="${circlePath(120)}" ${gridAttrs}/>
        <path d="M 40 160 L 280 160" ${gridAttrs}/>
        <path d="M 160 40 L 160 280" ${gridAttrs}/>
        <path d="M 75 75 L 245 245" ${gridAttrs}/>
        <path d="M 245 75 L 75 245" ${gridAttrs}/>
        <path d="${primaryCurvePath}" stroke="${secondaryCurvePath ? '#dc2626' : '#2563eb'}" stroke-width="2.2" fill="none"/>
        ${secondaryCurvePath ? `<path d="${secondaryCurvePath}" stroke="#2563eb" stroke-width="2.2" fill="none"/>` : ''}
        ${ringLabels}
        ${angleLabels}
    </g>
    <text x="18" y="22" font-family="Arial, sans-serif" font-size="11" fill="#0f172a" font-weight="700">CDL polar</text>
    <text x="18" y="38" font-family="Arial, sans-serif" font-size="8" fill="#64748b">${safeTitle}</text>
    <text x="18" y="246" font-family="Arial, sans-serif" font-size="8" fill="#64748b">Imax ${safeMax} cd/klm${fluxSuffix}</text>
</svg>`;
}
