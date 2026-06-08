import { gantt } from 'dhtmlx-gantt';
import React, { useState, useRef, useEffect, useCallback } from 'react';

interface WorkDays {
    lunes: boolean;
    martes: boolean;
    miercoles: boolean;
    jueves: boolean;
    viernes: boolean;
    sabado: boolean;
    domingo: boolean;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onApply: (settings: {
        projectStart?: string;
        projectEnd?: string;
        projectDuration?: number;
        holidays?: any[];
        workDays?: any;
        workStartTime?: string;
        workEndTime?: string;
        scheduleFromEnd?: boolean;
    }) => void;
}

const DAY_MAP: Record<keyof WorkDays, number> = {
    domingo: 0,
    lunes: 1,
    martes: 2,
    miercoles: 3,
    jueves: 4,
    viernes: 5,
    sabado: 6,
};

const DAY_LABELS: [keyof WorkDays, string][] = [
    ['lunes', 'Lunes'],
    ['martes', 'Martes'],
    ['miercoles', 'Miércoles'],
    ['jueves', 'Jueves'],
    ['viernes', 'Viernes'],
    ['sabado', 'Sábado'],
    ['domingo', 'Domingo'],
];

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

function readCurrentWorkDays(): WorkDays {
    if (!gantt || typeof gantt.isWorkTime !== 'function') {
        return { lunes: true, martes: true, miercoles: true, jueves: true, viernes: true, sabado: false, domingo: false };
    }
    try {
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
    } catch {
        return { lunes: true, martes: true, miercoles: true, jueves: true, viernes: true, sabado: false, domingo: false };
    }
}

function dateToInputValue(date: Date | null | undefined): string {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

const CalendarIcon = ({ className, onClick }: { className?: string; onClick?: () => void }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" onClick={onClick}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
);

let _savedStart = '';
let _savedEnd = '';
let _savedTopUnit = 'month';
let _savedBottomUnit = 'day';
let _savedWorkStart = '08:00';
let _savedWorkEnd = '17:00';
let _savedScheduleFromEnd = false;
let _savedHolidays: { date: string; name: string; checked: boolean; custom: boolean }[] = [];
let _savedWorkDays: WorkDays = {
    lunes: true, martes: true, miercoles: true,
    jueves: true, viernes: true, sabado: false, domingo: false,
};
let _savedDuration: number | null = null;

export const ProjectSettingsModal = ({ isOpen, onClose, onApply }: Props) => {

    const startDateRef = useRef<HTMLInputElement>(null);
    const [topUnit, setTopUnit] = useState(_savedTopUnit);
    const [bottomUnit, setBottomUnit] = useState(_savedBottomUnit);
    const [workStartTime, setWorkStartTime] = useState(_savedWorkStart);
    const [workEndTime, setWorkEndTime] = useState(_savedWorkEnd);
    const [projectStart, setProjectStart] = useState(_savedStart);
    const [projectEnd, setProjectEnd] = useState(_savedEnd);
    const [scheduleFromEnd, setScheduleFromEnd] = useState(_savedScheduleFromEnd);
    const [workDays, setWorkDays] = useState<WorkDays>({
        lunes: true, martes: true, miercoles: true,
        jueves: true, viernes: true, sabado: false, domingo: false,
    });

    const [holidays, setHolidays] = useState<{ date: string; name: string; checked: boolean; custom: boolean }[]>([]);
    const [holidayYear, setHolidayYear] = useState(2026);
    const [holidayOpen, setHolidayOpen] = useState(false);
    const [newHolidayDate, setNewHolidayDate] = useState('');
    const [newHolidayName, setNewHolidayName] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [projectDuration, setProjectDuration] = useState<number | null>(null);
    const [calculatedEndDate, setCalculatedEndDate] = useState<string>('');

    // ref para saber si el último cambio fue manual en duración o en días laborables
    const lastChangedRef = useRef<'duration' | 'days'>('duration');

    const FERIADOS_PERU_2026 = [
        { date: '01-01', name: 'Año Nuevo' },
        { date: '19-03', name: 'San José' },
        { date: '05-01', name: 'Día del Trabajo' },
        { date: '29-06', name: 'San Pedro y San Pablo' },
        { date: '28-07', name: 'Fiestas Patrias' },
        { date: '29-07', name: 'Fiestas Patrias' },
        { date: '30-08', name: 'Santa Rosa de Lima' },
        { date: '08-10', name: 'Combate de Angamos' },
        { date: '01-11', name: 'Todos los Santos' },
        { date: '08-12', name: 'Inmaculada Concepción' },
        { date: '25-12', name: 'Navidad' },
    ];

    function buildHolidaysForYear(year: number) {
        return FERIADOS_PERU_2026.map(h => ({
            date: `${year}-${h.date}`,
            name: h.name,
            checked: false,
            custom: false,
        }));
    }

    const calcularFinLaborable = useCallback((fechaInicio: string, diasTotales: number, diasConfig: WorkDays, feriadosList: any[]): string => {
        if (!fechaInicio || diasTotales <= 0) return '';
        const inicio = new Date(fechaInicio + 'T00:00:00');
        if (isNaN(inicio.getTime())) return '';

        const esLaborable: boolean[] = [
            diasConfig.domingo,
            diasConfig.lunes,
            diasConfig.martes,
            diasConfig.miercoles,
            diasConfig.jueves,
            diasConfig.viernes,
            diasConfig.sabado,
        ];

        const feriadosSet = new Set<string>();
        feriadosList.forEach(feriado => {
            if (feriado.checked && feriado.date) {
                const fechaFeriado = new Date(feriado.date);
                if (!isNaN(fechaFeriado.getTime())) {
                    feriadosSet.add(fechaFeriado.toISOString().split('T')[0]);
                }
            }
        });

        const fechaActual = new Date(inicio);
        let diasAgregados = 0;

        //  Contar el día de inicio SIN saltarlo
        while (diasAgregados < diasTotales) {
            const diaSemana = fechaActual.getDay();
            const fechaStr = fechaActual.toISOString().split('T')[0];
            if (esLaborable[diaSemana] && !feriadosSet.has(fechaStr)) {
                diasAgregados++;
            }
            if (diasAgregados < diasTotales) {
                fechaActual.setDate(fechaActual.getDate() + 1);
            }
        }

        const year = fechaActual.getFullYear();
        const month = String(fechaActual.getMonth() + 1).padStart(2, '0');
        const day = String(fechaActual.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }, []);

    const contarDiasLaborables = useCallback((inicio: string, fin: string, diasConfig: WorkDays, feriadosList: any[]): number => {
        const start = new Date(inicio);
        const end = new Date(fin);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;

        const esLaborable: boolean[] = [
            diasConfig.domingo,
            diasConfig.lunes,
            diasConfig.martes,
            diasConfig.miercoles,
            diasConfig.jueves,
            diasConfig.viernes,
            diasConfig.sabado,
        ];

        const feriadosSet = new Set<string>();
        feriadosList.forEach(h => {
            if (h.checked && h.date) {
                const f = new Date(h.date);
                if (!isNaN(f.getTime())) feriadosSet.add(f.toISOString().split('T')[0]);
            }
        });

        const fecha = new Date(start);
        let dias = 0;

        //  CORRECCIÓN: Contar el día de inicio también
        while (fecha <= end) {
            const str = fecha.toISOString().split('T')[0];
            if (esLaborable[fecha.getDay()] && !feriadosSet.has(str)) {
                dias++;
            }
            fecha.setDate(fecha.getDate() + 1);
        }
        return Math.max(1, dias);
    }, []);
    useEffect(() => {
        if (!isOpen) return;
        setWorkDays(_savedWorkDays);
        setProjectStart(_savedStart);
        setProjectEnd(_savedEnd);
        setTopUnit(_savedTopUnit);
        setBottomUnit(_savedBottomUnit);
        setWorkStartTime(_savedWorkStart);
        setWorkEndTime(_savedWorkEnd);
        setScheduleFromEnd(_savedScheduleFromEnd);
        setProjectDuration(_savedDuration);
        lastChangedRef.current = 'duration';
        if (_savedHolidays.length > 0) {
            setHolidays(_savedHolidays);
        } else {
            setHolidays(buildHolidaysForYear(2026));
        }
    }, [isOpen]);

    // Cuando cambia duración o fecha inicio → recalcula fecha fin
    useEffect(() => {
        if (lastChangedRef.current !== 'duration') return;
        if (projectStart && projectDuration && projectDuration > 0) {
            const fecha = calcularFinLaborable(projectStart, projectDuration, workDays, holidays);
            setCalculatedEndDate(fecha);
        } else {
            setCalculatedEndDate('');
        }
    }, [projectStart, projectDuration]);

    // Cuando cambia días laborables o feriados → recalcula DURACIÓN manteniendo fecha fin
    useEffect(() => {
        lastChangedRef.current = 'days';
        if (!projectStart || !calculatedEndDate) return;
        const nueva = contarDiasLaborables(projectStart, calculatedEndDate, workDays, holidays);
        setProjectDuration(nueva);
    }, [workDays, holidays]);

    const openCalendar = (ref: React.RefObject<HTMLInputElement | null>) => {
        if (!ref.current) return;
        if (typeof ref.current.showPicker === 'function') {
            ref.current.showPicker();
        } else {
            ref.current.click();
        }
    };

    const toggleDay = (key: keyof WorkDays) =>
        setWorkDays((prev) => ({ ...prev, [key]: !prev[key] }));

    const aplicarAjustes = () => {
        try {
            const duracionValida = projectDuration !== null && !isNaN(projectDuration) && projectDuration > 0
                ? parseInt(String(projectDuration), 10)
                : null;

            _savedStart = projectStart;
            _savedEnd = projectEnd;
            _savedTopUnit = topUnit;
            _savedBottomUnit = bottomUnit;
            _savedWorkStart = workStartTime;
            _savedWorkEnd = workEndTime;
            _savedScheduleFromEnd = scheduleFromEnd;
            _savedWorkDays = { ...workDays };
            _savedHolidays = holidays;
            _savedDuration = duracionValida;
            (gantt.config as any).scales = buildScaleConfig(topUnit, bottomUnit);

            onApply({
                projectStart: projectStart || undefined,
                projectEnd: projectEnd || undefined,
                projectDuration: duracionValida ?? undefined,
                holidays,
                workDays: { ...workDays },
                workStartTime,
                workEndTime,
                scheduleFromEnd,
            });
        } catch (error) {
            console.error('[ProjectSettingsModal] aplicarAjustes:', error);
        } finally {
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden">
                <div className="bg-gray-100 px-5 py-4 border-b flex justify-between items-center">
                    <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                        Configuración del Proyecto
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none" aria-label="Cerrar">
                        &times;
                    </button>
                </div>

                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
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

                    <section>
                        <SectionTitle>Duración del Proyecto</SectionTitle>
                        <div className="grid grid-cols-2 gap-4">
                            <Field label="Inicio del Proyecto">
                                <div className="relative">
                                    <input
                                        ref={startDateRef}
                                        type="date"
                                        value={projectStart}
                                        onChange={(e) => {
                                            lastChangedRef.current = 'duration';
                                            setProjectStart(e.target.value);
                                        }}
                                        className={`${inputCls} pl-9`}
                                    />
                                    <CalendarIcon
                                        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 cursor-pointer"
                                        onClick={() => openCalendar(startDateRef as any)}
                                    />
                                </div>
                            </Field>
                            <Field label="Duración (días laborables)">
                                <input
                                    type="number"
                                    value={projectDuration === null ? '' : projectDuration}
                                    onChange={(e) => {
                                        lastChangedRef.current = 'duration';
                                        setProjectDuration(e.target.value === '' ? null : parseInt(e.target.value));
                                    }}
                                    min="1"
                                    placeholder="Ej: 100"
                                    className={inputCls}
                                />
                            </Field>
                        </div>

                        {calculatedEndDate && projectStart && projectDuration && projectDuration > 0 && (
                            <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-blue-700 font-medium">📅 Fin estimado:</span>
                                    <span className="text-sm font-bold text-blue-800">{calculatedEndDate}</span>
                                </div>
                                <div className="flex justify-between items-center mt-1 pt-1 border-t border-blue-200">
                                    <span className="text-xs text-blue-600">📆 Días calendario totales:</span>
                                    <span className="text-sm font-semibold text-blue-700">
                                        {(() => {
                                            const start = new Date(projectStart);
                                            const end = new Date(calculatedEndDate);
                                            const diffTime = Math.abs(end.getTime() - start.getTime());
                                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                                            return `${diffDays} días`;
                                        })()}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center mt-1">
                                    <span className="text-xs text-blue-600">💼 Días laborables:</span>
                                    <span className="text-sm font-semibold text-blue-700">{projectDuration} días</span>
                                </div>
                            </div>
                        )}

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

                    <section style={{ position: 'relative' }} className="mb-6">
                        <SectionTitle>Días Feriados</SectionTitle>
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setHolidayOpen(!holidayOpen)}
                                className="w-full flex items-center justify-between px-3 py-2 text-xs border border-gray-300 rounded-md bg-white text-gray-700 hover:border-blue-400 transition-colors"
                            >
                                <span>
                                    {holidays.filter(h => h.checked).length} feriado{holidays.filter(h => h.checked).length !== 1 ? 's' : ''} activo{holidays.filter(h => h.checked).length !== 1 ? 's' : ''} — {holidayYear}
                                </span>
                                <span className="text-gray-500 text-[10px]">{holidayOpen ? '▲' : '▼'}</span>
                            </button>

                            {holidayOpen && (
                                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 overflow-hidden">
                                    <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50">
                                        <span className="text-[10px] text-gray-700 font-medium">Año:</span>
                                        <input
                                            type="number"
                                            value={holidayYear}
                                            onChange={e => setHolidayYear(Number(e.target.value))}
                                            className="w-16 text-[11px] px-2 py-1 border border-gray-300 rounded text-gray-800 bg-white"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setHolidays(buildHolidaysForYear(holidayYear))}
                                            className="text-[11px] px-2 py-1 border border-gray-300 rounded bg-white text-gray-700 hover:bg-gray-50"
                                        >
                                            Cargar
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setShowAddForm(!showAddForm)}
                                            className="text-[11px] px-2 py-1 border border-blue-200 rounded bg-blue-50 text-blue-600 hover:bg-blue-100"
                                        >
                                            + Personalizado
                                        </button>
                                    </div>

                                    {showAddForm && (
                                        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-blue-50">
                                            <input
                                                type="date"
                                                value={newHolidayDate}
                                                onChange={e => setNewHolidayDate(e.target.value)}
                                                className="text-[11px] px-2 py-1 border border-gray-300 rounded flex-1 text-gray-800"
                                            />
                                            <input
                                                type="text"
                                                placeholder="Nombre"
                                                value={newHolidayName}
                                                onChange={e => setNewHolidayName(e.target.value)}
                                                className="text-[11px] px-2 py-1 border border-gray-300 rounded flex-1 text-gray-800 placeholder:text-gray-400"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (!newHolidayDate || !newHolidayName) return;
                                                    setHolidays(prev => [...prev, { date: newHolidayDate, name: newHolidayName, checked: true, custom: true }]);
                                                    setNewHolidayDate('');
                                                    setNewHolidayName('');
                                                    setShowAddForm(false);
                                                }}
                                                className="text-[11px] px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                                            >
                                                Agregar
                                            </button>
                                        </div>
                                    )}

                                    <div className="max-h-44 overflow-y-auto">
                                        {holidays.map((h, i) => (
                                            <div key={i} className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-50 hover:bg-gray-50">
                                                <input
                                                    type="checkbox"
                                                    checked={h.checked}
                                                    onChange={() => setHolidays(prev => prev.map((x, j) => j === i ? { ...x, checked: !x.checked } : x))}
                                                    className="accent-blue-600 flex-shrink-0"
                                                />
                                                <span className="text-[10px] text-gray-600 w-20 flex-shrink-0">
                                                    {h.date.split('-').slice(1).reverse().join('/')}
                                                </span>
                                                <span className={`text-[11px] flex-1 ${h.checked ? 'text-gray-700 font-medium' : 'text-gray-400 line-through'}`}>
                                                    {h.name}
                                                </span>
                                                {h.custom && (
                                                    <span className="text-[9px] bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded-full border border-blue-100">custom</span>
                                                )}
                                                {h.custom && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setHolidays(prev => prev.filter((_, j) => j !== i))}
                                                        className="text-gray-400 hover:text-red-400 text-sm leading-none p-1"
                                                    >×</button>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    <div className="px-3 py-2 border-t border-gray-100 flex justify-end bg-gray-50">
                                        <button
                                            type="button"
                                            onClick={() => setHolidayOpen(false)}
                                            className="text-[11px] px-3 py-1 border border-gray-300 rounded bg-white text-gray-700 hover:bg-gray-100 transition-colors shadow-sm"
                                        >
                                            Cerrar
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>

                    <section>
                        <SectionTitle>Horario Laboral</SectionTitle>
                        <div className="grid grid-cols-2 gap-4">
                            <Field label="Hora de Inicio">
                                <input type="time" value={workStartTime} onChange={(e) => setWorkStartTime(e.target.value)} className={inputCls} />
                            </Field>
                            <Field label="Hora de Fin">
                                <input type="time" value={workEndTime} onChange={(e) => setWorkEndTime(e.target.value)} className={inputCls} />
                            </Field>
                        </div>
                    </section>
                </div>

                <div className="bg-gray-50 px-5 py-4 border-t flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-gray-500 uppercase hover:text-gray-700 transition-colors">
                        Cancelar
                    </button>
                    <button onClick={aplicarAjustes} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md text-xs font-black uppercase shadow-md transition-colors">
                        Guardar Cambios
                    </button>
                </div>
            </div>
        </div>
    );
};

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