import type { ContextoLibro } from './contexto';
import { bordes, C0, cabecera, celda, COLOR, encabezadoExpediente, FMT, nuevaHoja, rango, titulo } from './estilo';
import type { CeldaCabecera } from './estilo';

const FONDO_FUERA = 'FFF2F2F2';

/** RH-EM: personal clave (días asistidos) y cronograma diario de participación. */
export function hojaPersonal(ctx: ContextoLibro): void {
    const { asistencia } = ctx.d;
    const dias = asistencia.dias;
    const ws = nuevaHoja(ctx.wb, 'RH-EM', [6, 34, 28, 10, 10, ...dias.map(() => 3.3), 7]);
    const colDia = C0 + 5;
    const ultima = colDia + dias.length;
    let f = titulo(ws, 1, `Cronograma de participación de personal clave - ${ctx.mesCorto}`, ultima);
    f = encabezadoExpediente(ws, f + 1, ctx.exp, ultima);

    // Tabla 1: días asistidos en el mes.
    cabecera(ws, [
        { texto: 'PERSONAL CLAVE', fila: f, col: C0, cols: 5, fondo: COLOR.cabeceraGris },
        ...['ÍTEM', 'PROFESIONALES', 'CARGO', 'CANTIDAD', 'DÍAS ASISTIDOS EN EL MES'].map((texto, i): CeldaCabecera => ({ texto, fila: f + 1, col: C0 + i, fondo: COLOR.cabeceraGris })),
    ]);
    ws.getRow(f + 1).height = 30;
    f += 2;
    asistencia.filas.forEach((fila, i) => {
        celda(ws, f, C0, i + 1, { alineacion: 'center', borde: 'fino' });
        celda(ws, f, C0 + 1, fila.nombre.toUpperCase(), { borde: 'fino', ajustar: true });
        celda(ws, f, C0 + 2, fila.persona.cargo.toUpperCase(), { borde: 'fino', ajustar: true });
        celda(ws, f, C0 + 3, fila.persona.cantidad, { alineacion: 'center', formato: FMT.entero, borde: 'fino' });
        celda(ws, f, C0 + 4, fila.diasAsistidos, { alineacion: 'center', formato: FMT.entero, borde: 'fino' });
        ws.getRow(f).height = 30;
        f++;
    });
    f += 2;

    // Tabla 2: cronograma diario (verde = asistió, rojo = domingo, F = falta).
    cabecera(ws, [
        { texto: 'PERSONAL CLAVE', fila: f, col: C0, cols: 5, fondo: COLOR.cabeceraGris },
        { texto: '', fila: f, col: colDia, cols: dias.length, fondo: COLOR.cabeceraGris },
        { texto: 'TOTAL DÍAS', fila: f, col: ultima, filas: 3, fondo: COLOR.cabeceraGris },
        ...['ÍTEM', 'PROFESIONALES', 'CARGO', 'DNI', 'CIP'].map((texto, i): CeldaCabecera => ({ texto, fila: f + 1, col: C0 + i, filas: 2, fondo: COLOR.cabeceraGris })),
        ...dias.flatMap((dia, i): CeldaCabecera[] => {
            const fondo = dia.domingo ? COLOR.domingo : COLOR.blanco;

            return [
                { texto: dia.letra, fila: f + 1, col: colDia + i, fondo },
                { texto: String(dia.dia), fila: f + 2, col: colDia + i, fondo },
            ];
        }),
    ]);
    f += 3;
    asistencia.filas.forEach((fila, i) => {
        celda(ws, f, C0, i + 1, { alineacion: 'center', borde: 'fino' });
        celda(ws, f, C0 + 1, fila.nombre.toUpperCase(), { borde: 'fino', ajustar: true });
        celda(ws, f, C0 + 2, fila.persona.cargo.toUpperCase(), { borde: 'fino', ajustar: true });
        celda(ws, f, C0 + 3, fila.persona.dni, { alineacion: 'center', borde: 'fino' });
        celda(ws, f, C0 + 4, fila.persona.cip, { alineacion: 'center', borde: 'fino' });
        dias.forEach((dia, j) => {
            const estado = fila.dias[dia.fecha];
            const fondo = estado === 'asistio' ? (dia.domingo ? COLOR.domingo : COLOR.asistio) : estado === 'falta' ? COLOR.blanco : FONDO_FUERA;
            celda(ws, f, colDia + j, estado === 'falta' ? 'F' : null, { fondo, alineacion: 'center', borde: 'fino', negrita: true, color: 'FFC00000', tamano: 9 });
        });
        celda(ws, f, ultima, fila.diasAsistidos, { alineacion: 'center', borde: 'fino', negrita: true });
        ws.getRow(f).height = 30;
        f++;
    });
    bordes(ws, f - asistencia.filas.length, C0, f - 1, ultima);
    rango(ws, f + 1, C0, f + 1, ultima, `Leyenda: verde = asistió · rojo = domingo · F = falta · gris = fuera del plazo de obra. Días de obra en el mes: ${asistencia.diasDeObra}.`, { cursiva: true, tamano: 9 });
}
