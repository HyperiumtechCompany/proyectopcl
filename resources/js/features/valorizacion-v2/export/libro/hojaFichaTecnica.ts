import { D } from '../../lib/money';
import type { ModificacionPlazo } from '../../types';
import type { ContextoLibro } from './contexto';
import { C0, celda, fecha, FMT, num, nuevaHoja, rango, titulo } from './estilo';
import type { Valor } from './estilo';

const SIN_ADELANTO = 'NO SE OTORGÓ ADELANTO';

const modificaciones = (items: ModificacionPlazo[]): string =>
    items.length === 0 ? '-' : items.map((item) => `${item.documento || 'Sin documento'}: ${item.dias} días`).join('\n');

/** FT — FICHA TÉCNICA DEL PROYECTO: etiqueta : valor por secciones A–E. */
export function hojaFichaTecnica({ wb, d }: ContextoLibro): void {
    const ws = nuevaHoja(wb, 'FT', [44, 2, 92], true);
    const ultima = C0 + 2;
    const { datosGenerales: g, contratista: c, supervision: s, plazos: p, estado } = d.input.fichaTecnica;
    const { ficha, contrato } = d;
    let f = titulo(ws, 1, 'Ficha técnica del proyecto', ultima);

    const seccion = (texto: string) => {
        rango(ws, f, C0, f, ultima, texto, { negrita: true, tamano: 12 });
        f++;
    };
    const par = (etiqueta: string, valor: Valor, formato?: string) => {
        celda(ws, f, C0, etiqueta, { vertical: 'top' });
        celda(ws, f, C0 + 1, ':', { alineacion: 'center', vertical: 'top' });
        const texto = valor === null || valor === '' ? '-' : valor;
        celda(ws, f, C0 + 2, typeof texto === 'string' ? texto.toUpperCase() : texto, { formato, alineacion: 'left', vertical: 'top', ajustar: typeof texto === 'string' });
        if (typeof texto === 'string') {
            const lineas = texto.split('\n').reduce((acc, linea) => acc + Math.max(1, Math.ceil(linea.length / 95)), 0);
            if (lineas > 1) {
                ws.getRow(f).height = 15 * lineas;
            }
        }
        f++;
    };
    const monto = (valor: string | null) => (valor === null ? SIN_ADELANTO : num(D(valor)));

    seccion('A. DATOS GENERALES');
    par('Entidad', g.entidad);
    par('Obra', g.obra);
    par('Código único de inversión', g.cui);
    par('Aprobación del expediente técnico', g.resolucionAprobacion);
    par('Fecha de aprobación de expediente técnico', fecha(g.fechaAprobacionExpediente), FMT.fecha);
    par('Fecha de presupuesto base', fecha(g.fechaPresupuestoBase), 'mmm-yy');
    par('Ubicación', [`DEPARTAMENTO: ${g.ubicacion.departamento}`, `PROVINCIA: ${g.ubicacion.provincia}`, `DISTRITO: ${g.ubicacion.distrito}`, `LOCALIDAD: ${g.ubicacion.localidad}`].join('\n'));

    seccion('B. DEL CONTRATISTA EJECUTOR');
    par('Ejecutor', c.ejecutor);
    par('Representante común legal', c.representanteLegal);
    par('Domicilio legal', c.domicilioLegal);
    par('Proceso de selección', c.procesoSeleccion);
    par('Adjudicación de buena pro', fecha(c.fechaBuenaPro), FMT.fecha);
    par('Contrato', c.contrato);
    par('Fecha de firma del contrato', fecha(c.fechaFirmaContrato), FMT.fecha);
    par('Modalidad de ejecución', c.modalidadEjecucion);
    par('Sistema de contratación', c.sistemaContratacion);
    par('Valor referencial (con IGV)', num(contrato.referencial), FMT.moneda);
    par('Monto del contrato principal (incl. IGV)', num(contrato.principal), FMT.moneda);
    for (const mod of c.modificacionesContrato) {
        par(`${mod.tipo === 'adicional' ? 'Adicional' : 'Deductivo'} de obra (${mod.documento || 's/d'})`, num(D(mod.monto || 0)), FMT.moneda);
    }
    par('Monto del contrato vigente (incl. IGV)', num(contrato.vigente), FMT.moneda);
    par('Adelanto directo otorgado', monto(c.adelantoDirecto.monto), FMT.moneda);
    par('Fecha efectiva del adelanto directo', fecha(c.adelantoDirecto.fechaEfectiva), FMT.fecha);
    par('Adelanto de materiales otorgado', monto(c.adelantoMateriales.monto), FMT.moneda);
    par('Fecha efectiva del adelanto de materiales', fecha(c.adelantoMateriales.fechaEfectiva), FMT.fecha);
    par('Plazo de ejecución contractual', ficha.plazoContractualTexto);
    par('Residente de obra', c.residente);

    seccion('C. DE LA SUPERVISIÓN');
    par('Contratista', s.contratista);
    par('Ruc Nº', s.ruc);
    par('Representante legal', s.representanteLegal);
    par('Domicilio legal', s.domicilioLegal);
    par('Proceso de selección', s.procesoSeleccion);
    par('Fecha de cuantía de contratación', fecha(s.fechaCuantia), FMT.fecha);
    par('Contrato', s.contrato);
    par('Fecha de firma del contrato', fecha(s.fechaFirmaContrato), FMT.fecha);
    par('Valor referencial (incl. IGV)', num(D(s.valorReferencial || 0)), FMT.moneda);
    par('Monto del contrato original (incl. IGV)', num(D(s.montoContratoOriginal || 0)), FMT.moneda);
    par('Monto del contrato vigente (incl. IGV)', num(D(s.montoContratoVigente || 0)), FMT.moneda);
    par('Plazo de prestación del servicio', ficha.plazoServicioTexto);
    par('Supervisor de obra', s.supervisor);

    seccion('D. DE LOS PLAZOS DE EJECUCIÓN');
    par('Fecha de entrega de terreno', fecha(p.fechaEntregaTerreno), FMT.fecha);
    par('Fecha de inicio de ejecución de obra', fecha(p.fechaInicioObra), FMT.fecha);
    par('Plazo de ejecución', ficha.plazoEjecucionTexto);
    par('Fecha de término programado', fecha(ficha.fechaTerminoProgramado), FMT.fecha);
    par('Ampliaciones de plazo', modificaciones(p.ampliaciones));
    par('Suspensiones de plazo', modificaciones(p.suspensiones));
    if (ficha.fechaTerminoVigente !== ficha.fechaTerminoProgramado) {
        par('Fecha de término vigente', fecha(ficha.fechaTerminoVigente), FMT.fecha);
    }
    par('Fecha de término real', fecha(p.fechaTerminoReal), FMT.fecha);

    seccion('E. ESTADO SITUACIONAL DE LA OBRA');
    par('Forma de valorización', estado.formaValorizacion);
    par('Situación de la obra', estado.situacionObra);
    par('Avance físico acumulado programado', num(ficha.avance?.programado), FMT.pct);
    par('Avance físico acumulado ejecutado', num(ficha.avance?.ejecutado), FMT.pct);
    par('Situación del avance físico', ficha.avance?.texto ?? '-');

    // Marco exterior de la ficha, como en el expediente.
    for (let fila = 1; fila < f; fila++) {
        ws.getCell(fila, C0).border = { ...ws.getCell(fila, C0).border, left: { style: 'medium' } };
        ws.getCell(fila, ultima).border = { ...ws.getCell(fila, ultima).border, right: { style: 'medium' } };
    }
    for (let col = C0; col <= ultima; col++) {
        ws.getCell(f - 1, col).border = { ...ws.getCell(f - 1, col).border, bottom: { style: 'medium' } };
    }
}
