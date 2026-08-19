import { ConeDiagramRow } from './computeConeDiagram';

export function buildConeSvgFromRows(rows: ConeDiagramRow[], beamAngleDeg: number): string | null {
    if (!rows || rows.length === 0) return null;

    // Dimensiones
    const width = 360;
    const height = 280;
    const margin = { top: 30, right: 70, bottom: 30, left: 70 };
    
    // Altura utilizable
    const maxDist = Math.max(...rows.map(r => r.distanceM));
    const drawHeight = height - margin.top - margin.bottom;
    
    // Escala Y
    const y = (d: number) => margin.top + (d / maxDist) * drawHeight;

    // Escala X (el ancho máximo del cono será aprox el 50% del ancho del SVG)
    // El radio máximo real es maxDist * Math.tan(beamAngleDeg / 2 * PI / 180).
    const maxRadiusM = maxDist * Math.tan((beamAngleDeg / 2) * Math.PI / 180);
    const drawWidth = width - margin.left - margin.right;
    const pxPerM = maxRadiusM > 0 ? (drawWidth / 2) / maxRadiusM : 10;
    
    const xLeft = (r: number) => width / 2 - r * pxPerM;
    const xRight = (r: number) => width / 2 + r * pxPerM;
    const xCenter = width / 2;

    const paths: string[] = [];
    const texts: string[] = [];
    
    // Título
    texts.push(`<text x="10" y="15" font-family="Arial, sans-serif" font-size="11" fill="#0f172a" font-weight="700">Diagrama de cono</text>`);
    texts.push(`<text x="10" y="28" font-family="Arial, sans-serif" font-size="9" fill="#64748b">Ángulo de haz: ${Math.round(beamAngleDeg)}°</text>`);
    
    // Dibujar las líneas base (el cono)
    const conePath = `M ${xCenter} ${margin.top} L ${xLeft(maxRadiusM)} ${y(maxDist)} L ${xRight(maxRadiusM)} ${y(maxDist)} Z`;
    paths.push(`<path d="${conePath}" fill="#e0f2fe" stroke="#0284c7" stroke-width="1.5" stroke-linejoin="round" />`);
    
    // Línea central punteada
    paths.push(`<line x1="${xCenter}" y1="${margin.top}" x2="${xCenter}" y2="${y(maxDist)}" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4 4" />`);
    
    // Encabezados
    texts.push(`<text x="${margin.left - 10}" y="${margin.top - 5}" font-family="Arial, sans-serif" font-size="9" fill="#64748b" text-anchor="end">E0 (lx)</text>`);
    texts.push(`<text x="${width - margin.right + 10}" y="${margin.top - 5}" font-family="Arial, sans-serif" font-size="9" fill="#64748b" text-anchor="start">Eavg (lx)</text>`);

    // Iterar por cada fila (distancia)
    rows.forEach(row => {
        const yPos = y(row.distanceM);
        const radiusM = row.beamDiameterM / 2;
        
        // Línea horizontal de cota
        paths.push(`<line x1="${xLeft(maxRadiusM)}" y1="${yPos}" x2="${xRight(maxRadiusM)}" y2="${yPos}" stroke="#cbd5e1" stroke-width="0.5" />`);
        
        // Textos
        texts.push(`<text x="${margin.left - 10}" y="${yPos + 4}" font-family="Arial, sans-serif" font-size="9" fill="#0f172a" font-weight="bold" text-anchor="end">${Math.round(row.e0Lux)}</text>`);
        texts.push(`<text x="${width - margin.right + 10}" y="${yPos + 4}" font-family="Arial, sans-serif" font-size="9" fill="#0f172a" text-anchor="start">${Math.round(row.eAvgLux)}</text>`);
        
        // Distancia central
        texts.push(`<rect x="${xCenter - 12}" y="${yPos - 6}" width="24" height="12" fill="#e0f2fe" />`);
        texts.push(`<text x="${xCenter}" y="${yPos + 3}" font-family="Arial, sans-serif" font-size="8" fill="#0284c7" font-weight="bold" text-anchor="middle">${row.distanceM}m</text>`);
        
        // Diámetro debajo de la línea
        texts.push(`<text x="${xRight(radiusM) + 5}" y="${yPos - 2}" font-family="Arial, sans-serif" font-size="8" fill="#64748b" text-anchor="start">Ø ${row.beamDiameterM.toFixed(2)}m</text>`);
    });

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%">
        ${paths.join('\n        ')}
        ${texts.join('\n        ')}
    </svg>`;
}
