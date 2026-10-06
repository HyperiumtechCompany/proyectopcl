/**
 * Gráficos del libro Excel. ExcelJS no crea gráficos nativos, así que se
 * dibujan como SVG (con el estilo del expediente del cliente) y se insertan
 * como imagen PNG. Los generadores de SVG son puros (testeables); solo
 * `svgAPng` necesita el navegador.
 */

const FUENTE = "'Agency FB', 'Arial Narrow', Arial, sans-serif";
/** Paleta de Office del expediente: azul, rojo, verde, morado, celeste, naranja. */
export const PALETA_TORTA = ['#4F81BD', '#C0504D', '#9BBB59', '#8064A2', '#4BACC6', '#F79646'];
const AZUL = '#1F3864';
const ROJO = '#C0504D';

const esc = (texto: string) => texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pct = (valor: number) => `${(valor * 100).toFixed(2)}%`;
const r1 = (n: number) => Math.round(n * 10) / 10;

export interface SerieCurva {
    nombre: string;
    color: string;
    /** Avance acumulado (0–1) por valorización; el punto 0 (0 %) se agrega solo. */
    valores: number[];
    suave?: boolean;
}

/** Trazo suave (Catmull-Rom → Bézier) como las líneas suavizadas de Excel. */
function trazo(puntos: Array<[number, number]>, suave: boolean): string {
    if (!suave || puntos.length < 3) {
        return puntos.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${r1(x)},${r1(y)}`).join(' ');
    }
    let d = `M${r1(puntos[0][0])},${r1(puntos[0][1])}`;
    for (let i = 0; i < puntos.length - 1; i++) {
        const p0 = puntos[Math.max(0, i - 1)];
        const [p1, p2] = [puntos[i], puntos[i + 1]];
        const p3 = puntos[Math.min(puntos.length - 1, i + 2)];
        const c1: [number, number] = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
        const c2: [number, number] = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
        d += ` C${r1(c1[0])},${r1(c1[1])} ${r1(c2[0])},${r1(c2[1])} ${r1(p2[0])},${r1(p2[1])}`;
    }

    return d;
}

const rombo = (x: number, y: number, color: string) => `<path d="M${r1(x)},${r1(y - 5)} L${r1(x + 5)},${r1(y)} L${r1(x)},${r1(y + 5)} L${r1(x - 5)},${r1(y)} Z" fill="${color}"/>`;

/**
 * Curva S (CURVA S del expediente): avance acumulado programado vs ejecutado
 * por valorización, eje Y 0–100 %, etiquetas de % en cada punto.
 */
export function svgCurvaS({ titulo, subtitulo, valorizaciones, series, ancho = 960, alto = 520 }: { titulo: string; subtitulo: string; valorizaciones: number; series: SerieCurva[]; ancho?: number; alto?: number }): string {
    const m = { izq: 78, der: 36, sup: 78, inf: 108 };
    const w = ancho - m.izq - m.der;
    const h = alto - m.sup - m.inf;
    const n = Math.max(1, valorizaciones);
    const x = (i: number) => m.izq + (w * i) / n;
    const maxY = Math.max(1, ...series.flatMap((s) => s.valores));
    const topeY = Math.ceil(maxY * 10) / 10;
    const y = (v: number) => m.sup + h - (h * v) / topeY;
    const partes: string[] = [];

    partes.push(`<rect width="${ancho}" height="${alto}" fill="#fff"/>`);
    partes.push(`<text x="${ancho / 2}" y="28" text-anchor="middle" font-size="17" font-weight="700" text-decoration="underline">${esc(titulo)}</text>`);
    partes.push(`<text x="${ancho / 2}" y="50" text-anchor="middle" font-size="17" font-weight="700" text-decoration="underline">${esc(subtitulo)}</text>`);

    for (let k = 0; k <= Math.round(topeY * 10); k++) {
        const v = k / 10;
        partes.push(`<line x1="${m.izq}" x2="${m.izq + w}" y1="${r1(y(v))}" y2="${r1(y(v))}" stroke="${k === 0 ? '#7F7F7F' : '#95B3D7'}" stroke-width="1"/>`);
        partes.push(`<text x="${m.izq - 8}" y="${r1(y(v) + 4)}" text-anchor="end" font-size="12">${k * 10}%</text>`);
    }
    for (let i = 0; i <= n; i++) {
        partes.push(`<line x1="${r1(x(i))}" x2="${r1(x(i))}" y1="${m.sup}" y2="${m.sup + h}" stroke="#BFBFBF" stroke-dasharray="3 3"/>`);
        partes.push(`<text x="${r1(x(i))}" y="${m.sup + h + 18}" text-anchor="middle" font-size="12" font-weight="700">${i}</text>`);
    }
    partes.push(`<line x1="${m.izq}" x2="${m.izq}" y1="${m.sup}" y2="${m.sup + h}" stroke="#7F7F7F"/>`);
    partes.push(`<text x="${m.izq + w / 2}" y="${m.sup + h + 38}" text-anchor="middle" font-size="12" font-weight="700">VALORIZACIONES</text>`);
    partes.push(`<text transform="translate(22 ${m.sup + h / 2}) rotate(-90)" text-anchor="middle" font-size="12" font-weight="700">PORCENTAJE</text>`);

    for (const serie of series) {
        const puntos: Array<[number, number]> = [[x(0), y(0)], ...serie.valores.map((v, i): [number, number] => [x(i + 1), y(v)])];
        partes.push(`<path d="${trazo(puntos, serie.suave ?? false)}" fill="none" stroke="${serie.color}" stroke-width="2.5"/>`);
        puntos.forEach(([px, py], i) => {
            partes.push(rombo(px, py, serie.color));
            if (i > 0) {
                partes.push(`<text x="${r1(px)}" y="${r1(py - 10)}" text-anchor="${i === n ? 'end' : 'middle'}" font-size="13" font-weight="700" fill="${serie.color}">${pct(serie.valores[i - 1])}</text>`);
            }
        });
    }

    // Leyenda enmarcada, como en el expediente.
    const leyendaY = alto - 34;
    const anchoLeyenda = series.length * 190;
    const x0 = (ancho - anchoLeyenda) / 2;
    partes.push(`<rect x="${x0 - 12}" y="${leyendaY - 18}" width="${anchoLeyenda + 24}" height="34" fill="none" stroke="#7F7F7F"/>`);
    series.forEach((serie, i) => {
        const lx = x0 + i * 190;
        partes.push(`<line x1="${lx}" x2="${lx + 40}" y1="${leyendaY}" y2="${leyendaY}" stroke="${serie.color}" stroke-width="2.5"/>`);
        partes.push(rombo(lx + 20, leyendaY, serie.color));
        partes.push(`<text x="${lx + 48}" y="${leyendaY + 4}" font-size="12">${esc(serie.nombre.toUpperCase())}</text>`);
    });

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}" font-family="${FUENTE}" fill="#000">${partes.join('')}</svg>`;
}

export const SERIES_CURVA_S = { programado: AZUL, ejecutado: ROJO };

export interface PorcionTorta {
    nombre: string;
    valor: number;
}

/** Torta con etiquetas "NOMBRE; 62.72%" y leyenda inferior (AVANCE FÍSICO / CONTROL FINANCIERO). */
export function svgTorta({ titulo, porciones, ancho = 760, alto = 520 }: { titulo: string; porciones: PorcionTorta[]; ancho?: number; alto?: number }): string {
    const total = porciones.reduce((acc, p) => acc + Math.max(0, p.valor), 0);
    const cx = ancho / 2;
    const cy = alto / 2 + 4;
    const radio = Math.min(ancho, alto) * 0.3;
    const partes: string[] = [`<rect width="${ancho}" height="${alto}" fill="#fff"/>`];
    partes.push(`<text x="${cx}" y="34" text-anchor="middle" font-size="20" font-weight="700">${esc(titulo)}</text>`);

    // Empieza a las 12 en punto y gira en sentido horario, como Excel.
    let angulo = -Math.PI / 2;
    porciones.forEach((porcion, i) => {
        const fraccion = total > 0 ? Math.max(0, porcion.valor) / total : 0;
        if (fraccion <= 0) {
            return;
        }
        const color = PALETA_TORTA[i % PALETA_TORTA.length];
        const fin = angulo + fraccion * Math.PI * 2;
        if (fraccion >= 0.9999) {
            partes.push(`<circle cx="${cx}" cy="${cy}" r="${radio}" fill="${color}" stroke="#fff" stroke-width="1.5"/>`);
        } else {
            const [x1, y1] = [cx + radio * Math.cos(angulo), cy + radio * Math.sin(angulo)];
            const [x2, y2] = [cx + radio * Math.cos(fin), cy + radio * Math.sin(fin)];
            partes.push(`<path d="M${cx},${cy} L${r1(x1)},${r1(y1)} A${radio},${radio} 0 ${fraccion > 0.5 ? 1 : 0} 1 ${r1(x2)},${r1(y2)} Z" fill="${color}" stroke="#fff" stroke-width="1.5"/>`);
        }
        const medio = (angulo + fin) / 2;
        const [ex, ey] = [cx + radio * 1.18 * Math.cos(medio), cy + radio * 1.18 * Math.sin(medio)];
        partes.push(
            `<text x="${r1(ex)}" y="${r1(ey + 4)}" text-anchor="${Math.cos(medio) >= 0 ? 'start' : 'end'}" font-size="14">${esc(porcion.nombre)}; ${pct(porcion.valor / (total || 1))}</text>`,
        );
        angulo = fin;
    });

    const paso = Math.min(170, (ancho - 40) / Math.max(1, porciones.length));
    const x0 = (ancho - paso * porciones.length) / 2;
    porciones.forEach((porcion, i) => {
        const lx = x0 + i * paso;
        partes.push(`<rect x="${r1(lx)}" y="${alto - 30}" width="10" height="10" fill="${PALETA_TORTA[i % PALETA_TORTA.length]}"/>`);
        partes.push(`<text x="${r1(lx + 15)}" y="${alto - 21}" font-size="13">${esc(porcion.nombre)}</text>`);
    });

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}" font-family="${FUENTE}" fill="#000">${partes.join('')}</svg>`;
}

/** Rasteriza un SVG a PNG (data URL) en el navegador, a doble resolución para que no se vea borroso. */
export async function svgAPng(svg: string, ancho: number, alto: number, escala = 2): Promise<string> {
    const imagen = new Image();
    await new Promise<void>((resolve, reject) => {
        imagen.onload = () => resolve();
        imagen.onerror = () => reject(new Error('No se pudo dibujar un gráfico del libro.'));
        imagen.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    });
    const lienzo = document.createElement('canvas');
    lienzo.width = ancho * escala;
    lienzo.height = alto * escala;
    const ctx = lienzo.getContext('2d');
    if (!ctx) {
        throw new Error('El navegador no permite dibujar los gráficos.');
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, lienzo.width, lienzo.height);
    ctx.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);

    return lienzo.toDataURL('image/png');
}
