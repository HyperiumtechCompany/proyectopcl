import { Link2, Trash2, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePersonal } from '../../hooks/usePersonal';
import { formatDate, formatMonthYear } from '../../lib/dates';
import { newPartidaId } from '../../lib/presupuestoOps';
import { Chip } from '../../shared/Chip';
import { EditableCell } from '../../shared/EditableCell';
import { tableClasses as t } from '../../shared/table';
import { useValorizacionStore } from '../../store/ValorizacionStoreProvider';
import type { PersonaClave } from '../../types';
import type { EstadoDia } from './computeAsistencia';

const CELDA: Record<EstadoDia, string> = {
    asistio: 'bg-orange-500 hover:bg-orange-600',
    falta: 'bg-white ring-1 ring-inset ring-stone-300 hover:bg-stone-100 dark:bg-stone-900 dark:ring-stone-600',
    fuera: 'cursor-not-allowed bg-stone-200 bg-[repeating-linear-gradient(45deg,transparent,transparent_3px,rgba(0,0,0,0.06)_3px,rgba(0,0,0,0.06)_6px)] dark:bg-stone-800',
};

/** Hoja RH-EM: personal clave y cronograma de participación (asistencia) del mes valorizado. */
export default function RecursosHumanosSheet() {
    const { asistencia, mes, input } = usePersonal();
    const addPersona = useValorizacionStore((state) => state.addPersona);
    const updatePersona = useValorizacionStore((state) => state.updatePersona);
    const removePersona = useValorizacionStore((state) => state.removePersona);
    const toggleFalta = useValorizacionStore((state) => state.toggleFalta);
    const mesTitulo = formatMonthYear(`${mes}-01`);

    const nuevaPersona = (): PersonaClave => ({ id: newPartidaId().replace('p-', 'rh-'), nombre: 'NUEVO PROFESIONAL', cargo: 'CARGO', cantidad: 1, dni: '', cip: '' });
    const texto = (persona: PersonaClave, campo: 'cargo' | 'dni' | 'cip', label: string) => (
        <EditableCell label={`${label} ${persona.nombre}`} value={persona[campo] || null} onCommit={(valor) => updatePersona(persona.id, { [campo]: valor ?? '' })} />
    );

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                    <h2 className="text-lg font-bold text-stone-900 sm:text-xl dark:text-stone-50">Cronograma de participación de personal clave · {mesTitulo}</h2>
                    <p className="text-xs text-stone-500 sm:text-sm dark:text-stone-400">
                        Se asume asistencia en todos los días de obra; haz clic en un día para marcar o quitar una falta. Los días asistidos se calculan solos.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => addPersona(nuevaPersona())}
                    className="inline-flex items-center gap-1.5 rounded-md bg-stone-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900"
                >
                    <UserPlus className="size-3.5" /> Agregar profesional
                </button>
            </div>

            <div className={t.wrap}>
                <table className={cn(t.table, 'min-w-3xl')}>
                    <thead>
                        <tr>
                            {['Ítem', 'Profesional', 'Cargo', 'Cantidad', 'DNI', 'CIP', 'Días asistidos', ''].map((label, index) => (
                                <th key={label + index} className={cn(t.th, index === 3 || index === 6 ? 'text-right' : 'text-left')}>{label}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {asistencia.filas.map((fila, index) => (
                            <tr key={fila.persona.id}>
                                <td className={cn(t.td, 'font-mono')}>{index + 1}</td>
                                <td className={cn(t.td, 'min-w-64')}>
                                    {fila.persona.vinculoFT ? (
                                        <span className="inline-flex items-center gap-2">
                                            {fila.nombre}
                                            <Chip tone="neutral" title="Se toma de la Ficha Técnica (residente de obra)">
                                                <Link2 className="mr-0.5 size-3" /> FT
                                            </Chip>
                                        </span>
                                    ) : (
                                        <EditableCell label={`Nombre del profesional ${index + 1}`} value={fila.persona.nombre} onCommit={(nombre) => nombre && updatePersona(fila.persona.id, { nombre })} />
                                    )}
                                </td>
                                <td className={cn(t.td, 'min-w-56')}>{texto(fila.persona, 'cargo', 'Cargo')}</td>
                                <td className={cn(t.td, 'w-20')}>
                                    <EditableCell
                                        label={`Cantidad ${fila.nombre}`}
                                        kind="integer"
                                        value={String(fila.persona.cantidad)}
                                        onCommit={(valor) => valor && Number(valor) > 0 && updatePersona(fila.persona.id, { cantidad: Number(valor) })}
                                    />
                                </td>
                                <td className={cn(t.td, 'w-28')}>{texto(fila.persona, 'dni', 'DNI')}</td>
                                <td className={cn(t.td, 'w-24')}>{texto(fila.persona, 'cip', 'CIP')}</td>
                                <td className={cn(t.td, t.num, 'font-semibold text-stone-900 dark:text-stone-100')}>{String(fila.diasAsistidos).padStart(2, '0')}</td>
                                <td className={cn(t.td, 'w-8')}>
                                    {!fila.persona.vinculoFT && (
                                        <button
                                            type="button"
                                            onClick={() => window.confirm(`¿Quitar a ${fila.nombre}? Puedes deshacerlo con Ctrl+Z.`) && removePersona(fila.persona.id)}
                                            aria-label={`Quitar ${fila.nombre}`}
                                            className="rounded p-1 text-stone-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                                        >
                                            <Trash2 className="size-3.5" />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className={t.wrap}>
                <table className="w-full min-w-4xl border-separate border-spacing-0 text-[11px] text-stone-700 dark:text-stone-300">
                    <thead>
                        <tr>
                            <th rowSpan={2} className={cn(t.th, 'sticky left-0 z-10 min-w-56 text-left')}>Profesional</th>
                            {asistencia.dias.map((dia) => (
                                <th key={dia.fecha} className={cn(t.th, 'px-0 text-center', dia.domingo && 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300')}>{dia.letra}</th>
                            ))}
                            <th rowSpan={2} className={cn(t.th, 'text-right')}>Total días</th>
                        </tr>
                        <tr>
                            {asistencia.dias.map((dia) => (
                                <th key={dia.fecha} className={cn(t.th, 'px-0 text-center font-mono', dia.domingo && 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300')}>{dia.dia}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {asistencia.filas.map((fila) => (
                            <tr key={fila.persona.id}>
                                <td className={cn(t.td, 'sticky left-0 z-10 bg-white text-[12px] dark:bg-stone-900')}>
                                    <p className="font-medium text-stone-900 dark:text-stone-100">{fila.nombre}</p>
                                    <p className="text-[10px] text-stone-500">{fila.persona.cargo}</p>
                                </td>
                                {asistencia.dias.map((dia) => {
                                    const estado = fila.dias[dia.fecha];

                                    return (
                                        <td key={dia.fecha} className={cn('border-b border-stone-100 p-0.5 dark:border-stone-800', dia.domingo && 'bg-red-50/60 dark:bg-red-500/5')}>
                                            <button
                                                type="button"
                                                disabled={estado === 'fuera'}
                                                onClick={() => toggleFalta(fila.persona.id, dia.fecha)}
                                                title={`${dia.fecha} · ${estado === 'asistio' ? 'Asistió' : estado === 'falta' ? 'Falta' : 'Fuera del plazo de obra'}`}
                                                aria-label={`${fila.nombre} ${dia.fecha}: ${estado}`}
                                                className={cn('block h-6 w-full min-w-5 rounded-sm transition-colors', CELDA[estado])}
                                            />
                                        </td>
                                    );
                                })}
                                <td className={cn(t.td, t.num, 'font-semibold text-stone-900 dark:text-stone-100')}>{fila.diasAsistidos}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="flex flex-wrap gap-4 text-[11px] text-stone-600 dark:text-stone-400">
                <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-sm bg-orange-500" /> Asistió</span>
                <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-sm bg-white ring-1 ring-stone-300 dark:bg-stone-900" /> Falta</span>
                <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-sm bg-red-100 dark:bg-red-500/20" /> Domingo (cuenta como día de obra)</span>
                <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-sm bg-stone-200 dark:bg-stone-800" /> Fuera del plazo de obra (inicio {formatDate(input.fichaTecnica.plazos.fechaInicioObra)})</span>
            </div>
        </div>
    );
}
