import React, { useState, useRef, useEffect } from 'react';
import { gantt } from 'dhtmlx-gantt';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

interface WorkDays {
    lunes: boolean;
    martes: boolean;
    miercoles: boolean;
    jueves: boolean;
    viernes: boolean;
    sabado: boolean;
    domingo: boolean;
}

// FIX: el contrato de onApply se simplifica — el modal solo notifica
// las fechas al padre. Toda la lógica de configurar el gantt se hace
// aquí adentro para no duplicarla entre modal y componente padre.
interface Props {
    isOpen: boolean;
    onClose: () => void;
    onApply: (settings: { projectStart?: string; projectEnd?: string }) => void;
}

// Mapeo nombre de día → número (0=domingo, 1=lunes, ..., 6=sábado)
const DAY_MAP: Record<keyof WorkDays, number> = {
    domingo: 0,
    lunes: 1,
    martes: 2,
    miercoles: 3,
    jueves: 4,
    viernes: 5,
    sabado: 6,
};

// Orden visual de los días en el modal
const DAY_LABELS: [keyof WorkDays, string][] = [
    ['lunes', 'Lunes'],
    ['martes', 'Martes'],
    ['miercoles', 'Miércoles'],
    ['jueves', 'Jueves'],
    ['viernes', 'Viernes'],
    ['sabado', 'Sábado'],
    ['domingo', 'Domingo'],
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPER — construye la configuración de escalas
// ─────────────────────────────────────────────────────────────────────────────
function buildScaleConfig(topUnit: string, bottomUnit: string): any[] {
    const DAY_FORMAT = '%j %D';

    const configs: Record<string, any[]> = {
        'year-month': [{ unit: 'year', step: 1, format: '%Y' }, { unit: 'month', step: 1, format: '%F' }],
        'year-week': [{ unit: 'year', step: 1, format: '%Y' }, { unit: 'week', step: 1, format: 'Sem %W' }],
        'year-day': [{ unit: 'year', step: 1, format: '%Y' }, { unit: 'month', step: 1, format: '%F' }, { unit: 'day', step: 1, format: DAY_FORMAT }],
        'quarter-month': [{ unit: 'year', step: 1, format: '%Y' }, { unit: 'month', step: 3, format: 'Trim %q' }],
        'quarter-week': [{ unit: 'year', step: 1, format: '%Y' }, { unit: 'month', step: 3, format: 'Trim %q' }, { unit: 'week', step: 1, format: 'Sem %W' }],
        'month-week': [{ unit: 'month', step: 1, format: '%F %Y' }, { unit: 'week', step: 1, format: 'Sem %W' }],
        'month-day': [{ unit: 'month', step: 1, format: '%F %Y' }, { unit: 'day', step: 1, format: DAY_FORMAT }],
    };

    return configs[`${topUnit}-${bottomUnit}`] ?? configs['month-day'];
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER — lee el estado actual del gantt para inicializar el formulario
// Así cuando el usuario abre el modal por segunda vez ve la config real,
// no los valores por defecto.
// ─────────────────────────────────────────────────────────────────────────────
function readCurrentWorkDays(): WorkDays {
    // Si el gantt no está inicializado, devolver valores por defecto
    if (!gantt || typeof gantt.isWorkTime !== 'function') {
        return {
            lunes: true, martes: true, miercoles: true,
            jueves: true, viernes: true, sabado: false, domingo: false,
        };
    }

    try {
        // Usar getWorkTime que es más estable
        const getDayStatus = (day: number): boolean => {
            try {
                const result = (gantt as any).getWorkTime(day);
                return result !== false && result !== null;
            } catch {
                return day >= 1 && day <= 5;
            }
        };

        return {
            lunes: getDayStatus(1),
            martes: getDayStatus(2),
            miercoles: getDayStatus(3),
            jueves: getDayStatus(4),
            viernes: getDayStatus(5),
            sabado: getDayStatus(6),
            domingo: getDayStatus(0),
        };
    } catch (e) {
        return {
            lunes: true, martes: true, miercoles: true,
            jueves: true, viernes: true, sabado: false, domingo: false,
        };
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// ICONO CALENDARIO
// ─────────────────────────────────────────────────────────────────────────────
const CalendarIcon = ({ className, onClick }: { className?: string; onClick?: () => void }) => (
    <svg
        className={className}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        onClick={onClick}
    >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export const ProjectSettingsModal = ({ isOpen, onClose, onApply }: Props) => {

    const startDateRef = useRef<HTMLInputElement>(null);
    const endDateRef = useRef<HTMLInputElement>(null);

    // ── Estado del formulario ─────────────────────────────────────────────────
    const [topUnit, setTopUnit] = useState('month');
    const [bottomUnit, setBottomUnit] = useState('week');
    const [workStartTime, setWorkStartTime] = useState('08:00');
    const [workEndTime, setWorkEndTime] = useState('17:00');
    const [projectStart, setProjectStart] = useState('');
    const [projectEnd, setProjectEnd] = useState('');
    const [scheduleFromEnd, setScheduleFromEnd] = useState(false);
    const [workDays, setWorkDays] = useState<WorkDays>({
        lunes: true, martes: true, miercoles: true,
        jueves: true, viernes: true, sabado: false, domingo: false,
    });

    // FIX: al abrir el modal, leer el estado real del gantt en lugar de
    // mostrar siempre los valores por defecto.
    useEffect(() => {
        if (!isOpen) return;

        // Leer días laborables actuales del gantt
        setWorkDays(readCurrentWorkDays());

        // 🔥 NO leer fechas del Gantt - dejar campos vacíos
        setProjectStart('');
        setProjectEnd('');
    }, [isOpen]);

    // Abrir el selector de fecha nativo del navegador
    const openCalendar = (ref: React.RefObject<HTMLInputElement>) => {
        if (!ref.current) return;
        if (typeof ref.current.showPicker === 'function') {
            ref.current.showPicker();
        } else {
            ref.current.click();
        }
    };

    const toggleDay = (key: keyof WorkDays) =>
        setWorkDays((prev) => ({ ...prev, [key]: !prev[key] }));

    // ── Aplicar ajustes ───────────────────────────────────────────────────────
    // Toda la configuración del gantt se hace aquí.
    // El padre (CronogramaIndex) solo recibe las fechas para actualizar
    // su config.start_date / config.end_date y hacer render.
    // Así no hay doble ejecución de lógica entre modal y padre.
    const aplicarAjustes = () => {
        try {
            // 1. Escala de tiempo
            (gantt.config as any).scales = buildScaleConfig(topUnit, bottomUnit);

            // 2. Días laborables — resetear todos primero, luego activar los marcados
            for (let i = 0; i <= 6; i++) {
                gantt.setWorkTime({ day: i, hours: false } as any);
            }
            (Object.entries(workDays) as [keyof WorkDays, boolean][]).forEach(([name, active]) => {
                if (active) {
                    gantt.setWorkTime({
                        day: DAY_MAP[name],
                        hours: [`${workStartTime}-${workEndTime}`],
                    } as any);
                }
            });

            // 3. Modo de programación

            (gantt.config as any).schedule_from_end = scheduleFromEnd;
            gantt.config.skip_off_time = true;  // ← Cambiar de false a true
            gantt.config.work_time = true;

            // 4. Desplazar tareas si cambió la fecha de inicio
            if (projectStart) {
                const newStart = new Date(projectStart);
                let minTaskStart: Date | null = null;

                gantt.eachTask((task: any) => {
                    if (task.start_date) {
                        const s = new Date(task.start_date);
                        if (!minTaskStart || s < minTaskStart) minTaskStart = s;
                    }
                });

                if (minTaskStart) {
                    const diff = newStart.getTime() - (minTaskStart as Date).getTime();
                    if (diff !== 0) {
                        gantt.batchUpdate(() => {
                            gantt.eachTask((task: any) => {
                                task.start_date = new Date(new Date(task.start_date).getTime() + diff);
                                task.end_date = new Date(new Date(task.end_date).getTime() + diff);
                                gantt.updateTask(task.id);
                            });
                        });
                    }
                }
            }

            // 5. Recalcular fechas de fin
            gantt.batchUpdate(() => {
                gantt.eachTask((task: any) => {
                    if (!gantt.hasChild(task.id) && task.start_date && task.duration) {
                        task.end_date = gantt.calculateEndDate({
                            start_date: task.start_date,
                            duration: Number(task.duration),
                            task,
                        } as any);
                        gantt.updateTask(task.id);
                    }
                });
            });

            // 🔥 LOGS PARA DEPURAR
            console.log('🔍 Modal - projectStart:', projectStart);
            console.log('🔍 Modal - projectEnd:', projectEnd);

            const validStart = projectStart && projectStart !== '' ? projectStart : undefined;
            const validEnd = projectEnd && projectEnd !== '' ? projectEnd : undefined;

            console.log('📤 Modal - enviando:', { validStart, validEnd });
            // 🔥 FIN LOGS

            onApply({
                projectStart: validStart,
                projectEnd: validEnd
            });

        } catch (error) {
            console.error('[ProjectSettingsModal] aplicarAjustes:', error);
        }
    };

    if (!isOpen) return null;

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div
            className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden">

                {/* Cabecera */}
                <div className="bg-gray-100 px-5 py-4 border-b flex justify-between items-center">
                    <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                        Configuración del Proyecto
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                        aria-label="Cerrar"
                    >
                        &times;
                    </button>
                </div>

                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">

                    {/* Escala de tiempo */}
                    <section>
                        <SectionTitle>Escala de Tiempo</SectionTitle>
                        <div className="grid grid-cols-2 gap-4">
                            <Field label="Capa Superior">
                                <select value={topUnit} onChange={(e) => setTopUnit(e.target.value)} className={selectCls}>
                                    <option value="year">Año</option>
                                    <option value="quarter">Trimestre</option>
                                    <option value="month">Mes</option>
                                </select>
                            </Field>
                            <Field label="Capa Inferior">
                                <select value={bottomUnit} onChange={(e) => setBottomUnit(e.target.value)} className={selectCls}>
                                    <option value="month">Mes</option>
                                    <option value="week">Semana</option>
                                    <option value="day">Día</option>
                                </select>
                            </Field>
                        </div>
                    </section>

                    {/* Fechas del proyecto */}
                    <section>
                        <SectionTitle>Fechas del Proyecto</SectionTitle>
                        <div className="grid grid-cols-2 gap-4">
                            <Field label="Inicio del Proyecto">
                                <div className="relative">
                                    <input
                                        ref={startDateRef}
                                        type="date"
                                        value={projectStart}
                                        onChange={(e) => setProjectStart(e.target.value)}
                                        className={`${inputCls} pl-9`}
                                    />
                                    <CalendarIcon
                                        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 cursor-pointer"
                                        onClick={() => openCalendar(startDateRef as any)}
                                    />
                                </div>
                            </Field>
                            <Field label="Fin Pronosticado">
                                <div className="relative">
                                    <input
                                        ref={endDateRef}
                                        type="date"
                                        value={projectEnd}
                                        onChange={(e) => setProjectEnd(e.target.value)}
                                        className={`${inputCls} pl-9`}
                                    />
                                    <CalendarIcon
                                        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 cursor-pointer"
                                        onClick={() => openCalendar(endDateRef as any)}
                                    />
                                </div>
                            </Field>
                        </div>

                        <label className="flex items-center gap-2 mt-3 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={scheduleFromEnd}
                                onChange={(e) => setScheduleFromEnd(e.target.checked)}
                                className="w-4 h-4 rounded accent-blue-600"
                            />
                            <span className="text-xs font-medium text-gray-700">Programar desde el Fin</span>
                        </label>
                    </section>

                    {/* Días laborales */}
                    <section>
                        <SectionTitle>Días Laborales</SectionTitle>
                        <div className="grid grid-cols-4 gap-3">
                            {DAY_LABELS.map(([key, label]) => (
                                <label
                                    key={key}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors text-xs font-medium select-none ${workDays[key]
                                        ? 'bg-blue-50 border-blue-400 text-blue-700'
                                        : 'bg-gray-50 border-gray-300 text-gray-500'
                                        }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={workDays[key]}
                                        onChange={() => toggleDay(key)}
                                        className="w-3.5 h-3.5 rounded accent-blue-600"
                                    />
                                    {label}
                                </label>
                            ))}
                        </div>
                    </section>

                    {/* Horario laboral */}
                    <section>
                        <SectionTitle>Horario Laboral</SectionTitle>
                        <div className="grid grid-cols-2 gap-4">
                            <Field label="Hora de Inicio">
                                <input
                                    type="time"
                                    value={workStartTime}
                                    onChange={(e) => setWorkStartTime(e.target.value)}
                                    className={inputCls}
                                />
                            </Field>
                            <Field label="Hora de Fin">
                                <input
                                    type="time"
                                    value={workEndTime}
                                    onChange={(e) => setWorkEndTime(e.target.value)}
                                    className={inputCls}
                                />
                            </Field>
                        </div>
                    </section>
                </div>

                {/* Pie */}
                <div className="bg-gray-50 px-5 py-4 border-t flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-bold text-gray-500 uppercase hover:text-gray-700 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={aplicarAjustes}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md text-xs font-black uppercase shadow-md transition-colors"
                    >
                        Guardar Cambios
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTES
// ─────────────────────────────────────────────────────────────────────────────
const selectCls = 'w-full border border-gray-300 rounded-md p-2 text-sm text-gray-900 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none';
const inputCls = 'w-full border border-gray-300 rounded-md p-2 text-sm text-gray-900 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none';

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <h3 className="text-[11px] font-black text-blue-600 border-b border-blue-100 mb-4 pb-1 uppercase tracking-wider">
        {children}
    </h3>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex flex-col gap-1.5">
        <label className="text-[10px] text-gray-500 font-bold uppercase">{label}</label>
        {children}
    </div>
);