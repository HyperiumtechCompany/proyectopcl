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

    const polyline = [...points, ...mirrored].join(' ');
    const safeTitle = escapeXml(title);
    const safeMax = Math.round(maxCandela).toLocaleString('en-US');

    return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="520" viewBox="0 0 320 260">
    <rect width="320" height="260" fill="#ffffff"/>
    <g transform="translate(0 -30)" stroke="#d7dde6" stroke-width="0.7" fill="none">
        <circle cx="160" cy="160" r="40"/>
        <circle cx="160" cy="160" r="80"/>
        <circle cx="160" cy="160" r="120"/>
        <line x1="40" y1="160" x2="280" y2="160"/>
        <line x1="160" y1="40" x2="160" y2="280"/>
        <line x1="75" y1="75" x2="245" y2="245"/>
        <line x1="245" y1="75" x2="75" y2="245"/>
        <polyline points="${polyline}" stroke="#2563eb" stroke-width="2.2"/>
    </g>
    <text x="18" y="22" font-family="Arial, sans-serif" font-size="11" fill="#0f172a" font-weight="700">CDL polar</text>
    <text x="18" y="38" font-family="Arial, sans-serif" font-size="8" fill="#64748b">${safeTitle}</text>
    <text x="18" y="246" font-family="Arial, sans-serif" font-size="8" fill="#64748b">Imax ${safeMax} cd</text>
</svg>`;
}
