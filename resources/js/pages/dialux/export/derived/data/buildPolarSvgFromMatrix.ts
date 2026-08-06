/**
 * Puerto TS puro (sin red, sin DOM) de
 * `app/Services/ProductImportService.php::buildPolarSvg()` — Fase 15 del
 * plan maestro ("CDL polar sin dependencia de red"). Permite generar el
 * diagrama polar en el navegador cuando `fixture.reportAssets.polar_svg`
 * no está persistido y el catálogo remoto no respondió, usando solo la
 * matriz fotométrica que ya viaja en el snapshot del proyecto.
 */

interface PolarMatrixInput {
    gamma_angles?: number[] | null;
    candela?: number[][] | null;
}

function escapeXml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export function buildPolarSvgFromMatrix(web: PolarMatrixInput | null | undefined, title: string): string | null {
    const angles = web?.gamma_angles;
    const plane = web?.candela?.[0];
    if (!Array.isArray(angles) || !Array.isArray(plane) || plane.length === 0) {
        return null;
    }

    const maxCandela = Math.max(0, ...plane);
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

    const points = plane.map((candelaValue, index) => toPoint(angles[index] ?? index, candelaValue));
    const mirrored = [...plane]
        .map((candelaValue, index) => toPoint(-(angles[index] ?? index), candelaValue))
        .reverse();

    const curvePath = 'M ' + [...points, ...mirrored].join(' L ');
    const safeTitle = escapeXml(title);
    const safeMax = Math.round(maxCandela).toLocaleString('en-US');

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
    return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="520" viewBox="0 0 320 260">
    <rect width="320" height="260" fill="#ffffff"/>
    <g transform="translate(0 -30)">
        <path d="${circlePath(40)}" ${gridAttrs}/>
        <path d="${circlePath(80)}" ${gridAttrs}/>
        <path d="${circlePath(120)}" ${gridAttrs}/>
        <path d="M 40 160 L 280 160" ${gridAttrs}/>
        <path d="M 160 40 L 160 280" ${gridAttrs}/>
        <path d="M 75 75 L 245 245" ${gridAttrs}/>
        <path d="M 245 75 L 75 245" ${gridAttrs}/>
        <path d="${curvePath}" stroke="#2563eb" stroke-width="2.2" fill="none"/>
    </g>
    <text x="18" y="22" font-family="Arial, sans-serif" font-size="11" fill="#0f172a" font-weight="700">CDL polar</text>
    <text x="18" y="38" font-family="Arial, sans-serif" font-size="8" fill="#64748b">${safeTitle}</text>
    <text x="18" y="246" font-family="Arial, sans-serif" font-size="8" fill="#64748b">Imax ${safeMax} cd</text>
</svg>`;
}
