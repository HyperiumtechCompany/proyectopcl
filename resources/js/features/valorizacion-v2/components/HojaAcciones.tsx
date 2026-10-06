import { Printer } from 'lucide-react';
import type { SheetDefinition } from '../config/sheets';
import { formatMonthYear } from '../lib/dates';
import { useValorizacionStore } from '../store/ValorizacionStoreProvider';
import { ExportarValorizacion } from './ExportarValorizacion';

const boton =
    'inline-flex min-h-8 items-center gap-1.5 rounded-md border border-stone-300 bg-white px-2.5 py-1 text-xs font-semibold text-stone-700 hover:border-orange-400 hover:text-orange-700 disabled:opacity-50 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200 dark:hover:text-orange-300';

/** Encabezado del expediente: el mismo para la impresión y para el Excel exportado. */
export function useEncabezadoExpediente(): string[] {
    const { periodo, fichaTecnica } = useValorizacionStore((state) => state.input);
    const { datosGenerales, contratista } = fichaTecnica;

    return [
        datosGenerales.obra || 'Obra sin nombre',
        `Valorización N°${String(periodo.numero).padStart(2, '0')} · ${formatMonthYear(periodo.mes)}`,
        [datosGenerales.entidad && `Entidad: ${datosGenerales.entidad}`, contratista.ejecutor && `Ejecutor: ${contratista.ejecutor}`, datosGenerales.cui && `CUI: ${datosGenerales.cui}`].filter(Boolean).join('   ·   '),
    ];
}

/**
 * Acciones sobre la valorización: exportar TODA la valorización a Excel (una
 * pestaña por hoja) e imprimir / guardar como PDF la hoja activa.
 */
export function HojaAcciones({ sheet, nombreDocumento }: { sheet: SheetDefinition; nombreDocumento: string }) {
    return (
        <div className="mb-3 flex flex-wrap items-center justify-end gap-2 print:hidden" data-export="skip">
            <span className="mr-auto hidden text-[11px] text-stone-500 sm:inline dark:text-stone-400">Hoja del Excel: {sheet.excelSheet}</span>
            <ExportarValorizacion nombreDocumento={nombreDocumento} className={boton} />
            <button type="button" className={boton} onClick={() => window.print()} title="Imprime esta hoja o elige «Guardar como PDF» en el diálogo">
                <Printer className="size-4" /> Imprimir hoja / PDF
            </button>
        </div>
    );
}

/** Encabezado que solo aparece al imprimir (la cabecera oscura de la app se oculta). */
export function EncabezadoImpresion({ sheet }: { sheet: SheetDefinition }) {
    const [obra, valorizacion, partes] = useEncabezadoExpediente();

    return (
        <div className="mb-3 hidden border-b-2 border-orange-500 pb-2 text-stone-900 print:block">
            <p className="text-[13px] font-bold uppercase">{obra}</p>
            <p className="text-[11px] font-semibold text-orange-700">
                {valorizacion} — {sheet.label}
            </p>
            {partes && <p className="text-[10px] text-stone-600">{partes}</p>}
        </div>
    );
}
